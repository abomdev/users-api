import { TransformFnParams } from 'class-transformer';
import { normalizeEmail } from '../../../users/domain/user.entity';

/**
 * Aplica la normalizacion de email de la regla 1 antes de que corran los
 * validadores. Reusa la funcion del dominio: la regla se define en un solo
 * lugar y aca solo se decide *cuando* aplicarla.
 *
 * class-transformer entrega `value` como `any` porque no puede saber que
 * llego en el JSON. Lo estrechamos explicitamente en vez de confiar.
 */
export function normalizeEmailInput({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? normalizeEmail(value) : (value as unknown);
}
