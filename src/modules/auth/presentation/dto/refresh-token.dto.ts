import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Cuerpo de POST /auth/refresh y de POST /auth/logout.
 *
 * El token no se valida por formato mas alla de su largo: comprobar aca si
 * "parece" un token nuestro no aportaria seguridad, porque la unica prueba que
 * vale es encontrar su hash entre los guardados.
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'El refreshToken devuelto por /auth/login o por un /auth/refresh anterior',
    example: '4BiJwhkTx8oq1e79-xibKQ7v2mNpLd3RcYzA6HsUeWk',
  })
  @IsString()
  @IsNotEmpty({ message: 'refreshToken es obligatorio' })
  @MaxLength(512)
  refreshToken!: string;
}
