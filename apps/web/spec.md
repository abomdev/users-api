# Spec: cliente web de la API de usuarios

> Este documento es la fuente de verdad del **comportamiento del cliente**. La
> spec de la raiz (`../../spec.md`) define el contrato de la API -- endpoints,
> reglas de negocio, formato de errores -- y no se repite aca. Esta spec cubre
> la otra mitad: como se comporta la interfaz que consume ese contrato.
>
> Las reglas de esta spec se numeran `RF-n` (regla de frontend) y los
> criterios `CAF-n`, con prefijo propio para no confundirlos con las `regla n`
> y `CA-n` del backend cuando ambas specs se citan juntas.

## 1. Contexto y objetivo

Cliente web en Vue 3 para la API de usuarios: permite registrarse, iniciar
sesion, mantenerla activa entre recargas de pagina, ver el perfil propio y,
para administradores, listar las cuentas existentes.

No es solo una capa visual sobre la API: la parte no trivial es sostener una
sesion con un access token de vida corta (15 minutos) sin que el usuario lo
note, usando el refresh automatico que ya expone el backend.

## 2. Alcance

**Dentro de alcance:**

- Registro e inicio de sesion.
- Sesion persistente entre recargas (F5), usando el refresh silencioso.
- Renovacion automatica del access token vencido, transparente para quien usa
  la app.
- Perfil propio.
- Panel de administracion con el listado paginado, visible solo para `ADMIN`.
- Cierre de sesion.

**Fuera de alcance (por ahora):**

- Recuperacion de contrasena y verificacion de email: la API no los expone
  (ver seccion 2 de la spec raiz).
- Edicion de perfil y cambio de contrasena: no hay endpoint para eso.
- Tema oscuro / claro configurable, internacionalizacion.
- Renderizado en servidor (SSR). Es una SPA servida como archivos estaticos.
- Notificaciones push o websockets: todo el intercambio con la API es HTTP
  simple.

## 3. Arquitectura

```
src/
  app/          bootstrap: router, configuracion de PrimeVue, layouts
  features/
    auth/       login, registro, store y guards de sesion
    users/      perfil propio y panel de administracion
  shared/
    api/        cliente HTTP tipado y su logica de refresh (fase 14)
    components/ piezas de UI reusadas entre features
```

Organizada por *feature* y no por tipo de archivo: todo lo de autenticacion
vive junto, en lugar de repartir componentes, store y vistas en carpetas
paralelas. `shared/` es lo que dos o mas features usan.

**El frontend nunca llama a la API por su puerto propio.** Habla con `/api`,
del mismo origen que el propio frontend -- en desarrollo, el proxy de
`vite.config.ts`; en produccion, nginx (fase 18). Este punto no es una
preferencia de organizacion: **es funcional**. La regla 22 de la spec raiz
exige que la cookie del refresh token sea `HttpOnly` y `SameSite=Lax`; una
cookie cross-origin necesitaria `SameSite=None` + `Secure`, que a su vez exige
HTTPS, inviable en `http://localhost`. El proxy hace que, para el navegador,
API y frontend sean el mismo origen.

## 4. Rutas

| Ruta | Vista | Acceso |
|------|-------|--------|
| `/login` | Iniciar sesion | Publica |
| `/registro` | Crear cuenta | Publica |
| `/perfil` | Perfil propio | Requiere sesion |
| `/admin/usuarios` | Listado paginado | Requiere sesion + rol `ADMIN` |

## 5. Reglas de comportamiento

### Sesion y tokens

1. El access token vive **solo en memoria** (un store de Pinia), nunca en
   `localStorage`, `sessionStorage` ni en una cookie propia del frontend. Es la
   contraparte de la regla 22 del backend: si el access token se persistiera,
   un XSS que lo robara tendria una ventana de ataque mucho mayor que los 15
   minutos que dura en memoria.
2. El refresh token nunca es visible ni manipulable desde el frontend: viaja
   en la cookie `HttpOnly` que puso el backend, y el codigo del cliente jamas
   la lee ni la escribe directamente.
3. Al arrancar la aplicacion (carga inicial o recarga de pagina), como el
   access token en memoria se perdio, el cliente intenta un refresh silencioso
   contra `/auth/refresh` **antes** de decidir que mostrar. Si responde con un
   par nuevo, la sesion continua sin pedir credenciales. Si responde `401`, se
   trata como "no hay sesion" -- sin mostrar ningun error, porque es
   indistinguible de alguien que nunca inicio sesion.
4. Toda peticion a una ruta protegida de la API adjunta el access token en el
   header `Authorization: Bearer`.
5. Si una peticion autenticada responde `401` por access token vencido, el
   cliente llama una vez a `/auth/refresh` y reintenta la peticion original.
   Si el refresh tambien falla, se limpia la sesion local y se redirige a
   `/login`.
6. Si varias peticiones fallan por `401` al mismo tiempo, comparten una unica
   promesa de refresh en lugar de disparar varias rotaciones simultaneas. Dos
   refrescos concurrentes harian que el segundo presente un refresh token ya
   rotado por el primero, lo que en el backend dispara la deteccion de reuso
   (regla 14 de la spec raiz) y cierra la sesion entera por un problema que
   creo el propio cliente, no un atacante.
