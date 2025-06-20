// sockets/index.js

import { Server } from 'socket.io';
import { getDb } from '../rxdb.js';
import { ServerSocket } from './serversocket.js';
import { ClientSocketHandler } from './clientsocket.js';
import process from 'process';

/**
 * Toggle logging for socket connections and security rejections.
 * Controlled via `ENABLE_SOCKET_LOGGING=true` in the environment.
 * @type {boolean}
 */
const ENABLE_SOCKET_LOGGING = process.env.ENABLE_SOCKET_LOGGING === 'true';

let io;

/**
 * Initializes and returns a singleton Socket.IO server instance.
 *
 * - Uses `/server` namespace for server-to-server replication via `ServerSocket`
 * - Uses default namespace `/` for frontend clients via `ClientSocketHandler`
 * - Protects `/server` namespace to allow only localhost, direct (non-proxied) connections
 *
 * @param {import('http').Server | import('https').Server} http - Node HTTP or HTTPS server
 * @returns {Promise<import('socket.io').Server>} - Initialized Socket.IO server instance
 */
export async function getIO(http) {
  if (io) return io;

  io = new Server(http, {
    path: '/api/rxdb/stream',
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const db = await getDb();

  // Middleware to restrict /server namespace to direct localhost connections
  io.of('/server').use((socket, next) => {
    const headers = socket.request.headers;
    const ip = socket.request.connection.remoteAddress || socket.request.socket.remoteAddress;

    const isLocalIP =
      ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

    const hasProxyHeaders = !!headers['x-forwarded-for'] || !!headers['via'] || !!headers['x-real-ip'];

    if (isLocalIP && !hasProxyHeaders) {
      return next();
    }

    if (ENABLE_SOCKET_LOGGING) {
      console.warn(`[BLOCKED] Rejected proxied/non-local /server connection from ${ip}`, headers);
    }
    next(new Error('Unauthorized: only direct localhost connections allowed'));
  });

  // Trusted RxDB server connects to /server for remote sync
  io.of('/server').on('connection', (socket) => {
    const ip = socket.handshake.address;
    if (ENABLE_SOCKET_LOGGING) {
      console.log(`[ServerSocket] Connected to /server :: ${socket.id} @ ${ip} (${new Date().toISOString()})`);
    }
    new ServerSocket(socket, db);
  });

  // Frontend client connects to default namespace /
  io.on('connection', (socket) => {
    const ip = socket.handshake.address || socket.request.connection.remoteAddress;
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    if (ENABLE_SOCKET_LOGGING) {
      console.log(`[ClientSocketHandler] Connected to / :: ${socket.id} @ ${forwarded || ip} (${new Date().toISOString()})`);
    }
    new ClientSocketHandler(socket, db);
  });

  return io;
}

export default getIO;
