# Spec: API de usuarios con autenticación JWT

> Este documento es la fuente de verdad del comportamiento. Si algo cambia,
> primero se actualiza acá y después el código.

## 1. Contexto y objetivo

Una API REST que gestiona cuentas de usuario y las autentica con JWT: permite
registrarse, iniciar sesión, mantener la sesión viva sin volver a pedir la
contraseña, cerrarla, consultar el perfil propio y —para administradores— listar
las cuentas existentes.

Se construye como proyecto de aprendizaje y portfolio. La prioridad es que cada
decisión esté justificada y verificable, no la velocidad de entrega.

## 2. Alcance

**Dentro de alcance:**

- Registro de cuentas con email y contraseña.
- Login que emite un *access token* y un *refresh token*.
- Renovación del access token mediante refresh **con rotación** y detección de reuso.
- Cierre de sesión que revoca el refresh token.
- Consulta del perfil propio.
- Dos roles: `USER` y `ADMIN`.
- Listado paginado de usuarios, restringido a `ADMIN`.
- Documentación OpenAPI navegable.

**Fuera de alcance (por ahora):**

- **Cache con Redis.** La revocación de sesiones ya se resuelve persistiendo los
  refresh tokens en PostgreSQL. Redis se justificaría al escalar a varias
  instancias, no antes.
- **Colas con BullMQ.** No hay ningún trabajo que no pueda resolverse dentro del
  ciclo de la petición. Sin un caso real (por ejemplo, enviar emails), una cola
  sería decorativa.
- **Observabilidad (OpenTelemetry / Prometheus / Grafana).** Es el extra que mejor
  se justifica solo, pero su superficie de configuración compite con el foco de
  este proyecto, que es la autenticación.
- Verificación de email y recuperación de contraseña (requieren envío de correo).
- Edición y eliminación de usuarios (`PATCH`/`DELETE /users/:id`).
- Consulta de un usuario individual (`GET /users/:id`).
- Cambio de rol vía API. Se hace directamente en la base de datos.
- Rate limiting y bloqueo por intentos fallidos.
- OAuth / login con proveedores externos.
- Frontend. Se planea aparte, más adelante.

## 3. Modelo de datos

### User

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | UUID | Requerido. Clave primaria, generado por el sistema. |
| `email` | string | Requerido. Único. Formato de email válido. Se normaliza (trim + minúsculas) antes de validar y guardar. Máx. 255. |
| `passwordHash` | string | Requerido. Hash argon2id. **Nunca sale en una respuesta.** |
| `role` | enum | Requerido. `USER` \| `ADMIN`. Por defecto `USER`. |
| `createdAt` | datetime | Requerido. Lo asigna el sistema. |
| `updatedAt` | datetime | Requerido. Lo actualiza el sistema. |

Índice único sobre `email`.

### RefreshToken

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | UUID | Requerido. Clave primaria. |
| `userId` | UUID | Requerido. FK a `User`. Borrado en cascada. |
| `tokenHash` | string | Requerido. Único. SHA-256 del token. **El valor original nunca se guarda.** |
| `familyId` | UUID | Requerido. Identifica la cadena de rotaciones nacida de un login. |
| `expiresAt` | datetime | Requerido. |
| `revokedAt` | datetime \| null | `null` mientras el token está vigente. |
| `createdAt` | datetime | Requerido. |

Índices sobre `tokenHash` (único), `userId` y `familyId`.

## 4. Contratos

| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| `POST` | `/auth/register` | Crea una cuenta | Público |
| `POST` | `/auth/login` | Autentica y emite el par de tokens | Público |
| `POST` | `/auth/refresh` | Rota el refresh y emite un par nuevo | Público (requiere refresh válido) |
| `POST` | `/auth/logout` | Revoca el refresh presentado | Público (requiere refresh) |
| `GET` | `/auth/me` | Perfil del usuario autenticado | Access token |
| `GET` | `/users` | Listado paginado de usuarios | Access token + rol `ADMIN` |

### Operaciones clave

```json
// POST /auth/register  (request)
{ "email": "ana@example.com", "password": "unaClaveSegura1" }

// 201 Created
{
  "id": "6f1c...-...",
  "email": "ana@example.com",
  "role": "USER",
  "createdAt": "2026-08-05T10:00:00.000Z"
}
```

```json
// POST /auth/login  (request)
{ "email": "ana@example.com", "password": "unaClaveSegura1" }

// 200 OK
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "9f8c1d...opaco...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

```json
// POST /auth/refresh  (request)
{ "refreshToken": "9f8c1d...opaco..." }

// 200 OK  — mismo cuerpo que el login, con ambos tokens renovados
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "3a7b2e...nuevo...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

```json
// POST /auth/logout  (request)
{ "refreshToken": "3a7b2e...nuevo..." }

// 204 No Content  — sin cuerpo
```

