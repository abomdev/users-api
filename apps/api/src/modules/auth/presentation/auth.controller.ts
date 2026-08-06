import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
// `import type` es obligatorio aca, no una preferencia de estilo.
//
// Con un import normal, SWC no puede saber que Request y Response se usan solo
// como tipos, y `emitDecoratorMetadata` los emite como valores dentro de
// design:paramtypes. Eso genera un require('express') en tiempo de ejecucion, y
// express es una dependencia transitiva de @nestjs/platform-express, no una
// declarada: con el node_modules estricto de pnpm, la aplicacion no arranca.
//
// tsc lo resolveria solo porque conoce los tipos; SWC no. Es la misma raiz que
// el problema de las anotaciones explicitas en las clases validadas.
import type { Request, Response } from 'express';
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
import { RegisterUserDto } from './dto/register-user.dto';
import { TokenPairResponse } from './dto/token-pair-response.dto';
import { RefreshCookie } from './refresh-cookie';

/** Nombres de los esquemas de seguridad; coinciden con los de main.ts. */
export const ACCESS_TOKEN_SCHEME = 'access-token';
export const REFRESH_COOKIE_SCHEME = 'refresh-cookie';

/**
 * Capa de presentacion: traduce HTTP a llamadas de casos de uso y de vuelta.
 *
 * No contiene reglas de negocio. Si aparece un `if` con una decision del
 * dominio en este archivo, esta en el lugar equivocado.
 *
 * Que el refresh token viaje en cookie y no en el cuerpo es una decision de
 * transporte, y por eso vive entera en esta capa: los casos de uso reciben una
 * cadena y no saben de donde salio.
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
    private readonly refreshCookie: RefreshCookie,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear una cuenta',
    description:
      'Toda cuenta nueva nace con rol USER; enviar `role` en el cuerpo no tiene efecto (regla 5).',
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
    summary: 'Autenticarse y obtener el access token',
    description:
      'El refresh token se entrega en una cookie HttpOnly y no aparece en el cuerpo (regla 22). ' +
      'Credenciales invalidas devuelven siempre el mismo 401, sin distinguir si el email existe (regla 8).',
  })
  @ApiResponse({ status: 200, description: 'Autenticado', type: TokenPairResponse })
  @ApiUnauthorizedResponse({ description: 'Credenciales invalidas', type: ErrorResponse })
  async login(
    @Body() dto: LoginUserDto,
    // passthrough: true deja que Nest siga encargandose de serializar lo que
    // devuelve el metodo; sin eso habria que escribir la respuesta a mano.
    @Res({ passthrough: true }) response: Response,
  ): Promise<TokenPairResponse> {
    return this.emitirPar(await this.loginUser.execute(dto), response);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE_SCHEME)
  @ApiOperation({
    summary: 'Rotar el refresh token y renovar el access token',
    description:
      'No lleva cuerpo: el token se lee de la cookie. Cada uso invalida el token presentado y ' +
      'emite uno nuevo (regla 13). Presentar un token ya rotado revoca la familia completa (regla 14).',
  })
  @ApiResponse({ status: 200, description: 'Par renovado', type: TokenPairResponse })
  @ApiUnauthorizedResponse({
    description: 'Cookie ausente, vencida, revocada o reusada',
    type: ErrorResponse,
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TokenPairResponse> {
    const presentado = this.refreshCookie.read(request);
    return this.emitirPar(await this.refreshTokens.execute(presentado), response);
  }

  @Post('logout')
  // 204: la sesion quedo cerrada y no hay nada que devolver.
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE_SCHEME)
  @ApiOperation({
    summary: 'Cerrar sesion',
    description:
      'Idempotente: repetirlo con un token ya revocado, o sin cookie, tambien devuelve 204, y no ' +
      'dispara la deteccion de reuso (regla 16).',
  })
  @ApiResponse({ status: 204, description: 'Sesion cerrada' })
  async logoutSession(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.logout.execute(this.refreshCookie.read(request));
    // Se borra siempre, incluso si el token ya estaba revocado: dejar la cookie
    // puesta haria que el navegador siguiera mandando basura en cada peticion.
    this.refreshCookie.clear(response);
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

  /** Deja el refresh en la cookie y devuelve solo el access token (regla 22). */
  private emitirPar(par: TokenPair, response: Response): TokenPairResponse {
    this.refreshCookie.set(response, par.refreshToken);

    return {
      accessToken: par.accessToken,
      tokenType: 'Bearer',
      expiresIn: par.expiresInSeconds,
    };
  }
}
