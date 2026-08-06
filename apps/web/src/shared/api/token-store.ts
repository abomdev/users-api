import { readonly, ref } from 'vue';

/**
 * El access token, y solo el access token, en memoria (RF-1).
 *
 * Vive en su propio modulo -- no dentro del store de Pinia de auth (fase 15)
 * ni dentro del cliente HTTP -- porque los dos lo necesitan y uno no puede
 * depender del otro sin un ciclo: el cliente necesita leerlo para armar el
 * header Authorization, y el store de auth necesita al cliente para llamar a
 * /auth/login. Un modulo neutral, sin logica, resuelve el ciclo por
 * construccion.
 *
 * Es un `ref` de Vue a proposito: en la fase 15, el store de auth expone este
 * mismo ref (no una copia) como su estado, asi que la UI reacciona a los
 * cambios sin que haga falta duplicar el dato en dos lugares.
 */
const accessToken = ref<string | null>(null);

/** Copia de solo lectura para quien solo necesita observar, no escribir. */
export const currentAccessToken = readonly(accessToken);

export function setAccessToken(token: string | null): void {
  accessToken.value = token;
}

export function getAccessToken(): string | null {
  return accessToken.value;
}

export function clearAccessToken(): void {
  accessToken.value = null;
}