```json
// GET /auth/me      Authorization: Bearer <accessToken>
// 200 OK
{
  "id": "6f1c...-...",
  "email": "ana@example.com",
  "role": "USER",
  "createdAt": "2026-08-05T10:00:00.000Z"
}
```

```json
// GET /users?page=1&limit=20      Authorization: Bearer <accessToken de ADMIN>
// 200 OK
{
  "data": [
    { "id": "6f1c...", "email": "ana@example.com", "role": "USER", "createdAt": "..." }
  ],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}
```

## 5. Reglas de negocio

### Registro

1. El email se normaliza (trim + minúsculas) antes de validarse y guardarse.
2. No pueden existir dos usuarios con el mismo email normalizado; intentarlo devuelve `409`.
3. La contraseña se almacena hasheada con argon2id. Nunca se guarda ni se escribe en logs en claro.
4. La contraseña debe tener entre 8 y 128 caracteres.
5. Todo usuario nuevo se crea con rol `USER`. El rol no puede elegirse desde el registro, aunque venga en el cuerpo.
6. Ninguna respuesta de la API incluye `passwordHash`, en ningún endpoint.

### Login

7. Un login válido devuelve un access token y un refresh token, y abre una **familia** nueva de refresh tokens.
8. Las credenciales inválidas devuelven `401` con el **mismo** mensaje, sin distinguir si el email no existe o si la contraseña es incorrecta.

### Access token

9. Es un JWT firmado con HS256, con payload `{ sub, email, role }`, y expira a los 15 minutos.
10. Una ruta protegida responde `401` si el token falta, está vencido, o su firma no valida.

### Refresh y rotación

11. El refresh token es **opaco** (256 bits aleatorios), no un JWT, y se persiste hasheado con SHA-256.
12. Expira a los 7 días. Rotarlo **no** extiende la expiración de la familia.
13. Cada refresh exitoso rota: revoca el token presentado y emite uno nuevo dentro de la misma familia.
14. Si en `/auth/refresh` se presenta un token ya revocado (reuso), se revoca **la familia completa** y se responde `401`. Un token ya revocado solo pudo llegar de una copia robada.
15. Un refresh inexistente, vencido o revocado responde `401`.
16. `/auth/logout` revoca el token presentado y responde `204`. Es idempotente: repetirlo con un token ya revocado vuelve a responder `204`. **La detección de reuso de la regla 14 aplica solo a `/auth/refresh`**, nunca al logout.

### Roles y administración

17. `GET /users` requiere rol `ADMIN`. Un usuario autenticado con rol `USER` recibe `403`.
18. La paginación acepta `page` (entero ≥ 1, por defecto 1) y `limit` (entero entre 1 y 100, por defecto 20). Un valor fuera de rango se rechaza con `400`.
19. La respuesta incluye `meta` con `total`, `page`, `limit` y `totalPages`.
20. El listado se ordena por `createdAt` descendente y, a igualdad, por `id`, para que la paginación sea estable.

### Integridad

21. Al eliminar un usuario, sus refresh tokens se eliminan en cascada.

## 6. Errores y casos borde

