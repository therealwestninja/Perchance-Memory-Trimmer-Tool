/**
 * test/explain.test.js — semantic explanation string tests
 */
import { explainRemoval, explainNearDup, explainConflict, explainHotspot, confidenceLabel, explainHealth } from '../src/core/explain.js';

const pass = [], fail = [];
const t = (name, ok, d='') => { if(ok){pass.push(name);console.log(`  ✅  ${name}`);}else{fail.push(name);console.error(`  ❌  ${name}${d?' — '+d:''}`);} };

// explainRemoval
const fake = { byDedup:['dup entry'], byLong:['x'.repeat(400)], byAge:['old entry'] };
t('removal: dedup',  explainRemoval('dup entry', fake).includes('duplicate'));
t('removal: long',   explainRemoval('x'.repeat(400), fake).includes('character limit'));
t('removal: age',    explainRemoval('old entry', fake).includes('older entry'));
t('removal: fallback', explainRemoval('unknown', fake).includes('Removed'));

// explainNearDup
t('near-dup: shows pct', explainNearDup(0.73, []).includes('73%'));
t('near-dup: shows reason', explainNearDup(0.5, ['shared terms']).includes('shared terms'));

// explainConflict
const conf = { severity:'high', reasons:['conflicting relationship status'] };
t('conflict: high confidence', explainConflict(conf).includes('High-confidence'));
t('conflict: reason included', explainConflict(conf).includes('conflicting'));
const confLow = { severity:'medium', reasons:['opposing descriptors'] };
t('conflict: medium = possible', explainConflict(confLow).includes('Possible'));

// explainHotspot
t('hotspot: gram shown', explainHotspot({ gram:'red door', count:5 }).includes('red door'));
t('hotspot: count shown', explainHotspot({ gram:'x', count:3 }).includes('3 times'));

// confidenceLabel
t('confidence: high', confidenceLabel('high').text.includes('High'));
t('confidence: low',  confidenceLabel('low').text.includes('Low'));
t('confidence: unknown', confidenceLabel('???').text.includes('Uncertain'));

// explainHealth
const health = { score:55, label:'needs review', reasons:['high token pressure'], suggestions:['remove long entries'], totalTokens:1200 };
t('health explain: has label', explainHealth(health).includes('needs review'));
t('health explain: has score', explainHealth(health).includes('55'));
t('health explain: has issue', explainHealth(health).includes('token pressure'));

console.log(`\n${'='.repeat(50)}\nEXPLAIN TESTS: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.error('FAILED:', fail); process.exit(1); }
