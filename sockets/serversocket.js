//sockets/serversocket.js
import getIO from './index.js';
import { io as ioc } from 'socket.io-client';

/**
 * A class representing a server-side WebSocket handler with access to RxDB.
 * Accepts incoming connections from other RxDB servers on the '/server' namespace.
 */
export class ServerSocket {
  /**
   * @type {Map<string, import('socket.io').Socket>}
   */
  static serverSockets = new Map();

  /**
   * @type {Map<string, Function>}
   */
  static serverCallbacks = new Map();

  /**
   * @type {import('socket.io').Server}
   */
  static io;

  /**
   * @type {import('socket.io').Socket}
   */
  socket;

  /**
   * @type {import('rxdb').RxDatabase}
   */
  db;

  /**
   * @type {string | undefined}
   */
  serverName;

  /**
   * @param {import('socket.io').Socket} socket
   * @param {import('rxdb').RxDatabase} db
   */
  constructor(socket, db) {
    this.socket = socket;
    this.db = db;

    socket.on('setName', async (serverName) => {
      if (this.serverName) return;

      this.serverName = serverName;
      socket.join(serverName);
      ServerSocket.serverSockets.set(serverName, socket);

      // Bind remote using server name as identifier
      this.db.storage.addRxRemote(
        ServerSocket.getMessageChannel(serverName),
        serverName
      );

      // Send local collections to client
      const collections = Object.entries(this.db.collections)
        .filter(([, col]) => !col.isRxRemoteCollection)
        .map(([name, col]) => ({
          name,
          schema: col.schema.jsonSchema,
        }));
      socket.emit('collections', collections);
    });

    socket.on('collections', async (collections) => {
      if (!this.serverName) return;

      for (const { name, schema } of collections) {
        if (!this.db.collections[name]) {
          try {
            await this.db.addCollections({ [name]: { schema } });
            console.log(`Created remote collection '${name}'`);
          } catch (err) {
            console.warn(`Failed to create collection '${name}':`, err.message);
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
      }
    });
  }

  /**
   * @returns {Promise<import('socket.io').Server>}
   */
  static initialize() {
    const p = getIO();
    p.then((io) => ServerSocket.io = io);
    return p;
  }

  /**
   * @param {string} serverName
   * @returns {{ send: (msg: any) => void, receive: (fn: Function) => void }}
   */
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

  /**
   * Emit a custom event to all sockets in the given server room.
   * @param {string} server
   * @param {string} event
   * @param {...any} args
   */
  static emit(server, event, ...args) {
    ServerSocket.io.of('/server').to(server).emit(event, ...args);
  }
}

ServerSocket.initialize();

/**
 * A class representing a client socket that connects to a remote RxDB server.
 */
export class ServerSocketClient {
  /**
   * @type {import('socket.io-client').Socket}
   */
  socket;

  /**
   * @type {import('rxdb').RxDatabase}
   */
  db;

  /**
   * @type {string}
   */
  serverName;

  /**
   * @param {number} port
   * @param {string} serverName
   * @param {import('rxdb').RxDatabase} db
   */
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
      this.socket.emit('setName', serverName);

      // Bind to local RxDB storage with identifier
      this.db.storage.addRxRemote(this.getMessageChannel(), serverName);

      // Send collections to remote
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
            console.log(`Created remote collection '${name}'`);
          } catch (err) {
            console.warn(`Failed to create collection '${name}':`, err.message);
          }
        }
      }
    });

    this.socket.on('disconnect', () => {
      this.db.storage.removeRxRemoteByIdentifier(this.serverName);
      console.log(`Disconnected from server ${port}`);
    });
  }

  /**
   * @returns {{ send: (msg: any) => void, receive: (fn: Function) => void }}
   */
  getMessageChannel() {
    return {
      send: (msg) => this.socket.emit('message', msg),
      receive: (fn) => this.socket.on('message', fn),
    };
  }
}
