import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Exige un access token valido (regla 10).
 *
 * Vive en shared y no dentro del modulo de auth porque lo usan varios modulos,
 * y si estuviera en auth el modulo de users tendria que depender de auth --
 * que a su vez ya depende de users. No necesita nada de AuthModule: solo
 * nombra la estrategia 'jwt', que Passport resuelve de su registro global.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
