import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Forma esperada de la configuracion. Cada regla de aca se comprueba una sola
 * vez, al arrancar: si algo falta o esta mal, la app no levanta.
 *
 * El criterio es fallar temprano y ruidoso. Una variable ausente que se
 * descubre recien cuando un usuario intenta autenticarse es mucho mas cara de
 * diagnosticar que un arranque abortado con el nombre del campo que falta.
 */
/*
 * Nota sobre las anotaciones de tipo explicitas de esta clase:
 *
 * SWC compila sin informacion de tipos, asi que para `design:type` solo puede
 * copiar lo que este escrito. Con `PORT = 3000` (sin anotar) emite `Object`,
 * class-transformer no sabe a que convertir, PORT queda como el string "3000"
 * y `@IsInt` lo rechaza. Con `PORT: number = 3000` emite `Number` y convierte.
 *
 * tsc no tiene este problema porque infiere el tipo. Es una diferencia real
 * entre los dos compiladores: con SWC, anotar es obligatorio.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv, {
    message: 'NODE_ENV debe ser development, test o production',
  })
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt({ message: 'PORT debe ser un numero entero' })
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL es obligatoria' })
  DATABASE_URL!: string;

  // 32 caracteres es el piso razonable para una firma HS256: por debajo, la
  // clave tiene menos entropia que el hash que produce.
  @IsString()
  @MinLength(32, {
    message: 'JWT_SECRET debe tener al menos 32 caracteres',
  })
  JWT_SECRET!: string;

  /** Vida del access token, en formato de `ms` (por ejemplo `15m`). Regla 9. */
  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_TTL: string = '15m';

  /** Vida del refresh token, en dias. Regla 12. */
  @IsInt({ message: 'REFRESH_TTL_DAYS debe ser un numero entero' })
  @Min(1)
  REFRESH_TTL_DAYS: number = 7;
}

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  // Todo lo que viene del entorno es string. enableImplicitConversion deja que
  // los @IsInt reciban numeros de verdad en lugar de rechazar "3000".
  const parsed = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errores = validateSync(parsed, { skipMissingProperties: false });

  if (errores.length > 0) {
    const detalle = errores
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');

    throw new Error(
      `Configuracion invalida. Revisa tu archivo .env:\n${detalle}\n\n` +
        'Podes partir de .env.example.',
    );
  }

  return parsed;
}
