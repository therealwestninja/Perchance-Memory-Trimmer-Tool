/**
 * test/history.test.js — action history tests
 */
import { recordAction, getHistory, formatHistory, clearHistory } from '../src/core/history.js';

const pass = [], fail = [];
const t = (name, ok, d='') => { if(ok){pass.push(name);console.log(`  ✅  ${name}`);}else{fail.push(name);console.error(`  ❌  ${name}${d?' — '+d:''}`);} };

clearHistory();
t('starts empty', getHistory().length === 0);

recordAction('trim', { status:'ok', detail:'5 kept' });
t('records action', getHistory().length === 1);
t('action has type', getHistory()[0].type === 'trim');
t('action has ts',   typeof getHistory()[0].ts === 'string');
t('action has status', getHistory()[0].status === 'ok');

recordAction('fetch', { status:'ok' });
recordAction('apply', { status:'warn', detail:'mismatch' });
t('three actions', getHistory().length === 3);

const fmt = formatHistory(10);
t('formatted includes trim', fmt.includes('trim'));
t('formatted includes apply', fmt.includes('apply'));
t('formatted includes status', fmt.includes('[ok]') || fmt.includes('[warn]'));

// Cap at 50
clearHistory();
for (let i = 0; i < 60; i++) recordAction('test', { detail: `${i}` });
t('capped at 50', getHistory().length === 50);
t('keeps newest', getHistory()[49].detail === '59');

clearHistory();
t('clear works', getHistory().length === 0);

console.log(`\n${'='.repeat(50)}\nHISTORY TESTS: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.error('FAILED:', fail); process.exit(1); }
