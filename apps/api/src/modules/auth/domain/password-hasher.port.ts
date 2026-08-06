/**
 * Puerto de hasheo de contrasenas (regla 3).
 *
 * El caso de uso no sabe si por debajo hay argon2, bcrypt o scrypt: solo sabe
 * que puede convertir una contrasena en un hash y comprobar una candidata.
 * Cambiar de algoritmo no toca las reglas de negocio.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;

  /** Compara en tiempo constante. Nunca lanza por contrasena incorrecta. */
  verify(hash: string, plain: string): Promise<boolean>;

  /**
   * Consume el mismo tiempo que una verificacion real, sin comparar nada.
   *
   * Sirve para el login de un email inexistente: si respondieramos al instante
   * en ese caso y tardaramos ~30ms cuando el usuario si existe, el tiempo de
   * respuesta delataria que cuentas estan registradas. La regla 8 pide que los
   * dos casos sean indistinguibles, y eso incluye cuanto tardan.
   */
  fakeVerify(): Promise<void>;
}

export const PASSWORD_HASHER = Symbol('PasswordHasher');
