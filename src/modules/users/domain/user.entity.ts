import { Role } from './role.enum';

/**
 * Un usuario tal como lo entiende el negocio.
 *
 * Es una clase plana, sin decoradores ni dependencias: no sabe de que tabla
 * salio ni como se serializa. Todos sus campos son readonly porque nada de lo
 * que hay aca cambia mutando el objeto en memoria; los cambios pasan por el
 * repositorio.
 */
export class User {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly passwordHash: string,
    readonly role: Role,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  isAdmin(): boolean {
    return this.role === Role.Admin;
  }
}

/**
 * Normaliza un email antes de compararlo o guardarlo (regla 1).
 *
 * Es lo que hace que `Ana@Example.com ` y `ana@example.com` sean el mismo
 * usuario. Vive en el dominio, no en el controlador, porque es una regla de
 * negocio: tiene que valer para cualquier via de entrada, no solo para HTTP.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
