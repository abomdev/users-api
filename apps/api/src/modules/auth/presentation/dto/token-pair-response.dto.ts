import { ApiProperty } from '@nestjs/swagger';

/**
 * Respuesta de POST /auth/login y de POST /auth/refresh.
 *
 * El refresh token NO figura aca: viaja en una cookie `HttpOnly` (regla 22).
 * Que no aparezca en el cuerpo es justamente lo que impide que un script
 * inyectado lo lea.
 */
export class TokenPairResponse {
  @ApiProperty({
    description: 'JWT firmado con HS256 (regla 9). El cliente lo mantiene en memoria.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI...',
  })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ description: 'Vida del access token en segundos', example: 900 })
  expiresIn!: number;
}
