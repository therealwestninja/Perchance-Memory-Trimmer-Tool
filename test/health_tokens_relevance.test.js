import { installMockWindow } from './helpers/mock_browser.js';
installMockWindow({ countTokens: text => Math.ceil(String(text).length / 5), idealMaxContextTokens: 1000 });

const { computeHealthScore, computeBudgetPressure } = await import('../src/core/health.js');
const { scanRepetitionHotspots, getRepetitionRiskLabel } = await import('../src/core/repetition.js');
const { scoreRelevance } = await import('../src/core/relevance.js');
const { countTokens, setTokenSource, getTokenSource, getTokenSourceLabel } = await import('../src/core/tokens_exact.js');
const { getEntryId } = await import('../src/core/protection.js');

const pass = [], fail = [];
const t = (name, ok, detail = '') => {
  if (ok) { pass.push(name); console.log(`  ✅  ${name}`); }
  else { fail.push(name); console.error(`  ❌  ${name}${detail ? ' — ' + detail : ''}`); }
};

const hotspotEntries = [
  'The red door opens at dawn and the red door glows brightly.',
  'They said the red door opens at dawn whenever the bells ring.',
  'Legends claim the red door opens at dawn before the ritual.'
];
const hotspots = scanRepetitionHotspots(hotspotEntries, { n: 4, minCount: 2, minAffectedEntries: 2 });
t('scanRepetitionHotspots detects repeated phrase cluster', hotspots.length >= 1 && hotspots.some(h => /red door opens|door opens at dawn/.test(h.gram)), JSON.stringify(hotspots));
t('getRepetitionRiskLabel maps hotspot counts', ['low','moderate','high'].includes(getRepetitionRiskLabel(hotspots)));

const healthy = computeHealthScore({ entries: ['short note'], targetTokens: 500, pinnedIds: new Set(), nearDupCount: 0 });
const stressed = computeHealthScore({ entries: hotspotEntries.concat(Array.from({ length: 90 }, () => 'x'.repeat(900))), targetTokens: 50, pinnedIds: new Set(), nearDupCount: 6 });
t('computeHealthScore returns sane labels across workspace states', healthy.score > stressed.score && stressed.label !== 'healthy', JSON.stringify({ healthy, stressed }));
t('computeHealthScore emits reasons and suggestions under pressure', stressed.reasons.length > 0 && stressed.suggestions.length > 0, JSON.stringify(stressed));

const entries = ['moon treaty', 'quiet village rumor', 'moon gate oath'];
const pinnedIds = new Set([getEntryId('moon treaty')]);
const pressure = computeBudgetPressure(entries, pinnedIds, getEntryId, 3);
t('computeBudgetPressure counts pinned and total entries', pressure.pinnedCount === 1 && pressure.totalCount === 3, JSON.stringify(pressure));
t('computeBudgetPressure flags pinned budget overflow or free tokens field', 'freeTokens' in pressure && 'pinnedExceeds' in pressure);

const relevance = scoreRelevance(['The moon gate oath matters', 'Plain cooking note'], 'moon oath gate', getEntryId);
t('scoreRelevance ranks matching entry first', relevance[0].entry.includes('moon gate oath'), JSON.stringify(relevance));
t('scoreRelevance records matching terms', relevance[0].matchingTerms.length > 0, JSON.stringify(relevance[0]));

setTokenSource('heuristic');
t('setTokenSource persists supported mode', getTokenSource() === 'heuristic');
t('countTokens uses heuristic mode', countTokens('12345678') === 2, String(countTokens('12345678')));
setTokenSource('native');
t('getTokenSourceLabel reflects window.countTokens availability', getTokenSourceLabel() === 'native', getTokenSourceLabel());
setTokenSource('bogus');
t('unsupported token source falls back to auto', getTokenSource() === 'auto');

console.log(`\n${'='.repeat(50)}\nHEALTH/TOKENS/RELEVANCE TESTS: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.error('FAILED:', fail); process.exit(1); }
