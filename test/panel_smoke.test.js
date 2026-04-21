/**
 * test/panel_smoke.test.js — Panel DOM contract smoke tests (Node.js + jsdom)
 * 
 * Verifies that every q('id') call in panel.js has a matching id in the template.
 * This test runs without a browser — it parses the source statically.
 */

import { readFileSync } from 'fs';

const pass = [], fail = [];
const t = (name, ok, detail = '') => {
  if (ok) { pass.push(name); console.log(`  ✅  ${name}`); }
  else     { fail.push(name); console.error(`  ❌  ${name}${detail ? ' — ' + detail : ''}`); }
};

const panel = readFileSync('src/ui/panel.js', 'utf8');

// Extract queried IDs
const queriedIds = [...panel.matchAll(/q\('([^']+)'\)/g)].map(m => m[1]);

// Extract template IDs (from panel.innerHTML = ` ... `)
const templateStart = panel.indexOf('panel.innerHTML = `');
const templateEnd   = panel.indexOf('  document.body.appendChild(backdrop);');
const template      = templateStart >= 0 ? panel.slice(templateStart, templateEnd) : '';
const definedIds    = new Set([...template.matchAll(/id="\$\{NS\}-([^"]+)"/g)].map(m => m[1]));

// Every queried ID must exist in the template
const mismatches = queriedIds.filter(id => !definedIds.has(id));
t('no q() mismatches — all queried IDs exist in template', mismatches.length === 0,
  mismatches.length > 0 ? `Missing: ${mismatches.join(', ')}` : '');

// All primary action buttons should be present
const requiredIds = ['run', 'copy', 'apply-mem', 'restore', 'undo', 'more-toggle',
                     'ta', 'fill', 'tabs', 'status-msg', 'settings', 'out', 'out-scroll',
                     'post-trim-hint', 'mode-badge'];
for (const id of requiredIds) {
  t(`required element exists: ${id}`, definedIds.has(id));
}

// Apply should start disabled (safety: never auto-enables)
t('Apply starts disabled in markup', template.includes('id="${NS}-apply-mem" disabled'));

// Undo button should exist in markup
t('Undo button in markup', definedIds.has('undo'));

console.log(`\n${'='.repeat(50)}`);
console.log(`PANEL SMOKE: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.error('FAILED:', fail); process.exit(1); }
