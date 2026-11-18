import api from '../api/axios';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushNotifications() {
  if (typeof window === 'undefined') return null;

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return null;
      }
    }

    if (Notification.permission !== 'granted') {
      return null;
    }

    let vapidKey = '';
    try {
      const res = await api.get('/api/notifications/vapid-public-key');
      if (res.data?.publicKey) {
        vapidKey = res.data.publicKey;
      }
    } catch {
    }

    if (!vapidKey) {
      return null;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(vapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    const subscriptionJson = subscription.toJSON();
    if (subscriptionJson && subscriptionJson.endpoint) {
      await api.post('/api/notifications/subscribe', {
        endpoint: subscriptionJson.endpoint,
        keys: {
          p256dh: subscriptionJson.keys?.p256dh || '',
          auth: subscriptionJson.keys?.auth || '',
        },
      });
    }

    return subscription;
  } catch (err) {
    return null;
  }
}

export async function unregisterPushNotifications() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        try {
          await api.post('/api/notifications/unsubscribe', { endpoint });
        } catch {}
      }
    }
  } catch (err) {
  }
}
