import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  GeneratedRefreshToken,
  RefreshTokenGenerator,
} from '../domain/refresh-token-generator.port';

/** 32 bytes = 256 bits de entropia (regla 11). */
const TOKEN_BYTES = 32;

@Injectable()
export class CryptoRefreshTokenGenerator implements RefreshTokenGenerator {
  generate(): GeneratedRefreshToken {
    // randomBytes usa el generador criptografico del sistema. Math.random()
    // seria catastrofico aca: es predecible.
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    return { token, hash: this.hashOf(token) };
  }

  /**
   * SHA-256 y no argon2, a diferencia de las contrasenas.
   *
   * argon2 es lento a proposito para frenar ataques de diccionario, pero eso
   * solo tiene sentido cuando el secreto es adivinable. Un token de 256 bits
   * aleatorios no se adivina: no hay diccionario que lo contenga. Lo que hace
   * falta es un resumen rapido, porque se calcula en cada refresh.
   */
  hashOf(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
