import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import { createApp } from 'vue';
import { primeVueConfig } from './app/primevue';
import { router } from './app/router';
import App from './App.vue';

import 'primeicons/primeicons.css';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(PrimeVue, primeVueConfig);

app.mount('#app');
