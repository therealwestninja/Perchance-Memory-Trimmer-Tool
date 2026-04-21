/**
 * test/modes.test.js — user mode management tests
 */
import { getMode, setMode, isDailyMode, isAdvancedMode, isDebugMode, MODES } from '../src/core/modes.js';

const pass = [], fail = [];
const t = (name, ok, d='') => { if(ok){pass.push(name);console.log(`  ✅  ${name}`);}else{fail.push(name);console.error(`  ❌  ${name}${d?' — '+d:''}`);} };

// Defaults — storage unavailable in Node returns daily
const m = getMode();
t('default mode is daily', m === MODES.DAILY, `got: ${m}`);

// setMode + getMode
setMode(MODES.ADVANCED);
t('set advanced', getMode() === MODES.ADVANCED);
t('isAdvancedMode', isAdvancedMode());
t('not daily', !isDailyMode());
t('not debug', !isDebugMode());

setMode(MODES.DEBUG);
t('set debug', getMode() === MODES.DEBUG);
t('isDebugMode', isDebugMode());
t('isAdvancedMode also true in debug', isAdvancedMode());

setMode(MODES.DAILY);
t('restore daily', isDailyMode());
t('not advanced now', !isAdvancedMode());

// MODES constants
t('MODES.DAILY exists',    MODES.DAILY    === 'daily');
t('MODES.ADVANCED exists', MODES.ADVANCED === 'advanced');
t('MODES.DEBUG exists',    MODES.DEBUG    === 'debug');

console.log(`\n${'='.repeat(50)}\nMODES TESTS: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.error('FAILED:', fail); process.exit(1); }
