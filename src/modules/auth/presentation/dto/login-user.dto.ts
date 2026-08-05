import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength } from 'class-validator';
import { normalizeEmailInput } from './transforms';

/**
 * Contrato de entrada de POST /auth/login.
 *
 * A diferencia del registro, aca no se valida el largo minimo de la
 * contrasena: las reglas de fortaleza son del alta. Si cambiaramos la politica
 * manana, exigirlas en el login dejaria afuera a los usuarios existentes.
 */
export class LoginUserDto {
  // Misma normalizacion previa que en el registro (regla 1): sin ella, quien
  // se registro con `ana@example.com` no podria entrar escribiendo `Ana@...`.
  @Transform(normalizeEmailInput)
  @IsEmail({}, { message: 'email debe ser una direccion de correo valida' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
