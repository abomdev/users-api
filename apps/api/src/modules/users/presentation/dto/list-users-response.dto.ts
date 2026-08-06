import { ApiProperty } from '@nestjs/swagger';
import { UserResponse } from './user-response.dto';

/** Metadata de paginacion (regla 19). */
export class PageMetaResponse {
  @ApiProperty({ description: 'Total de usuarios, no de esta pagina', example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Cero si no hay usuarios', example: 3 })
  totalPages!: number;
}

export class ListUsersResponse {
  // El `type` explicito es obligatorio en arreglos: la metadata de un
  // `UserResponse[]` solo dice "Array", sin decir de que.
  @ApiProperty({ type: [UserResponse] })
  data!: UserResponse[];

  @ApiProperty({ type: PageMetaResponse })
  meta!: PageMetaResponse;
}
