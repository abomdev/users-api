import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Role } from '../domain/role.enum';
import { AuthenticatedUser } from './authenticated-user';
import { ROLES_KEY } from './roles.decorator';

/**
 * Comprueba el rol declarado con @Roles() (regla 17).
 *
 * Va siempre despues de JwtAuthGuard: sin autenticar no hay rol que mirar.
 * Devolver false hace que Nest responda 403 -- que es distinto de 401 y la
 * diferencia importa: 401 dice "no se quien sos", 403 dice "se quien sos y no
 * te alcanza".
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // getAllAndOverride deja que un metodo afine lo que declaro su controlador.
    const permitidos = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Sin @Roles() no hay restriccion de rol: basta con estar autenticado.
    if (!permitidos || permitidos.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    // Defensa por si alguien pone este guard sin JwtAuthGuard delante: sin
    // usuario, se niega en vez de dejar pasar.
    if (!request.user) {
      return false;
    }

    return permitidos.includes(request.user.role);
  }
}
