import { config as loadEnv } from 'dotenv';

/**
 * Carga .env.test antes de que se importe cualquier modulo de la aplicacion.
 *
 * `override: true` es imprescindible: sin el, un DATABASE_URL ya presente en el
 * entorno ganaria, y los tests correrian contra la base de desarrollo -- que
 * es justo lo que se quiere evitar, porque la vacian.
 */
loadEnv({ path: '.env.test', override: true });
