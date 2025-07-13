import getIO from './index.js';
import { io as ioc } from 'socket.io-client';
import process from 'process';

const ENABLE_SOCKET_LOGGING = process.env.ENABLE_SOCKET_LOGGING === 'true';
const LOG = (...args) => ENABLE_SOCKET_LOGGING && console.log('[ServerSocket]', ...args);
const WARN = (...args) => ENABLE_SOCKET_LOGGING && console.warn('[ServerSocket]', ...args);
// eslint-disable-next-line no-unused-vars
const ERROR = (...args) => ENABLE_SOCKET_LOGGING && console.error('[ServerSocket]', ...args);

/**
 * A class representing a server-side WebSocket handler with access to RxDB.
 * Accepts incoming connections from other RxDB servers on the '/server' namespace.
 */
export class ServerSocket {
  static serverSockets = new Map();
  static serverCallbacks = new Map();
  /** @type {Map<string, import('rxjs').Subscription>} */
  static pullStreamSubscriptions = new Map(); static initializationPromise;
  static io;
  static router;
  static http;
  static useRxServer;
  static rxServer;
  static db;
  static app;
  static cookie;
  socket;
  serverName;

  constructor(socket) {
    this.socket = socket;

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

  static async initialize(db, http, router, useRxServer = false) {
    const { app } = await import('../../backend/server/index.js');
    const cookie = await import("cookie");
    ServerSocket.app = app;
    ServerSocket.cookie = cookie;

    if (ServerSocket.initializationPromise) {
      return ServerSocket.initializationPromise;
    }

    ServerSocket.db = db;
    ServerSocket.http = http;
    ServerSocket.router = router;
    ServerSocket.useRxServer = useRxServer;

    return ServerSocket.initializationPromise = getIO(http).then(async (io) => {
      ServerSocket.io = io;
      if (useRxServer) {
        // Add middleware
        router.use(async (req, res, next) => {
          try {
            const username = req.cookies?.username;
            if (username) {
              const userDoc = await db.users.findOne({ selector: { username } }).exec();
              if (userDoc) req.headers.user = userDoc.toJSON();
            }
          } catch (err) {
            WARN(`[ServerSocket] User middleware error:`, err.message);
          }
          next();
        });

        const { createRxServer } = await import('rxdb-server/plugins/server');
        const { RxServerAdapterExpress } = await import('rxdb-server/plugins/adapter-express');

        const server = ServerSocket.rxServer = await createRxServer({
          path: "/",
          database: db,
          adapter: RxServerAdapterExpress,
          authHandler: (headers) => ({
            data: headers.user,
            validUntil: Date.now() + 60000,
          }),
          serverApp: router,
        });

        for (const [colName, collection] of Object.entries(db.collections)) {
          LOG('Add Endpoint:', `api/rxdb/${colName}`);
          server.addReplicationEndpoint({
            name: `api/rxdb/${colName}`,
            collection,
            changeValidator: (authData) => !!authData.data,
          });
          for (const [name, collection] of Object.entries(db.collections)) {
            const sub = collection.$.subscribe(change => {
              if (change.operation === 'UPDATE' || change.operation === 'INSERT') {
                ServerSocket.io.to(`pullstream:${name}`).emit(`stream:${name}`, 'RESYNC');
              }
            });
            ServerSocket.pullStreamSubscriptions.set(name, sub);
          }
        }
      }

      return io;
    });
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
  socket;
  db;
  states = {};

  constructor(socket) {
    this.socket = socket;
    this.db = ServerSocket.db;
    LOG(`[ClientSocketHandler] Client connected: ${socket.id}`);
    this.setupReplication();
    socket.on('rxdb:push', async ({ collection, version, docs }, callback) => {
      const cookies = ServerSocket.cookie.parse(socket.handshake.headers.cookie);
      console.log('rxdb:push:' + cookies.username, collection, docs.length);

      try {
        ServerSocket.app.runMiddleware(`/api/rxdb/${collection}/${version}/push`, {
          headers: { 'content-type': 'application/json' },
          method: 'post',
          query: {},
          body: docs,
          cookies,
        }, (code, body) => {
          if (code !== 200) {
            console.warn(`Push failed with status ${code}`);
            return callback({ error: true, status: code });
          }

          try {
            const parsed = JSON.parse(body);
            callback(parsed);
          } catch (err) {
            console.warn('Failed to parse push response:', err);
            callback({ error: true, message: 'Invalid JSON from server' });
          }
        });
      } catch (err) {
        console.error('rxdb:push middleware error:', err);
        callback({ error: true, message: err.message });
      }
    });
    socket.on('rxdb:pull', async ({ collection, version, lastCheckpoint, batchSize }, callback) => {
      const cookies = ServerSocket.cookie.parse(socket.handshake.headers.cookie);
      console.log('rxdb:pull:' + cookies.username, collection, batchSize);

      try {
        ServerSocket.app.runMiddleware(`/api/rxdb/${collection}/${version}/pull`, {
          headers: { 'content-type': 'application/json' },
          method: 'get',
          query: { lwt: lastCheckpoint, limit: batchSize },
          cookies,
        }, (code, body) => {
          try {
            const parsed = JSON.parse(body);
            callback(parsed);
          } catch (err) {
            console.warn('Failed to parse pull response:', err);
            callback({ documents: [], checkpoint: lastCheckpoint }); // safe fallback
          }
        });
      } catch (err) {
        console.error('rxdb:pull middleware error:', err);
        callback({ documents: [], checkpoint: lastCheckpoint });
      }
    });
    socket.on('disconnect', () => {
      LOG(`[ClientSocketHandler] Client disconnected: ${socket.id}`);
    });
  }

  async setupReplication() {
    const collections = Object.entries(this.db.collections);
    for (const [name] of collections) {
      this.socket.join(`pullstream:${name}`);
    }
    LOG(`[ClientSocketHandler] Exposing ${collections.length} collections`);
  }
}
