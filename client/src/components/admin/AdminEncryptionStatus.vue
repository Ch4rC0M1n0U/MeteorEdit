<template>
  <div class="admin-encryption">
    <div class="admin-section-header fade-in">
      <h2 class="admin-section-title mono">
        <v-icon size="20" class="mr-2">mdi-shield-lock-outline</v-icon>
        {{ $t('admin.encryption.title') }}
      </h2>
    </div>

    <div class="enc-status-card glass-card fade-in fade-in-delay-1 enc-status--active">
      <v-icon color="success" size="32">mdi-shield-check</v-icon>
      <div class="enc-status-info">
        <h3 class="enc-status-text">{{ $t('admin.encryption.allEncrypted') }}</h3>
        <p class="enc-status-detail">{{ $t('admin.encryption.allEncryptedDetail') }}</p>
      </div>
    </div>

    <div class="enc-info-cards fade-in fade-in-delay-2">
      <div class="enc-info-card glass-card">
        <v-icon size="20" color="primary">mdi-key-variant</v-icon>
        <div>
          <h4 class="enc-info-title mono">{{ $t('admin.encryption.algorithm') }}</h4>
          <p class="enc-info-value">RSA-OAEP 4096 + AES-256-GCM</p>
        </div>
      </div>
      <div class="enc-info-card glass-card">
        <v-icon size="20" color="primary">mdi-lock-outline</v-icon>
        <div>
          <h4 class="enc-info-title mono">{{ $t('admin.encryption.keyDerivation') }}</h4>
          <p class="enc-info-value">PBKDF2 SHA-256 (600 000 iterations)</p>
        </div>
      </div>
      <div class="enc-info-card glass-card">
        <v-icon size="20" color="primary">mdi-eye-off-outline</v-icon>
        <div>
          <h4 class="enc-info-title mono">{{ $t('admin.encryption.zeroKnowledge') }}</h4>
          <p class="enc-info-value">{{ $t('admin.encryption.zeroKnowledgeDesc') }}</p>
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

.enc-status-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  margin-bottom: 20px;
  border-left: 3px solid var(--me-accent);
}
.enc-status--active {
  border-left-color: #4caf50;
}
.enc-status-info {
  flex: 1;
}
.enc-status-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--me-text-primary);
  margin: 0 0 4px;
}
.enc-status-detail {
  font-size: 13px;
  color: var(--me-text-muted);
  margin: 0;
}

.enc-info-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}
.enc-info-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
}
.enc-info-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--me-text-muted);
  margin: 0 0 4px;
}
.enc-info-value {
  font-size: 13px;
  color: var(--me-text-primary);
  margin: 0;
}
</style>
