import { User } from './user.entity';

/**
 * Datos necesarios para dar de alta un usuario.
 *
 * No incluye `role` a proposito: la regla 5 dice que toda cuenta nueva nace
 * como USER, y la forma mas solida de garantizarlo no es una comprobacion en
 * tiempo de ejecucion sino que el tipo no permita expresar lo contrario.
 */
export interface NewUser {
  email: string;
  passwordHash: string;
}

/**
 * Puerto de persistencia de usuarios.
 *
 * Los casos de uso dependen de esta interfaz, nunca de Prisma. Eso permite
 * probarlos con un doble en memoria, sin base de datos, y deja la decision del
 * motor de persistencia fuera de las reglas de negocio.
 */
export interface UserRepository {
  /** Busca por email ya normalizado. Devuelve null si no existe. */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Crea el usuario. Si el email ya esta tomado lanza
   * EmailAlreadyRegisteredError (regla 2), incluso si la colision ocurre entre
   * dos peticiones simultaneas.
   */
  create(data: NewUser): Promise<User>;
}

/**
 * Las interfaces de TypeScript no existen en tiempo de ejecucion, asi que no
 * pueden usarse como token de inyeccion. Este simbolo cumple ese papel: es la
 * pieza que permite que el caso de uso pida "un UserRepository" sin nombrar
 * jamas a la implementacion concreta.
 */
export const USER_REPOSITORY = Symbol('UserRepository');
