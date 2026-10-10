import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, validate } from './engine';
import { seedStarterCategories } from './starterCategories';

test('first setup creates four valid, independent envelopes without allocating money', () => {
  const state = emptyState();
  seedStarterCategories(state, '2026-10');
  assert.deepEqual(state.categories.map(c => c.name), ['Maison', 'Courses', 'Sorties', 'Transports']);
  assert.equal(new Set(state.categories.map(c => c.id)).size, 4);
  assert.ok(state.categories.every(c => c.budgets['2026-10'] === 0));
  validate(state);
  const ids = state.categories.map(c => c.id);
  seedStarterCategories(state, '2026-11');
  assert.deepEqual(state.categories.map(c => c.id), ids);
});

test('setup preserves existing custom and archived categories', () => {
  const state = emptyState();
  state.categories = [{ id: 'existing', name: 'Santé', icon: 'health', budgets: { '2026-10': 12300 }, archived: "2026-09" }];
  const before = structuredClone(state);
  seedStarterCategories(state, '2026-10');
  assert.deepEqual(state, before);
});