Formato único para toda respuesta de error:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "El email ya está registrado",
  "timestamp": "2026-08-05T10:00:00.000Z",
  "path": "/auth/register"
}
```

Cuando la validación falla, `message` es un arreglo con un texto por campo inválido.

| Código | Situación |
|--------|-----------|
| `400` | Cuerpo o query inválidos: email mal formado, contraseña fuera de rango, `page`/`limit` fuera de rango. |
| `401` | Credenciales inválidas; access token ausente, vencido o mal firmado; refresh inexistente, vencido o revocado. |
| `403` | Autenticado pero sin el rol necesario. |
| `404` | Ruta inexistente. |
| `409` | Email ya registrado. |
| `500` | Error inesperado. El detalle interno se registra en logs pero **no** se devuelve. |

**Casos borde cubiertos:**

- Emails que difieren solo en mayúsculas o espacios (`Ana@Example.com `) son el mismo usuario (regla 1).
- Refresh usado dos veces: el segundo intento revoca la familia (regla 14).
- Logout repetido: sigue siendo `204`, no dispara la regla 14 (regla 16).
- `page` más allá del último: `200` con `data` vacío y `meta` coherente.
- Campos extra en el cuerpo: se descartan, no provocan error.

## 7. Criterios de aceptación

Cada criterio se traduce en al menos un test que lo cita por su identificador.

**Registro**
- **CA-1** — Dado un email libre y una contraseña válida, cuando registro, entonces recibo `201` con `id`, `email`, `role: "USER"` y sin `passwordHash`. *(reglas 3, 5, 6)*
- **CA-2** — Dado un email ya registrado, cuando registro de nuevo, entonces recibo `409`. *(regla 2)*
- **CA-3** — Dado el email `Ana@Example.com ` y existiendo ya `ana@example.com`, cuando registro, entonces recibo `409`. *(reglas 1, 2)*
- **CA-4** — Dada una contraseña de 7 caracteres, cuando registro, entonces recibo `400`. *(regla 4)*
- **CA-5** — Dado un cuerpo que incluye `role: "ADMIN"`, cuando registro, entonces la cuenta creada tiene rol `USER`. *(regla 5)*

**Login**
- **CA-6** — Dadas credenciales correctas, cuando hago login, entonces recibo `200` con `accessToken` y `refreshToken`. *(regla 7)*
- **CA-7** — Dada una contraseña incorrecta, y dado un email inexistente, cuando hago login, entonces ambos casos devuelven `401` con idéntico mensaje. *(regla 8)*
- **CA-8** — Dado un login exitoso, cuando decodifico el access token, entonces su payload trae `sub`, `email` y `role`. *(regla 9)*

**Rutas protegidas**
- **CA-9** — Dado ningún token, cuando pido `/auth/me`, entonces recibo `401`. *(regla 10)*
- **CA-10** — Dado un access token válido, cuando pido `/auth/me`, entonces recibo `200` con mi perfil y sin `passwordHash`. *(reglas 6, 10)*
- **CA-11** — Dado un token con firma alterada, cuando pido `/auth/me`, entonces recibo `401`. *(regla 10)*

**Refresh y rotación**
- **CA-12** — Dado un refresh válido, cuando lo uso, entonces recibo `200` con un par nuevo y el `refreshToken` devuelto es distinto del enviado. *(regla 13)*
- **CA-13** — Dado un refresh ya rotado, cuando lo reuso en `/auth/refresh`, entonces recibo `401` y **todos** los tokens de esa familia quedan revocados. *(regla 14)*
- **CA-14** — Dada una familia revocada por reuso, cuando intento refrescar con el token más reciente de esa familia, entonces recibo `401`. *(reglas 14, 15)*
- **CA-15** — Dado un refresh vencido, cuando lo uso, entonces recibo `401`. *(regla 15)*
- **CA-16** — Dado un refresh válido, cuando hago logout, entonces recibo `204` y ese token deja de servir para refrescar. *(regla 16)*
- **CA-17** — Dado un refresh ya revocado por logout, cuando repito el logout, entonces recibo `204` y la familia **no** se ve afectada. *(regla 16)*

**Roles y listado**
- **CA-18** — Dado un usuario con rol `USER`, cuando pido `/users`, entonces recibo `403`. *(regla 17)*
- **CA-19** — Dado un usuario con rol `ADMIN`, cuando pido `/users`, entonces recibo `200` con `data` y `meta`. *(reglas 17, 19)*
- **CA-20** — Dado `limit=101`, cuando pido `/users` como `ADMIN`, entonces recibo `400`. *(regla 18)*
- **CA-21** — Dados 25 usuarios y `page=2&limit=20`, cuando pido `/users`, entonces `data` trae 5 elementos y `meta.totalPages` es 2. *(reglas 19, 20)*
- **CA-22** — Dado cualquier elemento del listado, cuando lo inspecciono, entonces no contiene `passwordHash`. *(regla 6)*

## 8. Notas / decisiones

**Por qué el refresh token es opaco y no un JWT.** Un JWT es válido mientras no
expire, aunque se haya revocado; para poder revocarlo habría que consultar la base
igual. Como la rotación ya obliga a ir a la base en cada refresh, un token opaco da
lo mismo en costo y es revocable por naturaleza. El access token sí es JWT: es de
vida corta y se valida sin tocar la base.

**Por qué se guarda hasheado.** Si alguien lee la tabla, obtiene hashes inservibles.
Es el mismo criterio que con las contraseñas. Se usa SHA-256 y no argon2 porque el
token ya tiene 256 bits de entropía aleatoria: no hay nada que un ataque de
diccionario pueda adivinar, y la verificación ocurre en cada refresh.

**Por qué la detección de reuso revoca la familia entera.** Si un refresh ya rotado
vuelve a aparecer, hay dos copias en circulación y no se puede saber cuál es la
legítima. Cortar la cadena completa obliga a un login nuevo: molesta al usuario
legítimo, pero expulsa al atacante.

**Tensión aceptada entre las reglas 2 y 8.** El login no revela si un email existe,
pero el registro sí, al devolver `409`. Es un compromiso conocido: sin ese `409` el
registro sería inutilizable. Mitigarlo requeriría un flujo de confirmación por email,
que está fuera de alcance.

**Los tokens viajan en el cuerpo JSON, no en cookies.** Simplifica probar la API con
`curl` y la deja lista para clientes que no son navegadores. Una cookie `httpOnly`
protegería mejor contra XSS y es el camino natural cuando se sume el frontend; el
cambio afectaría al transporte, no a estas reglas.

**El rol se cambia desde la base de datos.** Un endpoint para promover
administradores necesita su propia capa de autorización y auditoría. Queda fuera
hasta que haga falta de verdad.
