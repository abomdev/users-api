# syntax=docker/dockerfile:1

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
# El schema de Prisma tambien va aca porque el postinstall corre `prisma
# generate`, que lo necesita.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma

# prisma.config.ts exige DATABASE_URL al cargarse. `generate` no se conecta a
# ninguna base -- solo lee el schema -- asi que un valor de relleno alcanza y
# evita que una credencial real quede grabada en una capa de la imagen.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile


# ---------------------------------------------------------------------------
# Compilacion.
# ---------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.build.json nest-cli.json .swcrc ./
COPY src ./src
RUN pnpm build


# ---------------------------------------------------------------------------
# Imagen final: solo lo necesario para ejecutar.
#
# Se instalan unicamente las dependencias de produccion y se copia el `dist` ya
# compilado. Ni el codigo TypeScript, ni los tests, ni el compilador viajan.
# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# --ignore-scripts salta el postinstall, que ejecutaria `prisma generate`: el
# cliente ya viene compilado dentro de dist, y la CLI de Prisma es una
# dependencia de desarrollo que no existe en esta imagen.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts

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

COPY --from=build /app/dist ./dist

# La imagen de Node trae un usuario `node` sin privilegios. Si no se cambia,
# el proceso corre como root y cualquier fallo de la aplicacion se ejecuta con
# permisos totales dentro del contenedor.
USER node

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
