// scripts/generate-typedefs-from-module.js
import fs from 'fs';
import path from 'path';
import initPromise from '../index.js'; // adjust if needed this is a standalone module

const outputPath = path.resolve('./typedefs.js');
const wmCollections = ['assignments', 'invoices', 'payments', 'techinvoices'];

function jsType(jsonType) {
  if (Array.isArray(jsonType)) {
    return jsonType.map(jsType).filter(Boolean).join(' | ');
  }
  return {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    array: 'any[]',
    object: 'object'
  }[jsonType] || 'any';
}

function toPascal(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function escapeField(field) {
  return /^[a-zA-Z_]\w*$/.test(field) ? field : `"${field}"`;
}

const collections = await initPromise;
const typedefs = [];
const wm = [];
const wgn = [];

for (const [key, collection] of Object.entries(collections)) {
  const pascal = toPascal(key);
  const base = pascal.endsWith('s') ? pascal.slice(0, -1) : pascal;

  const props = collection.schema?.properties ?? {};
  const docName = `${base}Doc`;
  const colName = `${base}Collection`;

  typedefs.push(`/** @typedef {Object} ${docName}`);
  for (const [field, def] of Object.entries(props)) {
    const type = jsType(def.type);
    typedefs.push(` * @property {${type}} ${escapeField(field)}`);
  }
  typedefs.push(` */`);
  typedefs.push(`export const ${docName} = {};`);

  typedefs.push(`/** @typedef {import('rxdb').RxCollection<${docName}>} ${colName} */`);
  typedefs.push(`export const ${colName} = {};\n`);

  (wmCollections.includes(key) ? wm : wgn).push(base);
}

function collectionGroup(name, list) {
  const props = list.map(k => ` * @property {${k}Collection} ${k}s`).join('\n');
  return `/**\n * @typedef {Object} ${name}\n${props}\n * @property {import('rxdb').RxDatabase} db\n */\nexport const ${name} = {};`;
}

typedefs.push(collectionGroup('WMCollections', wm));
typedefs.push(collectionGroup('WGNCollections', wgn));
typedefs.push(collectionGroup('AllCollections', [...wm, ...wgn]));

fs.writeFileSync(outputPath, '// AUTO-GENERATED FILE. DO NOT EDIT.\n\n' + typedefs.join('\n\n') + '\n');
console.log(`✅ typedefs.js written to ${outputPath}`);
