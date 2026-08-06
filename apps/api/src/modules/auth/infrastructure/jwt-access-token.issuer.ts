import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AccessTokenIssuer,
  AccessTokenPayload,
  IssuedAccessToken,
} from '../domain/access-token.port';

@Injectable()
export class JwtAccessTokenIssuer implements AccessTokenIssuer {
  constructor(private readonly jwt: JwtService) {}

  async issue(payload: AccessTokenPayload): Promise<IssuedAccessToken> {
    const token = await this.jwt.signAsync(payload);

    // `expiresIn` se calcula del token ya firmado en lugar de reinterpretar la
    // variable de entorno. Asi el numero que se le informa al cliente no puede
    // desincronizarse de la fecha que lleva el token dentro.
    const { exp, iat } = this.jwt.decode<{ exp: number; iat: number }>(token);

    return { token, expiresInSeconds: exp - iat };
  }
}
