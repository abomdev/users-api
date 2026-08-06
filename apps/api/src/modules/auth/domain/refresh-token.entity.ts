/**
 * Un refresh token persistido.
 *
 * No guarda el valor del token: solo su hash vive en la base (regla 11), y ni
 * siquiera eso hace falta aca -- el hash es la clave de busqueda, no un dato
 * del dominio. Lo que esta entidad sabe es si el token sirve o no, y a que
 * familia pertenece.
 */
export class RefreshToken {
  constructor(
    readonly id: string,
    readonly userId: string,
    /** Cadena de rotaciones nacida de un login (reglas 7, 13, 14). */
    readonly familyId: string,
    readonly expiresAt: Date,
    readonly revokedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  get isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isExpired(now: Date): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  // Nota: no hay un `isUsable()` que combine los dos estados, aunque la regla
  // 15 los trate igual. El caso de uso necesita distinguirlos: un token
  // revocado que reaparece revoca la familia entera (regla 14), mientras que
  // uno vencido solo se rechaza. Fundirlos en un solo metodo escondería
  // justamente la diferencia que importa.
}
