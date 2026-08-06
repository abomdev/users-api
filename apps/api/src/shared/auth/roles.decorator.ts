import { SetMetadata } from '@nestjs/common';
import { Role } from '../domain/role.enum';

export const ROLES_KEY = 'roles';

/**
 * Declara que roles pueden ejecutar un endpoint (regla 17).
 *
 * Solo deja una marca en la metadata del metodo; quien decide es RolesGuard.
 * Separar "que se exige" de "quien lo comprueba" permite leer el requisito
 * junto a la ruta, que es donde uno lo busca.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
