<template>
  <div class="profile-social-sessions">
    <SocialSessionManager embedded />
  </div>
</template>

<script setup lang="ts">
import SocialSessionManager from '../media/SocialSessionManager.vue';
</script>

<style scoped>
.profile-social-sessions {
  padding: 24px;
}
</style>
