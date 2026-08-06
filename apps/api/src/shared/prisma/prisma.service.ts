import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * Unico punto de acceso a la base de datos.
 *
 * En Prisma 7 el cliente ya no abre la conexion por su cuenta a partir de una
 * URL en el schema: recibe un *driver adapter* (aca, el de `pg`) y delega en el
 * el manejo del pool. Por eso la URL se inyecta desde ConfigService, que ya la
 * valido al arrancar.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<Record<string, unknown>, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get<string>('DATABASE_URL'),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    // Conectar aca (y no de forma perezosa en la primera consulta) hace que un
    // problema de conexion se vea al arrancar y no en mitad de una peticion.
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
