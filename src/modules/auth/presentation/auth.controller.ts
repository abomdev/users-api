import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { GetOwnProfileUseCase } from '../application/get-own-profile.use-case';
import { TokenPair } from '../application/issue-token-pair.service';
import { LoginUserUseCase } from '../application/login-user.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshTokensUseCase } from '../application/refresh-tokens.use-case';
import { RegisterUserUseCase } from '../application/register-user.use-case';
import { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { toUserResponse, UserResponse } from '../../users/presentation/dto/user-response.dto';

interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/**
 * Capa de presentacion: traduce HTTP a llamadas de casos de uso y de vuelta.
 *
 * No contiene reglas de negocio. Si aparece un `if` con una decision del
 * dominio en este archivo, esta en el lugar equivocado.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginUser: LoginUserUseCase,
    private readonly refreshTokens: RefreshTokensUseCase,
    private readonly logout: LogoutUseCase,
    private readonly getOwnProfile: GetOwnProfileUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterUserDto): Promise<UserResponse> {
    const user = await this.registerUser.execute(dto);
    return toUserResponse(user);
  }

  @Post('login')
  // Sin esto Nest responderia 201 a un POST. Un login no crea nada: es 200.
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginUserDto): Promise<TokenPairResponse> {
    return this.toResponse(await this.loginUser.execute(dto));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokenPairResponse> {
    return this.toResponse(await this.refreshTokens.execute(dto.refreshToken));
  }

  @Post('logout')
  // 204: la sesion quedo cerrada y no hay nada que devolver.
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutSession(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.logout.execute(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() actor: AuthenticatedUser): Promise<UserResponse> {
    const user = await this.getOwnProfile.execute(actor.userId);
    return toUserResponse(user);
  }

  private toResponse(par: TokenPair): TokenPairResponse {
    return {
      accessToken: par.accessToken,
      refreshToken: par.refreshToken,
      tokenType: 'Bearer',
      expiresIn: par.expiresInSeconds,
    };
  }
}
