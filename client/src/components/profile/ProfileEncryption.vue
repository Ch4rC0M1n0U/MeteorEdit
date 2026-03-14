<template>
  <div class="profile-encryption">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-shield-check-outline</v-icon>
        {{ $t('profile.encryption.title') }}
      </h2>
    </div>

    <div class="enc-card glass-card fade-in fade-in-delay-1">
      <div class="enc-banner">
        <v-icon color="success" size="28">mdi-shield-check</v-icon>
        <div class="enc-banner-text">
          <h3 class="enc-banner-title">{{ $t('profile.encryption.status') }}</h3>
          <p class="enc-banner-detail">{{ $t('profile.encryption.details') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.admin-section-header { margin-bottom: 20px; }
.admin-section-title { font-size: 18px; font-weight: 700; color: var(--me-text-primary); display: flex; align-items: center; }

.enc-card {
  padding: 20px 24px;
}
.enc-banner {
  display: flex;
  align-items: center;
  gap: 16px;
}
.enc-banner-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin: 0 0 4px;
}
.enc-banner-detail {
  font-size: 13px;
  color: var(--me-text-muted);
  margin: 0;
}
</style>
