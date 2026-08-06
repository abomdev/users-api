import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';

/** Nombre de la cookie. Regla 22. */
export const REFRESH_COOKIE = 'refresh_token';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Emite, lee y borra la cookie del refresh token (regla 22).
 *
 * Existe para que los atributos de seguridad esten definidos en un unico lugar.
 * Si estuvieran repetidos en cada endpoint, alcanzaria con olvidarse un
 * `httpOnly` en uno de ellos para dejar el token al alcance de cualquier script.
 */
@Injectable()
export class RefreshCookie {
  constructor(private readonly config: ConfigService<Record<string, unknown>, true>) {}

  private get options(): CookieOptions {
    return {
      // El punto de todo el cambio: JavaScript no puede leer esta cookie, ni
      // siquiera desde la propia pagina.
      httpOnly: true,

      // No se envia en peticiones cruzadas iniciadas por otro sitio, que es la
      // defensa contra CSRF.
      sameSite: 'lax',

      // Solo por HTTPS. En desarrollo tiene que quedar apagado o el navegador
      // descarta la cookie sobre http://localhost.
      secure: this.config.get<string>('NODE_ENV') === 'production',

      // Acota a que rutas se envia: /users no la necesita, asi que no la ve.
      path: '/auth',

      // Alineado con la regla 12: la cookie no sobrevive al token que contiene.
      maxAge: this.config.get<number>('REFRESH_TTL_DAYS') * MS_POR_DIA,
    };
  }

  set(response: Response, token: string): void {
    response.cookie(REFRESH_COOKIE, token, this.options);
  }

  /**
   * Devuelve cadena vacia si no hay cookie.
   *
   * No lanza a proposito: que falte se trata igual que un token invalido, y
   * cada caso de uso decide que significa eso. Para `/auth/refresh` es un 401;
   * para `/auth/logout`, un 204 por la idempotencia de la regla 16.
   */
  read(request: Request): string {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_COOKIE] ?? '';
  }

  clear(response: Response): void {
    // Los atributos tienen que coincidir con los de emision -- sobre todo
    // `path` -- o el navegador considera que es otra cookie y no la borra.
    // `maxAge` se omite porque clearCookie pone el suyo para vencerla.
    const { httpOnly, sameSite, secure, path } = this.options;
    response.clearCookie(REFRESH_COOKIE, { httpOnly, sameSite, secure, path });
  }
}
