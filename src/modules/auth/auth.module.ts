import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { GetOwnProfileUseCase } from './application/get-own-profile.use-case';
import { IssueTokenPair } from './application/issue-token-pair.service';
import { LoginUserUseCase } from './application/login-user.use-case';
import { LogoutUseCase } from './application/logout.use-case';
import { RefreshTokensUseCase } from './application/refresh-tokens.use-case';
import { RegisterUserUseCase } from './application/register-user.use-case';
import { ACCESS_TOKEN_ISSUER } from './domain/access-token.port';
import { PASSWORD_HASHER } from './domain/password-hasher.port';
import { REFRESH_TOKEN_GENERATOR } from './domain/refresh-token-generator.port';
import { REFRESH_TOKEN_REPOSITORY } from './domain/refresh-token.repository.port';
import { Argon2PasswordHasher } from './infrastructure/argon2-password-hasher';
import { CryptoRefreshTokenGenerator } from './infrastructure/crypto-refresh-token.generator';
import { JwtAccessTokenIssuer } from './infrastructure/jwt-access-token.issuer';
import { JwtStrategy } from './infrastructure/jwt.strategy';
import { PrismaRefreshTokenRepository } from './infrastructure/prisma-refresh-token.repository';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [
    UsersModule,
    PassportModule,
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
    RefreshTokensUseCase,
    LogoutUseCase,
    GetOwnProfileUseCase,
    IssueTokenPair,
    JwtStrategy,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: ACCESS_TOKEN_ISSUER, useClass: JwtAccessTokenIssuer },
    { provide: REFRESH_TOKEN_GENERATOR, useClass: CryptoRefreshTokenGenerator },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
  ],
})
export class AuthModule {}
