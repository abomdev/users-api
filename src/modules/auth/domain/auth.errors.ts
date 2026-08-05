import { DomainError, DomainErrorKind } from '../../../shared/domain/domain.error';

/**
 * Regla 8: el mismo error para email inexistente y para contrasena incorrecta.
 *
 * Un mensaje del tipo "ese usuario no existe" convierte al login en un oraculo
 * para averiguar que direcciones estan registradas.
 */
export class InvalidCredentialsError extends DomainError {
  readonly kind = DomainErrorKind.Unauthorized;

  constructor() {
    super('Credenciales invalidas');
  }
}
