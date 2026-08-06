import { Algorithm, hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '../domain/password-hasher.port';

/**
 * Hash con argon2id, el algoritmo que recomienda OWASP para contrasenas.
 *
 * A diferencia de SHA-256, argon2 esta disenado para ser deliberadamente lento
 * y costoso en memoria: eso es lo que hace inviable probar millones de
 * candidatas por segundo si algun dia se filtra la tabla.
 *
 * Los parametros de coste van dentro del propio hash resultante, asi que subir
 * el coste mas adelante no invalida los hashes viejos.
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  private static readonly OPTIONS = { algorithm: Algorithm.Argon2id };

  /** Hash de una contrasena que nadie usa, para igualar tiempos. */
  private dummyHash: string | null = null;

  hash(plain: string): Promise<string> {
    return hash(plain, Argon2PasswordHasher.OPTIONS);
  }

  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain, Argon2PasswordHasher.OPTIONS);
    } catch {
      // Un hash con formato invalido no es motivo para romper el login: es,
      // simplemente, una credencial que no valida.
      return false;
    }
  }

  async fakeVerify(): Promise<void> {
    this.dummyHash ??= await this.hash('contrasena-que-no-pertenece-a-nadie');
    await this.verify(this.dummyHash, 'candidata-incorrecta');
  }
}
