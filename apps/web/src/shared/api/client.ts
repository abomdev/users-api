import type { paths } from './schema.gen';
import { ApiError, NetworkError } from './api-error';
import { clearAccessToken, getAccessToken, setAccessToken } from './token-store';

type TokenPair = paths['/auth/refresh']['post']['responses']['200']['content']['application/json'];
type ErrorBody = paths['/auth/refresh']['post']['responses']['401']['content']['application/json'];

/**
 * Endpoints de ciclo de vida de la sesion: login, registro, refresh y logout.
 *
 * Un 401 en cualquiera de estos NO dispara refresh-y-reintento (RF-5). En
 * login/registro seria tratar una contrasena incorrecta como si la sesion
 * hubiera expirado; en refresh seria un bucle infinito refrescando el propio
 * refresh; en logout no tiene sentido renovar la sesion que se esta cerrando.
 */
const AUTH_LIFECYCLE_PATHS = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']);

let refreshing: Promise<TokenPair | null> | null = null;
const sessionExpiredListeners = new Set<() => void>();

/**
 * Se dispara cuando un refresh -- el que dispara automaticamente `request()`
 * ante un 401 -- termina fallando. Es la senal definitiva de que la sesion
 * murio; el store de auth (fase 15) se suscribe aca para redirigir a /login.
 *
 * Devuelve la funcion de desuscripcion, el patron habitual para no dejar un
 * listener colgado si el componente que se suscribio se desmonta.
 */
export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

async function doRefresh(): Promise<TokenPair | null> {
  const response = await rawFetch('/auth/refresh', { method: 'POST' });

  if (!response.ok) {
    clearAccessToken();
    for (const listener of sessionExpiredListeners) listener();
    return null;
  }

  const pair = (await response.json()) as TokenPair;
  setAccessToken(pair.accessToken);
  return pair;
}

/**
 * RF-6: un unico refresh en vuelo, sin importar cuantos llamadores lo pidan a
 * la vez.
 *
 * Si tres peticiones reciben 401 en el mismo instante y cada una disparara su
 * propio refresh, la segunda en llegar presentaria un refresh token que la
 * primera ya roto -- exactamente el patron que el backend interpreta como un
 * robo de token (regla 14 de la spec raiz) y responde revocando la familia
 * entera. `refreshing` hace que la segunda y la tercera esperen la MISMA
 * promesa en lugar de disparar la suya.
 *
 * Publica ademas para uso directo: el arranque de la app (fase 15, regla 3)
 * llama a esto explicitamente para el refresh silencioso, sin pasar por un
 * 401 de por medio.
 */
export function refreshSession(): Promise<TokenPair | null> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Arma la peticion: header de autorizacion si hay token, mismo origen siempre. */
function rawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`/api${path}`, {
    ...init,
    headers,
    // 'same-origin' y no 'include': el proxy (vite.config.ts en desarrollo,
    // nginx en produccion) hace que la API y el front sean el mismo origen a
    // proposito (regla 22 de la spec raiz), asi que 'include' -- pensado para
    // cookies genuinamente cross-origin -- describiria mal la arquitectura.
    credentials: 'same-origin',
  });
}

async function parseErrorBody(response: Response): Promise<ErrorBody> {
  try {
    return (await response.json()) as ErrorBody;
  } catch {
    // El filtro global del backend (AllExceptionsFilter) siempre devuelve
    // JSON; este fallback es para errores que ni siquiera llegan a Nest
    // (un proxy o el propio navegador cortando la conexion).
    return {
      statusCode: response.status,
      error: response.statusText || 'Error',
      message: 'Ocurrio un error inesperado',
      timestamp: new Date().toISOString(),
      path: new URL(response.url).pathname,
    };
  }
}

/**
 * Nucleo de todas las llamadas a la API (RF-4, RF-5).
 *
 * El tipo de retorno lo decide quien llama -- `request<T>` no infiere nada
 * del `path` -- las funciones tipadas de cada feature (auth.api.ts y las que
 * sumen las fases 15/16) son las que conectan cada endpoint con el tipo que
 * genera `schema.gen.ts`.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await rawFetch(path, init);
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (response.status === 401 && !AUTH_LIFECYCLE_PATHS.has(path)) {
    const renovado = await refreshSession();

    if (renovado) {
      try {
        // Un solo reintento (RF-5). Si esta segunda vuelta tambien da 401,
        // se deja caer: no hay una tercera oportunidad que dar.
        response = await rawFetch(path, init);
      } catch (cause) {
        throw new NetworkError(cause);
      }
    }
    // Si `renovado` es null, el refresh ya limpio la sesion y avisó a los
    // listeners; `response` sigue siendo el 401 original y cae al chequeo de
    // abajo, que lo convierte en el ApiError que ve quien llamo.
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorBody(response));
  }

  // 204 No Content (logout): no hay cuerpo que parsear.
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string): Promise<T> => request<T>(path),

  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  refreshSession,
  onSessionExpired,
};
