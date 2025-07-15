/** @type {'walgreens'} */ export const WALGREENS = 'walgreens';
/** @type {'workmarket'} */ export const WORKMARKET = 'workmarket';
export const CURRENT_SCHEMA_VERSION = 5;
export const useRxReplication = false;

export let collections = {};
export let wmSchemas = ['assignments', 'invoices', 'payments', 'techinvoices'];
export let wgnSchemas = [];
export const frontendOnly = ['cache'];
export const colMeta = {
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
export const pascalReplacements = {
  workorders: 'Workorders',
  techinvoices: 'TechInvoices',
  // Add more as needed
};
export let dbInstance = null;

export const { promise: schemaPromise, resolve: schemaResolve, reject: schemaReject } = Promise.withResolvers();
export const { promise: initPromise, resolve: initResolve, reject: initReject } = Promise.withResolvers();


export async function compileSchemas(rawSchemas) {
  // Add shared schema logic here (e.g. attach migration functions, apply metadata)
    wgnSchemas = Object.keys(rawSchemas).filter(c => !wmSchemas.includes(c));
    wgnSchemas = wgnSchemas.map((c) => rawSchemas[c]);
    wmSchemas = wmSchemas.map((c) => rawSchemas[c]);
  return rawSchemas;
}

/**
 * Returns an object with the initialized RxDB instance and each collection as PascalCase keys.
 * Waits until initDB is called.
 *
 * @returns {Promise<{ db: import('rxdb').RxDatabase } & Record<string, import('rxdb').RxCollection>>}
 */
export function dbModel(db) {
  if (!Object.keys(db.collections).length) {
    throw new Error('No collections found in db — was initDB() fully awaited?');
  }

  const result = { db };
  for (const [key, col] of Object.entries(db.collections)) {
    result[pascalReplacements[key] || key[0].toUpperCase() + key.slice(1)] = col;
  }

  return result;
}
