// sockets/socketclient.js
import { replicationSocketServer, replicationSocket } from 'rxdb/plugins/replication-socket';
import { io } from 'socket.io-client';
import process from 'process';

const ENABLE_SOCKET_LOGGING = process.env.ENABLE_SOCKET_LOGGING === 'true';

// ==============================
// Server-side: ClientSocketHandler
// ==============================
export class ClientSocketHandler {
  /**
   * @param {import('socket.io').Socket} socket
   * @param {RxDatabase} db - RxDB instance with local+remote collections
   */
  constructor(socket, db) {
    this.socket = socket;
    this.db = db;

    if (ENABLE_SOCKET_LOGGING) {
      console.log(`[ClientSocketHandler] Client connected: ${socket.id}`);
    }

    this.setupReplication();

    socket.on('disconnect', () => {
      if (ENABLE_SOCKET_LOGGING) {
        console.log(`[ClientSocketHandler] Client disconnected: ${socket.id}`);
      }
    });
  }

  async setupReplication() {
    const collections = Object.entries(this.db.collections);
    if (ENABLE_SOCKET_LOGGING) {
      console.log(`[ClientSocketHandler] Exposing ${collections.length} collections`);
    }

    for (const [name, collection] of collections) {
      try {
        await replicationSocketServer({
          collection,
          socket: this.socket,
        });
        if (ENABLE_SOCKET_LOGGING) {
          console.log(`[ClientSocketHandler] Collection exposed: ${name}`);
        }
      } catch (err) {
        if (ENABLE_SOCKET_LOGGING) {
          console.error(`[ClientSocketHandler] Failed to expose collection "${name}":`, err);
        }
      }
    }
  }
}

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
      console.log(`[SocketClient] Connected: ${this.socket.id}`);
      this.connected = true;
      await this.replicateAll({ live: this._live, retryTime: this._retryTime });
    });

    this.socket.on('disconnect', () => {
      console.warn('[SocketClient] Disconnected');
      this.connected = false;
      for (const rep of this.replications.values()) {
        rep.cancel();
      }
      this.replications.clear();
    });

    this.socket.on('reconnect_attempt', attempt => {
      console.info(`[SocketClient] Reconnect attempt #${attempt}`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[SocketClient] Reconnect failed');
    });

    this.socket.on('error', err => {
      console.error('[SocketClient] Socket error:', err);
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

      const replicationState = await replicationSocket({
        collection,
        socket: this.socket,
        live,
        retryTime,
      });

      this.replications.set(name, replicationState);
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
