<template>
  <div class="psr-card" :class="`psr-card--${result.status}`">
    <div class="psr-avatar-wrap">
      <img
        v-if="result.profile?.avatarUrl"
        :src="result.profile.avatarUrl"
        :alt="result.profile.name || result.phoneE164"
        class="psr-avatar"
        @error="onAvatarError"
      />
      <div v-else class="psr-avatar psr-avatar--fallback">
        <SocialIcon :platform="result.platform" :size="28" />
      </div>
      <span v-if="result.profile?.isBusiness" class="psr-business-badge" :title="$t('phoneScanner.business')">
        <i class="pi pi-briefcase" />
      </span>
    </div>

    <div class="psr-body">
      <div class="psr-phone mono">{{ formatPhone(result.phoneE164) }}</div>
      <div v-if="result.profile?.name" class="psr-name">{{ result.profile.name }}</div>
      <div v-if="result.profile?.about" class="psr-about" :title="result.profile.about">
        {{ result.profile.about }}
      </div>
      <div class="psr-status">
        <span :class="['psr-badge', `psr-badge--${result.status}`]">
          <i :class="statusIcon" />
          {{ statusLabel }}
        </span>
      </div>
    </div>

    <div class="psr-actions">
      <Button
        v-if="result.status === 'exists'"
        icon="pi pi-external-link"
        size="small"
        text
        rounded
        :title="$t('phoneScanner.openInWhatsapp')"
        @click="openWaMe"
      />
      <Button
        v-if="result.status === 'exists'"
        icon="pi pi-folder-plus"
        size="small"
        text
        rounded
        :title="$t('phoneScanner.addToDossier')"
        :loading="creating"
        @click="emit('add-to-dossier', result)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import SocialIcon from '../common/SocialIcon.vue';
import { formatPhone, buildWaMeUrl } from './phoneScannerHelpers';
import type { PhoneScanResult } from '../../stores/phoneScanner';

const props = defineProps<{
  result: PhoneScanResult;
  creating?: boolean;
}>();

const emit = defineEmits<{
  'add-to-dossier': [result: PhoneScanResult];
}>();

const { t } = useI18n();

const statusIcon = computed(() => ({
  exists: 'pi pi-check-circle',
  not_found: 'pi pi-times-circle',
  error: 'pi pi-exclamation-triangle',
  rate_limited: 'pi pi-clock',
}[props.result.status] || 'pi pi-circle'));

const statusLabel = computed(() => t(`phoneScanner.status.${props.result.status}`));

function openWaMe(): void {
  window.open(buildWaMeUrl(props.result.phoneE164), '_blank', 'noopener,noreferrer');
}

const avatarFailed = ref(false);
function onAvatarError(): void {
  avatarFailed.value = true;
}
</script>

<style scoped>
.psr-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-radius: 10px;
  background: var(--me-bg-elevated);
  border: 1px solid var(--me-border);
  transition: border-color 0.15s, transform 0.1s;
}
.psr-card:hover {
  border-color: var(--me-accent, #6366f1);
}
.psr-card--not_found,
.psr-card--error {
  opacity: 0.55;
}

.psr-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.psr-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
}
.psr-avatar--fallback {
  display: flex;
  align-items: center;
  justify-content: center;
}
.psr-business-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f59e0b;
  color: #fff;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--me-bg-elevated);
}

.psr-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.psr-phone {
  font-size: 13px;
  color: var(--me-text-secondary);
  font-weight: 600;
}
.psr-name {
  font-size: 15px;
  color: var(--me-text-primary);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.psr-about {
  font-size: 12px;
  color: var(--me-text-muted);
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.psr-status {
  margin-top: 4px;
}

.psr-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.psr-badge--exists {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
}
.psr-badge--not_found {
  color: #6b7280;
  background: rgba(107, 114, 128, 0.12);
}
.psr-badge--error {
  color: #b91c1c;
  background: rgba(239, 68, 68, 0.12);
}
.psr-badge--rate_limited {
  color: #b45309;
  background: rgba(245, 158, 11, 0.12);
}

.psr-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-self: center;
}
</style>
