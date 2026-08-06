import { ApiProperty } from '@nestjs/swagger';

/** Respuesta de POST /auth/login y de POST /auth/refresh. */
export class TokenPairResponse {
  @ApiProperty({
    description: 'JWT firmado con HS256 (regla 9)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI...',
  })
  accessToken!: string;

  @ApiProperty({
    description:
      'Token opaco de 256 bits (regla 11). No es un JWT: no contiene informacion y solo sirve presentandolo en /auth/refresh.',
    example: '4BiJwhkTx8oq1e79-xibKQ7v2mNpLd3RcYzA6HsUeWk',
  })
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ description: 'Vida del access token en segundos', example: 900 })
  expiresIn!: number;
}
