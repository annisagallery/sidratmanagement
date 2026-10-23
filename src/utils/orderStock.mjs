const count = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

export function availableForVariation(variation, custom = false) {
  if (!variation) return 0;
  // A custom piece must be made: a finished standard unit cannot cover it.
  const stock = custom ? 0 : count(variation.stock);
  const production = count(variation.productionCapacity ?? variation.materialAvailable);
  return stock + production + count(variation.backorderCapacity);
}

export function findOrderVariation(variations = [], attrs = {}, preferredId = null) {
  const custom = attrs.Type === 'Custom';
  const matches = variations.filter((variation) => (variation.attributes || []).every((attribute) => {
    const name = attribute.attributeName || attribute.name;
    const value = attribute.valueName || attribute.value;
    return name === 'Type' || (custom && attrs[name] === 'Custom') || attrs[name] === value;
  }));
  return matches.find((variation) => variation.id === preferredId) || matches[0] || null;
}

function legacyOrderStockProblems(items) {
  const groups = new Map();
  const backorders = new Map();
  const problems = [];
  for (const item of items) {
    const variation = (item.variations || []).find((entry) => entry.id === item.selectedVariationId);
    if (!variation) {
      problems.push(`${item.productName}: choose an available product option.`);
      continue;
    }
    const key = `${item.productId}:${variation.id}`;
    const group = groups.get(key) || { name: item.productName, productId: item.productId, backorderLimit: count(item.materialBackorderAvailable), variation, standard: 0, custom: 0 };
    const custom = item.selectedAttrs?.Type === 'Custom' || item.isCustom;
    group[custom ? 'custom' : 'standard'] += Number(item.qty || 1);
    groups.set(key, group);
  }
  for (const { name, productId, backorderLimit, variation, standard, custom } of groups.values()) {
    const finished = count(variation.stock);
    const production = count(variation.productionCapacity ?? variation.materialAvailable);
    const needsProduction = custom + Math.max(0, standard - finished);
    const backorder = count(variation.backorderCapacity);
    if (needsProduction > production + backorder) {
      problems.push(`${name}: ${finished} finished unit(s), materials for ${production} more, and ${backorder} approved backorder slot(s). This selection needs ${needsProduction} unit(s) made${custom ? `, including ${custom} custom` : ''}. ${variation.productionMessage || 'Reduce the quantity or receive the missing materials.'}`);
    }
    const entry = backorders.get(productId) || { name, used: 0, limit: backorderLimit };
    entry.used += Math.max(0, needsProduction - production);
    backorders.set(productId, entry);
  }
  for (const { name, used, limit } of backorders.values()) if (used > limit) problems.push(`${name}: this selection needs ${used} material backorder slot(s), but only ${limit} remain for the whole product.`);
  return problems;
}

const roundMaterial = value => Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
const materialCapacity = (lines, pool) => lines.length ? Math.max(0, Math.min(...lines.map(line =>
  Math.floor((roundMaterial(pool.get(line.accessoryId) || 0) + 1e-9) / line.requiredQuantity)))) : Number.MAX_SAFE_INTEGER;

function materialPlan(items, excludedKey = null) {
  const pool = new Map();
  const allowances = new Map();
  const groups = new Map();
  const finished = new Map();
  const problems = [];
  for (const item of items) {
    const allowance = count(item.materialBackorderAvailable);
    allowances.set(item.productId, Math.min(allowances.get(item.productId) ?? allowance, allowance));
    for (const variation of item.variations || []) for (const line of variation.materialRequirements || []) {
      const free = Math.max(0, Number(line.availableQuantity) || 0);
      pool.set(line.accessoryId, Math.min(pool.get(line.accessoryId) ?? free, free));
    }
    if (item._key === excludedKey) continue;
    const variation = item.variations?.find(row => row.id === item.selectedVariationId);
    if (!variation) continue;
    const key = `${item.productId}:${variation.id}`;
    const group = groups.get(key) || { item, variation, standard: 0, custom: 0 };
    group[item.isCustom || item.selectedAttrs?.Type === 'Custom' ? 'custom' : 'standard'] += count(item.qty || 1);
    groups.set(key, group);
  }
  for (const [key, { item, variation, standard, custom }] of groups) {
    const stock = count(variation.stock);
    finished.set(key, Math.max(0, stock - standard));
    const lines = variation.materialRequirements || [];
    if (!lines.length || lines.some(line => !(line.requiredQuantity > 0))) continue;
    const needed = custom + Math.max(0, standard - stock);
    const physical = materialCapacity(lines, pool);
    const nonRepurchasable = materialCapacity(lines.filter(line => !line.isRepurchasable), pool);
    const allowance = allowances.get(item.productId) || 0;
    const extra = Math.min(allowance, Math.max(0, nonRepurchasable - physical));
    if (needed > physical + extra) problems.push(`${item.productName}: shared materials support ${physical} more unit(s) after the other selections, plus ${extra} approved backorder(s). This selection needs ${needed} unit(s) made. Materials are shared across variations and products.`);
    allowances.set(item.productId, Math.max(0, allowance - Math.max(0, needed - physical)));
    for (const line of lines) pool.set(line.accessoryId, roundMaterial(Math.max(0, (pool.get(line.accessoryId) || 0) - needed * line.requiredQuantity)));
  }
  return { pool, allowances, finished, problems };
}

// Each line's maximum leaves room for every OTHER line in this draft order.
export function availabilityForOrderLine(items, item) {
  const variation = item.variations?.find(row => row.id === item.selectedVariationId);
  const lines = variation?.materialRequirements || [];
  if (!lines.length || lines.some(line => !(line.requiredQuantity > 0))) return item;
  const plan = materialPlan(items, item._key);
  const custom = item.isCustom || item.selectedAttrs?.Type === 'Custom';
  const key = `${item.productId}:${variation.id}`;
  const stock = custom ? 0 : plan.finished.get(key) ?? count(variation.stock);
  const productionCapacity = materialCapacity(lines, plan.pool);
  const backorderCapacity = Math.min(plan.allowances.get(item.productId) || 0,
    Math.max(0, materialCapacity(lines.filter(line => !line.isRepurchasable), plan.pool) - productionCapacity));
  return { ...item, stock, productionCapacity, backorderCapacity,
    availableQuantity: stock + productionCapacity + backorderCapacity, productionCapacityShared: true };
}

export function orderStockProblems(items) {
  return [...legacyOrderStockProblems(items), ...materialPlan(items).problems];
}
