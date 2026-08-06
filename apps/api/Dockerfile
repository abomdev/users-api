# syntax=docker/dockerfile:1

# IMPORTANTE: el contexto de build es la RAIZ del monorepo, no esta carpeta.
# En un workspace de pnpm el lockfile vive arriba, y sin el no se puede
# instalar con --frozen-lockfile. Por eso todas las rutas de COPY empiezan en
# la raiz. El docker-compose ya lo configura asi.

# ---------------------------------------------------------------------------
# Base comun: Node y pnpm.
#
# Se usa bookworm-slim (Debian) y no Alpine: el motor de esquema de Prisma es
# un binario nativo compilado contra glibc, y en Alpine (musl) hace falta
# instalar compatibilidad a mano. La diferencia de tamano no justifica el
# riesgo en un proyecto donde las migraciones se corren desde un contenedor.
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"

# Se instala pnpm directamente y no con corepack. El shim de corepack lee
# package.json para decidir que version usar, y ahi encuentra el `devEngines`
# con un rango (^11.0.0), que rechaza por no ser una version exacta. Instalarlo
# asi deja una unica fuente de verdad sobre el gestor de paquetes -- devEngines,
# que ademas es lo que impide usar npm por accidente -- y una version fija, para
# que la imagen se construya igual hoy que dentro de seis meses.
RUN npm install -g pnpm@11.1.2

WORKDIR /app


# ---------------------------------------------------------------------------
# Dependencias completas (incluidas las de desarrollo).
#
# Se copian primero solo los manifiestos: mientras no cambien, Docker reutiliza
# esta capa y no vuelve a descargar nada aunque cambie el codigo fuente.
#
# El schema de Prisma y el tsconfig tambien van aca porque el postinstall corre
# `prisma generate`, que los necesita a los dos.
# ---------------------------------------------------------------------------
FROM base AS deps

# El motor de esquema de Prisma -- el que aplica las migraciones -- se enlaza
# contra OpenSSL. La imagen slim no lo trae, y sin el Prisma avisa que "puede no
# funcionar como se espera". Va solo en esta etapa: de aca heredan `build` y el
# servicio de migraciones, mientras que la imagen final arranca de `base` y se
# queda sin este peso, porque en tiempo de ejecucion no migra nada.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma.config.ts apps/api/tsconfig.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma

# prisma.config.ts exige DATABASE_URL al cargarse. `generate` no se conecta a
# ninguna base -- solo lee el schema -- asi que un valor de relleno alcanza y
# evita que una credencial real quede grabada en una capa de la imagen.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

# --filter api instala solo lo que necesita esta aplicacion, no todo el
# monorepo: el frontend no tiene nada que hacer en la imagen del backend.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter api


# ---------------------------------------------------------------------------
# Compilacion.
# ---------------------------------------------------------------------------
FROM deps AS build
COPY apps/api/tsconfig.build.json apps/api/nest-cli.json apps/api/.swcrc ./apps/api/
COPY apps/api/src ./apps/api/src
RUN pnpm --filter api build


# ---------------------------------------------------------------------------
# Imagen final: solo lo necesario para ejecutar.
#
# Se instalan unicamente las dependencias de produccion y se copia el `dist` ya
# compilado. Ni el codigo TypeScript, ni los tests, ni el compilador viajan.
# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/

# --ignore-scripts salta el postinstall, que ejecutaria `prisma generate`: el
# cliente ya viene compilado dentro de dist, y la CLI de Prisma es una
# dependencia de desarrollo que no existe en esta imagen.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts --filter api

# El paquete `prisma` entra en produccion aunque sea una dependencia de
# desarrollo, y no es un error: en Prisma 7 el *query compiler* (los .wasm que
# traducen las consultas a SQL) vive ahi, y por eso @prisma/client lo declara
# como peer. Quitarlo rompe la aplicacion en la primera consulta.
#
# Lo que si sobra son las dependencias de Prisma Studio, que viaja dentro del
# mismo paquete: su interfaz en React, el motor de graficos y una base de datos
# embebida. Nada de eso participa de ejecutar consultas.
#
# Se borra como root, antes del USER node de mas abajo.
RUN rm -rf \
      node_modules/.pnpm/@prisma+studio-core@* \
      node_modules/.pnpm/@prisma+dev@* \
      node_modules/.pnpm/@electric-sql+pglite@* \
      node_modules/.pnpm/effect@* \
      node_modules/.pnpm/typescript@* \
      node_modules/.pnpm/@types+react* \
      node_modules/.pnpm/react@* \
      node_modules/.pnpm/react-dom@*

COPY --from=build /app/apps/api/dist ./apps/api/dist

# Node busca node_modules subiendo por el arbol de directorios, asi que desde
# aca encuentra tanto apps/api/node_modules como el de la raiz del workspace.
WORKDIR /app/apps/api

# La imagen de Node trae un usuario `node` sin privilegios. Si no se cambia,
# el proceso corre como root y cualquier fallo de la aplicacion se ejecuta con
# permisos totales dentro del contenedor.
USER node

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
