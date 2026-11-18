
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getAccessToken } from '../api/axios';

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || import.meta.env.VITE_API_BASE_URL || '';

class NotificationWebSocket {
  constructor() {
    this.client = null;
    this.subscribers = new Set();
    this.isConnected = false;
  }

  connect() {
    if (this.client && this.isConnected) {
      return;
    }

    const token = getAccessToken();

    this.client = new Client({
      webSocketFactory: () => {
        const endpoint = WS_BASE_URL ? `${WS_BASE_URL}/ws-notifications` : '/ws-notifications';
        return new SockJS(endpoint);
      },
      connectHeaders: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(localStorage.getItem('rideway_user_id') ? { 'X-User-Id': localStorage.getItem('rideway_user_id') } : {}),
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (msg) => {
        if (import.meta.env.DEV && !msg.includes('PING') && !msg.includes('PONG')) {
          console.debug('[RideWay WS]', msg);
        }
      },
      onConnect: () => {
        this.isConnected = true;
        console.info('[RideWay WS] Connected to real-time notification stream');

        this.client.subscribe('/user/queue/notifications', (message) => {
          try {
            const data = JSON.parse(message.body);
            this.notifyListeners(data);
          } catch (err) {
            console.warn('[RideWay WS] Error parsing message body:', err);
          }
        });
      },
      onStompError: (frame) => {
        console.error('[RideWay WS] Broker error:', frame.headers['message'], frame.body);
      },
      onWebSocketClose: () => {
        this.isConnected = false;
      },
    });

    this.client.activate();
  }

  disconnect() {
    if (this.client) {
      try {
        this.client.deactivate();
      } catch (ignored) {}
      this.client = null;
      this.isConnected = false;
    }
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    if (!this.isConnected && (!this.client || !this.client.active)) {
      this.connect();
    }

    return () => {
      this.subscribers.delete(callback);
      if (this.subscribers.size === 0) {
        this.disconnect();
      }
    };
  }

  notifyListeners(data) {
    this.subscribers.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error('[RideWay WS] Subscriber handler error:', err);
      }
    });
  }
}

export const notificationWs = new NotificationWebSocket();
export default notificationWs;
