// ==UserScript==
// @name         Perchance Memory Trimmer Tool 2.01
// @namespace    https://perchance.org/
// @version      2.01.6c
// @description  Memory trimmer for Perchance AI Chat — draggable UI, undo, preview diff, search, token count, settings persistence.
// @match        https://perchance.org/ai-character-chat*
// @match        https://perchance.org/urv-ai-chat*
// @match        https://perchance.org/new-ai-chat-gen*
// @grant        none
// @license      MIT
// @run-at       document-end
// @downloadURL https://update.greasyfork.org/scripts/553173/Perchance%20Memory%20Trimmer%20Tool%20201.user.js
// @updateURL https://update.greasyfork.org/scripts/553173/Perchance%20Memory%20Trimmer%20Tool%20201.meta.js
// ==/UserScript==

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 1 — DOUBLE-INJECTION GUARD
  //  Must run before anything else. Perchance is a SPA and may re-run
  //  content scripts on soft navigations.
  // ══════════════════════════════════════════════════════════════════════
  const SENTINEL_ID = 'pmt5-sentinel';
  if (document.getElementById(SENTINEL_ID)) return;

  const sentinel = document.createElement('div');
  sentinel.id    = SENTINEL_ID;
  sentinel.style.cssText = 'display:none!important';
  document.body.appendChild(sentinel);

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 2 — CONSTANTS & CONFIGURATION
  // ══════════════════════════════════════════════════════════════════════
  const NS      = 'pmt5';
  const VERSION        = '2.01.6b';
  const CFG_KEY        = 'pmt5_cfg';
  const POS_KEY        = 'pmt5_pos';
  const CUSTOM_CSS_KEY = 'pmt5_custom_css'; // stored separately — can be large

  // Minimum pointer movement (px) before a drag gesture is recognised.
  // Below this threshold a press is treated as a click.
  const DRAG_PX = 5;

  const DEFAULTS = {
    charLimit    : 200,
    keepN        : '',
    trimLong     : false,
    dedup        : false,
    rememberPos  : true,
    autoFocus    : true,
    showTokens   : true,
    previewOnTrim: false,
    theme        : 'dark',   // 'dark' | 'light' | 'custom'
  };

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 3 — SAFE STORAGE
  // ══════════════════════════════════════════════════════════════════════
  const store = {
    get(key)      { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); }        catch { /* silently skip */ } },
    del(key)      { try { localStorage.removeItem(key); }                          catch { /* silently skip */ } },
  };

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 4 — SETTINGS
  // ══════════════════════════════════════════════════════════════════════
  let cfg = { ...DEFAULTS, ...(store.get(CFG_KEY) ?? {}) };
  function saveCfg() { store.set(CFG_KEY, cfg); }

  let savedPos = cfg.rememberPos ? (store.get(POS_KEY) ?? {}) : {};
  function savePos() { if (cfg.rememberPos) store.set(POS_KEY, savedPos); }

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 5 — CORE TRIM LOGIC
  // ══════════════════════════════════════════════════════════════════════

  /** Split raw text into trimmed, non-empty entries (blank-line delimited). */
  function parseEntries(raw) {
    return raw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  }

  /** Count duplicate entries (second-or-later occurrences). */
  function countDups(entries) {
    const seen = new Set();
    let n = 0;
    for (const e of entries) { seen.has(e) ? n++ : seen.add(e); }
    return n;
  }

  /** Rough token estimate (~4 chars per token, matching GPT/Claude averages). */
  function estTokens(text) { return Math.ceil(text.length / 4); }

  /**
   * Run the full trim pipeline on a copy of `entries`.
   * Returns a result object describing what was kept and removed.
   */
  function runTrim(entries, opts) {
    const { charLimit, keepN, trimLong, dedup } = opts;

    let work = [...entries]; // always operate on a copy

    // Step 1 — Deduplicate: keep first occurrence of each entry
    const byDedup = [];
    if (dedup) {
      const seen = new Set();
      const next = [];
      for (const e of work) { seen.has(e) ? byDedup.push(e) : (seen.add(e), next.push(e)); }
      work = next;
    }

    // Step 2 — Long-entry filter: remove entries exceeding the char limit
    const byLong = [];
    if (trimLong) {
      const limit = Math.max(1, parseInt(charLimit, 10) || 200);
      const next  = [];
      for (const e of work) { e.length > limit ? byLong.push(e) : next.push(e); }
      work = next;
    }

    // Step 3 — Keep-newest N: drop the oldest entries beyond the limit
    const byAge = [];
    const n = parseInt(keepN, 10);
    if (!isNaN(n) && n > 0 && work.length > n) {
      byAge.push(...work.splice(0, work.length - n));
    }

    const removed       = [...byDedup, ...byLong, ...byAge];
    const originalCount = entries.length;
    const finalCount    = work.length;

    return {
      kept          : work,
      removed,
      byDedup,
      byLong,
      byAge,
      originalCount,
      finalCount,
      totalRemoved  : removed.length,
      keptPct       : originalCount > 0 ? Math.round(finalCount / originalCount * 100) : 100,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 6 — CLIPBOARD
  // ══════════════════════════════════════════════════════════════════════
  async function writeClipboard(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // Legacy fallback for contexts where the Clipboard API is unavailable
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    Object.assign(ta.style, {
      position: 'fixed', top: '-9999px', left: '-9999px',
      opacity: '0', pointerEvents: 'none',
    });
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length); // iOS requirement
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (!ok) throw new Error('execCommand("copy") returned false');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 7 — DRAGGABLE UTILITY
  //
  //  Three bugs fixed over previous versions:
  //
  //  BUG A — Close button (and other interactive children) not clickable:
  //    setPointerCapture() on pointerdown redirects all subsequent pointer
  //    events — including the synthesised click — to the capturing element
  //    (the drag handle), so children like the Close button never received
  //    their click events. Fix: skip drag setup entirely when pointerdown
  //    originates from an interactive child element.
  //
  //  BUG B — Panel jumps to top-left on first drag:
  //    The panel uses CSS transform:translate(-50%,-50%) for centring.
  //    When we set style.left/top in pixels but leave the transform active,
  //    the visual position is offset by -50% of the element's dimensions.
  //    Fix: at the moment the drag threshold is first crossed, remove the
  //    transform and anchor the element at its current visual (rect) position
  //    before applying the pointer delta.
  //
  //  BUG C — Post-drag click suppression bleeds into subsequent clicks:
  //    Keeping `dragged = true` after pointerup so the capture-phase click
  //    guard could see it meant the flag was never reset if no click fired
  //    (e.g. drag ends over empty space). The next genuine click was then
  //    silently eaten. Fix: use a dedicated `suppressNextClick` flag that is
  //    set in pointerup and cleared (consumed) inside the click guard, with
  //    `dragged` reset to false in pointerup where it belongs.
  // ══════════════════════════════════════════════════════════════════════
  function makeDraggable(element, handle, onMoved) {
    let startX, startY, startL, startT;
    let active            = false;
    let dragged           = false;
    let suppressNextClick = false;

    handle.addEventListener('pointerdown', function onPointerDown(e) {
      if (e.button !== 0) return;

      // Always clear any stale suppression flag FIRST, before any other logic.
      // If a previous drag ended with the mouse off-screen or off-element, no
      // click fires to reset the flag — so without this line it stays true
      // indefinitely and silently blocks the next real click on any child.
      suppressNextClick = false;

      handle.setPointerCapture(e.pointerId);
      const r = element.getBoundingClientRect();
      startX = e.clientX;  startY = e.clientY;
      startL = r.left;     startT = r.top;
      active  = true;
      dragged = false;
    });

    handle.addEventListener('pointermove', function onPointerMove(e) {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!dragged) {
        if (Math.hypot(dx, dy) < DRAG_PX) return; // below threshold — not a drag yet

        dragged = true;
        handle.style.cursor = 'grabbing';

        // BUG B FIX — Remove any CSS centering transform before the first
        // pixel assignment. getBoundingClientRect() returns the real visual
        // position regardless of how that position was achieved (% values,
        // transforms, etc.), so startL/startT are already the correct pixel
        // anchors. Setting left/top to those values while removing the
        // transform keeps the element visually stationary at drag start.
        element.style.transform = 'none';
        element.style.right  = 'auto';
        element.style.bottom = 'auto';
        element.style.left   = startL + 'px';
        element.style.top    = startT + 'px';
        // Remove the open animation class if it is still present
        element.classList.remove(`${NS}-open-anim`);
      }

      const maxL = window.innerWidth  - element.offsetWidth;
      const maxT = window.innerHeight - element.offsetHeight;
      element.style.left = Math.max(0, Math.min(maxL, startL + dx)) + 'px';
      element.style.top  = Math.max(0, Math.min(maxT, startT + dy)) + 'px';
    });

    function endDrag() {
      if (!active) return;
      active = false;
      handle.style.cursor = ''; // return cursor to CSS-defined value

      if (dragged) {
        // BUG C FIX — Reset `dragged` immediately and use a dedicated flag
        // to tell the capture-phase click guard to suppress exactly one click.
        dragged           = false;
        suppressNextClick = true;
        if (typeof onMoved === 'function') {
          onMoved({ left: element.style.left, top: element.style.top });
        }
      }
    }

    handle.addEventListener('pointerup',     endDrag);
    handle.addEventListener('pointercancel', endDrag); // handle OS interruptions (e.g. incoming call)

    // Capture-phase click guard — runs before any bubble-phase listener.
    // Cancels the post-drag click when suppressNextClick is set, then
    // immediately clears the flag so future clicks are never affected.
    handle.addEventListener('click', function onClickCapture(e) {
      if (suppressNextClick) {
        suppressNextClick = false;
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, /* capture */ true);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 8 — HTML UTILITIES
  // ══════════════════════════════════════════════════════════════════════
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 9 — CSS
  // ══════════════════════════════════════════════════════════════════════
  const CSS = `
/* ── Isolation reset ──────────────────────────────────────────────────── */
#${NS}-fab, #${NS}-panel, #${NS}-backdrop,
#${NS}-panel * {
  box-sizing: border-box;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: normal;
  -webkit-font-smoothing: antialiased;
}

/* ── Floating button ───────────────────────────────────────────────────── */
#${NS}-fab {
  all: unset;
  box-sizing: border-box;
  position: fixed;
  bottom: 86px;
  right: 18px;
  z-index: 2147483640;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  background: #161b22;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 8px;
  cursor: pointer;   /* pointer at rest — NOT grab; this is a button first */
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  /* No box-shadow or glow */
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
#${NS}-fab:hover  { background: #1c2128; border-color: #8b949e; color: #e6edf3; }
#${NS}-fab:active { background: #21262d; }

/* ── Backdrop ──────────────────────────────────────────────────────────── */
#${NS}-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483641;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  animation: ${NS}-fade-in 0.18s ease;
}
@keyframes ${NS}-fade-in { from { opacity: 0; } to { opacity: 1; } }

/* ── Panel ─────────────────────────────────────────────────────────────── */
#${NS}-panel {
  position: fixed;
  z-index: 2147483642;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(820px, 94vw);
  max-height: 92vh;
  min-width: 360px;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 10px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.65);
  resize: both;
}
#${NS}-panel.${NS}-open-anim {
  animation: ${NS}-panel-in 0.2s cubic-bezier(0.22,0.61,0.36,1) both;
}
@keyframes ${NS}-panel-in {
  from { opacity: 0; transform: translate(-50%, -48%); }
  to   { opacity: 1; transform: translate(-50%, -50%); }
}
/* Applied after first drag — removes centering transform so left/top are absolute */
#${NS}-panel.${NS}-positioned { transform: none; }

/* ── Header row: topbar wraps the drag zone + close button ─────────────── */
#${NS}-topbar {
  display: flex;
  align-items: stretch;
  background: #161b22;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
}

/* ── Header drag zone (child of topbar, NOT containing the close button) ── */
#${NS}-hdr {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 9px;
  flex: 1;
  min-width: 0;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}
#${NS}-hdr-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #e6edf3;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
#${NS}-ver {
  font-size: 10px;
  font-weight: 600;
  color: #6e7681;
  background: #21262d;
  border: 1px solid #30363d;
  border-radius: 20px;
  padding: 2px 8px;
  letter-spacing: 0.3px;
  white-space: nowrap;
  user-select: none;
  flex-shrink: 0;
}
#${NS}-kbd {
  font-size: 10px;
  color: #3d444d;
  white-space: nowrap;
  flex-shrink: 0;
  pointer-events: none;
}
@media (max-width: 520px) { #${NS}-kbd { display: none; } }
#${NS}-close {
  all: unset;
  box-sizing: border-box;
  color: #6e7681;
  font-size: 18px;
  line-height: 1;
  padding: 3px 7px;
  border-radius: 6px;
  cursor: pointer;   /* explicit pointer overrides inherited grab from header */
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
#${NS}-close:hover { background: rgba(248,81,73,0.14); color: #f85149; }

/* ── Scrollable body (top section — textarea + options + buttons) ───────── */
#${NS}-body {
  flex: 0 0 auto;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: #30363d transparent;
}
#${NS}-body::-webkit-scrollbar       { width: 5px; }
#${NS}-body::-webkit-scrollbar-track { background: transparent; }
#${NS}-body::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }

/* ── Generic section wrapper ───────────────────────────────────────────── */
.${NS}-sec { padding: 12px 14px; border-bottom: 1px solid #21262d; }

/* ── Paste textarea ────────────────────────────────────────────────────── */
#${NS}-ta {
  display: block;
  width: 100%;
  height: 130px;
  min-height: 56px;
  resize: vertical;
  background: #010409;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 7px;
  padding: 8px 10px;
  font: 12.5px/1.6 'Cascadia Code','Fira Code',Consolas,monospace;
  transition: border-color 0.2s;
}
#${NS}-ta:focus        { outline: none; border-color: #388bfd; }
#${NS}-ta::placeholder { color: #3d444d; }

/* ── Stat pills ────────────────────────────────────────────────────────── */
#${NS}-pills { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
.${NS}-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 20px;
  font-size: 11px;
  color: #8b949e;
  white-space: nowrap;
}
.${NS}-pill b            { color: #c9d1d9; font-weight: 600; }
.${NS}-pill.${NS}-warn b { color: #f0883e; }

/* ── Options grid ──────────────────────────────────────────────────────── */
#${NS}-opts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
  gap: 8px;
}
.${NS}-og {
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 7px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.${NS}-og-hd {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #3d444d;
}
.${NS}-lbl {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: #8b949e;
  cursor: pointer;
  user-select: none;
}
.${NS}-lbl:hover { color: #c9d1d9; }
.${NS}-lbl input[type=checkbox] {
  accent-color: #388bfd;
  width: 14px; height: 14px;
  cursor: pointer;
  flex-shrink: 0;
  margin: 0;
}
.${NS}-row { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.${NS}-slider { flex: 1; min-width: 60px; accent-color: #388bfd; cursor: pointer; }
.${NS}-cv { font-size: 12px; font-weight: 600; color: #388bfd; min-width: 26px; text-align: right; }
.${NS}-sel, .${NS}-numbox {
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 12.5px;
  transition: border-color 0.2s;
  min-width: 0;
}
.${NS}-sel   { flex: 1; }
.${NS}-numbox { width: 72px; }
.${NS}-sel:focus, .${NS}-numbox:focus { outline: none; border-color: #388bfd; }

/* ── Action buttons ────────────────────────────────────────────────────── */
#${NS}-btns { display: flex; flex-wrap: wrap; gap: 7px; }
.${NS}-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 12px;
  border: none;
  border-radius: 7px;
  font: 600 12.5px/1 system-ui, sans-serif;
  cursor: pointer;
  white-space: nowrap;
  transition: filter 0.12s, transform 0.1s;
}
.${NS}-btn:active:not(:disabled) { transform: scale(0.96); }
.${NS}-btn:disabled               { opacity: 0.38; cursor: not-allowed; }
.${NS}-btn-run  { background: #238636; color: #fff; }
.${NS}-btn-copy { background: #1f6feb; color: #fff; }
.${NS}-btn-undo { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; }
.${NS}-btn-prev { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; }
.${NS}-btn-clr  { background: transparent; color: #8b949e; border: 1px solid #30363d; }
.${NS}-btn-run:hover:not(:disabled)  { filter: brightness(1.15); }
.${NS}-btn-copy:hover:not(:disabled) { filter: brightness(1.15); }
.${NS}-btn-undo:hover:not(:disabled) { border-color: #8b949e; color: #e6edf3; }
.${NS}-btn-prev:hover:not(:disabled) { border-color: #8b949e; color: #e6edf3; }
.${NS}-btn-clr:hover:not(:disabled)  { color: #f85149; border-color: #f85149; }

/* ── Progress rail ─────────────────────────────────────────────────────── */
#${NS}-rail {
  height: 3px;
  background: #161b22;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
  overflow: hidden;
}
#${NS}-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #238636, #388bfd);
  border-radius: 1px;
  transition: width 0.5s cubic-bezier(0.22,0.61,0.36,1);
}

/* ── Tabs ──────────────────────────────────────────────────────────────── */
#${NS}-tabs {
  display: flex;
  background: #161b22;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
#${NS}-tabs::-webkit-scrollbar { display: none; }
.${NS}-tab {
  padding: 8px 13px;
  font-size: 12px;
  font-weight: 600;
  color: #6e7681;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  user-select: none;
}
.${NS}-tab:hover            { color: #c9d1d9; }
.${NS}-tab.${NS}-active     { color: #58a6ff; border-bottom-color: #58a6ff; }

/* ── Output zone (grows to fill remaining panel height) ────────────────── */
#${NS}-output-zone {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* ── Search bar ────────────────────────────────────────────────────────── */
#${NS}-search {
  display: none;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-bottom: 1px solid #21262d;
  background: #161b22;
  flex-shrink: 0;
}
#${NS}-search.${NS}-visible { display: flex; }
#${NS}-search-in {
  flex: 1;
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 5px 9px;
  font-size: 12px;
  transition: border-color 0.2s;
}
#${NS}-search-in:focus        { outline: none; border-color: #388bfd; }
#${NS}-search-in::placeholder { color: #3d444d; }
#${NS}-search-count { font-size: 11px; color: #6e7681; white-space: nowrap; flex-shrink: 0; }

/* ── Output scroller ───────────────────────────────────────────────────── */
#${NS}-out-scroll {
  flex: 1 1 auto;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 60px;
  /* No max-height — the output zone fills whatever height the panel has,
     including after the user resizes the panel with the native resize handle */
  scrollbar-width: thin;
  scrollbar-color: #30363d transparent;
}
#${NS}-out-scroll::-webkit-scrollbar       { width: 5px; }
#${NS}-out-scroll::-webkit-scrollbar-track { background: transparent; }
#${NS}-out-scroll::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
#${NS}-out {
  padding: 10px 14px;
  font: 12.5px/1.7 'Cascadia Code','Fira Code',Consolas,monospace;
  white-space: pre-wrap;
  word-break: break-word;
  color: #8b949e;
  min-height: 40px;
}
.${NS}-hint   { color: #3d444d; font-style: italic; }
.${NS}-c-ok   { color: #3fb950; }
.${NS}-c-warn { color: #f0883e; }
.${NS}-c-kept { color: #c9d1d9; }
.${NS}-c-gone { color: #f85149; text-decoration: line-through; opacity: 0.6; }
.${NS}-c-sep  { color: #21262d; user-select: none; }
.${NS}-c-hl   { background: rgba(88,166,255,0.18); color: #58a6ff; border-radius: 2px; }

/* ── Settings pane ─────────────────────────────────────────────────────── */
#${NS}-settings {
  display: none;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: #30363d transparent;
}
#${NS}-settings.${NS}-visible { display: flex; }
.${NS}-stg-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 7px;
}
.${NS}-stg-label { font-size: 12.5px; font-weight: 600; color: #c9d1d9; }
.${NS}-stg-sub   { font-size: 11px; color: #6e7681; margin-top: 2px; }
.${NS}-tog {
  position: relative;
  width: 38px; height: 21px;
  flex-shrink: 0;
}
.${NS}-tog input { position: absolute; opacity: 0; width: 0; height: 0; }
.${NS}-tog-track {
  position: absolute; inset: 0;
  background: #21262d; border: 1px solid #30363d;
  border-radius: 21px; cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.${NS}-tog input:checked + .${NS}-tog-track { background: #1a4232; border-color: #3fb950; }
.${NS}-tog-thumb {
  position: absolute;
  width: 14px; height: 14px;
  top: 3px; left: 3px;
  background: #6e7681; border-radius: 50%;
  pointer-events: none;
  transition: left 0.2s, background 0.2s;
}
.${NS}-tog input:checked ~ .${NS}-tog-thumb { left: 20px; background: #3fb950; }
#${NS}-stg-reset {
  all: unset;
  box-sizing: border-box;
  margin-top: 4px;
  padding: 8px 14px;
  color: #f85149;
  border: 1px solid #f8514966;
  border-radius: 7px;
  font: 600 12px/1 system-ui, sans-serif;
  cursor: pointer;
  align-self: flex-start;
  transition: background 0.15s;
}
#${NS}-stg-reset:hover { background: rgba(248,81,73,0.1); }

/* ── Status bar ────────────────────────────────────────────────────────── */
#${NS}-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 5px 14px;
  background: #161b22;
  border-top: 1px solid #21262d;
  flex-shrink: 0;
}
#${NS}-status-msg {
  font-size: 11.5px; color: #6e7681;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  flex: 1;
}
#${NS}-status-msg.${NS}-ok   { color: #3fb950; }
#${NS}-status-msg.${NS}-warn { color: #f0883e; }
#${NS}-status-msg.${NS}-err  { color: #f85149; }
#${NS}-undo-label { font-size: 11px; color: #3d444d; white-space: nowrap; flex-shrink: 0; }

/* ── Easter egg overlay ────────────────────────────────────────────────── */
#${NS}-egg {
  position: absolute; inset: 0; z-index: 5;
  background: #0d1117; border-radius: 10px;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 14px; padding: 24px;
  animation: ${NS}-fade-in 0.2s ease;
}
#${NS}-egg-title { font: 700 17px/1.3 'Cascadia Code',Consolas,monospace; color: #f0883e; text-align: center; }
#${NS}-egg-msg   { font-size: 13px; color: #8b949e; text-align: center; line-height: 1.6; }
#${NS}-egg-close {
  all: unset; box-sizing: border-box;
  padding: 8px 20px;
  background: #21262d; color: #c9d1d9; border: 1px solid #30363d;
  border-radius: 7px; font: 600 13px/1 system-ui, sans-serif; cursor: pointer;
  transition: background 0.15s;
}
#${NS}-egg-close:hover { background: #2d333b; }

/* ── Settings: theme select ────────────────────────────────────────────── */
.${NS}-stg-sel {
  background: #0d1117;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 12.5px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.2s;
  flex-shrink: 0;
  min-width: 110px;
}
.${NS}-stg-sel:focus { outline: none; border-color: #388bfd; }

/* ── Custom CSS import area ────────────────────────────────────────────── */
#${NS}-custom-css-area {
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 7px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
#${NS}-custom-css-area.${NS}-hidden { display: none; }
.${NS}-css-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
#${NS}-import-file-btn {
  all: unset;
  box-sizing: border-box;
  padding: 6px 12px;
  background: #21262d;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  font: 600 12px/1 system-ui, sans-serif;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}
#${NS}-import-file-btn:hover { background: #2d333b; border-color: #8b949e; }
.${NS}-css-hint {
  font-size: 11px;
  color: #6e7681;
  flex: 1;
  line-height: 1.4;
}
#${NS}-custom-css-ta {
  display: block;
  width: 100%;
  height: 96px;
  min-height: 56px;
  resize: vertical;
  background: #010409;
  color: #c9d1d9;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 7px 9px;
  font: 12px/1.5 'Cascadia Code','Fira Code',Consolas,monospace;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
#${NS}-custom-css-ta:focus       { outline: none; border-color: #388bfd; }
#${NS}-custom-css-ta::placeholder { color: #3d444d; }
.${NS}-css-footer {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}
#${NS}-apply-css {
  all: unset;
  box-sizing: border-box;
  padding: 6px 14px;
  background: #238636;
  color: #fff;
  border-radius: 6px;
  font: 600 12px/1 system-ui, sans-serif;
  cursor: pointer;
  transition: filter 0.12s;
}
#${NS}-apply-css:hover { filter: brightness(1.15); }
#${NS}-clear-css {
  all: unset;
  box-sizing: border-box;
  padding: 6px 12px;
  color: #f85149;
  border: 1px solid #f8514966;
  border-radius: 6px;
  font: 600 12px/1 system-ui, sans-serif;
  cursor: pointer;
  transition: background 0.15s;
}
#${NS}-clear-css:hover { background: rgba(248,81,73,0.1); }
`;

  // Inject base (dark) styles
  const styleEl = document.createElement('style');
  styleEl.id = `${NS}-styles`;
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 9b — THEME SYSTEM
  //  Three themes: 'dark' (default), 'light', 'custom' (user CSS).
  //  Implemented as injected override stylesheets — no class changes on
  //  elements, no CSS-variable refactor needed. The base dark CSS is
  //  always present; light/custom override specific rules on top.
  // ══════════════════════════════════════════════════════════════════════

  // Light-theme override — every dark color replaced with a GitHub-light palette.
  const LIGHT_CSS = `
#${NS}-fab { background:#ffffff; color:#24292f; border-color:#d0d7de; }
#${NS}-fab:hover  { background:#f3f4f6; border-color:#8c959f; color:#24292f; }
#${NS}-fab:active { background:#ebecf0; }
#${NS}-backdrop   { background: rgba(0,0,0,0.25); }
#${NS}-panel { background:#ffffff; border-color:#d0d7de; box-shadow:0 8px 40px rgba(0,0,0,0.18); }
#${NS}-topbar { background:#f6f8fa; border-bottom-color:#d0d7de; }
#${NS}-hdr    { background:#f6f8fa; }
#${NS}-hdr-title { color:#24292f; }
#${NS}-ver  { color:#57606a; background:#eaeef2; border-color:#d0d7de; }
#${NS}-kbd  { color:#8c959f; }
#${NS}-close { color:#57606a; }
#${NS}-body { scrollbar-color:#d0d7de transparent; }
.${NS}-sec  { border-bottom-color:#d0d7de; }
#${NS}-ta   { background:#f6f8fa; color:#24292f; border-color:#d0d7de; }
#${NS}-ta:focus { border-color:#0969da; }
#${NS}-ta::placeholder { color:#8c959f; }
.${NS}-pill { background:#f6f8fa; border-color:#d0d7de; color:#57606a; }
.${NS}-pill b { color:#24292f; }
.${NS}-og   { background:#f6f8fa; border-color:#d0d7de; }
.${NS}-og-hd { color:#8c959f; }
.${NS}-lbl  { color:#57606a; }
.${NS}-lbl:hover { color:#24292f; }
.${NS}-lbl input[type=checkbox] { accent-color:#0969da; }
.${NS}-slider { accent-color:#0969da; }
.${NS}-cv   { color:#0969da; }
.${NS}-sel, .${NS}-numbox { background:#ffffff; color:#24292f; border-color:#d0d7de; }
.${NS}-sel:focus, .${NS}-numbox:focus { border-color:#0969da; }
.${NS}-btn-undo { background:#f6f8fa; color:#24292f; border-color:#d0d7de; }
.${NS}-btn-prev { background:#f6f8fa; color:#24292f; border-color:#d0d7de; }
.${NS}-btn-clr  { color:#57606a; border-color:#d0d7de; }
.${NS}-btn-undo:hover:not(:disabled) { border-color:#8c959f; color:#24292f; }
.${NS}-btn-prev:hover:not(:disabled) { border-color:#8c959f; color:#24292f; }
#${NS}-rail { background:#f6f8fa; border-bottom-color:#d0d7de; }
#${NS}-tabs { background:#f6f8fa; border-bottom-color:#d0d7de; }
.${NS}-tab  { color:#57606a; }
.${NS}-tab:hover { color:#24292f; }
.${NS}-tab.${NS}-active { color:#0969da; border-bottom-color:#0969da; }
#${NS}-search { background:#f6f8fa; border-bottom-color:#d0d7de; }
#${NS}-search-in { background:#ffffff; color:#24292f; border-color:#d0d7de; }
#${NS}-search-in:focus { border-color:#0969da; }
#${NS}-search-in::placeholder { color:#8c959f; }
#${NS}-search-count { color:#57606a; }
#${NS}-out-scroll { scrollbar-color:#d0d7de transparent; }
#${NS}-out  { color:#57606a; }
.${NS}-hint   { color:#8c959f; }
.${NS}-c-ok   { color:#1a7f37; }
.${NS}-c-warn { color:#9a6700; }
.${NS}-c-kept { color:#24292f; }
.${NS}-c-gone { color:#cf222e; }
.${NS}-c-sep  { color:#d0d7de; }
.${NS}-c-hl   { background:rgba(9,105,218,0.12); color:#0969da; }
#${NS}-settings { scrollbar-color:#d0d7de transparent; }
.${NS}-stg-row  { background:#f6f8fa; border-color:#d0d7de; }
.${NS}-stg-label { color:#24292f; }
.${NS}-stg-sub   { color:#57606a; }
.${NS}-tog-track { background:#d0d7de; border-color:#d0d7de; }
.${NS}-tog input:checked + .${NS}-tog-track { background:#d4f0dc; border-color:#1a7f37; }
.${NS}-tog-thumb { background:#8c959f; }
.${NS}-tog input:checked ~ .${NS}-tog-thumb { background:#1a7f37; }
.${NS}-stg-sel { background:#ffffff; color:#24292f; border-color:#d0d7de; }
.${NS}-stg-sel:focus { border-color:#0969da; }
#${NS}-custom-css-area { background:#f6f8fa; border-color:#d0d7de; }
#${NS}-import-file-btn { background:#eaeef2; color:#24292f; border-color:#d0d7de; }
#${NS}-import-file-btn:hover { background:#dce1e7; border-color:#8c959f; }
.${NS}-css-hint { color:#57606a; }
#${NS}-custom-css-ta { background:#ffffff; color:#24292f; border-color:#d0d7de; }
#${NS}-custom-css-ta:focus { border-color:#0969da; }
#${NS}-custom-css-ta::placeholder { color:#8c959f; }
#${NS}-stg-reset { color:#cf222e; border-color:#cf222e66; }
#${NS}-stg-reset:hover { background:rgba(207,34,46,0.08); }
#${NS}-status { background:#f6f8fa; border-top-color:#d0d7de; }
#${NS}-status-msg { color:#57606a; }
#${NS}-status-msg.${NS}-ok   { color:#1a7f37; }
#${NS}-status-msg.${NS}-warn { color:#9a6700; }
#${NS}-status-msg.${NS}-err  { color:#cf222e; }
#${NS}-undo-label { color:#8c959f; }
#${NS}-egg        { background:#ffffff; }
#${NS}-egg-title  { color:#cf222e; }
#${NS}-egg-msg    { color:#57606a; }
#${NS}-egg-close  { background:#f6f8fa; color:#24292f; border-color:#d0d7de; }
#${NS}-egg-close:hover { background:#ebecf0; }
`;

  // Module-level handles — kept alive across panel open/close cycles.
  let lightStyleEl  = null;
  let customStyleEl = null;

  /**
   * Apply the selected theme by injecting or removing override stylesheets.
   * Safe to call at any time; idempotent for the same theme.
   */
  function applyTheme(theme) {
    // Tear down any existing override sheets
    lightStyleEl?.remove();  lightStyleEl  = null;
    customStyleEl?.remove(); customStyleEl = null;

    if (theme === 'light') {
      lightStyleEl = document.createElement('style');
      lightStyleEl.id = `${NS}-light-theme`;
      lightStyleEl.textContent = LIGHT_CSS;
      document.head.appendChild(lightStyleEl);

    } else if (theme === 'custom') {
      const css = store.get(CUSTOM_CSS_KEY);
      if (css && css.trim()) {
        customStyleEl = document.createElement('style');
        customStyleEl.id = `${NS}-custom-theme`;
        customStyleEl.textContent = css;
        document.head.appendChild(customStyleEl);
      }
    }
    // 'dark' — base stylesheet is always present, nothing extra needed
  }

  // Apply saved theme immediately (affects FAB right away)
  applyTheme(cfg.theme ?? 'dark');

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 10 — FLOATING BUTTON
  // ══════════════════════════════════════════════════════════════════════
  const fab = document.createElement('button');
  fab.id    = `${NS}-fab`;
  fab.title = 'Open Memory Trimmer  (Alt+M)';
  fab.textContent = 'Trim Memories';

  restorePosition(fab, savedPos.fab, false);
  document.body.appendChild(fab);

  makeDraggable(fab, fab, pos => {
    savedPos.fab = pos;
    savePos();
  });

  fab.addEventListener('click', () => openPanel());

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 11 — POSITION HELPER
  // ══════════════════════════════════════════════════════════════════════
  function restorePosition(el, pos, addPositionedClass) {
    if (!pos?.left || !pos?.top) return false;
    el.style.left   = pos.left;
    el.style.top    = pos.top;
    el.style.right  = 'auto';
    el.style.bottom = 'auto';
    if (addPositionedClass) el.classList.add(`${NS}-positioned`);
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 12 — MODAL STATE (persists between open/close cycles)
  // ══════════════════════════════════════════════════════════════════════
  let isOpen         = false;
  let activeTab      = 'result';
  let currentEntries = [];
  let removedEntries = [];
  let trimResult     = null;
  let undoStack      = [];
  let filterQ        = '';

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 13 — OPEN PANEL
  // ══════════════════════════════════════════════════════════════════════
  function openPanel() {
    if (isOpen) return;
    isOpen = true;

    // Clean up any elements left over from a previous close animation
    document.getElementById(`${NS}-backdrop`)?.remove();
    document.getElementById(`${NS}-panel`)?.remove();

    // ── DOM construction ─────────────────────────────────────────────
    const backdrop = document.createElement('div');
    backdrop.id = `${NS}-backdrop`;

    const panel = document.createElement('div');
    panel.id = `${NS}-panel`;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Memory Trimmer');

    panel.innerHTML = `
      <div id="${NS}-topbar">
        <div id="${NS}-hdr">
          <span id="${NS}-hdr-title">Memory Trimmer</span>
          <span id="${NS}-ver" title="Click 5× for a surprise">v${VERSION}</span>
          <span id="${NS}-kbd">Ctrl+Enter=Trim  Esc=Close</span>
        </div>
        <button id="${NS}-close" title="Close (Esc)">✕</button>
      </div>

      <div id="${NS}-body">

        <div class="${NS}-sec">
          <textarea id="${NS}-ta"
            placeholder="Paste your /mem output here — in Perchance chat type /mem, send, then Ctrl+A Ctrl+C on the memory window and paste here."
            spellcheck="false"></textarea>
          <div id="${NS}-pills">
            <div class="${NS}-pill">Entries <b id="${NS}-p-n">0</b></div>
            <div class="${NS}-pill">Chars <b id="${NS}-p-ch">0</b></div>
            <div class="${NS}-pill" id="${NS}-tok-pill">~Tokens <b id="${NS}-p-tok">0</b></div>
            <div class="${NS}-pill" id="${NS}-dup-pill">Dups <b id="${NS}-p-dup">0</b></div>
            <div class="${NS}-pill" id="${NS}-max-pill">Longest <b id="${NS}-p-max">0</b>c</div>
          </div>
        </div>

        <div class="${NS}-sec">
          <div id="${NS}-opts">

            <div class="${NS}-og">
              <div class="${NS}-og-hd">Long-entry filter</div>
              <label class="${NS}-lbl">
                <input type="checkbox" id="${NS}-opt-long">
                Trim entries &gt; <span class="${NS}-cv" id="${NS}-cv">200</span>c
              </label>
              <div class="${NS}-row">
                <input type="range" id="${NS}-slider" class="${NS}-slider"
                  min="50" max="600" step="10" value="200">
              </div>
            </div>

            <div class="${NS}-og">
              <div class="${NS}-og-hd">Keep newest</div>
              <select id="${NS}-keep" class="${NS}-sel">
                <option value="">No limit</option>
                <option value="10">10 entries</option>
                <option value="20">20 entries</option>
                <option value="25">25 entries</option>
                <option value="50">50 entries</option>
                <option value="75">75 entries</option>
                <option value="100">100 entries</option>
                <option value="custom">Custom…</option>
              </select>
              <input type="number" id="${NS}-keep-n" class="${NS}-numbox"
                placeholder="N" min="1" max="9999" style="display:none;margin-top:5px">
            </div>

            <div class="${NS}-og">
              <div class="${NS}-og-hd">Extra</div>
              <label class="${NS}-lbl">
                <input type="checkbox" id="${NS}-opt-dedup"> Remove duplicates
              </label>
            </div>

          </div>
        </div>

        <div class="${NS}-sec">
          <div id="${NS}-btns">
            <button class="${NS}-btn ${NS}-btn-run"  id="${NS}-run">Trim</button>
            <button class="${NS}-btn ${NS}-btn-copy" id="${NS}-copy" disabled>Copy</button>
            <button class="${NS}-btn ${NS}-btn-undo" id="${NS}-undo" disabled>Undo</button>
            <button class="${NS}-btn ${NS}-btn-prev" id="${NS}-prev" disabled>Preview</button>
            <button class="${NS}-btn ${NS}-btn-clr"  id="${NS}-clr">Clear</button>
          </div>
        </div>

      </div>

      <div id="${NS}-rail"><div id="${NS}-fill"></div></div>

      <div id="${NS}-tabs">
        <div class="${NS}-tab ${NS}-active" data-tab="result">Result</div>
        <div class="${NS}-tab"              data-tab="preview">Preview</div>
        <div class="${NS}-tab"              data-tab="removed">Removed (<span id="${NS}-removed-n">0</span>)</div>
        <div class="${NS}-tab"              data-tab="settings">Settings</div>
      </div>

      <div id="${NS}-output-zone">
        <div id="${NS}-search">
          <input id="${NS}-search-in" type="text" placeholder="Filter entries…"
            autocomplete="off" spellcheck="false">
          <span id="${NS}-search-count"></span>
        </div>
        <div id="${NS}-out-scroll"><div id="${NS}-out"></div></div>
        <div id="${NS}-settings"></div>
      </div>

      <div id="${NS}-status">
        <span id="${NS}-status-msg">Ready — paste memory text above, then click Trim.</span>
        <span id="${NS}-undo-label"></span>
      </div>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    // ── Position / open animation ────────────────────────────────────
    const hadSavedPos = restorePosition(panel, savedPos.panel, true);
    if (!hadSavedPos) {
      panel.classList.add(`${NS}-open-anim`);
      panel.addEventListener('animationend', () => panel.classList.remove(`${NS}-open-anim`), { once: true });
    } else {
      panel.style.opacity = '0';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        panel.style.transition = 'opacity 0.18s ease';
        panel.style.opacity    = '1';
        panel.addEventListener('transitionend', () => {
          panel.style.transition = '';
          panel.style.opacity    = '';
        }, { once: true });
      }));
    }

    // ── Element shorthand ────────────────────────────────────────────
    const q = id => document.getElementById(`${NS}-${id}`);

    const ta         = q('ta');
    const btnRun     = q('run');
    const btnCopy    = q('copy');
    const btnUndo    = q('undo');
    const btnPrev    = q('prev');
    const btnClr     = q('clr');
    const btnClose   = q('close');
    const optLong    = q('opt-long');
    const slider     = q('slider');
    const cvDisp     = q('cv');
    const keepSel    = q('keep');
    const keepN      = q('keep-n');
    const optDedup   = q('opt-dedup');
    const tabsEl     = q('tabs');
    const outZone    = q('output-zone');  // eslint-disable-line no-unused-vars
    const settingEl  = q('settings');
    const searchBar  = q('search');
    const searchIn   = q('search-in');
    const searchCt   = q('search-count');
    const outScroll  = q('out-scroll');
    const outEl      = q('out');
    const progFill   = q('fill');
    const statusMsg  = q('status-msg');
    const undoLabel  = q('undo-label');
    const removedN   = q('removed-n');
    const verBadge   = q('ver');
    const hdr        = q('hdr');
    const PP = {
      n       : q('p-n'),
      ch      : q('p-ch'),
      tok     : q('p-tok'),
      dup     : q('p-dup'),
      max     : q('p-max'),
      tokPill : q('tok-pill'),
      dupPill : q('dup-pill'),
      maxPill : q('max-pill'),
    };

    // ── Restore control values from saved cfg ────────────────────────
    optLong.checked  = cfg.trimLong;
    slider.value     = cfg.charLimit;
    cvDisp.textContent = cfg.charLimit;
    optDedup.checked = cfg.dedup;
    PP.tokPill.style.display = cfg.showTokens ? '' : 'none';

    const STD_KEEPS = ['', '10', '20', '25', '50', '75', '100'];
    if (STD_KEEPS.includes(String(cfg.keepN))) {
      keepSel.value = cfg.keepN;
    } else if (cfg.keepN) {
      keepSel.value = 'custom';
      keepN.style.display = 'block';
      keepN.value   = cfg.keepN;
    }

    // ── Panel drag setup ─────────────────────────────────────────────
    // The Close button lives inside the header. makeDraggable's interactive-
    // child check ensures the Close button retains its own click event.
    makeDraggable(panel, hdr, pos => {
      panel.classList.add(`${NS}-positioned`);
      savedPos.panel = pos;
      savePos();
    });

    if (cfg.autoFocus) setTimeout(() => ta.focus(), 50);

    // ── Status helper ────────────────────────────────────────────────
    // Timer is stored on the panel element so closePanel() can cancel it
    // before the element is removed — preventing writes to detached nodes.
    panel._statusTimer = null;
    function setStatus(msg, type = '', clearMs = 0) {
      clearTimeout(panel._statusTimer);
      statusMsg.textContent = msg;
      statusMsg.className   = type ? `${NS}-${type}` : '';
      if (clearMs > 0) {
        panel._statusTimer = setTimeout(() => {
          if (statusMsg.isConnected) {
            statusMsg.textContent = '';
            statusMsg.className   = '';
          }
        }, clearMs);
      }
    }

    function refreshUndo() {
      const n = undoStack.length;
      undoLabel.textContent = n > 0 ? `${n} undo level${n > 1 ? 's' : ''}` : '';
      btnUndo.disabled      = n === 0;
    }

    // ── Live stat pills ──────────────────────────────────────────────
    function updatePills() {
      try {
        const raw  = ta.value;
        const ents = parseEntries(raw);
        const dups = countDups(ents);
        const maxL = ents.reduce((a, e) => Math.max(a, e.length), 0);
        PP.n.textContent   = ents.length.toLocaleString();
        PP.ch.textContent  = raw.length.toLocaleString();
        PP.tok.textContent = estTokens(raw).toLocaleString();
        PP.dup.textContent = dups;
        PP.max.textContent = maxL;
        PP.dupPill.classList.toggle(`${NS}-warn`, dups > 0);
        PP.maxPill.classList.toggle(`${NS}-warn`,
          optLong.checked && maxL > parseInt(slider.value, 10));
      } catch { /* non-critical */ }
    }
    ta.addEventListener('input', updatePills);
    updatePills();

    slider.addEventListener('input', () => {
      cvDisp.textContent = slider.value;
      updatePills();
    });

    keepSel.addEventListener('change', () => {
      keepN.style.display = keepSel.value === 'custom' ? 'block' : 'none';
    });

    // ── Persist options on any change ────────────────────────────────
    function persistOpts() {
      cfg.charLimit = parseInt(slider.value, 10) || 200;
      cfg.keepN     = keepSel.value === 'custom' ? (keepN.value || '') : keepSel.value;
      cfg.trimLong  = optLong.checked;
      cfg.dedup     = optDedup.checked;
      saveCfg();
    }
    [optLong, optDedup].forEach(el => el.addEventListener('change', persistOpts));
    slider.addEventListener('change', persistOpts);
    keepSel.addEventListener('change', persistOpts);
    keepN.addEventListener('input', persistOpts);

    function readOpts() {
      return {
        charLimit : parseInt(slider.value, 10) || 200,
        keepN     : keepSel.value === 'custom' ? (keepN.value || '') : keepSel.value,
        trimLong  : optLong.checked,
        dedup     : optDedup.checked,
      };
    }

    // ════════════════════════════════════════════════════════════════
    //  RENDER OUTPUT
    //  Highlighting is applied to raw text before HTML-escaping to avoid
    //  the double-escape bug (e.g. searching "&" breaking the output).
    // ════════════════════════════════════════════════════════════════
    function highlight(raw, q) {
      if (!q) return escHtml(raw);
      const re = new RegExp(escRegex(q), 'gi');
      let out = '';
      let last = 0;
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(raw)) !== null) {
        out += escHtml(raw.slice(last, m.index));
        out += `<mark class="${NS}-c-hl">${escHtml(m[0])}</mark>`;
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
      }
      return out + escHtml(raw.slice(last));
    }

    function renderOutput() {
      const q = filterQ.toLowerCase().trim();

      if (activeTab === 'result') {
        if (!currentEntries.length) {
          outEl.innerHTML = `<span class="${NS}-hint">No result yet — paste memory text above and click Trim.</span>`;
          searchCt.textContent = '';
          return;
        }
        let matched = 0;
        const parts = currentEntries.map(entry => {
          const visible = !q || entry.toLowerCase().includes(q);
          if (visible) matched++;
          return `<span class="${NS}-c-kept" ${visible ? '' : 'style="display:none"'}>${highlight(entry, q)}</span>`;
        });
        outEl.innerHTML = parts.join(`<span class="${NS}-c-sep">\n\n</span>`);
        searchCt.textContent = q
          ? `${matched} of ${currentEntries.length}`
          : `${currentEntries.length} entries`;

      } else if (activeTab === 'removed') {
        if (!removedEntries.length) {
          outEl.innerHTML = `<span class="${NS}-hint">No entries were removed in the last trim.</span>`;
          searchCt.textContent = '';
          return;
        }
        let matched = 0;
        const parts = removedEntries.map(entry => {
          const visible = !q || entry.toLowerCase().includes(q);
          if (visible) matched++;
          return `<span class="${NS}-c-gone" ${visible ? '' : 'style="display:none"'}>${highlight(entry, q)}</span>`;
        });
        outEl.innerHTML = parts.join(`<span class="${NS}-c-sep">\n\n</span>`);
        searchCt.textContent = q
          ? `${matched} of ${removedEntries.length}`
          : `${removedEntries.length} entries`;

      } else if (activeTab === 'preview') {
        if (!trimResult) {
          outEl.innerHTML = `<span class="${NS}-hint">Run Trim first to see a diff preview.</span>`;
          return;
        }
        const r     = trimResult;
        const lines = [
          `<span class="${NS}-c-ok">Kept ${r.finalCount} entries (${r.keptPct}%)</span>`,
          `<span class="${NS}-c-warn">Removed ${r.totalRemoved} entries</span>`,
          `<span class="${NS}-c-sep">${'─'.repeat(46)}</span>`,
          '',
          ...r.kept.map(e => `<span class="${NS}-c-kept">  ${escHtml(e)}</span>`),
        ];
        if (r.removed.length) {
          lines.push('', `<span class="${NS}-c-sep">${'─'.repeat(46)}</span>`, '');
          r.removed.forEach(e => lines.push(`<span class="${NS}-c-gone">  ${escHtml(e)}</span>`));
        }
        outEl.innerHTML = lines.join('\n');
        outScroll.scrollTop = 0;
      }
    }

    // ════════════════════════════════════════════════════════════════
    //  TAB SWITCHING
    // ════════════════════════════════════════════════════════════════
    function switchTab(name) {
      activeTab = name;
      tabsEl.querySelectorAll(`.${NS}-tab`).forEach(t => {
        t.classList.toggle(`${NS}-active`, t.dataset.tab === name);
      });
      const isSettings   = name === 'settings';
      const isSearchable = name === 'result' || name === 'removed';
      outScroll.style.display   = isSettings ? 'none' : '';
      settingEl.classList.toggle(`${NS}-visible`, isSettings);
      searchBar.classList.toggle(`${NS}-visible`, isSearchable);
      if (isSettings) buildSettings();
      else            renderOutput();
    }

    tabsEl.addEventListener('click', e => {
      const tab = e.target.closest(`.${NS}-tab`);
      if (tab?.dataset.tab) switchTab(tab.dataset.tab);
    });

    searchIn.addEventListener('input', () => {
      filterQ = searchIn.value;
      renderOutput();
    });

    // ════════════════════════════════════════════════════════════════
    //  SETTINGS
    // ════════════════════════════════════════════════════════════════
    function mkToggleRow(id, label, sub, checked) {
      return `
        <div class="${NS}-stg-row">
          <div>
            <div class="${NS}-stg-label">${label}</div>
            <div class="${NS}-stg-sub">${sub}</div>
          </div>
          <label class="${NS}-tog">
            <input type="checkbox" id="${NS}-${id}" ${checked ? 'checked' : ''}>
            <div class="${NS}-tog-track"></div>
            <div class="${NS}-tog-thumb"></div>
          </label>
        </div>`;
    }

    function mkThemeRow(currentTheme) {
      return `
        <div class="${NS}-stg-row">
          <div>
            <div class="${NS}-stg-label">Theme</div>
            <div class="${NS}-stg-sub">Color theme for the tool interface</div>
          </div>
          <select id="${NS}-stg-theme" class="${NS}-stg-sel">
            <option value="dark"   ${currentTheme === 'dark'   ? 'selected' : ''}>Dark</option>
            <option value="light"  ${currentTheme === 'light'  ? 'selected' : ''}>Light</option>
            <option value="custom" ${currentTheme === 'custom' ? 'selected' : ''}>Custom CSS…</option>
          </select>
        </div>
        <div id="${NS}-custom-css-area" class="${currentTheme !== 'custom' ? NS + '-hidden' : ''}">
          <div class="${NS}-css-row">
            <button id="${NS}-import-file-btn">Import .css file</button>
            <input type="file" id="${NS}-import-file" accept=".css,.txt"
              style="display:none;position:absolute;opacity:0;pointer-events:none">
            <span class="${NS}-css-hint">
              Target <code>#${NS}-panel</code> and <code>#${NS}-fab</code> to style the tool.
            </span>
          </div>
          <textarea id="${NS}-custom-css-ta"
            placeholder="Paste your CSS here, or use the file importer above…"
            spellcheck="false">${escHtml(store.get(CUSTOM_CSS_KEY) ?? '')}</textarea>
          <div class="${NS}-css-footer">
            <button id="${NS}-apply-css">Apply</button>
            <button id="${NS}-clear-css">Clear custom CSS</button>
          </div>
        </div>`;
    }

    let settingsReady = false;
    function buildSettings() {
      if (settingsReady) return;
      settingsReady = true;

      settingEl.innerHTML = [
        mkThemeRow(cfg.theme ?? 'dark'),
        mkToggleRow('stg-pos',   'Remember window position',
                    'Saves the panel and button positions between sessions', cfg.rememberPos),
        mkToggleRow('stg-focus', 'Auto-focus textarea on open',
                    'Cursor jumps to the paste area automatically', cfg.autoFocus),
        mkToggleRow('stg-tok',   'Show token estimate',
                    'Rough GPT/Claude token count (~4 chars/token)', cfg.showTokens),
        mkToggleRow('stg-prev',  'Auto-switch to Preview after Trim',
                    'Shows the diff view automatically after trimming', cfg.previewOnTrim),
        `<button id="${NS}-stg-reset">Reset all settings and saved positions</button>`,
      ].join('');

      // ── Theme dropdown ─────────────────────────────────────────────
      const themeSelect   = document.getElementById(`${NS}-stg-theme`);
      const cssArea       = document.getElementById(`${NS}-custom-css-area`);
      const importFileBtn = document.getElementById(`${NS}-import-file-btn`);
      const importFileIn  = document.getElementById(`${NS}-import-file`);
      const customCssTa   = document.getElementById(`${NS}-custom-css-ta`);
      const applyBtn      = document.getElementById(`${NS}-apply-css`);
      const clearBtn      = document.getElementById(`${NS}-clear-css`);

      themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        cfg.theme = theme;
        saveCfg();
        cssArea.classList.toggle(`${NS}-hidden`, theme !== 'custom');
        applyTheme(theme);
      });

      // File import — open a hidden <input type=file> on button click
      importFileBtn.addEventListener('click', () => importFileIn.click());

      importFileIn.addEventListener('change', () => {
        const file = importFileIn.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload  = e => { customCssTa.value = e.target.result; };
        reader.onerror = () => setStatus('Could not read file.', 'err', 4000);
        reader.readAsText(file);
        // Reset so the same file can be re-imported if needed
        importFileIn.value = '';
      });

      // Apply — save CSS and re-inject
      applyBtn.addEventListener('click', () => {
        const css = customCssTa.value.trim();
        store.set(CUSTOM_CSS_KEY, css || null);
        cfg.theme = 'custom';
        themeSelect.value = 'custom';
        saveCfg();
        applyTheme('custom');
        setStatus('Custom CSS applied.', 'ok', 3000);
      });

      // Clear — wipe saved CSS, revert to dark
      clearBtn.addEventListener('click', () => {
        if (!confirm('Clear the custom CSS and revert to the dark theme?')) return;
        customCssTa.value = '';
        store.del(CUSTOM_CSS_KEY);
        cfg.theme = 'dark';
        themeSelect.value = 'dark';
        saveCfg();
        cssArea.classList.add(`${NS}-hidden`);
        applyTheme('dark');
        setStatus('Custom CSS cleared.', 'ok', 3000);
      });

      // ── Toggle switches ────────────────────────────────────────────
      function bindToggle(id, key, sideEffect) {
        const el = document.getElementById(`${NS}-${id}`);
        if (!el) return;
        el.addEventListener('change', () => {
          cfg[key] = el.checked;
          saveCfg();
          sideEffect?.(el.checked);
        });
      }
      bindToggle('stg-pos',   'rememberPos',    on => { if (!on) { store.del(POS_KEY); savedPos = {}; } });
      bindToggle('stg-focus', 'autoFocus');
      bindToggle('stg-tok',   'showTokens',     on => { PP.tokPill.style.display = on ? '' : 'none'; });
      bindToggle('stg-prev',  'previewOnTrim');

      // ── Reset ──────────────────────────────────────────────────────
      document.getElementById(`${NS}-stg-reset`).addEventListener('click', () => {
        if (!confirm('Reset all Memory Trimmer settings and saved positions to defaults?')) return;
        cfg = { ...DEFAULTS };
        saveCfg();
        savedPos = {};
        store.del(POS_KEY);
        store.del(CUSTOM_CSS_KEY);
        applyTheme('dark');
        setStatus('Settings reset to defaults.', 'ok', 3500);
        // Rebuild the settings panel so all controls reflect the reset values
        settingsReady = false;
        settingEl.innerHTML = '';
        buildSettings();
      });
    }

    // ════════════════════════════════════════════════════════════════
    //  TRIM
    // ════════════════════════════════════════════════════════════════
    btnRun.addEventListener('click', () => {
      const raw = ta.value.trim();
      if (!raw) {
        setStatus('Paste your memory text first.', 'warn', 4000);
        if (cfg.autoFocus) ta.focus();
        return;
      }

      let parsed;
      try {
        parsed = parseEntries(raw);
      } catch {
        setStatus('Could not parse input — unexpected text format.', 'err', 5000);
        return;
      }

      if (!parsed.length) {
        setStatus('No entries found. Entries must be separated by blank lines.', 'warn', 5000);
        return;
      }

      const opts   = readOpts();
      const result = runTrim(parsed, opts);

      if (result.kept.length === 0) {
        setStatus('All entries would be removed — loosen the filters and try again.', 'warn', 5000);
        return;
      }

      // Save undo snapshot (capped at 20 levels)
      undoStack.push(currentEntries.length > 0 ? [...currentEntries] : [...parsed]);
      if (undoStack.length > 20) undoStack.shift();

      trimResult     = result;
      currentEntries = result.kept;
      removedEntries = result.removed;

      removedN.textContent  = result.removed.length;
      progFill.style.width  = `${result.keptPct}%`;
      btnCopy.disabled      = false;
      btnPrev.disabled      = false;
      refreshUndo();
      updatePills();

      const parts = [`${result.totalRemoved} removed, ${result.finalCount} kept (${result.keptPct}%)`];
      if (result.byDedup.length) parts.push(`${result.byDedup.length} dups`);
      if (result.byLong.length)  parts.push(`${result.byLong.length} too-long`);
      if (result.byAge.length)   parts.push(`${result.byAge.length} oldest`);
      setStatus(parts.join(' · '), 'ok', 7000);

      switchTab(cfg.previewOnTrim ? 'preview' : 'result');
    });

    // ════════════════════════════════════════════════════════════════
    //  COPY
    // ════════════════════════════════════════════════════════════════
    btnCopy.addEventListener('click', async () => {
      if (!currentEntries.length) {
        setStatus('Nothing to copy — run Trim first.', 'warn', 3000);
        return;
      }
      try {
        await writeClipboard(currentEntries.join('\n\n'));
        setStatus('Copied! Close this window and paste (Ctrl+V) into the Memory box.', 'ok', 8000);
        const orig    = btnCopy.innerHTML;
        btnCopy.innerHTML = 'Copied!';
        btnCopy.disabled  = true;
        setTimeout(() => {
          if (btnCopy.isConnected) { btnCopy.innerHTML = orig; btnCopy.disabled = false; }
        }, 2500);
      } catch {
        setStatus('Clipboard blocked — switch to the Result tab and copy manually (Ctrl+A, Ctrl+C).', 'warn');
        switchTab('result');
      }
    });

    // ════════════════════════════════════════════════════════════════
    //  UNDO
    // ════════════════════════════════════════════════════════════════
    btnUndo.addEventListener('click', () => {
      if (!undoStack.length) return;
      currentEntries = undoStack.pop();
      removedEntries = [];
      trimResult     = null;
      removedN.textContent = '0';
      progFill.style.width = '100%';
      btnPrev.disabled     = true;
      refreshUndo();
      switchTab('result');
      setStatus(`Restored ${currentEntries.length} entries.`, 'ok', 4000);
    });

    btnPrev.addEventListener('click', () => switchTab('preview'));

    // ════════════════════════════════════════════════════════════════
    //  CLEAR
    // ════════════════════════════════════════════════════════════════
    btnClr.addEventListener('click', () => {
      ta.value       = '';
      currentEntries = [];
      removedEntries = [];
      trimResult     = null;
      undoStack      = [];
      filterQ        = '';
      searchIn.value = '';
      removedN.textContent = '0';
      progFill.style.width = '0%';
      btnCopy.disabled     = true;
      btnPrev.disabled     = true;
      refreshUndo();
      updatePills();
      switchTab('result');
      setStatus('Cleared.', '', 2000);
      if (cfg.autoFocus) ta.focus();
    });

    // ════════════════════════════════════════════════════════════════
    //  CLOSE PANEL
    //
    //  Three fixes over previous versions:
    //
    //  FIX 1 — Close button not working:
    //    Handled in makeDraggable (interactive-child check). The Close
    //    button's click now fires correctly because setPointerCapture is
    //    never called when the pointer originates from a button child.
    //
    //  FIX 2 — FAB not reappearing after Escape:
    //    The backdrop's pointer-events are disabled immediately so the
    //    FAB is interactable the moment close starts (not after the 160ms
    //    fade). isOpen is set to false before the timeout so openPanel()
    //    can be called again without waiting for the animation to finish.
    //
    //  FIX 3 — Status timer writing to detached nodes:
    //    panel._statusTimer is cancelled here before removal.
    // ════════════════════════════════════════════════════════════════
    function closePanel() {
      clearTimeout(panel._statusTimer);
      document.removeEventListener('keydown', keyHandler);

      // Disable pointer events immediately on both overlay elements so the
      // FAB and the rest of the page are fully interactive during the fade.
      panel.style.pointerEvents    = 'none';
      backdrop.style.pointerEvents = 'none';

      // Mark as closed now so openPanel() can be called again right away.
      isOpen = false;

      panel.style.transition    = 'opacity 0.15s ease';
      backdrop.style.transition = 'opacity 0.15s ease';
      panel.style.opacity    = '0';
      backdrop.style.opacity = '0';

      setTimeout(() => { panel.remove(); backdrop.remove(); }, 160);
    }

    // Wire up close button and backdrop click
    btnClose.addEventListener('click', closePanel);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closePanel(); });

    // ── Keyboard shortcuts ───────────────────────────────────────────
    function keyHandler(e) {
      if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); btnRun.click(); }
    }
    document.addEventListener('keydown', keyHandler);

    // ════════════════════════════════════════════════════════════════
    //  EASTER EGG — click the version badge 5× within 2.5 s
    // ════════════════════════════════════════════════════════════════
    let eggCount = 0;
    let eggTimer = null;
    verBadge.style.cursor     = 'pointer';
    verBadge.style.transition = 'color 0.15s, border-color 0.15s';

    // setPointerCapture() on the drag handle redirects the subsequent `click`
    // event to the handle element, so verBadge's own click listener never fires.
    // Stopping propagation here means the hdr pointerdown handler never runs
    // for verBadge presses, so no capture is set and click lands on verBadge.
    verBadge.addEventListener('pointerdown', e => e.stopPropagation());

    verBadge.addEventListener('click', () => {
      eggCount++;
      clearTimeout(eggTimer);
      eggTimer = setTimeout(() => { eggCount = 0; }, 2500);
      verBadge.style.color       = '#3fb950';
      verBadge.style.borderColor = '#3fb95077';
      setTimeout(() => {
        if (verBadge.isConnected) {
          verBadge.style.color       = '';
          verBadge.style.borderColor = '';
        }
      }, 280);
      if (eggCount >= 5) {
        eggCount = 0;
        clearTimeout(eggTimer);
        showEasterEgg(panel);
      }
    });

    // Initial render
    switchTab(activeTab);
    refreshUndo();
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 14 — EASTER EGG
  // ══════════════════════════════════════════════════════════════════════
  function showEasterEgg(panel) {
    if (document.getElementById(`${NS}-egg`)) return;
    const egg = document.createElement('div');
    egg.id = `${NS}-egg`;
    egg.innerHTML = `
      <div id="${NS}-egg-title">MEMORY PURGE INITIATED</div>
      <div id="${NS}-egg-msg">
        Just kidding — your memories are perfectly safe! 😄<br><br>
        <span style="color:#3fb950;font-family:monospace;font-size:12px">
          Achievement unlocked: <b>Memory Hacker</b>
        </span>
      </div>
      <button id="${NS}-egg-close">Phew, close this!</button>
    `;
    panel.appendChild(egg);
    function dismiss() {
      egg.style.transition = 'opacity 0.22s';
      egg.style.opacity    = '0';
      setTimeout(() => egg.remove(), 240);
    }
    document.getElementById(`${NS}-egg-close`).addEventListener('click', dismiss);
    setTimeout(() => { if (egg.isConnected) dismiss(); }, 6000);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 15 — GLOBAL KEYBOARD SHORTCUT  (Alt+M)
  // ══════════════════════════════════════════════════════════════════════
  document.addEventListener('keydown', e => {
    if (e.altKey && (e.key === 'm' || e.key === 'M')) { e.preventDefault(); openPanel(); }
  });

  // ══════════════════════════════════════════════════════════════════════
  //  SECTION 16 — SPA REINJECT GUARD
  //  Perchance may replace document.body on soft navigation.
  //  Debounced MutationObserver re-injects our elements if removed.
  // ══════════════════════════════════════════════════════════════════════
  let reinjectTimer = null;
  new MutationObserver(() => {
    clearTimeout(reinjectTimer);
    reinjectTimer = setTimeout(() => {
      if (!document.getElementById(SENTINEL_ID)) document.body.appendChild(sentinel);
      if (!document.getElementById(`${NS}-fab`))  document.body.appendChild(fab);
      if (!document.head.contains(styleEl))        document.head.appendChild(styleEl);
    }, 250);
  }).observe(document.body, { childList: true });

  console.debug(`[PMT v${VERSION}] Loaded.`);

})();