7. El logout limpia el access token de memoria y llama a `/auth/logout` para
   revocar la cookie en el backend. Si esa llamada falla igual se completa el
   logout localmente: la sesion del lado del cliente no puede depender de que
   la red funcione en el momento de salir.

### Rutas y acceso

8. Una ruta que requiere sesion, sin sesion activa, redirige a `/login`
   recordando la ruta de destino para volver ahi despues de autenticarse.
9. La ruta de administracion exige ademas rol `ADMIN`. Un usuario autenticado
   sin ese rol es redirigido sin ver el menu ni el contenido de la seccion.
10. Como el rol viaja dentro del access token (regla 9 de la spec raiz), un
    cambio de rol hecho en la base de datos no se refleja hasta que la sesion
    se renueve -- exactamente lo mismo que se verifico en el backend en la
    fase 6. El cliente no intenta ocultar esa latencia.

### Formularios y errores

11. El formulario de registro valida en el cliente el largo de la contrasena
    (regla 4) y el formato del email antes de enviar, para dar una respuesta
    inmediata. Esa validacion es una comodidad de UX, no una garantia: la
    definitiva es la que aplica el backend, y el cliente muestra el error que
    venga de ahi si de todos modos ocurre.
12. Los errores de la API llegan con la forma `{ statusCode, error, message,
    timestamp, path }` (seccion 6 de la spec raiz). El cliente traduce
    `message` a un texto legible -- ya sea una cadena o un arreglo de
    cadenas -- y nunca muestra el JSON crudo.
13. Una falla de red (sin respuesta HTTP: servidor caido, sin conexion) se
    distingue de un `401`: no dispara el cierre de sesion ni redirige a
    login. Muestra un aviso de conectividad, porque no hay ninguna evidencia
    de que la sesion sea invalida.

## 6. Errores y casos borde

- El refresh silencioso del arranque (regla 3) nunca muestra un mensaje de
  error: su fracaso es un estado normal, no una falla.
- Dos pestañas abiertas con la misma sesion: cada una mantiene su propio
  access token en memoria: cerrar sesion en una no afecta a la otra hasta que
  esta intente su proximo refresh y la cookie ya no sea valida.
- Un `403` en una ruta a la que ya se habia entrado (por ejemplo, se revoco el
  rol mientras la sesion seguia activa) se muestra como aviso dentro de la
  vista, no se confunde con una falta de sesion.

## 7. Criterios de aceptacion

- **CAF-1** — Dado que no hay sesion, cuando se carga la aplicacion, entonces
  se muestra `/login` sin mensajes de error. *(regla 3)*
- **CAF-2** — Dado un login exitoso, cuando se recarga la pagina, entonces la
  sesion persiste sin pedir credenciales de nuevo. *(reglas 1, 3)*
- **CAF-3** — Dado un access token vencido, cuando se hace una peticion
  autenticada, entonces el cliente refresca una vez y la reintenta sin que se
  note. *(regla 5)*
- **CAF-4** — Dadas tres peticiones simultaneas que fallan por token vencido,
  cuando se disparan a la vez, entonces `/auth/refresh` se llama una sola vez.
  *(regla 6)*
- **CAF-5** — Dado un usuario sin sesion, cuando intenta entrar a `/perfil` por
  URL, entonces es redirigido a `/login`. *(regla 8)*
- **CAF-6** — Dado un usuario con rol `USER`, cuando intenta entrar a
  `/admin/usuarios` por URL, entonces es redirigido y no ve el menu de
  administracion. *(regla 9)*
- **CAF-7** — Dado un logout, cuando se completa, entonces no queda ningun
  token en memoria y la cookie de refresh fue borrada. *(regla 7)*
- **CAF-8** — Dada una falla de red sin respuesta HTTP, cuando ocurre durante
  una peticion autenticada, entonces se muestra un aviso de conectividad y no
  se cierra la sesion. *(regla 13)*

## 8. Notas / decisiones

**Por que el access token vive solo en Pinia y no en `localStorage`.** Es el
mismo razonamiento de la regla 22 del backend, aplicado del lado del cliente:
`localStorage` es legible por cualquier script que corra en la pagina. Guardar
ahi el access token no seria tan grave como guardar el refresh (dura 15
minutos, no 7 dias), pero seguiria siendo una superficie de ataque
innecesaria cuando la memoria alcanza y sobra.

**Por que el refresh silencioso es obligatorio y no una comodidad.** Sin el,
recargar la pagina (F5) desloguearia siempre: el access token vive en memoria
y una recarga borra la memoria de la pestaña. La cookie `HttpOnly` es
precisamente lo que sobrevive a la recarga, y el refresh silencioso es el
mecanismo que la aprovecha.

**Por que compartir una unica promesa de refresh (regla 6).** No es solo una
optimizacion. El backend rota el refresh token en cada uso (regla 13 de la
spec raiz) y revoca la familia entera si detecta uno ya usado (regla 14). Si
el cliente disparara un refresh por cada peticion en paralelo que reciba 401,
el segundo refresh en llegar presentaria un token que el primero ya rotara, y
el backend lo interpretaria como el mismo ataque que esta disenado para
frenar. El cliente tiene que comportarse, el mismo, como un unico actor.
