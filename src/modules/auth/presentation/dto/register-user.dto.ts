import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmailInput } from './transforms';

/**
 * Contrato de entrada de POST /auth/register (seccion 4 de spec.md).
 *
 * Los tipos van anotados explicitamente (`email!: string`) porque SWC compila
 * sin informacion de tipos y solo puede emitir en la metadata lo que este
 * escrito. Sin la anotacion, class-validator no sabria que espera cada campo.
 *
 * `role` no figura aca a proposito: con `whitelist: true` en el ValidationPipe,
 * cualquier campo no declarado se descarta antes de llegar al caso de uso. Eso
 * hace cumplir la regla 5 sin escribir una sola comprobacion.
 */
export class RegisterUserDto {
  @ApiProperty({
    description: 'Se normaliza a minusculas y sin espacios antes de validarse (regla 1)',
    example: 'ana@example.com',
    maxLength: 255,
  })
  // La regla 1 dice "se normaliza antes de validarse": el @Transform corre
  // durante la conversion del cuerpo, o sea antes que los validadores. Sin
  // esto, `  ANA@EXAMPLE.COM  ` fallaria el @IsEmail por los espacios y
  // devolveria 400 en lugar del 409 que corresponde por email ya registrado.
  @Transform(normalizeEmailInput)
  @IsEmail({}, { message: 'email debe ser una direccion de correo valida' })
  @MaxLength(255, { message: 'email no puede superar los 255 caracteres' })
  email!: string;

  @ApiProperty({
    description: 'Entre 8 y 128 caracteres (regla 4)',
    example: 'unaClaveSegura1',
    minLength: 8,
    maxLength: 128,
  })
  // Regla 4. El maximo tambien importa: sin tope, una contrasena enorme
  // convierte cada registro en trabajo de hasheo arbitrariamente caro.
  @IsString()
  @MinLength(8, { message: 'password debe tener al menos 8 caracteres' })
  @MaxLength(128, { message: 'password no puede superar los 128 caracteres' })
  password!: string;
}
