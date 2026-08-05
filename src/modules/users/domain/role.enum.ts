/**
 * Roles del dominio (regla 17).
 *
 * Prisma genera su propio enum `Role` a partir del schema. Este es distinto a
 * proposito: si el dominio importara el de Prisma, cambiar de ORM obligaria a
 * tocar los casos de uso. El mapeo entre ambos vive en el repositorio, que es
 * el unico lugar que conoce las dos representaciones.
 */
export enum Role {
  User = 'USER',
  Admin = 'ADMIN',
}
