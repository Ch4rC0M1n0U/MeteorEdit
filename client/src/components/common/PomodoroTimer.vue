<template>
  <div class="pomodoro">
    <div class="pomo-display" :class="{ 'pomo-break': isBreak }" @click="showSettings = true" title="Configurer">
      <span class="pomo-time mono">{{ display }}</span>
      <span v-if="running" class="pomo-label mono">{{ isBreak ? 'Pause' : 'Focus' }}</span>
    </div>
    <div class="pomo-controls">
      <button v-if="!running" class="pomo-btn pomo-btn-start" @click="start" title="Demarrer">
        <v-icon size="16">mdi-play</v-icon>
      </button>
      <button v-else class="pomo-btn pomo-btn-pause" @click="pause" title="Pause">
        <v-icon size="16">mdi-pause</v-icon>
      </button>
      <button class="pomo-btn" @click="reset" title="Reinitialiser">
        <v-icon size="14">mdi-refresh</v-icon>
      </button>
      <button class="pomo-btn" @click="skip" title="Passer" v-if="running">
        <v-icon size="14">mdi-skip-next</v-icon>
      </button>
      <button class="pomo-btn" @click="showSettings = true" title="Parametres">
        <v-icon size="14">mdi-cog-outline</v-icon>
      </button>
    </div>
    <div class="pomo-sessions mono">
      <span v-for="i in sessionsBeforeLong" :key="i" class="pomo-dot" :class="{ 'pomo-dot--done': i <= completedSessions }" />
    </div>

    <!-- Settings Modal -->
    <v-dialog v-model="showSettings" max-width="380" persistent>
      <div class="pomo-settings glass-card">
        <div class="pomo-settings-header">
          <v-icon size="20" class="pomo-settings-icon">mdi-timer-cog-outline</v-icon>
          <span>Configuration Pomodoro</span>
          <button class="pomo-settings-close" @click="cancelSettings">
            <v-icon size="18">mdi-close</v-icon>
          </button>
        </div>

        <div class="pomo-settings-body">
          <div class="pomo-field">
            <label class="pomo-field-label">Focus (min)</label>
            <div class="pomo-stepper">
              <button class="pomo-stepper-btn" @click="tmpFocus = Math.max(1, tmpFocus - 5)">
                <v-icon size="14">mdi-minus</v-icon>
              </button>
              <input v-model.number="tmpFocus" type="number" min="1" max="120" class="pomo-stepper-input mono" />
              <button class="pomo-stepper-btn" @click="tmpFocus = Math.min(120, tmpFocus + 5)">
                <v-icon size="14">mdi-plus</v-icon>
              </button>
            </div>
          </div>

          <div class="pomo-field">
            <label class="pomo-field-label">Pause courte (min)</label>
            <div class="pomo-stepper">
              <button class="pomo-stepper-btn" @click="tmpShort = Math.max(1, tmpShort - 1)">
                <v-icon size="14">mdi-minus</v-icon>
              </button>
              <input v-model.number="tmpShort" type="number" min="1" max="60" class="pomo-stepper-input mono" />
              <button class="pomo-stepper-btn" @click="tmpShort = Math.min(60, tmpShort + 1)">
                <v-icon size="14">mdi-plus</v-icon>
              </button>
            </div>
          </div>

          <div class="pomo-field">
            <label class="pomo-field-label">Pause longue (min)</label>
            <div class="pomo-stepper">
              <button class="pomo-stepper-btn" @click="tmpLong = Math.max(1, tmpLong - 5)">
                <v-icon size="14">mdi-minus</v-icon>
              </button>
              <input v-model.number="tmpLong" type="number" min="1" max="60" class="pomo-stepper-input mono" />
              <button class="pomo-stepper-btn" @click="tmpLong = Math.min(60, tmpLong + 5)">
                <v-icon size="14">mdi-plus</v-icon>
              </button>
            </div>
          </div>

          <div class="pomo-field">
            <label class="pomo-field-label">Sessions avant pause longue</label>
            <div class="pomo-stepper">
              <button class="pomo-stepper-btn" @click="tmpSessions = Math.max(2, tmpSessions - 1)">
                <v-icon size="14">mdi-minus</v-icon>
              </button>
              <input v-model.number="tmpSessions" type="number" min="2" max="10" class="pomo-stepper-input mono" />
              <button class="pomo-stepper-btn" @click="tmpSessions = Math.min(10, tmpSessions + 1)">
                <v-icon size="14">mdi-plus</v-icon>
              </button>
            </div>
          </div>

          <div class="pomo-field pomo-field-toggle">
            <label class="pomo-field-label">Notifications bureau</label>
            <button class="pomo-toggle" :class="{ 'pomo-toggle--on': tmpNotify }" @click="tmpNotify = !tmpNotify">
              <span class="pomo-toggle-knob" />
            </button>
          </div>

          <div class="pomo-field pomo-field-toggle">
            <label class="pomo-field-label">Son a la fin</label>
            <button class="pomo-toggle" :class="{ 'pomo-toggle--on': tmpSound }" @click="tmpSound = !tmpSound">
              <span class="pomo-toggle-knob" />
            </button>
          </div>
        </div>

        <div class="pomo-settings-footer">
          <button class="pomo-settings-btn pomo-settings-btn--cancel" @click="cancelSettings">Annuler</button>
          <button class="pomo-settings-btn pomo-settings-btn--save" @click="saveSettings">Appliquer</button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { usePomodoro } from '../../composables/usePomodoro';

