import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Parametros de paginacion de GET /users (regla 18).
 *
 * `@Type(() => Number)` es imprescindible: lo que llega en el query string es
 * siempre texto, y sin la conversion `@IsInt` rechazaria hasta un "1" valido.
 *
 * Los tipos van anotados explicitamente por la misma razon que en los otros
 * DTOs: SWC compila sin informacion de tipos y solo emite en la metadata lo
 * que este escrito.
 */
export class ListUsersQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un numero entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page: number = 1;

  // El tope de 100 no es capricho: sin el, un `?limit=1000000` obligaria a
  // traer la tabla entera a memoria y serializarla.
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un numero entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(100, { message: 'limit no puede superar 100' })
  limit: number = 20;
}
