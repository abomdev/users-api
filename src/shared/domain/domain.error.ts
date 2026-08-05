/**
 * Naturaleza del fallo, en vocabulario de negocio.
 *
 * A proposito no dice "404" ni "409": el dominio no sabe que existe HTTP. Es el
 * filtro de la capa de presentacion el que traduce cada tipo a su codigo. Si
 * manana esta API se expusiera por gRPC o por una cola, los casos de uso no
 * cambiarian una linea.
 */
export enum DomainErrorKind {
  /** La operacion choca con el estado actual del sistema (regla 2). */
  Conflict = 'CONFLICT',
  /** Las credenciales o el token no autorizan la operacion (reglas 8, 10, 15). */
  Unauthorized = 'UNAUTHORIZED',
  /** El actor esta identificado pero no tiene permiso (regla 17). */
  Forbidden = 'FORBIDDEN',
  /** Lo pedido no existe. */
  NotFound = 'NOT_FOUND',
}

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
