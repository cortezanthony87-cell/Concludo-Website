/**
 * Tasklet 1.1: Output Registry Service
 *
 * Implements the authoritative in-memory and database-backed catalogue of all
 * 58 Concludo output deliverables, specifying metadata, package assignments,
 * schema references, and execution constraints.
 */
import { registry, loadFullRegistry } from '../registry.mjs';

export const VALID_TIERS = ['starter', 'pro_subscription', 'team'];

const TIER_ORDER = {
  starter: 1,
  pro_subscription: 2,
  team: 3,
};

let cache = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

function buildCatalogue() {
  const full = loadFullRegistry();
  const outputs = new Map();

  // 1. Spine deliverables (10 deliverables: OUT-01 to OUT-10)
  const spineItems = full?.outputs?.spine ?? registry.spine ?? [];
  for (const item of spineItems) {
    outputs.set(item.id, {
      output_id: item.id,
      name: item.name,
      code: item.id.replace('-', '_'),
      category: 'EXECUTIVE_SPINE',
      template: item.template,
      summary: item.precondition || 'Core executive spine deliverable',
      tier_minimum: item.id === 'OUT-09' ? 'pro_subscription' : 'starter',
      schema_version: 'v1.1',
      required_dag_stages: [1, 2, 3, 4, 5, 6, 7],
      is_active: true,
      precondition: item.precondition,
    });
  }

  // 2. Catalogue deliverables (48 deliverables: OUT-11 to OUT-58)
  const catalogueItems = full?.outputs?.catalogue ?? [];
  for (const item of catalogueItems) {
    // Map tier minimums based on category / sophistication
    let tier = 'pro_subscription';
    if (['OUT-33', 'OUT-35', 'OUT-52', 'OUT-53'].includes(item.id)) {
      tier = 'team';
    } else if (['OUT-11', 'OUT-12', 'OUT-13'].includes(item.id)) {
      tier = 'pro_subscription';
    }

    outputs.set(item.id, {
      output_id: item.id,
      name: item.name,
      code: item.id.replace('-', '_'),
      category: item.template?.startsWith('T') ? 'STRATEGIC_CATALOGUE' : 'OPERATIONAL_AGILITY',
      template: item.template,
      summary: item.precondition || 'Catalogue deliverable',
      tier_minimum: tier,
      schema_version: 'v1.1',
      required_dag_stages: [1, 2, 3, 4, 5, 6, 7],
      is_active: true,
      precondition: item.precondition,
    });
  }

  return outputs;
}

function getCache() {
  const now = Date.now();
  if (!cache || now > cacheExpiresAt) {
    cache = buildCatalogue();
    cacheExpiresAt = now + CACHE_TTL_MS;
  }
  return cache;
}

export function invalidateRegistryCache() {
  cache = null;
  cacheExpiresAt = 0;
}

export function getAllOutputs() {
  return Array.from(getCache().values());
}

export function getOutputById(id) {
  const item = getCache().get(id);
  if (!item) {
    const err = new Error('Output deliverable does not exist in registry');
    err.code = 'OUTPUT_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  return item;
}

export function getOutputsByTier(tier) {
  if (!VALID_TIERS.includes(tier)) {
    throw new Error(`Invalid subscription tier: "${tier}". Expected starter, pro_subscription, or team.`);
  }
  const currentLevel = TIER_ORDER[tier];
  return getAllOutputs().filter((out) => TIER_ORDER[out.tier_minimum] <= currentLevel);
}

export function validateOutputEligibility(outputId, currentTier) {
  if (!VALID_TIERS.includes(currentTier)) {
    return false;
  }
  try {
    const deliverable = getOutputById(outputId);
    return TIER_ORDER[currentTier] >= TIER_ORDER[deliverable.tier_minimum];
  } catch (e) {
    if (e.code === 'OUTPUT_NOT_FOUND') return false;
    throw e;
  }
}
