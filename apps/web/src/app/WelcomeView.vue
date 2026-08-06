<script setup lang="ts">
import Card from 'primevue/card';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import { onMounted, ref } from 'vue';

/**
 * Pantalla de arranque del frontend.
 *
 * No es una feature de negocio: existe para demostrar, de forma visual y no
 * solo desde la consola, que el proxy de Vite hacia la API funciona (vite.config.ts)
 * y que PrimeVue esta cargando su tema correctamente. Cuando exista el login
 * (fase 15), esta vista deja de ser la puerta de entrada.
 */

interface InfoApi {
  titulo: string;
  version: string;
  descripcion: string;
}

const info = ref<InfoApi | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    // /api/docs-json pasa por el proxy definido en vite.config.ts y llega a la
    // API como /docs-json. Si esto responde, el proxy y CORS estan bien.
    const respuesta = await fetch('/api/docs-json');

    if (!respuesta.ok) {
      throw new Error(`La API respondio ${respuesta.status}`);
    }

    const documento = (await respuesta.json()) as {
      info: { title: string; version: string; description: string };
    };

    info.value = {
      titulo: documento.info.title,
      version: documento.info.version,
      descripcion: documento.info.description,
    };
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Error desconocido';
  }
});
</script>

<template>
  <main class="contenedor">
    <Card style="max-width: 32rem">
      <template #title>API de usuarios</template>
      <template #subtitle>Cliente web en Vue 3</template>
      <template #content>
        <p v-if="!info && !error" class="estado-carga">
          <ProgressSpinner style="width: 2rem; height: 2rem" :stroke-width="6" />
          Consultando la API a traves del proxy...
        </p>

        <Message v-else-if="error" severity="error">
          No se pudo contactar la API: {{ error }}
        </Message>

        <div v-else-if="info">
          <p>
            Conectado con <strong>{{ info.titulo }}</strong>
            <Tag :value="`v${info.version}`" severity="success" class="etiqueta-version" />
          </p>
          <p class="descripcion">{{ info.descripcion }}</p>
        </div>
      </template>
    </Card>
  </main>
</template>

<style scoped>
.contenedor {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 1rem;
}

.estado-carga {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.etiqueta-version {
  margin-left: 0.5rem;
}

.descripcion {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
}
</style>
