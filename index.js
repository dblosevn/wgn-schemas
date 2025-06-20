//./index.js
import dotenv from 'dotenv';
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
if (!process.env.MONGOURL) dotenv.config({ path: path.resolve(path.join('../', '.env')) }); //running in standalone mode

/** @type {'walgreens'} */ export const WALGREENS = 'walgreens';
/** @type {'workmarket'} */ export const WORKMARKET = 'workmarket';

const collections = {};
let wmSchemas = ['assignments', 'invoices', 'payments', 'techinvoices'];
let wgnSchemas = [];
const frontendOnly = ['cache'];
const colMeta = {
  cache: {
    cleanupPolicy: {
      minimumDeletedTime: 1000 * 60 * 60 * 24,
      minimumCollectionAge: 1000 * 60,
      runEach: 1000 * 60 * 5,
      awaitReplicationsInSync: true,
      waitForLeadership: true,
    },
  }
};
let resolve, reject;
const Schemas = new Promise((Resolve, Reject) => {
  resolve = Resolve;
  reject = Reject;
});

(async () => {
  try {
    const schemaBase = path.resolve("./schemas");
    const colDirs = fs.readdirSync(schemaBase);

    for (const colDir of colDirs) {
      const colPath = path.join(schemaBase, colDir);
      const migDir = path.join(colPath, "Migrations");

      if (!fs.existsSync(migDir)) {
        fs.mkdirSync(migDir);
      }

      const schFiles = fs.readdirSync(colPath).filter(d => d !== "Migrations");
      const migrations = {};
      let collectionKey = `${colDir.toLowerCase()}s`;
      collectionKey = (collectionKey == 'caches') ? 'cache' : collectionKey;

      const collection = (collections[collectionKey] = {
        name: collectionKey,
        srcServer: (wmSchemas.indexOf(collectionKey) === -1) ? WALGREENS : WORKMARKET,
        schema: null,
        migrations,
        frontendOnly: frontendOnly.indexOf(collectionKey) !== -1,
        meta: colMeta[collectionKey] || null,
        versions: {},
      });

      for (const schFile of schFiles) {
        const filePath = path.join(colPath, schFile);
        const current = (await import(pathToFileURL(filePath))).default;

        if (current?.version === undefined || current?.version === null) {
          throw new Error(`Schema file "${schFile}" is missing a version`);
        }

        collection.versions[current.version] = current;
        collection.schema = current;
      }

      const migFiles = fs.readdirSync(migDir).sort((a, b) => {
        const aVer = parseInt(/V(\d+)/.exec(a)?.[1] ?? 0, 10);
        const bVer = parseInt(/V(\d+)/.exec(b)?.[1] ?? 0, 10);
        return aVer - bVer;
      });

      for (const migFile of migFiles) {
        const match = /V([0-9]+)Migration/.exec(migFile);
        if (!match) continue;
        const v = match[1];
        migrations[v] = (await import(pathToFileURL(path.join(migDir, migFile)))).default;
      }
    }
    wgnSchemas = Object.keys(collections).filter(c => !wmSchemas.includes(c));
    wgnSchemas = wgnSchemas.map((c) => collections[c]);
    wmSchemas = wmSchemas.map((c) => collections[c]);
    resolve(collections);
  } catch (e) {
    reject(e);
  }
})();


let dbInstance = null;
let initPromise;
/**
 * @typedef {'walgreens' | 'workmarket'} Server
 * A server identifier, must be either 'walgreens' or 'workmarket'.
 */

/**
 * Initializes the RxDB instance for the given server.
 *
 * @param {Server} server - Server key ('walgreens' or 'workmarket')
 * @param {boolean} [isFrontend=false] - Whether running on frontend
 * @param {import('http').Server|null} [http=null] - HTTP server for socket setup
 * @returns {Promise<import('rxdb').RxDatabase>}
 */
