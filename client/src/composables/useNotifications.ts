import { ref } from 'vue';
import api from '../services/api';
import { getSocket, connectSocket } from '../services/socket';

interface NotificationItem {
  _id: string;
  type: string;
  message: string;
  dossierId: string | null;
  fromUserId: { firstName: string; lastName: string } | null;
  read: boolean;
  createdAt: string;
}

const notifications = ref<NotificationItem[]>([]);
const unreadCount = ref(0);

export function useNotifications() {
  async function fetchNotifications() {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 20 } });
      notifications.value = data.notifications;
      unreadCount.value = data.unreadCount;
    } catch {}
  }

  async function markRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
    const n = notifications.value.find(n => n._id === id);
    if (n && !n.read) {
      n.read = true;
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }
  }

  async function markAllRead() {
    await api.patch('/notifications/read-all');
    notifications.value.forEach(n => n.read = true);
    unreadCount.value = 0;
  }

  function playNotificationSound() {
    try {
      const prefsStr = localStorage.getItem('userPreferences');
      const userPrefs = prefsStr ? JSON.parse(prefsStr) : {};
      if (userPrefs.soundEnabled === false) return;

      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }

  function setupSocketListener() {
    const socket = getSocket() || connectSocket();
    socket.on('notification:new', (notif: NotificationItem) => {
      notifications.value.unshift(notif);
      unreadCount.value++;
      playNotificationSound();
    });
  }

  function cleanupSocketListener() {
    const socket = getSocket();
    socket?.off('notification:new');
  }

  return { notifications, unreadCount, fetchNotifications, markRead, markAllRead, setupSocketListener, cleanupSocketListener };
}
