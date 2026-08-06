<script setup lang="ts">
/**
 * Banco de pruebas TEMPORAL para verificar el refresh automatico (fase 14).
 *
 * No es una pantalla real de la aplicacion -- no hay login/registro de
 * verdad todavia, eso es la fase 15 -- existe solo para poder observar, con
 * los propios ojos y no solo leyendo el codigo, que `client.ts` hace lo que
 * promete: adjunta el token, refresca una vez ante un 401 y reintenta.
 *
 * Se elimina en la fase 15, cuando el login real y el store de Pinia la
 * reemplazan.
 */
import Button from 'primevue/button';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import { computed, onUnmounted, ref } from 'vue';
import { getMe, login, logout, register } from '../shared/api/auth.api';
import { ApiError, NetworkError } from '../shared/api/api-error';
import { currentAccessToken } from '../shared/api/token-store';

interface EntradaLog {
  hora: string;
  texto: string;
  huella: string;
}

const email = ref('smoke@example.com');
const password = ref('unaClaveSegura1');
const cargando = ref(false);
const error = ref<string | null>(null);
const log = ref<EntradaLog[]>([]);
const sondeando = ref(false);
let temporizador: ReturnType<typeof setInterval> | undefined;

/** Los ultimos 8 caracteres del token: alcanza para notar cuando CAMBIA sin exponerlo entero en pantalla. */
const huellaToken = computed(() => currentAccessToken.value?.slice(-8) ?? '(sin token)');

function agregarLog(texto: string): void {
  log.value.unshift({
    hora: new Date().toLocaleTimeString(),
    texto,
    huella: huellaToken.value,
  });
}

/** Decodifica el payload del JWT solo para mostrar `exp`; no valida la firma (para eso esta el backend). */
function segundosHastaVencer(): number | null {
  const token = currentAccessToken.value;
  if (!token) return null;
  const payload = JSON.parse(atob(token.split('.')[1])) as { exp: number };
  return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
}

const vidaRestante = ref<number | null>(null);
setInterval(() => {
  vidaRestante.value = segundosHastaVencer();
}, 1000);

async function manejar(accion: () => Promise<unknown>, etiqueta: string): Promise<void> {
  cargando.value = true;
  error.value = null;
  try {
    await accion();
    agregarLog(`${etiqueta}: OK`);
  } catch (e) {
    if (e instanceof ApiError) {
      error.value = `${e.status}: ${e.message}`;
      agregarLog(`${etiqueta}: ApiError ${e.status}`);
    } else if (e instanceof NetworkError) {
      error.value = e.message;
      agregarLog(`${etiqueta}: NetworkError`);
    } else {
      throw e;
    }
  } finally {
    cargando.value = false;
  }
}

const alRegistrar = () =>
  manejar(() => register({ email: email.value, password: password.value }), 'registro');

const alLoguear = () => manejar(() => login({ email: email.value, password: password.value }), 'login');

const alConsultarMe = () => manejar(() => getMe(), 'GET /auth/me');

const alCerrarSesion = () => manejar(() => logout(), 'logout');

function alternarSondeo(): void {
  sondeando.value = !sondeando.value;
  if (sondeando.value) {
    // Cada 5s golpea /auth/me. Con JWT_ACCESS_TTL_SECONDS=60 en el .env, en
    // algun momento entre el segundo 60 y 65 uno de estos pedidos va a
    // encontrarse el token vencido -- y ahi es cuando hay que mirar la
    // pestaña Network: dos peticiones en vez de una (el 401 y el reintento),
    // y en este log, la "huella" del token cambiando de valor.
    temporizador = setInterval(() => void alConsultarMe(), 5000);
  } else if (temporizador) {
    clearInterval(temporizador);
  }
}

onUnmounted(() => {
  if (temporizador) clearInterval(temporizador);
});
</script>

<template>
  <main class="contenedor">
    <Card style="width: 100%; max-width: 36rem">
      <template #title>Banco de pruebas del refresh automatico</template>
      <template #subtitle>Fase 14 -- se reemplaza por el login real en la fase 15</template>
      <template #content>
        <div class="fila">
          <InputText v-model="email" placeholder="email" />
          <Password v-model="password" placeholder="password" :feedback="false" toggle-mask />
        </div>

        <div class="fila">
          <Button label="Registrarse" severity="secondary" :loading="cargando" @click="alRegistrar" />
          <Button label="Iniciar sesion" :loading="cargando" @click="alLoguear" />
          <Button label="GET /auth/me" :loading="cargando" @click="alConsultarMe" />
          <Button label="Cerrar sesion" severity="danger" :loading="cargando" @click="alCerrarSesion" />
        </div>

        <div class="fila">
          <Button
            :label="sondeando ? 'Dejar de sondear' : 'Sondear /auth/me cada 5s'"
            :severity="sondeando ? 'warn' : 'info'"
            @click="alternarSondeo"
          />
        </div>

        <Message v-if="error" severity="error" class="mensaje">{{ error }}</Message>

        <dl class="estado">
          <dt>Token actual (ultimos 8):</dt>
          <dd>{{ huellaToken }}</dd>
          <dt>Vence en:</dt>
          <dd>{{ vidaRestante ?? '--' }}s</dd>
        </dl>

        <ul class="log">
          <li v-for="(entrada, i) in log" :key="i">
            <span class="hora">{{ entrada.hora }}</span>
            <span>{{ entrada.texto }}</span>
            <span class="huella">token …{{ entrada.huella }}</span>
          </li>
        </ul>
      </template>
    </Card>
  </main>
</template>

<style scoped>
.contenedor {
  display: flex;
  justify-content: center;
  padding: 2rem 1rem;
}

.fila {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.mensaje {
  margin-bottom: 0.75rem;
}

.estado {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 0.75rem;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.log {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 14rem;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.8rem;
  border-top: 1px solid var(--p-content-border-color);
}

.log li {
  display: flex;
  gap: 0.75rem;
  padding: 0.25rem 0;
  border-bottom: 1px dashed var(--p-content-border-color);
}

.hora {
  color: var(--p-text-muted-color);
}

.huella {
  margin-left: auto;
  color: var(--p-primary-color);
}
</style>
