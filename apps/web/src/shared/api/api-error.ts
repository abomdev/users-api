import type { components } from './schema.gen';

/** El formato unico de error de la API (seccion 6 de ../../../../../spec.md). */
type ErrorBody = components['schemas']['ErrorResponse'];

/**
 * Una respuesta de error real de la API: llego una respuesta HTTP, y no fue
 * 2xx. Trae el `status` y el cuerpo tal como lo definio el backend.
 *
 * Se distingue a proposito de {@link NetworkError} (RF-13): un 401 dice algo
 * sobre la sesion, una caida de red no dice nada sobre la sesion. Tratarlos
 * igual haria que perder la conexion a internet se viera identico a que
 * expirara la sesion.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ErrorBody,
  ) {
    super(readableMessage(body));
    this.name = 'ApiError';
  }
}

/**
 * La API no respondio: el fetch mismo fallo (sin conexion, servidor caido,
 * CORS). No hay `status` porque no hubo respuesta HTTP que traerlo.
 */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('No se pudo conectar con la API');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/**
 * RF-12: `message` puede ser un texto o un arreglo de textos (uno por campo
 * invalido). Esta es la unica funcion del proyecto que decide como se ve eso
 * en pantalla, para no repetir el `Array.isArray` en cada componente.
 */
function readableMessage(body: ErrorBody): string {
  return Array.isArray(body.message) ? body.message.join(', ') : body.message;
}
