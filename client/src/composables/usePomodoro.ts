import { ref, computed } from 'vue';

// State lives at module level — survives component mount/unmount
const focusDuration = ref(25);
const shortBreak = ref(5);
const longBreak = ref(15);
const sessionsBeforeLong = ref(4);
const notifyEnabled = ref(true);
const soundEnabled = ref(true);

const timeLeft = ref(focusDuration.value * 60);
const running = ref(false);
const isBreak = ref(false);
const completedSessions = ref(0);

let interval: ReturnType<typeof setInterval> | null = null;

const display = computed(() => {
  const m = Math.floor(timeLeft.value / 60);
  const s = timeLeft.value % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

function tick() {
  timeLeft.value--;
  if (timeLeft.value <= 0) {
    onTimerEnd();
  }
}

function start() {
  if (running.value) return;
  running.value = true;
  interval = setInterval(tick, 1000);
}

function pause() {
  running.value = false;
  if (interval) { clearInterval(interval); interval = null; }
}

function reset() {
  pause();
  isBreak.value = false;
  completedSessions.value = 0;
  timeLeft.value = focusDuration.value * 60;
}

function skip() {
  pause();
  onTimerEnd();
}

function onTimerEnd() {
  if (interval) { clearInterval(interval); interval = null; }
  running.value = false;

  if (!isBreak.value) {
    completedSessions.value++;
    isBreak.value = true;
    timeLeft.value = (completedSessions.value % sessionsBeforeLong.value === 0 ? longBreak.value : shortBreak.value) * 60;
    notify('Pause ! Reposez-vous.');
  } else {
    isBreak.value = false;
    timeLeft.value = focusDuration.value * 60;
    notify('C\'est reparti ! Focus.');
  }
}

function notify(msg: string) {
  if (soundEnabled.value) {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.stop(ctx.currentTime + 0.5);
    } catch { /* silent fallback */ }
  }

  if (!notifyEnabled.value) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Pomodoro', { body: msg, icon: '/favicon.ico' });
  } else if ('Notification' in window && Notification.permission !== 'denied') {
    Notification.requestPermission();
  }
}

function applySettings(settings: {
  focus: number;
  short: number;
  long: number;
  sessions: number;
  notify: boolean;
  sound: boolean;
}) {
  focusDuration.value = Math.max(1, Math.min(120, settings.focus));
  shortBreak.value = Math.max(1, Math.min(60, settings.short));
  longBreak.value = Math.max(1, Math.min(60, settings.long));
  sessionsBeforeLong.value = Math.max(2, Math.min(10, settings.sessions));
  notifyEnabled.value = settings.notify;
  soundEnabled.value = settings.sound;

  if (!running.value) {
    timeLeft.value = isBreak.value
      ? (completedSessions.value % sessionsBeforeLong.value === 0 ? longBreak.value : shortBreak.value) * 60
      : focusDuration.value * 60;
  }
}

export function usePomodoro() {
  return {
    // State (readonly-ish, consumed by template)
    focusDuration,
    shortBreak,
    longBreak,
    sessionsBeforeLong,
    notifyEnabled,
    soundEnabled,
    timeLeft,
    running,
    isBreak,
    completedSessions,
    display,
    // Actions
    start,
    pause,
    reset,
    skip,
    applySettings,
  };
}
