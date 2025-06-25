//./index.js

/** @type {'walgreens'} */ export const WALGREENS = 'walgreens';
/** @type {'workmarket'} */ export const WORKMARKET = 'workmarket';
export const CURRENT_SCHEMA_VERSION = 5;
const useRxReplication = false;

let collections = {};
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
const pascalReplacements = {
  workorders: 'Workorders',
  techinvoices: 'TechInvoices',
  // Add more as needed
};

const { promise: schemaPromise, resolve, reject } = Promise.withResolvers();
async function initSchemas(isFrontend = false) {
  try {
    if (!isFrontend) {
      const path = await import("path");
      const fs = await import("fs");
      const { pathToFileURL } = await import("url");

      const __dirname = path.dirname(decodeURI(new URL(import.meta.url).pathname).replace(/^\/([a-zA-Z]:)/, '$1'));
      const schemaBase = path.resolve(__dirname, "schemas");
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
          const current = (await import(/* @vite-ignore */ pathToFileURL(filePath))).default;

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
          const migPath = pathToFileURL(path.join(migDir, migFile));
          migrations[v] = (await import(/* @vite-ignore */ migPath)).default;
        }
      }
    } else {
      collections = (await import('./allschemas.js')).default;
    }

    wgnSchemas = Object.keys(collections).filter(c => !wmSchemas.includes(c));
    wgnSchemas = wgnSchemas.map((c) => collections[c]);
    wmSchemas = wmSchemas.map((c) => collections[c]);
    resolve(collections);
  } catch (e) {
    reject(e);
  }
  return schemaPromise;
};


let dbInstance = null;
const { promise: initPromise, resolve: initResolve, reject: initReject } = Promise.withResolvers();
const { promise: getPromise, resolve: getResolve, reject: getReject } = Promise.withResolvers();

