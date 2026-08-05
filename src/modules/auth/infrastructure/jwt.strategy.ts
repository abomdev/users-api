import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { AccessTokenPayload } from '../domain/access-token.port';

/**
 * Validacion del access token (regla 10).
 *
 * Passport se encarga de extraer el token, verificar la firma y comprobar el
 * vencimiento. Si algo de eso falla, `validate` ni siquiera se llama y la
 * peticion termina en 401.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<Record<string, unknown>, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Nunca en true: aceptar tokens vencidos anularia la regla 9 entera.
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
      // Fijar el algoritmo evita que un token firmado con "alg": "none" o con
      // un algoritmo distinto pase la verificacion.
      algorithms: ['HS256'],
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