export function initDB(server, isFrontend = false, http = null) {
  if (initPromise) return initPromise;

  if (!server && !dbInstance) throw new Error('No DB instance and no config');

  return initPromise = new Promise(async (resolve, reject) => {
    try {
      let allSchemas = await Schemas;

      const schemas = (server === WALGREENS) ? wgnSchemas : wmSchemas;

      if (isFrontend) {
          if (server !== WALGREENS) {
    throw new Error('Frontend DB may only be initialized for WALGREENS');
  }
        const { getRxStorageDexie } = await import('rxdb/plugins/storage-dexie');
        const { addRxPlugin, createRxDatabase } = await import('rxdb/plugins/core');


        const { RxDBUpdatePlugin } = await import('rxdb/plugins/update');
        const { RxDBMigrationSchemaPlugin } = await import('rxdb/plugins/migration-schema');
        const { RxDBStatePlugin } = await import('rxdb/plugins/state');
        const { RxDBCleanupPlugin } = await import('rxdb/plugins/cleanup');
        const { RxDBAttachmentsPlugin } = await import('rxdb/plugins/attachments');
        const { createBlob } = await import('rxdb');
        const { RxDBLeaderElectionPlugin } = await import('rxdb/plugins/leader-election');
        const {ClientSocket} = await import('./sockets/clientsocket.js');

        addRxPlugin(RxDBLeaderElectionPlugin);
        addRxPlugin(RxDBAttachmentsPlugin);
        addRxPlugin(RxDBCleanupPlugin);
        addRxPlugin(RxDBStatePlugin);
        addRxPlugin(RxDBMigrationSchemaPlugin);
        addRxPlugin(RxDBUpdatePlugin);

        const db = await createRxDatabase({
          name: WALGREENS,
          storage: getRxStorageDexie(),
          multiInstance: true,
        });
        let colOptions = {}
        for (let entry of Object.values(allSchemas)) {
          colOptions[entry.name] = {
            schema: entry.schema,
            migrationStrategies: entry.migrations
          }
          if (entry.meta) {
            colOptions[entry.name] = Object.assign(colOptions[entry.name], entry.meta);
          }
        }
        db.addCollections(colOptions);

        new ClientSocket(db);

        dbInstance = db;
        resolve(dbInstance);
        return;
      }

      const { createRxDatabase } = await import("rxdb");
      const { addRxPlugin } = await import('rxdb/plugins/core');
      const { getRxStorageMongoDB } = await import("rxdb/plugins/storage-mongodb");
      const { RxDBMigrationSchemaPlugin } = await import('rxdb/plugins/migration-schema');
      const { RxDBUpdatePlugin } = await import('rxdb/plugins/update');
      const process = await import("process");

      addRxPlugin(RxDBMigrationSchemaPlugin);
      addRxPlugin(RxDBUpdatePlugin);

      const uri = process.env.MONGOURL;
      const db = await createRxDatabase({
        name: server,
        multiInstance: true,
        eventReduce: true,
        storage: getRxStorageMongoDB({ connection: uri }),
      });
      let colOptions = {}
      for (let entry of schemas) {
        if (entry.frontendOnly) continue;
        colOptions[entry.name] = {
          schema: entry.schema,
          migrationStrategies: entry.migrations
        }
        if (entry.meta) {
          colOptions[entry.name] = Object.assign(colOptions[entry.name], entry.meta);
        }
      }
      db.addCollections(colOptions);

      if (server === WALGREENS) {
        const { ServerSocket, ClientSocketHandler } = await import("./sockets/serversocket.js");
        await ServerSocket.initialize(http);
        const io = ServerSocket.io;
        io.of('/server').on('connection', (socket) => new ServerSocket(socket, db));
        io.on('connection', (socket) => new ClientSocketHandler(socket, db));
      } else if (server === WORKMARKET) {
        const { ServerSocketClient } = await import("./sockets/serversocket.js");
        new ServerSocketClient(process.env.SERVER_PORT, server, db);
      }

      dbInstance = db;
      resolve(db);
    } catch (err) {
      reject(err);
    }
  });
}
export default Schemas;
