// LC ledger persistence. MongoDB (collection `lc_ledger`) when MONGODB_URI is set,
// otherwise the local JSON file used before (data/lc-ledger.json; local development only).
// One document per LC, _id = normalized LC number:
//   { _id, lcNumber, lcDetails, contractData, shipments: [{ invoiceNo, ... }], createdAt, updatedAt }
import fs from 'fs';
import path from 'path';
import { MongoClient, Collection } from 'mongodb';

export interface LedgerStore {
  kind: 'mongodb' | 'file';
  list(): Promise<any[]>;
  get(key: string): Promise<any | null>;
  /** Create or refresh the LC; existing shipments (and contract, if none given) are kept. */
  upsertLC(key: string, lcDetails: any, contractData: any): Promise<any>;
  /** LC that already holds this invoice number, other than `exceptKey`. */
  findInvoiceOwner(invoiceNo: string, exceptKey: string): Promise<any | null>;
  /** Add or replace one shipment by invoice number. Returns null if the LC does not exist. */
  putShipment(key: string, record: any): Promise<any | null>;
  removeShipment(key: string, invoiceNo: string): Promise<any | null>;
}

export const LEDGER_FILE = path.join(process.cwd(), 'data', 'lc-ledger.json');
export const LEDGER_COLLECTION = 'lc_ledger';
const DEFAULT_DB = 'lahoti_export_docs';

const byInvoice = (a: any, b: any) => String(a.invoiceNo).localeCompare(String(b.invoiceNo));
const toEntry = ({ _id, ...rest }: any) => rest;

