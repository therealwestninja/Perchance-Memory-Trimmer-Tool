import { readFileSync } from 'fs';

const pass = [], fail = [];
const t = (name, ok, detail = '') => {
  if (ok) { pass.push(name); console.log(`  ✅  ${name}`); }
  else { fail.push(name); console.error(`  ❌  ${name}${detail ? ' — ' + detail : ''}`); }
};

const panel = readFileSync('src/ui/panel.js', 'utf8');
const bubble = readFileSync('src/ui/bubble_map.js', 'utf8');
const qa = readFileSync('src/ui/qa_popup.js', 'utf8');
const theme = readFileSync('src/ui/theme.js', 'utf8');

const templateStart = panel.indexOf('panel.innerHTML = `');
const templateEnd = panel.indexOf('  document.body.appendChild(backdrop);');
const template = templateStart >= 0 && templateEnd > templateStart ? panel.slice(templateStart, templateEnd) : '';
const definedIds = new Set([...template.matchAll(/id="\$\{NS\}-([^"]+)"/g)].map(m => m[1]));
const described = [...template.matchAll(/aria-describedby="\$\{NS\}-([^"]+)"/g)].map(m => m[1]);
const missingDesc = described.filter(id => !definedIds.has(id));
t('panel aria-describedby targets exist in template', missingDesc.length === 0, missingDesc.join(', '));

t('qa_popup awaits fetch response before response.ok checks', /const\s+response\s*=\s*await\s+fetch\(/.test(qa) && /if\s*\(\s*!response\.ok\s*\)/.test(qa));
t('bubble map exposes interactive application semantics', /role="application"/.test(bubble) && /tabindex="0"/.test(bubble));
const canvasTag = (bubble.match(/<canvas[\s\S]*?<\/canvas>/) || [''])[0];
t('bubble map no longer labels canvas as static image', !/role="img"/.test(canvasTag));
t('theme light CSS template is properly closed before JS resumes', /const\s+LIGHT_CSS\s*=\s*`[\s\S]*?`\s*;[\s\S]*?let\s+lightStyleEl\s*=\s*null;/.test(theme.replace(/lightStyleEl\s{2,}=\s*null;/, 'lightStyleEl = null;')));

t('panel keeps apply button disabled in markup', template.includes('id="${NS}-apply-mem" disabled'));

t('panel keeps API key input described for accessibility', /aria-describedby="\$\{NS\}-stg-api-key-hint"/.test(panel));

console.log(`\n${'='.repeat(50)}\nUI STATIC CONTRACT TESTS: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) { console.error('FAILED:', fail); process.exit(1); }
