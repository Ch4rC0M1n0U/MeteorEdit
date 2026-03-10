<template>
  <v-snackbar
    v-model="showPrompt"
    :timeout="-1"
    location="bottom end"
    color="surface"
    class="pwa-update-snackbar"
    multi-line
  >
    <div class="d-flex align-center ga-3">
      <v-icon icon="mdi-update" color="primary" />
      <span>Une nouvelle version est disponible</span>
    </div>
    <template #actions>
      <v-btn
        variant="tonal"
        color="primary"
        size="small"
        @click="updateServiceWorker()"
      >
        Mettre à jour
      </v-btn>
      <v-btn
        variant="text"
        size="small"
        @click="close"
      >
        Plus tard
      </v-btn>
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';

const showPrompt = ref(false);

const { updateServiceWorker } = useRegisterSW({
  onNeedRefresh() {
    showPrompt.value = true;
  },
  onOfflineReady() {
    // silently ready
  },
});

function close() {
  showPrompt.value = false;
}
</script>
