import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Exige un access token valido (regla 10).
 *
 * Es una subclase con nombre propio en vez de usar `AuthGuard('jwt')` suelto en
 * cada controlador: si manana la estrategia cambia, se toca solo este archivo.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
