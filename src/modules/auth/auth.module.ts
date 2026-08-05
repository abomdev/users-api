import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { LoginUserUseCase } from './application/login-user.use-case';
import { RegisterUserUseCase } from './application/register-user.use-case';
import { ACCESS_TOKEN_ISSUER } from './domain/access-token.port';
import { PASSWORD_HASHER } from './domain/password-hasher.port';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { JwtAccessTokenIssuer } from './infrastructure/jwt-access-token.issuer';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Record<string, unknown>, true>) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          // Regla 9: HS256 y vencimiento corto. `expiresIn` numerico son
          // segundos, la misma unidad que lleva el claim `exp` del token.
          algorithm: 'HS256',
          expiresIn: config.get<number>('JWT_ACCESS_TTL_SECONDS'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    RegisterUserUseCase,
    LoginUserUseCase,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: ACCESS_TOKEN_ISSUER, useClass: JwtAccessTokenIssuer },
  ],
})
export class AuthModule {}
