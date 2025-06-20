import { replicationSocketServer } from 'rxdb/plugins/replication-socket';
import getIO from './index.js';
import { io as ioc } from 'socket.io-client';
import process from 'process';

const ENABLE_SOCKET_LOGGING = process.env.ENABLE_SOCKET_LOGGING === 'true';
const LOG = (...args) => ENABLE_SOCKET_LOGGING && console.log('[ServerSocket]', ...args);
const WARN = (...args) => ENABLE_SOCKET_LOGGING && console.warn('[ServerSocket]', ...args);
const ERROR = (...args) => ENABLE_SOCKET_LOGGING && console.error('[ServerSocket]', ...args);

/**
 * A class representing a server-side WebSocket handler with access to RxDB.
 * Accepts incoming connections from other RxDB servers on the '/server' namespace.
 */
export class ServerSocket {
  static serverSockets = new Map();
  static serverCallbacks = new Map();
  static io;

  socket;
  db;
  serverName;

  constructor(socket, db) {
    this.socket = socket;
    this.db = db;

    socket.on('setName', async (serverName) => {
      if (this.serverName) return;

      this.serverName = serverName;
      socket.join(serverName);
      ServerSocket.serverSockets.set(serverName, socket);

      this.db.storage.addRxRemote(
        ServerSocket.getMessageChannel(serverName),
        serverName
      );

      const collections = Object.entries(this.db.collections)
        .filter(([, col]) => !col.isRxRemoteCollection)
        .map(([name, col]) => ({
          name,
          schema: col.schema.jsonSchema,
        }));

      LOG(`Registered server '${serverName}', sending ${collections.length} collections`);
      socket.emit('collections', collections);
    });

    socket.on('collections', async (collections) => {
      if (!this.serverName) return;

      for (const { name, schema } of collections) {
        if (!this.db.collections[name]) {
          try {
            await this.db.addCollections({ [name]: { schema } });
            LOG(`Created remote collection '${name}'`);
          } catch (err) {
            WARN(`Failed to create collection '${name}':`, err.message);
          }
        }
      }
    });

    socket.on('message', (...args) => {
      if (!this.serverName) return;
      const cb = ServerSocket.serverCallbacks.get(this.serverName);
      if (cb) cb(...args);
    });

    socket.on('disconnect', () => {
      if (this.serverName) {
        ServerSocket.serverSockets.delete(this.serverName);
        ServerSocket.serverCallbacks.delete(this.serverName);
        this.db.storage.removeRxRemoteByIdentifier(this.serverName);
        LOG(`Server '${this.serverName}' disconnected`);
      }
    });
  }

  static initialize() {
    const p = getIO();
    p.then((io) => ServerSocket.io = io);
    return p;
  }

  static getMessageChannel(serverName) {
    return {
      send: (msg) => {
        ServerSocket.io.of('/server').to(serverName).emit('message', msg);
      },
      receive: (fn) => {
        ServerSocket.serverCallbacks.set(serverName, fn);
      }
    };
  }

  static emit(server, event, ...args) {
    ServerSocket.io.of('/server').to(server).emit(event, ...args);
  }
}

ServerSocket.initialize();

export class ServerSocketClient {
  socket;
  db;
  serverName;

  constructor(port, serverName, db) {
    this.serverName = serverName;
    this.db = db;

    this.socket = ioc(`http://localhost:${port}/server`, {
      path: '/api/rxdb/stream',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      LOG(`Connected to remote server ${port} as '${serverName}'`);
      this.socket.emit('setName', serverName);

      this.db.storage.addRxRemote(this.getMessageChannel(), serverName);

      const collections = Object.entries(this.db.collections)
        .filter(([, col]) => !col.isRxRemoteCollection)
        .map(([name, col]) => ({
          name,
          schema: col.schema.jsonSchema,
        }));
      this.socket.emit('collections', collections);
    });

    this.socket.on('collections', async (collections) => {
      for (const { name, schema } of collections) {
        if (!this.db.collections[name]) {
          try {
            await this.db.addCollections({ [name]: { schema } });
            LOG(`Created remote collection '${name}'`);
          } catch (err) {
            WARN(`Failed to create collection '${name}':`, err.message);
          }
        }
      }
    });

    this.socket.on('disconnect', () => {
      this.db.storage.removeRxRemoteByIdentifier(this.serverName);
      WARN(`Disconnected from server ${port}`);
    });
  }

  getMessageChannel() {
    return {
      send: (msg) => this.socket.emit('message', msg),
      receive: (fn) => this.socket.on('message', fn),
    };
  }
}

export class ClientSocketHandler {
  constructor(socket, db) {
    this.socket = socket;
    this.db = db;

    LOG(`[ClientSocketHandler] Client connected: ${socket.id}`);
    this.setupReplication();

    socket.on('disconnect', () => {
      LOG(`[ClientSocketHandler] Client disconnected: ${socket.id}`);
    });
  }

  async setupReplication() {
    const collections = Object.entries(this.db.collections);
    LOG(`[ClientSocketHandler] Exposing ${collections.length} collections`);

    for (const [name, collection] of collections) {
      try {
        await replicationSocketServer({
          collection,
          socket: this.socket,
        });
        LOG(`[ClientSocketHandler] Collection exposed: ${name}`);
      } catch (err) {
        ERROR(`[ClientSocketHandler] Failed to expose collection "${name}":`, err);
      }
    }
  }
}
