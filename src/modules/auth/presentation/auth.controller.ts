import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/auth/jwt-auth.guard';
import { ErrorResponse } from '../../../shared/http/error-response.dto';
import { toUserResponse, UserResponse } from '../../users/presentation/dto/user-response.dto';
import { GetOwnProfileUseCase } from '../application/get-own-profile.use-case';
import { TokenPair } from '../application/issue-token-pair.service';
import { LoginUserUseCase } from '../application/login-user.use-case';
import { LogoutUseCase } from '../application/logout.use-case';
import { RefreshTokensUseCase } from '../application/refresh-tokens.use-case';
import { RegisterUserUseCase } from '../application/register-user.use-case';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { TokenPairResponse } from './dto/token-pair-response.dto';

/** Nombre del esquema de seguridad; tiene que coincidir con el de main.ts. */
export const ACCESS_TOKEN_SCHEME = 'access-token';

/**
 * Capa de presentacion: traduce HTTP a llamadas de casos de uso y de vuelta.
 *
 * No contiene reglas de negocio. Si aparece un `if` con una decision del
 * dominio en este archivo, esta en el lugar equivocado.
 */
@ApiTags('auth')
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
  @ApiOperation({
    summary: 'Crear una cuenta',
    description: 'Toda cuenta nueva nace con rol USER; enviar `role` en el cuerpo no tiene efecto (regla 5).',
  })
  @ApiResponse({ status: 201, description: 'Cuenta creada', type: UserResponse })
  @ApiResponse({ status: 400, description: 'Email o password invalidos', type: ErrorResponse })
  @ApiResponse({ status: 409, description: 'El email ya esta registrado', type: ErrorResponse })
  async register(@Body() dto: RegisterUserDto): Promise<UserResponse> {
    const user = await this.registerUser.execute(dto);
    return toUserResponse(user);
  }

  @Post('login')
  // Sin esto Nest responderia 201 a un POST. Un login no crea nada: es 200.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Autenticarse y obtener el par de tokens',
    description:
      'Credenciales invalidas devuelven siempre el mismo 401, sin distinguir si el email existe (regla 8).',
  })
  @ApiResponse({ status: 200, description: 'Autenticado', type: TokenPairResponse })
  @ApiUnauthorizedResponse({ description: 'Credenciales invalidas', type: ErrorResponse })
  async login(@Body() dto: LoginUserDto): Promise<TokenPairResponse> {
    return this.toResponse(await this.loginUser.execute(dto));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotar el refresh token y renovar el access token',
    description:
      'Cada uso invalida el token presentado y emite uno nuevo (regla 13). Presentar un token ya rotado revoca la familia completa (regla 14).',
  })
  @ApiResponse({ status: 200, description: 'Par renovado', type: TokenPairResponse })
  @ApiUnauthorizedResponse({
    description: 'Token inexistente, vencido, revocado o reusado',
    type: ErrorResponse,
  })
  async refresh(@Body() dto: RefreshTokenDto): Promise<TokenPairResponse> {
    return this.toResponse(await this.refreshTokens.execute(dto.refreshToken));
  }

  @Post('logout')
  // 204: la sesion quedo cerrada y no hay nada que devolver.
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cerrar sesion',
    description:
      'Idempotente: repetirlo con un token ya revocado tambien devuelve 204, y no dispara la deteccion de reuso (regla 16).',
  })
  @ApiResponse({ status: 204, description: 'Sesion cerrada' })
  async logoutSession(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.logout.execute(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(ACCESS_TOKEN_SCHEME)
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil', type: UserResponse })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, vencido o mal firmado',
    type: ErrorResponse,
  })
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
