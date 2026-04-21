import { createSessionProtectionStore, getEntryId } from '../src/core/protection.js';

const pass = [], fail = [];
const t = (name, ok, detail = '') => {
  if (ok) { pass.push(name); console.log(`  ✅  ${name}`); }
  else { fail.push(name); console.error(`  ❌  ${name}${detail ? ' — ' + detail : ''}`); }
};

const s = createSessionProtectionStore();
t('starts empty', s.size() === 0 && s.values().length === 0);

s.protect('a');
t('protect adds id', s.has('a') && s.size() === 1);

s.protect('a');
t('protect is idempotent', s.size() === 1);

t('toggle removes existing id', s.toggle('a') === false && !s.has('a'));
t('toggle adds missing id', s.toggle('b') === true && s.has('b'));

s.unprotect('b');
t('unprotect removes id', !s.has('b') && s.size() === 0);

s.protect('x');
s.protect('y');
s.clear();
t('clear empties store', s.size() === 0 && s.values().length === 0);

const id1 = getEntryId('  Hello world  ');
const id2 = getEntryId('Hello world');
const id3 = getEntryId('Hello world!');
t('entry id trims surrounding whitespace', id1 === id2, `${id1} vs ${id2}`);
t('entry id distinguishes changed content', id2 !== id3, `${id2} vs ${id3}`);
t('entry id stable format', /^e_[0-9a-f]{8}$/.test(id2), id2);
t('entry id handles nullish input', /^e_[0-9a-f]{8}$/.test(getEntryId(null)));

console.log(`\n${'='.repeat(50)}\nPROTECTION TESTS: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.error('FAILED:', fail); process.exit(1); }
