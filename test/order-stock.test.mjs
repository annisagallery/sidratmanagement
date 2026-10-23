import test from 'node:test';
import assert from 'node:assert/strict';
import { availableForVariation, availabilityForOrderLine, findOrderVariation, orderStockProblems } from '../src/utils/orderStock.mjs';

const variation = (overrides = {}) => ({ id: 'blue-m', stock: 0, productionCapacity: 0, backorderCapacity: 0, attributes: [{ attributeName: 'Colour', valueName: 'Blue' }, { attributeName: 'Size', valueName: 'M' }], ...overrides });
const item = (option, overrides = {}) => ({ productId: 'shirt', productName: 'Shirt', variations: [option], selectedVariationId: option.id, selectedAttrs: { Type: 'Standard', Colour: 'Blue', Size: 'M' }, qty: 1, materialBackorderAvailable: 0, ...overrides });

test('no stock or materials means zero availability, even when presale is enabled', () => {
  assert.equal(availableForVariation(variation({ overSale: true, available: 999999 })), 0);
  assert.equal(availableForVariation(null), 0);
  assert.ok(orderStockProblems([item(variation())]).length);
});

test('standard items can use finished stock or material-backed production', () => {
  const option = variation({ stock: 2, productionCapacity: 3 });
  assert.equal(availableForVariation(option), 5);
  assert.deepEqual(orderStockProblems([item(option, { qty: 5 })]), []);
  assert.ok(orderStockProblems([item(option, { qty: 6 })]).length);
});

test('custom items cannot use finished standard stock', () => {
  const option = variation({ stock: 100 });
  assert.equal(availableForVariation(option, true), 0);
  assert.ok(orderStockProblems([item(option, { isCustom: true })]).length);
});

test('custom production is limited by materials', () => {
  const option = variation({ stock: 100, productionCapacity: 2 });
  assert.equal(availableForVariation(option, true), 2);
  assert.deepEqual(orderStockProblems([item(option, { isCustom: true, qty: 2 })]), []);
  assert.ok(orderStockProblems([item(option, { isCustom: true, qty: 3 })]).length);
});

test('duplicate lines share stock and production capacity', () => {
  const option = variation({ stock: 2, productionCapacity: 1 });
  assert.ok(orderStockProblems([item(option, { qty: 2 }), item(option, { qty: 2 })]).length);
});

test('standard and custom lines spend the same material capacity once', () => {
  const option = variation({ stock: 2, productionCapacity: 1 });
  assert.deepEqual(orderStockProblems([item(option, { qty: 2 }), item(option, { isCustom: true })]), []);
  assert.ok(orderStockProblems([item(option, { qty: 3 }), item(option, { isCustom: true })]).length);
});

test('only approved material backorders extend availability', () => {
  const option = variation({ backorderCapacity: 2 });
  assert.deepEqual(orderStockProblems([item(option, { qty: 2, materialBackorderAvailable: 2 })]), []);
  assert.deepEqual(orderStockProblems([item(option, { isCustom: true, qty: 2, materialBackorderAvailable: 2 })]), []);
  assert.ok(orderStockProblems([item(option, { qty: 3, materialBackorderAvailable: 2 })]).length);
});

test('backorder slots are shared across sizes of the same product', () => {
  const blue = variation({ backorderCapacity: 2 });
  const red = variation({ id: 'red-l', backorderCapacity: 2 });
  const problems = orderStockProblems([item(blue, { qty: 2, materialBackorderAvailable: 2 }), item(red, { materialBackorderAvailable: 2 })]);
  assert.ok(problems.some((problem) => problem.includes('only 2 remain')));
});

test('unmatched standard options never keep the previously selected stock', () => {
  assert.equal(findOrderVariation([variation()], { Type: 'Standard', Colour: 'Red', Size: 'M' }, 'blue-m'), null);
});

test('custom dimensions retain the compatible material option and its capacity', () => {
  const blue = variation();
  const red = variation({ id: 'red-m', attributes: [{ attributeName: 'Colour', valueName: 'Red' }, { attributeName: 'Size', valueName: 'M' }] });
  assert.equal(findOrderVariation([blue, red], { Type: 'Custom', Colour: 'Red', Size: 'Custom' }, blue.id)?.id, red.id);
});

const material = (overrides = {}) => ({ accessoryId: 'fabric', name: 'Cotton', unit: 'm', availableQuantity: 1000, requiredQuantity: 2, isRepurchasable: false, ...overrides });
const sharedItem = (key, optionId, quantity, overrides = {}) => item(variation({ id: optionId, productionCapacity: 500, materialRequirements: [material()] }), { _key: key, qty: quantity, ...overrides });

test('500 material-backed pieces are shared across variations rather than offered 500 times per size', () => {
  const first = sharedItem('a', 'blue-m', 300);
  const second = sharedItem('b', 'blue-l', 200);
  assert.deepEqual(orderStockProblems([first, second]), []);
  assert.equal(availabilityForOrderLine([first, second], first).productionCapacity, 300);
  assert.equal(availabilityForOrderLine([first, second], second).productionCapacity, 200);
  assert.ok(orderStockProblems([first, { ...second, qty: 201 }]).some(problem => problem.includes('shared materials')));
});

test('different products compete for the same accessory pool, including different per-piece quantities', () => {
  const first = sharedItem('a', 'shirt-m', 300);
  const second = item(variation({ id: 'dress-m', productionCapacity: 250, materialRequirements: [material({ requiredQuantity: 4 })] }), { _key: 'b', productId: 'dress', productName: 'Dress', qty: 100 });
  assert.deepEqual(orderStockProblems([first, second]), []);
  assert.equal(availabilityForOrderLine([first, second], second).productionCapacity, 100);
  assert.ok(orderStockProblems([first, { ...second, qty: 101 }]).length);
});

test('finished units are used before shared materials; custom pieces still require production', () => {
  const first = sharedItem('a', 'blue-m', 100);
  first.variations[0].stock = 100;
  const second = sharedItem('b', 'blue-l', 500);
  assert.deepEqual(orderStockProblems([first, second]), []);
  assert.equal(availabilityForOrderLine([first, second], second).productionCapacity, 500);
  assert.ok(orderStockProblems([{ ...first, isCustom: true }, second]).length);
});

test('shared shortages use the product backorder allowance once', () => {
  const first = sharedItem('a', 'blue-m', 500, { materialBackorderAvailable: 2 });
  const second = sharedItem('b', 'blue-l', 2, { materialBackorderAvailable: 2 });
  for (const entry of [first, second]) {
    entry.variations[0].materialRequirements[0].isRepurchasable = true;
    entry.variations[0].backorderCapacity = 2;
  }
  assert.deepEqual(orderStockProblems([first, second]), []);
  assert.equal(availabilityForOrderLine([first, second], second).backorderCapacity, 2);
  assert.ok(orderStockProblems([first, { ...second, qty: 3 }]).length);
});

test('unrelated materials remain independent and smaller fresh stock snapshots win', () => {
  const first = sharedItem('a', 'blue-m', 500);
  const second = sharedItem('b', 'red-m', 500);
  second.variations[0].materialRequirements[0].accessoryId = 'other-fabric';
  assert.deepEqual(orderStockProblems([first, second]), []);
  second.variations[0].materialRequirements[0].accessoryId = 'fabric';
  second.variations[0].materialRequirements[0].availableQuantity = 600;
  assert.equal(availabilityForOrderLine([first, second], first).productionCapacity, 0);
  assert.ok(orderStockProblems([first, second]).length);
});
