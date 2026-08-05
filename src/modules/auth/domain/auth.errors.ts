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

/**
 * Reglas 14 y 15: refresh inexistente, vencido, revocado o reusado.
 *
 * Los cuatro casos comparten error y mensaje a proposito. En particular, la
 * deteccion de reuso no se anuncia: decirle a quien robo un token "detectamos
 * que lo reusaste" solo le informa que su ventana se cerro y que conviene
 * cambiar de tactica.
 */
export class InvalidRefreshTokenError extends DomainError {
  readonly kind = DomainErrorKind.Unauthorized;

  constructor() {
    super('Refresh token invalido');
  }
}
