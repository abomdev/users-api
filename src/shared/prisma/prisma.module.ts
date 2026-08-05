import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global para no reimportarlo en cada modulo de feature.
 *
 * Es la unica excepcion que nos permitimos: los repositorios concretos son los
 * unicos que van a inyectar PrismaService, y viven en la capa de
 * infrastructure. Los casos de uso nunca lo ven, dependen de su puerto.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
