import { installMockLocalStorage } from './helpers/mock_browser.js';
installMockLocalStorage();

const { pinEntry, unpinEntry, togglePin, isPinned, getPinnedIds, getPins, clearPins } = await import('../src/core/pins.js');
const { saveSnapshot, listSnapshots, getLastSnapshot, toggleStarSnapshot, deleteSnapshot, exportSnapshots } = await import('../src/core/snapshot.js');
const { loadCfg, saveCfg, loadSavedPos, savePos, loadSchema, getStorageHealthSnapshot } = await import('../src/storage.js');
const { DEFAULTS } = await import('../src/defaults.js');

const pass = [], fail = [];
const t = (name, ok, detail = '') => {
  if (ok) { pass.push(name); console.log(`  ✅  ${name}`); }
  else { fail.push(name); console.error(`  ❌  ${name}${detail ? ' — ' + detail : ''}`); }
};

const scope = 'scope-alpha';
clearPins(scope);
pinEntry(scope, 'e1', 'First pin');
t('pinEntry persists pin', isPinned(scope, 'e1'));
t('getPinnedIds returns set', getPinnedIds(scope) instanceof Set && getPinnedIds(scope).has('e1'));
t('getPins includes label', getPins(scope).e1?.label === 'First pin');

t('togglePin unpins existing', togglePin(scope, 'e1') === false && !isPinned(scope, 'e1'));
t('togglePin pins missing', togglePin(scope, 'e2', 'Second') === true && isPinned(scope, 'e2'));
unpinEntry(scope, 'e2');
t('unpinEntry removes pin', !isPinned(scope, 'e2'));

const cfg = loadCfg();
t('loadCfg returns defaults when empty', cfg.rememberPos === DEFAULTS.rememberPos);
saveCfg({ rememberPos: true, trimLong: false, keepN: '9' });
t('saveCfg persists config', loadCfg().keepN === '9' && loadCfg().trimLong === false);

savePos({ rememberPos: false }, { left: 1, top: 2 });
t('savePos respects rememberPos=false', Object.keys(loadSavedPos({ rememberPos: false })).length === 0);
savePos({ rememberPos: true }, { left: 10, top: 20 });
t('savePos persists remembered position', loadSavedPos({ rememberPos: true }).left === 10);

const schema = loadSchema();
t('loadSchema backfills versioned roots', schema.schemaVersion >= 1 && schema.pinsByScope && schema.continuityByScope && schema.debugReportsByScope);

const s1 = saveSnapshot(scope, 'One\n\nTwo', 'first');
const s2 = saveSnapshot(scope, 'Three\n\nFour', 'second');
t('saveSnapshot stores latest snapshot', getLastSnapshot(scope).id === s2.id);
t('listSnapshots returns newest first', listSnapshots(scope)[0].id === s2.id);
t('snapshot stats include entries', listSnapshots(scope)[0].stats.entries === 2);

toggleStarSnapshot(scope, s1.id);
t('toggleStarSnapshot flips starred flag', listSnapshots(scope).find(s => s.id === s1.id)?.starred === true);

const exported = JSON.parse(exportSnapshots(scope));
t('exportSnapshots includes scope and records', exported.scopeId === scope && exported.snapshots.length === 2);

deleteSnapshot(scope, s2.id);
t('deleteSnapshot removes target', !listSnapshots(scope).some(s => s.id === s2.id));

const health = await getStorageHealthSnapshot();
t('storage health returns warnLevel and byte counts', typeof health.pmtBytes === 'number' && typeof health.warnLevel === 'string');

console.log(`\n${'='.repeat(50)}\nPINS/STORAGE/SNAPSHOT TESTS: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.error('FAILED:', fail); process.exit(1); }
