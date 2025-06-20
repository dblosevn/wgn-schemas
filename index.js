//./index.js
import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";

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
      const collectionKey = `${colDir.toLowerCase()}s`;

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

/**
 * @template T
 * @param {import('rxdb').RxDatabase} db
 * @param {string[]} cols
 * @param {boolean} [useRxReplication=false]
 * @param {boolean} [isServer=false]
 * @returns {Promise<T>}
 */
async function initCollections(db, cols, useRxReplication = false, isServer = false) {
  const colConfig = {};
  const endpoints = [];
  const retObj = {};

  for (const col of cols) {
    const collection = collections[col];
    if (!collection) {
      console.warn(`[initCollections] Missing collection "${col}", skipping.`);
      continue;
    }

    colConfig[col] = {
      schema: collection.schema,
      migrationStrategies: collection.migrations,
    };

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
      const replicationConfig = {
        name: endpoint.name,
        collection: db[endpoint.collectionName],
        ...(isServer && { changeValidator: myChangeValidator })
      };
      db.addReplicationEndpoint(replicationConfig);
    }
  }

  retObj.db = db;
  return retObj;
}
/** @returns {Promise<import("./typedefs.js").WMCollections>} */
export async function initWMCollections(db, useRxReplication = false, isServer = false) {
  await Schemas;
  return await initCollections(db, wmCollections, useRxReplication, isServer);
}
/** @returns {Promise<import("./typedefs.js").WGNCollections>} */
export async function initWGNCollections(db, useRxReplication = false, isServer = false) {
  await Schemas;
  const colNames = Object.keys(collections).filter(c => !wmCollections.includes(c));
  return await initCollections(db, colNames, useRxReplication, isServer);
}
export {ClientSocket} from "./sockets/clientsocket.js";

export default Schemas;
