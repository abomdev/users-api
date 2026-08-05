import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Cuerpo de POST /auth/refresh y de POST /auth/logout.
 *
 * El token no se valida por formato mas alla de su largo: comprobar aca si
 * "parece" un token nuestro no aportaria seguridad, porque la unica prueba que
 * vale es encontrar su hash entre los guardados.
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'refreshToken es obligatorio' })
  @MaxLength(512)
  refreshToken!: string;
}
