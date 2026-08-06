/**
 * Roles del dominio (regla 17).
 *
 * Vive en shared y no dentro de un modulo porque lo usan los dos: users lo
 * guarda como atributo del usuario, y auth lo mete en el access token y lo lee
 * al autorizar. Dejarlo en uno de los dos obligaria al otro a depender de el
 * solo por un enum.
 *
 * Prisma genera su propio `Role` a partir del schema. Este es distinto a
 * proposito: si el dominio importara el de Prisma, cambiar de ORM obligaria a
 * tocar los casos de uso. El mapeo entre ambos vive en el repositorio, que es
 * el unico lugar que conoce las dos representaciones.
 */
export enum Role {
  User = 'USER',
  Admin = 'ADMIN',
}
