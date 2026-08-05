import { Role } from '../../../users/domain/role.enum';
import { User } from '../../../users/domain/user.entity';

/**
 * Forma en que un usuario sale de la API.
 *
 * Regla 6: ninguna respuesta incluye passwordHash. La garantia no es "acordarse
 * de borrarlo": es que este objeto se construye campo por campo, asi que lo que
 * no se nombra aca no puede escaparse. Si manana la entidad suma un campo
 * sensible, no aparece solo en las respuestas.
 */
export interface UserResponse {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
