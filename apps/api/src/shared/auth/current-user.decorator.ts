import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from './authenticated-user';

/**
 * Inyecta el usuario autenticado en el metodo del controlador.
 *
 * Evita repetir `@Req() req` y andar hurgando en `req.user`, que ademas viene
 * sin tipar. Solo tiene sentido en rutas protegidas por JwtAuthGuard: sin el,
 * no hay usuario que inyectar.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    return request.user;
  },
);
