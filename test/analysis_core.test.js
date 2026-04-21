import { getEntryId } from '../src/core/protection.js';
import { computeStats } from '../src/core/stats.js';
import { scoreContinuity, scoreAllEntries } from '../src/core/continuity.js';
import { detectConflicts } from '../src/core/contradictions.js';
import { buildTopicGroups, extractEntities } from '../src/core/topics.js';
import { classifyBeat, extractStoryBeats } from '../src/core/timeline.js';
import { compareMemoryVsLoreVsSummary } from '../src/core/comparison.js';
import { classifyWorkspaceSize, guardedAnalysis, PERF_CAPS } from '../src/core/performance.js';
import { formatLoreDraft, formatSteeringDraft, setEntryLabel, getEntryLabels } from '../src/core/lore.js';
import { installMockLocalStorage } from './helpers/mock_browser.js';

installMockLocalStorage();

const pass = [], fail = [];
const t = (name, ok, detail = '') => {
  if (ok) { pass.push(name); console.log(`  ✅  ${name}`); }
  else { fail.push(name); console.error(`  ❌  ${name}${detail ? ' — ' + detail : ''}`); }
};

const stats = computeStats('Alpha\n\nBeta\n\nAlpha');
t('computeStats counts entries and dups', stats.count === 3 && stats.dups === 1, JSON.stringify(stats));
t('computeStats tracks chars/maxLen', stats.chars > 0 && stats.maxLen === 5, JSON.stringify(stats));

const high = scoreContinuity('The kingdom law is critical and must always be remembered.', { index: 9, total: 10 });
t('scoreContinuity detects strong signals', high.label !== 'low' && high.reasons.length >= 2, JSON.stringify(high));
const all = scoreAllEntries(['plain note', 'Alice betrayed the kingdom'], new Set(), new Set(), getEntryId);
t('scoreAllEntries annotates each entry with ids', all.length === 2 && all.every(r => r.entryId && r.label), JSON.stringify(all));

const conflicts = detectConflicts(['Alice is alive', 'Alice is dead', 'Bob is alive'], getEntryId);
t('detectConflicts finds shared-subject contradiction', conflicts.length >= 1 && conflicts[0].severity === 'medium', JSON.stringify(conflicts[0]));

const entities = extractEntities('Alice meets Bob in Riverwood during a prophecy quest.');
t('extractEntities finds persons/location/theme', entities.persons.includes('Alice') && entities.persons.includes('Bob') && entities.locations.includes('Riverwood') && entities.themes.includes('prophecy'));
const groups = buildTopicGroups([
  'Alice travels to Riverwood on a prophecy quest.',
  'Bob warns Alice that Riverwood hides a prophecy.',
  'Cara visits Stonekeep.'
], getEntryId);
t('buildTopicGroups keeps recurring persons or themes', groups.persons.length > 0 || groups.locations.length > 0 || groups.themes.length > 0);

const beat = classifyBeat('After the battle, Alice discovered the hidden treaty.');
t('classifyBeat recognizes event-like text', beat.score >= 3 && beat.confidence !== 'low', JSON.stringify(beat));
const beats = extractStoryBeats(['Quiet note', 'After the battle, Alice discovered the hidden treaty.'], getEntryId);
t('extractStoryBeats filters to likely beats', beats.length === 1 && beats[0].beatType !== 'misc' && beats[0].confidence !== 'low', JSON.stringify(beats));

const cmp = compareMemoryVsLoreVsSummary(
  ['Alice guards the moon gate', 'Bob lost the treaty'],
  'Alice guards the moon gate',
  'Bob lost the treaty'
);
t('compareMemoryVsLoreVsSummary places entries into overlap buckets', cmp.inMemoryAndLore.length === 1 && cmp.inMemoryAndSummary.length === 1, JSON.stringify(cmp));

const normal = classifyWorkspaceSize(['a'.repeat(50), 'b'.repeat(50)]);
const large = classifyWorkspaceSize(Array.from({ length: 210 }, (_, i) => `entry ${i}`));
t('classifyWorkspaceSize distinguishes workspace pressure', normal.sizeClass === 'normal' && large.shouldDefer === true, JSON.stringify({ normal, large }));
const guarded = guardedAnalysis(() => [1,2,3,4], [], 2, false);
t('guardedAnalysis caps oversized array result', guarded.capped === true && guarded.result.length === 2, JSON.stringify(guarded));
const deferred = guardedAnalysis(() => [1,2,3], [], PERF_CAPS.conflictLimit, true);
t('guardedAnalysis defers when requested', deferred.deferred === true && deferred.result.length === 0, JSON.stringify(deferred));

const loreDraft = formatLoreDraft(['Alpha', 'Beta']);
t('formatLoreDraft builds bullet list', loreDraft.includes('- Alpha') && loreDraft.startsWith('# Lore draft'));
const steering = formatSteeringDraft([{ gram: 'red door', count: 5 }]);
t('formatSteeringDraft includes hotspot phrase', steering.includes('red door'));
setEntryLabel('scope-1', 'e1', 'scene', globalThis.localStorage ? (await import('../src/storage.js')).store : null);
const labels = getEntryLabels('scope-1', (await import('../src/storage.js')).store);
t('set/getEntryLabel persists label mapping', labels.e1 === 'scene', JSON.stringify(labels));

console.log(`\n${'='.repeat(50)}\nANALYSIS CORE TESTS: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.error('FAILED:', fail); process.exit(1); }
