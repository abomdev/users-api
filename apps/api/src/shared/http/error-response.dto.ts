import { ApiProperty } from '@nestjs/swagger';

/**
 * Formato unico de error de la seccion 6 de spec.md.
 *
 * Existe para que Swagger pueda documentar la forma de las respuestas de error,
 * que es tan parte del contrato como la del caso exitoso. Quien consume la API
 * necesita saber que esperar cuando algo sale mal, no solo cuando sale bien.
 */
export class ErrorResponse {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({ example: 'Conflict' })
  error!: string;

  @ApiProperty({
    description:
      'Texto unico, o un arreglo con un mensaje por campo cuando falla la validacion',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'El email ya esta registrado',
  })
  message!: string | string[];

  @ApiProperty({ format: 'date-time', example: '2026-08-05T10:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/auth/register' })
  path!: string;
}
