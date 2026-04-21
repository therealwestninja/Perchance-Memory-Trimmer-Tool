/**
 * test/parse.test.js — Entry parsing tests
 */

import { parseEntries, countDups } from '../src/core/parse.js';

const pass = [], fail = [];
const t = (name, ok, detail = '') => {
  if (ok) { pass.push(name); console.log(`  ✅  ${name}`); }
  else     { fail.push(name); console.error(`  ❌  ${name}${detail ? ' — ' + detail : ''}`); }
};

// ── Basic splitting ───────────────────────────────────────────────────────
t('splits on double newline',   parseEntries('A\n\nB').length === 2);
t('splits on triple newline',   parseEntries('A\n\n\nB').length === 2);
t('trims whitespace',           parseEntries('  A  \n\n  B  ')[0] === 'A');
t('filters empty entries',      parseEntries('\n\nA\n\n\n\nB\n\n').length === 2);
t('handles CRLF separators',    parseEntries('A\r\n\r\nB').length === 2);
t('single entry no split',      parseEntries('just one').length === 1);
t('empty string returns none',  parseEntries('').length === 0);
t('whitespace-only returns none', parseEntries('   \n\n   ').length === 0);

// ── Duplicate counting ────────────────────────────────────────────────────
t('no dups', countDups(['A', 'B', 'C']) === 0);
t('one dup',  countDups(['A', 'B', 'A']) === 1);
t('two dups', countDups(['A', 'A', 'A']) === 2);
t('case sensitive dups', countDups(['a', 'A']) === 0);

// ── Round-trip: parse then join ───────────────────────────────────────────
const original = 'Entry one\n\nEntry two\n\nEntry three';
const parsed   = parseEntries(original);
t('round-trip count', parsed.length === 3);
t('round-trip content', parsed[0] === 'Entry one' && parsed[2] === 'Entry three');

console.log(`\n${'='.repeat(50)}`);
console.log(`PARSE TESTS: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.error('FAILED:', fail); process.exit(1); }