function readLedgerFile(): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function createFileStore(): LedgerStore {
  const write = (ledger: Record<string, any>) => {
    fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
    const tmp = `${LEDGER_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2));
    fs.renameSync(tmp, LEDGER_FILE);
  };
  return {
    kind: 'file',
    async list() {
      return Object.values(readLedgerFile());
    },
    async get(key) {
      return readLedgerFile()[key] || null;
    },
    async upsertLC(key, lcDetails, contractData) {
      const ledger = readLedgerFile();
      const now = new Date().toISOString();
      const prev = ledger[key];
      ledger[key] = {
        lcNumber: lcDetails.lcNumber,
        lcDetails,
        contractData: contractData ?? prev?.contractData ?? null,
        shipments: prev?.shipments || [],
        createdAt: prev?.createdAt || now,
        updatedAt: now
      };
      write(ledger);
      return ledger[key];
    },
    async findInvoiceOwner(invoiceNo, exceptKey) {
      return Object.entries(readLedgerFile())
        .find(([k, e]: [string, any]) => k !== exceptKey && e.shipments?.some((s: any) => s.invoiceNo === invoiceNo))?.[1] || null;
    },
    async putShipment(key, record) {
      const ledger = readLedgerFile();
      const entry = ledger[key];
      if (!entry) return null;
      const now = new Date().toISOString();
      entry.shipments = [...entry.shipments.filter((s: any) => s.invoiceNo !== record.invoiceNo), { ...record, updatedAt: now }].sort(byInvoice);
      entry.updatedAt = now;
      write(ledger);
      return entry;
    },
    async removeShipment(key, invoiceNo) {
      const ledger = readLedgerFile();
      const entry = ledger[key];
      if (!entry) return null;
      entry.shipments = entry.shipments.filter((s: any) => s.invoiceNo !== invoiceNo);
      entry.updatedAt = new Date().toISOString();
      write(ledger);
      return entry;
    }
  };
}

function createMongoStore(col: Collection<any>): LedgerStore {
  return {
    kind: 'mongodb',
    async list() {
      return (await col.find({}).sort({ updatedAt: -1 }).toArray()).map(toEntry);
    },
    async get(key) {
      const doc = await col.findOne({ _id: key });
      return doc ? toEntry(doc) : null;
    },
    async upsertLC(key, lcDetails, contractData) {
      const now = new Date().toISOString();
      const doc = await col.findOneAndUpdate(
        { _id: key },
        {
          $set: { lcNumber: lcDetails.lcNumber, lcDetails, updatedAt: now, ...(contractData != null ? { contractData } : {}) },
          $setOnInsert: { shipments: [], createdAt: now, ...(contractData != null ? {} : { contractData: null }) }
        },
        { upsert: true, returnDocument: 'after' }
      );
      return toEntry(doc);
    },
    async findInvoiceOwner(invoiceNo, exceptKey) {
      const doc = await col.findOne({ _id: { $ne: exceptKey }, 'shipments.invoiceNo': invoiceNo });
      return doc ? toEntry(doc) : null;
    },
    async putShipment(key, record) {
      const now = new Date().toISOString();
      // Single atomic update: drop any earlier copy of this invoice, append the new one, keep sorted
      const doc = await col.findOneAndUpdate(
        { _id: key },
        [{
          $set: {
            updatedAt: now,
            shipments: {
              $sortArray: {
                input: {
                  $concatArrays: [
                    { $filter: { input: '$shipments', cond: { $ne: ['$$this.invoiceNo', record.invoiceNo] } } },
                    [{ $literal: { ...record, updatedAt: now } }]
                  ]
                },
                sortBy: { invoiceNo: 1 }
              }
            }
          }
        }],
        { returnDocument: 'after' }
      );
      return doc ? toEntry(doc) : null;
    },
    async removeShipment(key, invoiceNo) {
      const doc = await col.findOneAndUpdate(
        { _id: key },
        { $pull: { shipments: { invoiceNo } }, $set: { updatedAt: new Date().toISOString() } } as any,
        { returnDocument: 'after' }
      );
      return doc ? toEntry(doc) : null;
    }
  };
}

/** Copies LCs from the old JSON file into MongoDB; LCs already in MongoDB are left untouched. */
export async function importLedgerFile(col: Collection<any>): Promise<number> {
  const entries = Object.entries(readLedgerFile());
  if (!entries.length) return 0;
  const result = await col.bulkWrite(
    entries.map(([key, entry]) => ({
      updateOne: { filter: { _id: key }, update: { $setOnInsert: entry }, upsert: true }
    }))
  );
  return result.upsertedCount;
}

export async function connectLedgerCollection(uri: string, dbName = DEFAULT_DB): Promise<{ client: MongoClient; col: Collection<any> }> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const col = client.db(dbName).collection(LEDGER_COLLECTION);
  await col.createIndex({ 'shipments.invoiceNo': 1 }, { name: 'shipments_invoiceNo' });
  await col.createIndex({ updatedAt: -1 }, { name: 'updatedAt_desc' });
  return { client, col };
}

export async function createLedgerStore(): Promise<LedgerStore> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    // Serverless file systems are read-only and not shared between instances
    if (process.env.VERCEL) throw new Error('MONGODB_URI is not set');
    console.warn('MONGODB_URI not set: LC ledger is stored in data/lc-ledger.json');
    return createFileStore();
  }
  const dbName = process.env.MONGODB_DB || DEFAULT_DB;
  const { col } = await connectLedgerCollection(uri, dbName);
  const imported = await importLedgerFile(col);
  console.log(`LC ledger: MongoDB ${dbName}.${LEDGER_COLLECTION}${imported ? ` (imported ${imported} LC(s) from data/lc-ledger.json)` : ''}`);
  return createMongoStore(col);
}

// One connection per server instance, reused by every request (and across dev hot reloads).
// A failed connection is not cached, so the next request tries again.
const cache = globalThis as typeof globalThis & { __lcLedgerStore?: Promise<LedgerStore> };

export function getLedgerStore(): Promise<LedgerStore> {
  if (!cache.__lcLedgerStore) {
    cache.__lcLedgerStore = createLedgerStore().catch(err => {
      cache.__lcLedgerStore = undefined;
      throw err;
    });
  }
  return cache.__lcLedgerStore;
}
