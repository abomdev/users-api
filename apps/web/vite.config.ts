import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
// defineConfig de 'vitest/config' reexporta el de Vite con el campo `test`
// agregado a los tipos. Se usa este en vez del de 'vite' a secas para no
// tener un vitest.config.ts aparte que pueda desincronizarse del alias `@` y
// del proxy de aca abajo -- los tests importan los mismos modulos que la app.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    proxy: {
      // La API no tiene CORS habilitado para cualquier origen, y sobre todo:
      // el refresh token viaja en una cookie httpOnly cuyos atributos exigen
      // que el navegador vea al front y a la API como el MISMO origen (regla
      // 22 de spec.md). Sin este proxy, la cookie cross-origin necesitaria
      // SameSite=None + Secure, que a su vez exige HTTPS -- inviable en
      // localhost. Con el proxy, para el navegador todo es "localhost:5173".
      //
      // `/api/auth/login` entra aca y sale como `/auth/login` hacia la API:
      // las rutas reales de Nest no llevan el prefijo `/api`.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),

        // La cookie del refresh token llega del backend con `Path=/auth`
        // (regla 22 de la spec raiz): esa ruta es correcta DESDE la API, que
        // no sabe que existe un proxy. Pero el navegador decide si adjuntar
        // una cookie mirando la URL que EL MISMO pidio -- `/api/auth/...',
        // no `/auth/...' -- y esa decision pasa ANTES de que este proxy
        // reescriba nada. Sin este ajuste, la cookie queda guardada con un
        // Path que ninguna peticion real del navegador vuelve a igualar, y
        // /auth/refresh recibe 401 siempre, como si la cookie nunca hubiera
        // llegado. Lo mismo va a hacer falta en nginx para produccion (fase
        // 18), con `proxy_cookie_path`.
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const cookies = proxyRes.headers['set-cookie'];
            if (!cookies) return;

            proxyRes.headers['set-cookie'] = cookies.map((cookie) =>
              cookie.replace(/Path=\/auth\b/i, 'Path=/api/auth'),
            );
          });
        },
      },
    },
  },

  test: {
    environment: 'jsdom',
    // Fase 13 solo deja el andamiaje: los tests de verdad -- store de auth,
    // reintento tras 401, guards -- se escriben recien en la fase 17. Sin
    // esto, `pnpm test` fallaria con "No test files found" hasta entonces y
    // rompería `pnpm -r test` corrido desde la raiz del monorepo.
    passWithNoTests: true,
  },
});
