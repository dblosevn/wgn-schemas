//sockets/socketclient.js
import { io } from 'socket.io-client';
import { replicateRxCollection } from 'rxdb/plugins/replication';
import { Subject } from 'rxjs';

const ENABLE_SOCKET_LOGGING = true;
const LOG = (...args) => ENABLE_SOCKET_LOGGING && console.log('[SocketClient]', ...args);
const WARN = (...args) => ENABLE_SOCKET_LOGGING && console.warn('[SocketClient]', ...args);
const INFO = (...args) => ENABLE_SOCKET_LOGGING && console.info('[SocketClient]', ...args);
const ERROR = (...args) => ENABLE_SOCKET_LOGGING && console.error('[SocketClient]', ...args);


export class ClientSocket {
  /**
   * @param {import('rxdb').RxDatabase} db - The client-side RxDB instance
   */
  constructor(db) {
    this.db = db;
    this.socket = null;
    this.replications = new Map();
    this.connected = false;
    this._live = true;
    this._retryTime = 3000;

    this.connect();
  }

  connect() {
    if (this.socket) return this.socket;

    const baseURL = window.location.origin;

    this.socket = io(baseURL, {
      path: '/api/rxdb/stream',
      transports: ['polling'],
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

  /**
   * Helper to emit a message with ack + timeout
   * @param {string} event
   * @param {object} payload
   * @param {number} [timeout=5000]
   * @returns {Promise<any>}
   */
  emitWithAck(event, payload, timeout = 5000) {
    return new Promise((resolve, reject) => {
      this.socket
        .timeout(timeout)
        .emit(event, payload, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
    });
  }
  #getStream(collection) {
    const stream$ = new Subject();
    let firstOpen = true;

    const streamEvent = `stream:${collection}`;

    const messageHandler = (data) => stream$.next(data);
    const reconnectHandler = () => {
      if (!firstOpen) stream$.next('RESYNC');
      firstOpen = false;
    };
    const disconnectHandler = () => {
      this.socket.off(streamEvent, messageHandler);
      this.socket.off('connect', reconnectHandler);
      this.socket.off('disconnect', disconnectHandler);
    };

    this.socket.on(streamEvent, messageHandler);
    this.socket.on('connect', reconnectHandler);
    this.socket.on('disconnect', disconnectHandler);

    return stream$.asObservable();
  }
  /**
   * Starts replication for all collections over a single socket
   * @param {object} options
   * @param {boolean} [options.live=true]
   * @param {number} [options.retryTime=3000]
   */
  async replicateAll({ live = true, retryTime = 3000 } = {}) {
    this._live = live;
    this._retryTime = retryTime;

    for (let [name, collection] of Object.entries(this.db.collections)) {
      if (name === 'cache') continue;
      if (this.replications.has(name)) continue;

      try {
        const replicationState = replicateRxCollection({
          collection,
          replicationIdentifier: `${name}-replication`,
          pull: {
            handler: async (lastCheckpoint, batchSize) => {
              const response = await this.emitWithAck('rxdb:pull', {
                collection: name,
                version: collection.schema.version,
                lastCheckpoint,
                batchSize,
              });
              return response;
            },
            stream$: this.#getStream(name)
          },
          push: {
            handler: async (docs) => {
              LOG(`[${name}] PUSH`, docs.length);
              const response = await this.emitWithAck('rxdb:push', {
                collection: name,
                version: collection.schema.version,
                docs,
              });
              LOG(`[${name}] PUSH response`, response);
              return response;
            },
          },
          live,
          retryTime,
        });

        replicationState.error$.subscribe(err => {
          ERROR(`[${name}] Replication error`, err);
        });

        this.replications.set(name, replicationState);
        LOG(`Started replication for: ${name}`);
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
