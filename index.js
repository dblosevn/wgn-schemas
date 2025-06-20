//./index.js
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import ReconnectingEventSource from "reconnecting-eventsource";
import { replicateServer } from "rxdb-server/dist/types/plugins/replication-server/index.js";

const collections = {};
const wmCollections = ['assignments', 'invoices', 'payments', 'techinvoices'];

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
      collectionKey = (collectionKey == 'caches') ? 'cache': collectionKey;

      const collection = (collections[collectionKey] = {
        schema: null,
        migrations,
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

    resolve(collections);
  } catch (e) {
    reject(e);
  }
})();

function myChangeValidator(authData) {
  return !!authData.data;
}
export async function deleteRxDBStoresExceptCache() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('walgreens')
    request.onsuccess = (event) => {
      const db = event.target.result
      const stores = Array.from(db.objectStoreNames)
      db.close()
      const deleteRequest = indexedDB.deleteDatabase('walgreens-temp')
      deleteRequest.onsuccess = () => {
        const preserveCache = indexedDB.open('walgreens', db.version + 1)
        preserveCache.onupgradeneeded = (ev) => {
          const upgradedDb = ev.target.result
          stores.forEach((store) => {
            if (store === 'cache') {
              upgradedDb.createObjectStore('cache', { keyPath: '_id' })
            }
          })
        }
        preserveCache.onsuccess = () => {
          preserveCache.result.close()
          resolve()
        }
        preserveCache.onerror = reject
      }
      deleteRequest.onerror = reject
    }
    request.onerror = reject
  })
}

/**
 * @template T
 * @param {import('rxdb').RxDatabase} db
 * @param {string[]} cols
 * @param {boolean} [useRxReplication=false]
 * @param {boolean} [server=false]
 * @returns {Promise<T>}
 */
async function initCollections(db, cols, useRxReplication = false, server = false, extColOptions={}) {
  const colConfig = {};
  const endpoints = [];
  const retObj = {};

  for (const col of cols) {
    const collection = collections[col];
    if (!collection) {
      console.warn(`[initCollections] Missing collection "${col}", skipping.`);
      continue;
    }
    if (server && col == 'cache') continue; //cache is a frontend only collection
    colConfig[col] = {
      schema: collection.schema,
      migrationStrategies: collection.migrations,
    };
    if (extColOptions[col]) colConfig[col] = Object.assign(colConfig[col], extColOptions[col]);

    endpoints.push({
      name: `api/rxdb/${col}`,
      collectionName: col,
    });
  }

  await db.addCollections(colConfig);

  for (const endpoint of endpoints) {
    const colName = endpoint.collectionName.charAt(0).toUpperCase() + endpoint.collectionName.slice(1);
    retObj[colName] = db[endpoint.collectionName];

    if (useRxReplication) {
      if (server) {
        const replicationConfig = {
          name: endpoint.name,
          collection: db.collections[endpoint.collectionName],
          ...(server && { changeValidator: myChangeValidator })
        };
        db.addReplicationEndpoint(replicationConfig);
      } else {
        let repOptions = {
            collection: db.collections[endpoint.collectionName],
            replicationIdentifier: `${endpoint.collectionName}-replication`,
            url: `/${endpoint.name}/` + db.collections[endpoint.collectionName].schema.version,
            push: ({documents, collection}) => {
              const name = collection.name;
            },
            pull: ({lastPulledCheckpoint, collection}) => {
              const name = collection.name;

            },
            live: true,
            autoStart: true,
            eventSource: ReconnectingEventSource,
          };
         const state = replicateServer(repOptions);

          state.error$.subscribe(err => {
            console.error(`${endpoint.name} replication error:`, err)
            if (err?.status === 400 || err?.message?.includes('schema')) {
              alert('App update required. Clearing outdated data...')
              deleteRxDBStoresExceptCache().then(() => location.reload())
            }
          })
      }
    }
  }

  retObj.db = db;
  return retObj;
}
/** @returns {Promise<import("./typedefs.js").WMCollections>} */
export async function initWMCollections(db, useRxReplication = false, server = false, colOptions={}) {
  await Schemas;
  return await initCollections(db, wmCollections, useRxReplication, server, colOptions);
}
/** @returns {Promise<import("./typedefs.js").WGNCollections>} */
export async function initWGNCollections(db, useRxReplication = false, server = false, colOptions={}) {
  await Schemas;
  const colNames = Object.keys(collections).filter(c => !wmCollections.includes(c));
  return await initCollections(db, colNames, useRxReplication, server, colOptions);
}
export { ClientSocket } from "./sockets/clientsocket.js";

export default Schemas;
export const CURRENT_SCHEMA_VERSION = '5'
