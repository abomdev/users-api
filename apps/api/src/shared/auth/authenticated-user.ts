import { Role } from '../domain/role.enum';

/**
 * Lo que queda en `request.user` despues de validar el access token.
 *
 * Es intencionalmente pequeno: lo que viene firmado en el token, nada mas. Si
 * un caso de uso necesita el usuario completo, lo busca en el repositorio --
 * ver GetOwnProfileUseCase y por que no alcanza con lo que trae el JWT.
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}
