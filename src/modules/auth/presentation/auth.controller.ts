import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { LoginUserUseCase } from '../application/login-user.use-case';
import { RegisterUserUseCase } from '../application/register-user.use-case';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { toUserResponse, UserResponse } from './dto/user-response.dto';

interface LoginResponse {
  accessToken: string;
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
  async login(@Body() dto: LoginUserDto): Promise<LoginResponse> {
    const { accessToken, expiresInSeconds } = await this.loginUser.execute(dto);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: expiresInSeconds,
    };
  }
}
