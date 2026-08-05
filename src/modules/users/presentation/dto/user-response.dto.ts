import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../../shared/domain/role.enum';
import { User } from '../../domain/user.entity';

/**
 * Forma en que un usuario sale de la API.
 *
 * Regla 6: ninguna respuesta incluye passwordHash. La garantia no es "acordarse
 * de borrarlo": es que este objeto se construye campo por campo, asi que lo que
 * no se nombra aca no puede escaparse. Si manana la entidad suma un campo
 * sensible, no aparece solo en las respuestas.
 *
 * Es una clase y no una interfaz porque las interfaces de TypeScript no existen
 * en tiempo de ejecucion, y Swagger necesita algo que pueda inspeccionar para
 * generar el esquema.
 */
export class UserResponse {
  @ApiProperty({ format: 'uuid', example: '6f1c8b2e-3d4a-4f5b-9c8d-1e2f3a4b5c6d' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'ana@example.com' })
  email!: string;

  @ApiProperty({ enum: Role, enumName: 'Role', example: Role.User })
  role!: Role;

  @ApiProperty({ format: 'date-time', example: '2026-08-05T10:00:00.000Z' })
  createdAt!: string;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
