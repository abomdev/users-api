import { apiClient } from './client';
import type { paths } from './schema.gen';

/**
 * Cada alias extrae, del documento OpenAPI generado, el tipo exacto que la
 * API devuelve para ese endpoint. Si mañana el backend cambia -- se agrega un
 * campo, se renombra uno -- basta con correr `pnpm api:types` de nuevo para
 * que estos alias cambien solos, y TypeScript señale cada lugar del frontend
 * que asumia la forma vieja. Es lo que evita que el contrato se desincronice
 * en silencio.
 */
export type RegisterInput = paths['/auth/register']['post']['requestBody']['content']['application/json'];
export type LoginInput = paths['/auth/login']['post']['requestBody']['content']['application/json'];
type UserResponse = paths['/auth/register']['post']['responses']['201']['content']['application/json'];
type TokenPairResponse = paths['/auth/login']['post']['responses']['200']['content']['application/json'];

export function register(input: RegisterInput): Promise<UserResponse> {
  return apiClient.post<UserResponse>('/auth/register', input);
}

export function login(input: LoginInput): Promise<TokenPairResponse> {
  return apiClient.post<TokenPairResponse>('/auth/login', input);
}

/** Perfil del usuario autenticado. Exige un access token valido en memoria. */
export function getMe(): Promise<UserResponse> {
  return apiClient.get<UserResponse>('/auth/me');
}

export function logout(): Promise<void> {
  return apiClient.post<void>('/auth/logout');
}
