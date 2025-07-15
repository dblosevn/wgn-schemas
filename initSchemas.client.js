import allSchemas from "./allschemas.js";
import { compileSchemas, dbModel, initPromise, initResolve, schemaPromise, schemaResolve, useRxReplication, WALGREENS, wgnSchemas } from "./initSchemas.shared.js";
let schemaStarted = false;
export {CURRENT_SCHEMA_VERSION} from "./initSchemas.shared.js"
/**
 * @type {Promise<import('rxdb').RxDatabase>}
 */
let dbInstance = null;

/**
 * @typedef {'walgreens' | 'workmarket'} Server
 * A server identifier, must be either 'walgreens' or 'workmarket'.
 */

/**
 * Initializes the RxDB instance for the given server.
 *
 * @param {Server} server - Server key ('walgreens' or 'workmarket')
 * @returns {Promise<import('rxdb').RxDatabase>}
 */
export async function initDB(server) {
  if (dbInstance) return dbInstance;
  if (!server && !dbInstance) throw new Error('No DB instance and no config');
  await initSchemas();

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
  console.log(colOptions);
  await db.addCollections(colOptions);

  const { replicateServer } = await import('rxdb-server/plugins/replication-server');
  const { ReconnectingEventSource } = await import('reconnecting-eventsource');
  const states = {};
  for (const [name, collection] of Object.entries(db.collections)) {
    try {
      const frontendOnly = allSchemas[name].frontendOnly;
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
  initResolve(dbInstance);
  return initPromise;
}

export async function initSchemas() {
  if (schemaStarted) return schemaPromise;
  schemaStarted = true;
  compileSchemas(allSchemas);
  schemaResolve(allSchemas);
  return schemaPromise;
}

/**
 * Returns an object with the initialized RxDB instance and each collection as PascalCase keys.
 * Waits until initDB is called.
 *
 * @returns {Promise<{ db: import('rxdb').RxDatabase } & Record<string, import('rxdb').RxCollection>>}
 */
export async function getDb() {
  const db = await initPromise;
  console.log(db);
  return dbModel(db);
}
export async function initFrontEndDB() {
  return initDB(WALGREENS);
}
