// sockets/socketclient.js
import { replicationSocket } from 'rxdb/plugins/replication-socket';
import { io } from 'socket.io-client';
import process from 'process';

const ENABLE_SOCKET_LOGGING = process.env.ENABLE_SOCKET_LOGGING === 'true';
const LOG = (...args) => ENABLE_SOCKET_LOGGING && console.log('[SocketClient]', ...args);
const WARN = (...args) => ENABLE_SOCKET_LOGGING && console.warn('[SocketClient]', ...args);
const INFO = (...args) => ENABLE_SOCKET_LOGGING && console.info('[SocketClient]', ...args);
const ERROR = (...args) => ENABLE_SOCKET_LOGGING && console.error('[SocketClient]', ...args);

// ==============================
// Client-side: ClientSocket
// ==============================
export class ClientSocket {
  /**
   * @param {RxDatabase} db - The client-side RxDB instance
   */
  constructor(db) {
    this.db = db;
    this.socket = null;
    this.replications = new Map();
    this.connected = false;
    this._live = true;
    this._retryTime = 3000;
  }

  connect() {
    if (this.socket) return this.socket;

    const baseURL = import.meta.env?.VITE_SOCKET_URL || window.location.origin;

    this.socket = io(baseURL, {
      path: '/api/rxdb/stream',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', async () => {
      LOG(`Connected: ${this.socket.id}`);
      this.connected = true;
      await this.replicateAll({ live: this._live, retryTime: this._retryTime });
    });

    this.socket.on('disconnect', () => {
      WARN('Disconnected');
      this.connected = false;
      for (const rep of this.replications.values()) {
        rep.cancel();
      }
      this.replications.clear();
    });

    this.socket.on('reconnect_attempt', attempt => {
      INFO(`Reconnect attempt #${attempt}`);
    });

    this.socket.on('reconnect_failed', () => {
      ERROR('Reconnect failed');
    });

    this.socket.on('error', err => {
      ERROR('Socket error:', err);
    });

    return this.socket;
  }

  async replicateAll({ live = true, retryTime = 3000 } = {}) {
    this._live = live;
    this._retryTime = retryTime;

    this.connect();

    for (const [name, collection] of Object.entries(this.db.collections)) {
      if (name === 'cache') continue;
      if (this.replications.has(name)) continue;

      try {
        const replicationState = await replicationSocket({
          collection,
          socket: this.socket,
          live,
          retryTime,
        });

        this.replications.set(name, replicationState);
        LOG(`Replicating collection: ${name}`);
      } catch (err) {
        ERROR(`Failed to replicate "${name}":`, err);
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    for (const rep of this.replications.values()) {
      rep.cancel();
    }

    this.replications.clear();
  }
}
