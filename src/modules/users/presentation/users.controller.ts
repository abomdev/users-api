import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import { Roles } from '../../../shared/auth/roles.decorator';
import { RolesGuard } from '../../../shared/auth/roles.guard';
import { Role } from '../../../shared/domain/role.enum';
import { ListUsersUseCase, PageMeta } from '../application/list-users.use-case';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { toUserResponse, UserResponse } from './dto/user-response.dto';

interface ListUsersResponse {
  data: UserResponse[];
  meta: PageMeta;
}

@Controller('users')
// El orden importa: JwtAuthGuard resuelve quien es, y recien despues
// RolesGuard puede mirar su rol.
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly listUsers: ListUsersUseCase) {}

  @Get()
  // Regla 17. El requisito queda declarado junto a la ruta, que es donde se
  // busca al leer el codigo.
  @Roles(Role.Admin)
  async list(@Query() query: ListUsersQueryDto): Promise<ListUsersResponse> {
    const { data, meta } = await this.listUsers.execute(query);

    // Regla 6: cada usuario pasa por toUserResponse, que arma la respuesta
    // campo por campo. El hash no tiene por donde escaparse.
    return { data: data.map(toUserResponse), meta };
  }
}