initPromise.then(getResolve);
initPromise.catch(getReject);
function toESMModule(obj, indent = 2) {
  const seen = new WeakMap();

  function serialize(value, depth = 0, path = '') {
    const pad = (n = 0) => ' '.repeat(n * indent);

    if (value === null) return 'null';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (typeof value === 'function') return value.toString();

    if (Array.isArray(value)) {
      return `[\n${value.map((v, i) => pad(depth + 1) + serialize(v, depth + 1, `${path}[${i}]`)).join(',\n')}\n${pad(depth)}]`;
    }

    if (typeof value === 'object') {
      if (seen.has(value)) {
        const firstPath = seen.get(value);
        // Treat only true cycles as circular
        if (firstPath === path) {
          return '{} /* [Circular: ' + path + '] */';
        }
        // Otherwise, clone object again normally
      } else {
        seen.set(value, path);
      }

      const entries = Object.entries(value).map(([k, v]) =>
        `${pad(depth + 1)}${JSON.stringify(k)}: ${serialize(v, depth + 1, path ? `${path}.${k}` : k)}`
      );
      return `{\n${entries.join(',\n')}\n${pad(depth)}}`;
    }

    return 'undefined';
  }

  return `// Auto-generated by schema build step\nexport default ${serialize(obj)};\n`;
}

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
async function initDB(server, isFrontend = false, http = null, router = null) {
  if (dbInstance) return dbInstance;

  if (!server && !dbInstance) throw new Error('No DB instance and no config');

  try {
    const allSchemas = await initSchemas(isFrontend);
    if (!isFrontend) {
      const path = await import("path");
      const fs = await import("fs");
      const __dirname = path.resolve(path.dirname(decodeURI(new URL(import.meta.url).pathname).replace(/^\/([a-zA-Z]:)/, '$1')));
      fs.writeFileSync(path.join(__dirname, 'allschemas.js'), toESMModule(allSchemas, 2));
    }

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
      const { RxDBLeaderElectionPlugin } = await import('rxdb/plugins/leader-election');
      const { ClientSocket } = await import('./sockets/clientsocket.js');

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
      for (let entry of Object.values(wgnSchemas)) {
        colOptions[entry.name] = {
          schema: entry.schema,
          migrationStrategies: entry.migrations
        }
        if (entry.meta) {
          colOptions[entry.name] = Object.assign(colOptions[entry.name], entry.meta);
        }
      }

      await db.addCollections(colOptions);

      const { replicateServer } = await import('rxdb-server/plugins/replication-server');
      const { ReconnectingEventSource } = await import('reconnecting-eventsource');
      const states = {};
      for (const [name, collection] of Object.entries(db.collections)) {
        try {
          const frontendOnly = collections[name].frontendOnly;
          if (!frontendOnly && useRxReplication) {
            const state = replicateServer({
              collection,
              replicationIdentifier: `${name}-replication`,
              url: `/api/rxdb/${name}/${collection.schema.version}`,
              push: true,
              pull: true,
              live: true,
              autoStart: true,
              eventSource: ReconnectingEventSource,
            });
            state.error$.subscribe(err => {
              console.error(`${name} replication error:`, err)
              if (err?.status === 400 || err?.message?.includes('schema')) {
                console.warn('App update required. May need to delete localdatabase if update fails...')
                //deleteRxDBStoresExceptCache().then(() => location.reload())
              }
            })
            states[name] = state;
          }
        } catch (err) {
          console.error(`[ClientSocketHandler] Failed to expose rxServer collection "${name}":`, err);
        }
      }

      new ClientSocket(db);

      dbInstance = db;
      return initResolve(dbInstance);
    }

    const { createRxDatabase } = await import("rxdb");
    const { addRxPlugin } = await import('rxdb/plugins/core');
    const { getRxStorageMongoDB } = await import("rxdb/plugins/storage-mongodb");
    const { RxDBMigrationSchemaPlugin } = await import('rxdb/plugins/migration-schema');
    const { RxDBUpdatePlugin } = await import('rxdb/plugins/update');
    const process = await import("process");
    const path = await import("path");
    if (!process.env.MONGOURL) {
      const dotenv = await import('dotenv');
      dotenv.config({ path: path.resolve(path.join('../', '.env')) }); //running in standalone mode
    }

    addRxPlugin(RxDBMigrationSchemaPlugin);
    addRxPlugin(RxDBUpdatePlugin);

    const uri = process.env.MONGOURL;
    const db = await createRxDatabase({
      name: server,
      multiInstance: true,
      eventReduce: true,
      storage: getRxStorageMongoDB({ connection: uri })
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
    await db.addCollections(colOptions);

    if (server === WALGREENS) {
      const { ServerSocket } = await import("./sockets/serversocket.js");
      await ServerSocket.initialize(db, http, router, true);
    } else if (server === WORKMARKET) {
      const { ServerSocketClient } = await import("./sockets/serversocket.js");
      new ServerSocketClient(process.env.SERVER_PORT, server, db);
    }

    dbInstance = db;
    return initResolve(db);
  } catch (err) {
    return initReject(err);
  }
}
export async function initWalgreensDB(http, router) {
  return initDB(WALGREENS, false, http, router);
}
export async function initWorkmarketDB(http, router) {
  return initDB(WORKMARKET, false, http, router);
}
export async function initFrontEndDB() {
  return initDB(WALGREENS, true);
}
/**
 * Returns an object with the initialized RxDB instance and each collection as PascalCase keys.
 * Waits until initDB is called.
 *
 * @returns {Promise<{ db: import('rxdb').RxDatabase } & Record<string, import('rxdb').RxCollection>>}
 */
export async function getDb() {
  const db = await getPromise;
  if (!Object.keys(db.collections).length) {
    throw new Error('No collections found in db — was initDB() fully awaited?');
  }

  const result = { db };
  for (const [key, col] of Object.entries(db.collections)) {
    result[pascalReplacements[key] || key[0].toUpperCase() + key.slice(1)] = col;
  }

  return result;
}

export default schemaPromise;
