import { DomainError, DomainErrorKind } from '../../../shared/domain/domain.error';

/** Regla 2: no pueden existir dos usuarios con el mismo email normalizado. */
export class EmailAlreadyRegisteredError extends DomainError {
  readonly kind = DomainErrorKind.Conflict;

  constructor() {
    // El mensaje no repite el email recibido: evita que un error se convierta
    // en un eco de lo que mando el cliente.
    super('El email ya esta registrado');
  }
}
