import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import { Roles } from '../../../shared/auth/roles.decorator';
import { RolesGuard } from '../../../shared/auth/roles.guard';
import { Role } from '../../../shared/domain/role.enum';
import { ErrorResponse } from '../../../shared/http/error-response.dto';
import { ACCESS_TOKEN_SCHEME } from '../../auth/presentation/auth.controller';
import { ListUsersUseCase } from '../application/list-users.use-case';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ListUsersResponse } from './dto/list-users-response.dto';
import { toUserResponse } from './dto/user-response.dto';

@ApiTags('users')
@ApiBearerAuth(ACCESS_TOKEN_SCHEME)
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
  @ApiOperation({
    summary: 'Listar usuarios (solo ADMIN)',
    description:
      'Ordenado por fecha de creacion descendente. El rol se lee del access token, asi que un cambio de rol requiere volver a autenticarse.',
  })
  @ApiResponse({ status: 200, description: 'Pagina de usuarios', type: ListUsersResponse })
  @ApiResponse({ status: 400, description: 'page o limit fuera de rango', type: ErrorResponse })
  @ApiUnauthorizedResponse({ description: 'Token ausente o invalido', type: ErrorResponse })
  @ApiForbiddenResponse({ description: 'Autenticado pero sin rol ADMIN', type: ErrorResponse })
  async list(@Query() query: ListUsersQueryDto): Promise<ListUsersResponse> {
    const { data, meta } = await this.listUsers.execute(query);

    // Regla 6: cada usuario pasa por toUserResponse, que arma la respuesta
    // campo por campo. El hash no tiene por donde escaparse.
    return { data: data.map(toUserResponse), meta };
  }
}
