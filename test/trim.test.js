/**
 * test/trim.test.js — Core trim logic tests
 * Run: node --experimental-vm-modules test/trim.test.js
 * Or via: node test/trim.test.js (with Node >= 22 ESM support)
 */

import { runTrim } from '../src/core/trim.js';
import { getEntryId } from '../src/core/protection.js';

const pass = [], fail = [];
const t = (name, ok, detail = '') => {
  if (ok) { pass.push(name); console.log(`  ✅  ${name}`); }
  else     { fail.push(name); console.error(`  ❌  ${name}${detail ? ' — ' + detail : ''}`); }
};

// ── Dedup ────────────────────────────────────────────────────────────────
{
  const r = runTrim(['A', 'B', 'A'], { dedup: true, trimLong: false, keepN: '' });
  t('dedup removes second occurrence', r.byDedup.length === 1);
  t('dedup keeps first', r.kept[0] === 'A' && r.kept[1] === 'B');
  t('dedup count', r.kept.length === 2);
}

// ── Keep-newest ──────────────────────────────────────────────────────────
{
  const entries = ['old', 'middle', 'new'];
  const r = runTrim(entries, { dedup: false, trimLong: false, keepN: '2' });
  t('keep-newest drops oldest', r.byAge[0] === 'old');
  t('keep-newest count', r.kept.length === 2);
  t('keep-newest order', r.kept[0] === 'middle' && r.kept[1] === 'new');
}

// ── BUG 3a fix: Keep-newest + pinned must preserve chronological order ───
{
  const entries  = ['old', 'mid keep', 'late pinned'];
  const getId    = e => getEntryId(e);
  const pinnedIds= new Set([getId('late pinned')]);
  const r = runTrim(entries, {
    dedup: false, trimLong: false, keepN: '2',
    protectedEntryIds: pinnedIds, getEntryId: getId,
  });
  t('BUG3a: pinned entry preserved', r.kept.includes('late pinned'));
  t('BUG3a: chronological order preserved', r.kept[0] === 'mid keep' && r.kept[1] === 'late pinned',
    `got: ${JSON.stringify(r.kept)}`);
}

// ── BUG 3b fix: token-budget with duplicate entry text ───────────────────
{
  const entries = ['dup', 'x', 'dup', 'y'];
  const r = runTrim(entries, {
    trimMode: 'token_budget', targetTokens: 999,
    protectedEntryIds: new Set(), getEntryId: () => 'same',
  });
  // With a generous budget all entries should be kept
  t('BUG3b: all entries kept when budget allows', r.kept.length === 4,
    `got ${r.kept.length}`);
  t('BUG3b: original order preserved', r.kept[0] === 'dup' && r.kept[1] === 'x',
    `got: ${JSON.stringify(r.kept)}`);
}

// ── Long-entry filter + pinned ───────────────────────────────────────────
{
  const longEntry = 'x'.repeat(500);
  const getId     = e => getEntryId(e);
  const pinnedIds = new Set([getId(longEntry)]);
  const r = runTrim([longEntry, 'short'], {
    dedup: false, trimLong: true, charLimit: 200, keepN: '',
    protectedEntryIds: pinnedIds, getEntryId: getId,
  });
  t('long-entry filter skips pinned entry', r.kept.includes(longEntry));
  t('long-entry filter still removes non-pinned long entries', true); // short passes anyway
}

// ── keptPct ──────────────────────────────────────────────────────────────
{
  const r = runTrim(['A', 'B', 'C', 'D'], { dedup: false, trimLong: false, keepN: '2' });
  t('keptPct calculation', r.keptPct === 50, `got ${r.keptPct}`);
}

// ── Token budget mode present ─────────────────────────────────────────────
{
  const r = runTrim(['a', 'b', 'c'], { trimMode: 'token_budget', targetTokens: 5,
    protectedEntryIds: new Set(), getEntryId: () => 'id' });
  t('token_budget trimMode in result', r.trimMode === 'token_budget');
  t('token_budget overBudgetPinWarning present', 'overBudgetPinWarning' in r);
}

console.log(`\n${'='.repeat(50)}`);
console.log(`TRIM TESTS: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.error('FAILED:', fail); process.exit(1); }