const {
  focusDuration, shortBreak, longBreak, sessionsBeforeLong,
  notifyEnabled, soundEnabled,
  running, isBreak, completedSessions, display,
  start, pause, reset, skip, applySettings,
} = usePomodoro();

const showSettings = ref(false);

// Temp settings for modal
const tmpFocus = ref(25);
const tmpShort = ref(5);
const tmpLong = ref(15);
const tmpSessions = ref(4);
const tmpNotify = ref(true);
const tmpSound = ref(true);

watch(showSettings, (open) => {
  if (open) {
    tmpFocus.value = focusDuration.value;
    tmpShort.value = shortBreak.value;
    tmpLong.value = longBreak.value;
    tmpSessions.value = sessionsBeforeLong.value;
    tmpNotify.value = notifyEnabled.value;
    tmpSound.value = soundEnabled.value;
  }
});

function saveSettings() {
  applySettings({
    focus: tmpFocus.value,
    short: tmpShort.value,
    long: tmpLong.value,
    sessions: tmpSessions.value,
    notify: tmpNotify.value,
    sound: tmpSound.value,
  });
  showSettings.value = false;
}

function cancelSettings() {
  showSettings.value = false;
}
</script>

<style scoped>
.pomodoro {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(8px);
  flex-shrink: 0;
}
.pomo-display {
  display: flex;
  align-items: baseline;
  gap: 6px;
  cursor: pointer;
  border-radius: 6px;
  padding: 2px 6px;
  transition: background 0.15s;
}
.pomo-display:hover {
  background: rgba(255, 255, 255, 0.08);
}
.pomo-time {
  font-size: 20px;
  font-weight: 700;
  color: var(--me-accent, #3b82f6);
  letter-spacing: 1px;
}
.pomo-break .pomo-time {
  color: #34d399;
}
.pomo-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
}
.pomo-controls {
  display: flex;
  gap: 4px;
}
.pomo-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.pomo-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--me-text-primary);
}
.pomo-btn-start {
  color: var(--me-accent, #3b82f6);
  border-color: var(--me-accent, #3b82f6);
}
.pomo-btn-start:hover {
  background: rgba(59, 130, 246, 0.15);
}
.pomo-btn-pause {
  color: #facc15;
  border-color: #facc15;
}
.pomo-btn-pause:hover {
  background: rgba(250, 204, 21, 0.15);
}
.pomo-sessions {
  display: flex;
  gap: 4px;
}
.pomo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  transition: background 0.2s;
}
.pomo-dot--done {
  background: var(--me-accent, #3b82f6);
}

/* Settings Modal */
.pomo-settings {
  padding: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--me-bg-surface, #1e1e2e);
  border: 1px solid var(--me-border, rgba(255,255,255,0.08));
}
.pomo-settings-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--me-border, rgba(255,255,255,0.08));
  font-size: 14px;
  font-weight: 600;
  color: var(--me-text-primary, #fff);
}
.pomo-settings-icon {
  color: var(--me-accent, #3b82f6);
}
.pomo-settings-close {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  transition: all 0.15s;
}
.pomo-settings-close:hover {
  background: rgba(255,255,255,0.08);
  color: var(--me-text-primary);
}
.pomo-settings-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.pomo-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pomo-field-toggle {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.pomo-field-label {
  font-size: 12px;
  color: var(--me-text-secondary, #a0a0b0);
  font-weight: 500;
}
.pomo-stepper {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--me-border, rgba(255,255,255,0.1));
  border-radius: 8px;
  overflow: hidden;
  width: fit-content;
}
.pomo-stepper-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.pomo-stepper-btn:hover {
  background: rgba(255,255,255,0.08);
  color: var(--me-accent, #3b82f6);
}
.pomo-stepper-input {
  width: 50px;
  height: 34px;
  text-align: center;
  border: none;
  border-left: 1px solid var(--me-border, rgba(255,255,255,0.1));
  border-right: 1px solid var(--me-border, rgba(255,255,255,0.1));
  background: rgba(255,255,255,0.03);
  color: var(--me-text-primary, #fff);
  font-size: 14px;
  font-weight: 600;
  outline: none;
  -moz-appearance: textfield;
}
.pomo-stepper-input::-webkit-inner-spin-button,
.pomo-stepper-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
.pomo-toggle {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  background: rgba(255,255,255,0.1);
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  padding: 0;
}
.pomo-toggle--on {
  background: var(--me-accent, #3b82f6);
}
.pomo-toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.pomo-toggle--on .pomo-toggle-knob {
  transform: translateX(18px);
}
.pomo-settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--me-border, rgba(255,255,255,0.08));
}
.pomo-settings-btn {
  padding: 7px 16px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.pomo-settings-btn--cancel {
  background: none;
  color: var(--me-text-muted);
}
.pomo-settings-btn--cancel:hover {
  background: rgba(255,255,255,0.06);
  color: var(--me-text-primary);
}
.pomo-settings-btn--save {
  background: var(--me-accent, #3b82f6);
  color: #fff;
}
.pomo-settings-btn--save:hover {
  filter: brightness(1.15);
}
</style>
