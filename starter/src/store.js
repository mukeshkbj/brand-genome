// File-backed data: merchant, shared catalogue, genomes (with undo history) and orders.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { sanitizeGenome } from './genome.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2)); };

export const merchant = readJson(join(ROOT, 'data/merchant.json'));
export const catalog = readJson(join(ROOT, 'data/catalog.json'));
export const products = catalog.products;
export const productById = (id) => products.find((p) => p.id === id);

const genomePath = (id) => join(ROOT, 'genomes', `${id}.json`);
const historyDir = join(ROOT, 'data/history');

export const isBrand = (id) => merchant.brands.includes(id);
export function getGenome(id) {
  if (!isBrand(id)) return null;
  const g = readJson(genomePath(id));
  return sanitizeGenome(g, g);
}
export function saveGenome(genome) {
  const prev = getGenome(genome.id);
  writeJson(join(historyDir, `${genome.id}-${Date.now()}.json`), prev);
  writeJson(genomePath(genome.id), genome);
}
export function undoGenome(id) {
  if (!existsSync(historyDir)) return null;
  const files = readdirSync(historyDir).filter((f) => f.startsWith(`${id}-`)).sort();
  const last = files.at(-1);
  if (!last) return null;
  const g = readJson(join(historyDir, last));
  writeJson(genomePath(id), g);
  unlinkSync(join(historyDir, last));
  return g;
}

// Proposals live in memory until the merchant approves or rejects them.
const proposals = new Map();
export function addProposal(p) {
  const id = randomUUID();
  proposals.set(id, { ...p, id, createdAt: Date.now() });
  if (proposals.size > 50) proposals.delete(proposals.keys().next().value);
  return id;
}
export const getProposal = (id) => proposals.get(id);
export const dropProposal = (id) => proposals.delete(id);

// Orders
const ordersPath = join(ROOT, 'data/orders.json');
const orders = existsSync(ordersPath) ? readJson(ordersPath) : {};
export const getOrder = (id) => orders[id];
export function saveOrder(order) { orders[order.id] = order; writeJson(ordersPath, orders); return order; }
export function findOrderByProviderRef(ref) { return Object.values(orders).find((o) => o.payment?.providerRef === ref); }
