// ==UserScript==
// @name         Perchance Memory Trimmer Tool
// @namespace    https://perchance.org/
// @version      2.04.0
// @description  Memory trimmer for Perchance AI Chat — draggable UI, undo, preview diff, search, token count, settings persistence.
// @match        https://perchance.org/ai-character-chat*
// @match        https://perchance.org/urv-ai-chat*
// @match        https://perchance.org/new-ai-chat-gen*
// @grant        none
// @license      MIT
// @run-at       document-end
// @downloadURL https://update.greasyfork.org/scripts/553173/Perchance%20Memory%20Trimmer%20Tool.user.js
// @updateURL https://update.greasyfork.org/scripts/553173/Perchance%20Memory%20Trimmer%20Tool.meta.js
// ==/UserScript==

(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/constants.js
  var NS, VERSION, SENTINEL_ID, CFG_KEY, POS_KEY, CUSTOM_CSS_KEY, SCHEMA_KEY, SCHEMA_VERSION, DRAG_PX, IDS;
  var init_constants = __esm({
    "src/constants.js"() {
      NS = "pmt5";
      VERSION = "2.04.0";
      SENTINEL_ID = "pmt5-sentinel";
      CFG_KEY = "pmt5_cfg";
      POS_KEY = "pmt5_pos";
      CUSTOM_CSS_KEY = "pmt5_custom_css";
      SCHEMA_KEY = "pmt5_schema";
      SCHEMA_VERSION = 1;
      DRAG_PX = 5;
      IDS = {
        fab: `${NS}-fab`,
        panel: `${NS}-panel`,
        styles: `${NS}-styles`,
        backdrop: `${NS}-backdrop`
      };
    }
  });

  // src/defaults.js
  var DEFAULTS;
  var init_defaults = __esm({
    "src/defaults.js"() {
      DEFAULTS = {
        // Trim options
        charLimit: 200,
        keepN: "",
        trimLong: false,
        dedup: false,
        trimMode: "basic",
        // 'basic' | 'token_budget'
        targetTokens: 2000,
        // UX
        rememberPos: true,
        autoFocus: true,
        showTokens: true,
        previewOnTrim: false,
        theme: "dark",
        // 'dark' | 'light' | 'custom'
        tokenizerSource: "auto",
        // 'auto' | 'native' | 'heuristic'
        showPerEntryTokens: false,
        debugMode: false,
        // Feature flags
        normalizeSeparators: true,
        showRepetitionBadge: true,
        showAutomationBadge: true,
        autoMatchHostTheme: false,
        injectMiniToolbar: false
      };
    }
  });

  // src/storage.js
  var storage_exports = {};
  __export(storage_exports, {
    getStorageHealthSnapshot: () => getStorageHealthSnapshot,
    loadCfg: () => loadCfg,
    loadSavedPos: () => loadSavedPos,
    loadSchema: () => loadSchema,
    saveCfg: () => saveCfg,
    savePos: () => savePos,
    saveSchema: () => saveSchema,
    store: () => store
  });
  function loadCfg() {
    var _a;
    const saved = (_a = store.get(CFG_KEY)) != null ? _a : {};
    // Migrate removed 'exact' token source
    if (saved.tokenizerSource === "exact") saved.tokenizerSource = "auto";
    return { ...DEFAULTS, ...saved };
  }
  function saveCfg(cfg) {
    store.set(CFG_KEY, cfg);
  }
  function loadSavedPos(cfg) {
    var _a;
    return cfg.rememberPos ? (_a = store.get(POS_KEY)) != null ? _a : {} : {};
  }
  function savePos(cfg, savedPos) {
    if (cfg.rememberPos) store.set(POS_KEY, savedPos);
  }
  function loadSchema() {
    const saved = store.get(SCHEMA_KEY);
    return migrateSchema(saved);
  }
  function saveSchema(schema) {
    store.set(SCHEMA_KEY, schema);
  }
  function migrateSchema(saved) {
    const base = {
      schemaVersion: SCHEMA_VERSION,
      pinsByScope: {},
      continuityByScope: {},
      debugReportsByScope: {}
    };
    if (!saved || typeof saved !== "object") return base;
    return {
      ...base,
      ...saved,
      schemaVersion: SCHEMA_VERSION
    };
  }
  async function getStorageHealthSnapshot() {
    var _a;
    const bytes = store.estimateBytes();
    const schema = loadSchema();
    const scopeKeys = Object.keys(schema.pinsByScope || {});
    let browserEstimate = null;
    try {
      if (typeof navigator !== "undefined" && ((_a = navigator.storage) == null ? void 0 : _a.estimate)) {
        const est = await navigator.storage.estimate();
        browserEstimate = { quota: est.quota, usage: est.usage };
      }
    } catch {
    }
    return {
      pmtBytes: bytes,
      pmtKb: Math.round(bytes / 1024),
      scopeCount: scopeKeys.length,
      browserEstimate,
      warnLevel: bytes > 2e5 ? "high" : bytes > 8e4 ? "medium" : "ok"
    };
  }
  var store;
  var init_storage = __esm({
    "src/storage.js"() {
      init_constants();
      init_defaults();
      store = {
        get(key2) {
          var _a;
          try {
            return JSON.parse((_a = localStorage.getItem(key2)) != null ? _a : "null");
          } catch {
            return null;
          }
        },
        set(key2, val) {
          try {
            localStorage.setItem(key2, JSON.stringify(val));
          } catch {
          }
        },
        del(key2) {
          try {
            localStorage.removeItem(key2);
          } catch {
          }
        },
        /** Approximate total bytes used by all PMT keys. */
        estimateBytes() {
          var _a, _b;
          let total = 0;
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k == null ? void 0 : k.startsWith("pmt5")) {
                total += ((_b = (_a = localStorage.getItem(k)) == null ? void 0 : _a.length) != null ? _b : 0) * 2;
              }
            }
          } catch {
          }
          return total;
        }
      };
    }
  });

  // src/host/helpers.js
  var helpers_exports = {};
  __export(helpers_exports, {
    classifyPerchanceWindow: () => classifyPerchanceWindow,
    downloadText: () => downloadText,
    findBestMemoryWindow: () => findBestMemoryWindow,
    getAutomationState: () => getAutomationState,
    getHostAnchors: () => getHostAnchors,
    getHostThemeVars: () => getHostThemeVars,
    getIdealMaxContextTokens: () => getIdealMaxContextTokens,
    getNativeTokenCount: () => getNativeTokenCount,
    injectMiniToolbar: () => injectMiniToolbar,
    injectShortcutButton: () => injectShortcutButton,
    normalizeEntries: () => normalizeEntries,
    serializeEntries: () => serializeEntries,
    verifyNormalizedApply: () => verifyNormalizedApply
  });
  function getNativeTokenCount(text) {
    try {
      if (_source !== "heuristic" && typeof window.countTokens === "function") {
        const value = window.countTokens(String(text != null ? text : ""));
        if (Number.isFinite(value) && value >= 0) return value;
      }
    } catch {
    }
    if (_source === "native") return 0;
    return Math.ceil(String(text != null ? text : "").length / 4);
  }
  function getIdealMaxContextTokens(fallback = null) {
    try {
      const value = window.idealMaxContextTokens;
      if (Number.isFinite(value) && value > 0) return value;
    } catch {
    }
    return fallback;
  }
  function normalizeEntries(raw) {
    return String(raw != null ? raw : "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  }
  function serializeEntries(entries) {
    return (entries || []).map((s) => String(s != null ? s : "").trim()).filter(Boolean).join("\n\n");
  }
  function downloadText(filename, text) {
    const blob = new Blob([String(text != null ? text : "")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3e4);
  }
  function getHostThemeVars() {
    const root = getComputedStyle(document.documentElement);
    return {
      background: root.getPropertyValue("--background").trim(),
      buttonBg: root.getPropertyValue("--button-bg").trim(),
      buttonBgHover: root.getPropertyValue("--button-bg-hover").trim(),
      textColor: root.getPropertyValue("--text-color").trim(),
      borderColor: root.getPropertyValue("--border-color").trim(),
      boxColor: root.getPropertyValue("--box-color").trim(),
      boxColorHover: root.getPropertyValue("--box-color-hover").trim(),
      borderRadius: root.getPropertyValue("--border-radius").trim()
    };
  }
  function getHostAnchors() {
    // Versioned adapter with fallback selector arrays for Perchance DOM drift resilience
    const messageInput =
      document.querySelector("#messageInput") ||
      document.querySelector("textarea[name='message']") ||
      document.querySelector(".message-input textarea");
    const sendButton =
      document.querySelector("#sendButton") ||
      document.querySelector("button[data-action='send']") ||
      document.querySelector(".send-btn");
    const shortcutButtons =
      document.querySelector("#shortcutButtonsCtn") ||
      document.querySelector(".shortcut-buttons") ||
      document.querySelector("[data-shortcut-container]");
    const messageFeed =
      document.querySelector("#messageFeed") ||
      document.querySelector(".message-feed") ||
      document.querySelector(".messages");
    const windows = [...document.querySelectorAll(".window")];
    const confidence =
      (messageInput ? 0.35 : 0) +
      (sendButton ? 0.35 : 0) +
      (windows.length > 0 ? 0.2 : 0) +
      (messageFeed ? 0.1 : 0);
    return { messageInput, sendButton, shortcutButtons, messageFeed, windows, confidence };
  }
  function buildCapabilities(cfg2) {
    const auto = getAutomationState();
    const hasNativeTokens = typeof window.countTokens === "function";
    const hasKey = !!getStoredKey();
    return {
      automation:          auto.status === "connected",
      memoryWindowAccess:  auto.status !== "manual",
      compare:             true,
      snapshots:           true,
      qaLocal:             true,
      qaRemote:            hasKey,
      diagnostics:         true,
      miniToolbar:         auto.status !== "manual" && !!(findBestMemoryWindow()),
      nativeTokens:        hasNativeTokens
    };
  }
  function getAutomationState() {
    const anchors = getHostAnchors();
    const hasMessageInput = !!(anchors.messageInput);
    const hasSendButton = !!(anchors.sendButton);
    const hasWindow = anchors.windows.length > 0;
    const confidence = anchors.confidence;
    let status;
    if (hasMessageInput && hasSendButton) {
      status = "connected";
    } else if (hasWindow) {
      status = "window-detected";
    } else {
      status = "manual";
      if (!getAutomationState._logged) {
        getAutomationState._logged = true;
        console.debug("[PMT] Host adapter fallback. No Perchance controls found. confidence:", confidence.toFixed(2));
      }
    }
    return { status, hasMessageInput, hasSendButton, hasWindow, anchors, confidence };
  }
  getAutomationState._logged = false;
  function classifyPerchanceWindow(windowEl) {
    var _a, _b;
    if (!windowEl) return { type: "unknown", confidence: 0 };
    const headerText = (((_a = windowEl.querySelector(".header")) == null ? void 0 : _a.textContent) || "").toLowerCase().trim();
    const bodyText = (((_b = windowEl.querySelector(".body")) == null ? void 0 : _b.textContent) || "").toLowerCase().trim();
    const textarea = windowEl.querySelector("textarea");
    let confidence = 0;
    let type = "unknown";
    if (/mem|memory|memories/.test(headerText)) {
      type = "memory";
      confidence += 0.6;
    }
    if (/lore/.test(headerText)) {
      type = "lore";
      confidence += 0.6;
    }
    if (textarea) {
      confidence += 0.2;
      if (normalizeEntries(textarea.value).length >= 3) confidence += 0.2;
    } else if (/mem|memory|memories/.test(bodyText)) {
      confidence += 0.1;
    }
    return { type, confidence, textarea };
  }
  function findBestMemoryWindow() {
    var _a;
    const scored = [...document.querySelectorAll(".window")].map((el) => ({ el, ...classifyPerchanceWindow(el) })).sort((a, b) => b.confidence - a.confidence);
    return (_a = scored.find((item) => item.type === "memory" && item.confidence >= 0.7)) != null ? _a : null;
  }
  function injectMiniToolbar(windowEl, options = {}) {
    if (!windowEl) return null;
    const header = windowEl.querySelector(".header");
    if (!header) return null;
    // Idempotency: return existing toolbar
    const existing = header.querySelector('[data-pmt-toolbar="true"]');
    if (existing) return existing;
    // Normalize API: accept {onOpen} shorthand and synthesize a default button
    let buttons = options.buttons || [];
    if (!buttons.length && typeof options.onOpen === "function") {
      buttons = [{ label: "\uD83E\uDDE0 Trim", title: "Open Memory Trimmer", onClick: options.onOpen }];
    }
    // Never append an empty toolbar shell
    if (!buttons.length) return null;
    const theme = getHostThemeVars();
    const toolbar = document.createElement("div");
    toolbar.dataset.pmtToolbar = "true";
    toolbar.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:0.25rem",
      "margin-left:auto",
      "padding-left:0.5rem",
      `color:${theme.textColor || "inherit"}`
    ].join(";");
    buttons.forEach(({ label, title, onClick }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      if (title) btn.title = title;
      btn.style.cssText = [
        `background:${theme.buttonBg || "var(--button-bg, #333)"}`,
        `border:1px solid ${theme.borderColor || "var(--border-color, #666)"}`,
        `border-radius:${theme.borderRadius || "3px"}`,
        "padding:0.125rem 0.35rem",
        "cursor:pointer",
        "font-size:0.75rem",
        "line-height:1.2"
      ].join(";");
      if (typeof onClick === "function") btn.addEventListener("click", onClick);
      toolbar.appendChild(btn);
    });
    header.appendChild(toolbar);
    return toolbar;
  }
  function removeMiniToolbar(windowEl) {
    if (!windowEl) return;
    const header = windowEl.querySelector(".header");
    if (!header) return;
    const existing = header.querySelector('[data-pmt-toolbar="true"]');
    if (existing) existing.remove();
  }
  function injectShortcutButton({ label = "\u{1F9E0} Trim mem", title = "Open the Memory Trimmer", onClick = null } = {}) {
    const anchors = getHostAnchors();
    const container = anchors.shortcutButtons || document.querySelector("#shortcutButtonsCtn");
    if (!container) return null;
    if (container.querySelector('[data-pmt-shortcut="true"]')) {
      return container.querySelector('[data-pmt-shortcut="true"]');
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.pmtShortcut = "true";
    btn.textContent = label;
    btn.title = title;
    if (typeof onClick === "function") btn.addEventListener("click", onClick);
    container.appendChild(btn);
    return btn;
  }
  function verifyNormalizedApply(expectedText, actualText) {
    const expected = serializeEntries(normalizeEntries(expectedText));
    const actual = serializeEntries(normalizeEntries(actualText));
    return { ok: expected === actual, expected, actual };
  }
  var init_helpers = __esm({
    "src/host/helpers.js"() {
    }
  });

  // src/core/repetition.js
  var repetition_exports = {};
  __export(repetition_exports, {
    getRepetitionRiskLabel: () => getRepetitionRiskLabel,
    scanRepetitionHotspots: () => scanRepetitionHotspots
  });
  function normalizeForNgrams(text) {
    return String(text != null ? text : "").toLowerCase().replace(/[\u2019']/g, "'").replace(/[^a-z0-9'\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function ngrams(words, n) {
    const out = [];
    for (let i = 0; i + n <= words.length; i++) {
      out.push(words.slice(i, i + n).join(" "));
    }
    return out;
  }
  function scanRepetitionHotspots(entries, options = {}) {
    const {
      n = 4,
      minCount = 3,
      minAffectedEntries = 2,
      limit = 25
    } = options;
    const gramCounts = /* @__PURE__ */ new Map();
    const gramEntries = /* @__PURE__ */ new Map();
    entries.forEach((entry, idx) => {
      const words = normalizeForNgrams(entry).split(" ").filter(Boolean);
      const grams = new Set(ngrams(words, n));
      grams.forEach((gram) => {
        gramCounts.set(gram, (gramCounts.get(gram) || 0) + 1);
        if (!gramEntries.has(gram)) gramEntries.set(gram, []);
        gramEntries.get(gram).push(idx);
      });
    });
    return [...gramCounts.entries()].map(([gram, count]) => ({
      gram,
      count,
      affectedEntries: [...new Set(gramEntries.get(gram) || [])]
    })).filter(
      (item) => item.count >= minCount && item.affectedEntries.length >= minAffectedEntries
    ).sort((a, b) => b.count - a.count).slice(0, limit);
  }
  function getRepetitionRiskLabel(hotspots) {
    const n = hotspots.length;
    if (n === 0) return "none";
    if (n <= 3) return "low";
    if (n <= 8) return "moderate";
    return "high";
  }
  var init_repetition = __esm({
    "src/core/repetition.js"() {
    }
  });

  // src/core/protection.js
  function createSessionProtectionStore() {
    const protectedIds = /* @__PURE__ */ new Set();
    return {
      protect(id) {
        protectedIds.add(id);
      },
      unprotect(id) {
        protectedIds.delete(id);
      },
      toggle(id) {
        if (protectedIds.has(id)) {
          protectedIds.delete(id);
          return false;
        }
        protectedIds.add(id);
        return true;
      },
      has(id) {
        return protectedIds.has(id);
      },
      clear() {
        protectedIds.clear();
      },
      values() {
        return [...protectedIds];
      },
      size() {
        return protectedIds.size;
      }
    };
  }
  function getEntryId(entry) {
    const s = String(entry != null ? entry : "").trim();
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h << 5) + h ^ s.charCodeAt(i);
    return `e_${(h >>> 0).toString(16).padStart(8, "0")}`;
  }
  var init_protection = __esm({
    "src/core/protection.js"() {
    }
  });

  // src/debug/smoketests.js
  var smoketests_exports = {};
  __export(smoketests_exports, {
    buildDebugReport: () => buildDebugReport,
    collectHostDiagnostics: () => collectHostDiagnostics,
    runSmokeTests: () => runSmokeTests
  });
  function record(results, name, pass, details = "") {
    results.push({ name, pass, details });
  }
  function runSmokeTests() {
    const results = [];
    try {
      const normalized = normalizeEntries("one\n\n\n two \r\n\r\nthree");
      record(
        results,
        "normalizeEntries-roundtrip-shape",
        normalized.length === 3,
        JSON.stringify(normalized)
      );
    } catch (e) {
      record(results, "normalizeEntries-roundtrip-shape", false, String(e));
    }
    try {
      const serialized = serializeEntries([" one ", "two", "three "]);
      record(
        results,
        "serializeEntries-joins-with-blank-lines",
        serialized === "one\n\ntwo\n\nthree",
        serialized
      );
    } catch (e) {
      record(results, "serializeEntries-joins-with-blank-lines", false, String(e));
    }
    try {
      const count = getNativeTokenCount("hello world");
      record(
        results,
        "native-token-fallback-returns-number",
        Number.isFinite(count) && count > 0,
        String(count)
      );
    } catch (e) {
      record(results, "native-token-fallback-returns-number", false, String(e));
    }
    try {
      const store2 = createSessionProtectionStore();
      store2.protect("entry_a");
      const first = store2.has("entry_a");
      store2.toggle("entry_a");
      const second = !store2.has("entry_a");
      record(
        results,
        "session-protection-store-toggle",
        first && second,
        JSON.stringify(store2.values())
      );
    } catch (e) {
      record(results, "session-protection-store-toggle", false, String(e));
    }
    try {
      const v = verifyNormalizedApply("one\r\n\r\ntwo", "one\n\n\n two");
      record(results, "verifyNormalizedApply-normalized-match", v.ok === true, JSON.stringify(v));
    } catch (e) {
      record(results, "verifyNormalizedApply-normalized-match", false, String(e));
    }
    try {
      const v = verifyNormalizedApply("one\n\ntwo", "one\n\nthree");
      record(results, "verifyNormalizedApply-detects-mismatch", v.ok === false, JSON.stringify(v));
    } catch (e) {
      record(results, "verifyNormalizedApply-detects-mismatch", false, String(e));
    }
    try {
      const hotspots = scanRepetitionHotspots([
        "The red door stays shut in the rain and the red door stays shut at dusk.",
        "Everyone knows the red door stays shut when the bell rings.",
        "By custom, the red door stays shut until sunrise."
      ]);
      record(
        results,
        "repetition-hotspot-detection",
        hotspots.length > 0,
        JSON.stringify(hotspots.slice(0, 2))
      );
    } catch (e) {
      record(results, "repetition-hotspot-detection", false, String(e));
    }
    try {
      const risk = getRepetitionRiskLabel([]);
      record(results, "repetition-risk-label-none", risk === "none", risk);
    } catch (e) {
      record(results, "repetition-risk-label-none", false, String(e));
    }
    // PATCH-9: capability detection
    try {
      const auto = getAutomationState();
      record(results, "getAutomationState-returns-status",
        ["connected", "window-detected", "manual"].includes(auto.status),
        auto.status);
    } catch (e) {
      record(results, "getAutomationState-returns-status", false, String(e));
    }
    // PATCH-9: tokenizer source config validity
    try {
      const valid = ["auto", "native", "heuristic"];
      const src = _source;
      record(results, "token-source-is-valid-value", valid.includes(src), src);
    } catch (e) {
      record(results, "token-source-is-valid-value", false, String(e));
    }
    // PATCH-9: normalizeEntries handles lone \r (CRLF parity)
    try {
      const entries = normalizeEntries("one\r\ntwo\r\nthree\rfour");
      record(results, "normalizeEntries-handles-lone-cr",
        entries.length === 1 && entries[0].includes("one"),
        JSON.stringify(entries));
    } catch (e) {
      record(results, "normalizeEntries-handles-lone-cr", false, String(e));
    }
    // PATCH-9: injectMiniToolbar synthesizes button from onOpen
    try {
      const fakeWin = document.createElement("div");
      const fakeHeader = document.createElement("div");
      fakeHeader.className = "header";
      fakeWin.appendChild(fakeHeader);
      const result2 = injectMiniToolbar(fakeWin, { onOpen: () => {} });
      const hasButton = result2 && result2.querySelector("button") !== null;
      record(results, "injectMiniToolbar-synthesizes-button-from-onOpen", !!hasButton,
        hasButton ? "button found" : "no button");
    } catch (e) {
      record(results, "injectMiniToolbar-synthesizes-button-from-onOpen", false, String(e));
    }
    // PATCH-9: buildDebugReport is available in smoketests_exports
    try {
      record(results, "buildDebugReport-available-in-smoketests",
        typeof buildDebugReport === "function", typeof buildDebugReport);
    } catch (e) {
      record(results, "buildDebugReport-available-in-smoketests", false, String(e));
    }
    // PATCH-9: DEFAULTS has no undefined token-source value
    try {
      const valid2 = ["auto", "native", "heuristic"];
      record(results, "defaults-tokenizerSource-is-valid",
        valid2.includes(DEFAULTS.tokenizerSource), DEFAULTS.tokenizerSource);
    } catch (e) {
      record(results, "defaults-tokenizerSource-is-valid", false, String(e));
    }
    // Regression: saved tokenizerSource="exact" migrates to "auto"
    try {
      const migrated = { tokenizerSource: "exact" };
      if (migrated.tokenizerSource === "exact") migrated.tokenizerSource = "auto";
      record(results, "regression-exact-migrates-to-auto",
        migrated.tokenizerSource === "auto", migrated.tokenizerSource);
    } catch (e) {
      record(results, "regression-exact-migrates-to-auto", false, String(e));
    }
    // Regression: injectShortcutButton uses fallback anchors (not hardcoded selector)
    try {
      const fakeContainer = document.createElement("div");
      fakeContainer.dataset.pmtTestContainer = "true";
      const fakeAnchors = { shortcutButtons: fakeContainer, windows: [], confidence: 0.1,
        messageInput: null, sendButton: null, messageFeed: null };
      // Simulate the updated path: use anchors.shortcutButtons
      const container = fakeAnchors.shortcutButtons || document.querySelector("#shortcutButtonsCtn");
      const btn = document.createElement("button");
      btn.dataset.pmtShortcut = "true";
      container.appendChild(btn);
      record(results, "regression-shortcut-uses-host-adapter",
        !!container.querySelector('[data-pmt-shortcut="true"]'), "adapter path works");
    } catch (e) {
      record(results, "regression-shortcut-uses-host-adapter", false, String(e));
    }
    // Regression: injectMiniToolbar({ onOpen }) creates a clickable button
    try {
      const fakeWin2 = document.createElement("div");
      const fakeHdr2 = document.createElement("div");
      fakeHdr2.className = "header";
      fakeWin2.appendChild(fakeHdr2);
      let clicked = false;
      const toolbar = injectMiniToolbar(fakeWin2, { onOpen: () => { clicked = true; } });
      const btn2 = toolbar ? toolbar.querySelector("button") : null;
      if (btn2) btn2.click();
      record(results, "regression-injectMiniToolbar-onOpen-creates-clickable",
        !!btn2 && clicked, `btn=${!!btn2} clicked=${clicked}`);
    } catch (e) {
      record(results, "regression-injectMiniToolbar-onOpen-creates-clickable", false, String(e));
    }
    return {
      version: VERSION,
      passCount: results.filter((r) => r.pass).length,
      failCount: results.filter((r) => !r.pass).length,
      results
    };
  }
  function collectHostDiagnostics() {
    const automation = getAutomationState();
    const theme = getHostThemeVars();
    return {
      automation,
      themePresence: {
        background: !!theme.background,
        buttonBg: !!theme.buttonBg,
        textColor: !!theme.textColor,
        borderColor: !!theme.borderColor,
        borderRadius: !!theme.borderRadius
      },
      tokenCounterSource: typeof window.countTokens === "function" ? "native" : "heuristic"
    };
  }
  async function buildDebugReport({ featureFlags = {}, latestApplyResult = null } = {}) {
    const storageHealth = await getStorageHealthSnapshot().catch(() => null);
    return {
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      version: VERSION,
      featureFlags,
      diagnostics: collectHostDiagnostics(),
      storageHealth,
      smokeTests: runSmokeTests(),
      latestApplyResult
    };
  }
  var init_smoketests = __esm({
    "src/debug/smoketests.js"() {
      init_helpers();
      init_repetition();
      init_protection();
      init_helpers();
      init_constants();
      init_storage();
    }
  });

  // src/core/comparison.js
  var comparison_exports = {};
  __export(comparison_exports, {
    compareMemoryVsLoreVsSummary: () => compareMemoryVsLoreVsSummary
  });
  function compareMemoryVsLoreVsSummary(memEntries, loreText = "", summaryText = "") {
    const loreEntries = normalizeEntries(loreText);
    const summaryEntries = normalizeEntries(summaryText);
    function overlaps(a, b) {
      const tokA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
      const tokB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
      let shared = 0;
      for (const t of tokA) if (tokB.has(t)) shared++;
      return shared / Math.max(tokA.size, tokB.size, 1);
    }
    const THRESHOLD = 0.4;
    const results = memEntries.map((entry) => {
      const inLore = loreEntries.some((l) => overlaps(entry, l) >= THRESHOLD);
      const inSummary = summaryEntries.some((s) => overlaps(entry, s) >= THRESHOLD);
      return { entry, inLore, inSummary };
    });
    return {
      onlyInMemory: results.filter((r) => !r.inLore && !r.inSummary).map((r) => r.entry),
      inMemoryAndLore: results.filter((r) => r.inLore && !r.inSummary).map((r) => r.entry),
      inMemoryAndSummary: results.filter((r) => r.inSummary && !r.inLore).map((r) => r.entry),
      inAll: results.filter((r) => r.inLore && r.inSummary).map((r) => r.entry),
      loreSuggestions: results.filter((r) => !r.inLore && !r.inSummary).map((r) => r.entry).slice(0, 10)
    };
  }
  var init_comparison = __esm({
    "src/core/comparison.js"() {
      init_helpers();
    }
  });

  // src/app/bootstrap.js
  init_constants();
  init_storage();

  // src/ui/theme.js
  init_constants();
  init_storage();
  var LIGHT_CSS = `
/* \u2500\u2500 Light theme \u2014 GitHub-light palette \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   Override EVERY dark surface/text from styles.css.
   Uses CSS token layer so new components inherit correctly.
   \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */

/* Token layer \u2014 unified semantic tokens for light mode */
#pmt5-panel, #pmt5-fab {
  --pmt-bg        : #ffffff;
  --pmt-surface   : #f6f8fa;
  --pmt-surface-2 : #ffffff;
  --pmt-surface-3 : #eaeef2;
  --pmt-text      : #24292f;
  --pmt-text-muted: #57606a;
  --pmt-text-faint: #6e7681;
  --pmt-text-dim  : #8c959f;
  --pmt-text-bright: #1f2328;
  --pmt-border    : #d0d7de;
  --pmt-accent    : #0969da;
  --pmt-accent-hi : #0550ae;
  --pmt-focus     : #0969da;
  --pmt-success   : #1a7f37;
  --pmt-success-bg: #dafbe1;
  --pmt-warning   : #9a6700;
  --pmt-danger    : #cf222e;
  --pmt-danger-bg : #ffebe9;
  --pmt-gold      : #9a6700;
  --pmt-gold-dim  : #e3b34155;
  --pmt-purple    : #8250df;
  --pmt-chip-bg   : #eaeef2;
  --pmt-chip-text : #57606a;
}

/* \u2500\u2500 FAB \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-fab { background:#ffffff; color:#24292f; border-color:#d0d7de; }
#pmt5-fab:hover  { background:#f3f4f6; border-color:#8c959f; }
#pmt5-fab:active { background:#ebecf0; }

/* \u2500\u2500 Backdrop \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-backdrop { background:rgba(0,0,0,0.18); }

/* \u2500\u2500 Panel shell \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-panel { background:#ffffff; border-color:#d0d7de; box-shadow:0 8px 40px rgba(0,0,0,0.15); }

/* \u2500\u2500 Zone 1: Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-header    { background:#f6f8fa; border-bottom-color:#d0d7de; }
#pmt5-hdr-title { color:#24292f; }
#pmt5-ver       { color:#57606a; background:#eaeef2; border-color:#d0d7de; }
#pmt5-auto-badge { border-color:#d0d7de; background:#eaeef2; color:#57606a; }
#pmt5-auto-badge.connected  { color:#1a7f37; border-color:#aceebb; background:#dafbe1; }
#pmt5-auto-badge.windowed   { color:#0969da; border-color:#b6d4fb; background:#ddf4ff; }
#pmt5-verify-badge.verified  { color:#1a7f37; border-color:#aceebb; background:#dafbe1; }
#pmt5-verify-badge.mismatch  { color:#cf222e; border-color:#ffc1c0; background:#ffebe9; }
#pmt5-verify-badge.unverified{ color:#57606a; border-color:#d0d7de; background:#eaeef2; }
#pmt5-kbd   { color:#8c959f; }
#pmt5-close { color:#57606a; }
#pmt5-close:hover { background:rgba(207,34,46,0.08); color:#cf222e; }

/* \u2500\u2500 Recovery banner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-recovery-banner { background:#ffebe9; border-bottom-color:#ffc1c066; }
#pmt5-recovery-msg    { color:#cf222e; }
#pmt5-recovery-act    { color:#cf222e; border-color:#ffc1c0; }

/* \u2500\u2500 Zone 2: Workspace \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-workspace { border-bottom-color:#d0d7de; }
#pmt5-ta { background:#ffffff; color:#24292f; border-color:#d0d7de; }
#pmt5-ta:focus { border-color:#0969da; }
#pmt5-ta::placeholder { color:#8c959f; }

/* \u2500\u2500 Zone 3: Stats strip \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-stats { background:#f6f8fa; border-bottom-color:#d0d7de; }
.pmt5-stat  { background:#ffffff; border-color:#d0d7de; color:#57606a; }
.pmt5-stat b { color:#24292f; }

/* \u2500\u2500 Zone 4: Preset strip \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-presets      { background:#f6f8fa; border-bottom-color:#d0d7de; }
#pmt5-preset-label { color:#8c959f; }
.pmt5-preset-btn   { border-color:#d0d7de; color:#57606a; }
.pmt5-preset-btn:hover { border-color:#0969da; color:#0969da; background:#f6f8fa; }

/* \u2500\u2500 Zone 5: Options (collapsible) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-opts-toggle { background:#ffffff; border-bottom-color:#d0d7de; color:#57606a; }
#pmt5-opts-toggle b { color:#24292f; }
#pmt5-opts-toggle:hover { color:#24292f; }
#pmt5-opts-body   { border-bottom-color:#d0d7de; }
.pmt5-og          { background:#ffffff; border-color:#d0d7de; }
.pmt5-og-hd       { color:#8c959f; }
.pmt5-lbl         { color:#57606a; }
.pmt5-lbl:hover   { color:#24292f; }
.pmt5-lbl input[type=checkbox] { accent-color:#0969da; }
.pmt5-slider      { accent-color:#0969da; }
.pmt5-cv          { color:#0969da; }
.pmt5-sel, .pmt5-numbox {
  background:#ffffff; color:#24292f; border-color:#d0d7de;
}
.pmt5-sel:focus, .pmt5-numbox:focus { border-color:#0969da; }

/* \u2500\u2500 Zone 6: Primary actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-actions-primary  { background:#f6f8fa; border-bottom-color:#d0d7de; }
.pmt5-btn-secondary    { background:#ffffff; color:#24292f; border-color:#d0d7de; }
.pmt5-btn-recovery     { background:#ffffff; color:#57606a; border-color:#d0d7de; }
.pmt5-btn-secondary:hover:not(:disabled) { border-color:#8c959f; color:#24292f; }
.pmt5-btn-recovery:hover:not(:disabled)  { border-color:#8c959f; color:#24292f; }
#pmt5-undo             { color:#57606a; }
#pmt5-undo-lbl         { color:#8c959f; }
#pmt5-more-toggle      { color:#57606a; border-color:#d0d7de; background:transparent; }
#pmt5-more-toggle:hover { color:#24292f; border-color:#8c959f; }

/* \u2500\u2500 Zone 7: Secondary actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-actions-secondary { background:#f6f8fa; border-bottom-color:#d0d7de; }
.pmt5-btn-tool    { color:#57606a; border-color:#d0d7de; background:transparent; }
.pmt5-btn-tool:hover:not(:disabled) { color:#24292f; border-color:#8c959f; background:#ffffff; }
.pmt5-btn-tool.accent:hover:not(:disabled) { color:#0969da; border-color:#b6d4fb; }
.pmt5-btn-tool.lore:hover:not(:disabled)   { color:#9a6700; border-color:#e3b34155; }
.pmt5-btn-tool.qa:hover:not(:disabled)     { color:#6e40c9; border-color:#a371f755; }
.pmt5-btn-tool.danger:hover:not(:disabled) { color:#cf222e; border-color:#ffc1c0; }

/* \u2500\u2500 Progress rail \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-rail { background:#f6f8fa; }

/* \u2500\u2500 Zone 8: Tabs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-tabs    { background:#f6f8fa; border-bottom-color:#d0d7de; }
.pmt5-tab     { color:#57606a; }
.pmt5-tab:hover { color:#24292f; }
.pmt5-tab.pmt5-active { color:#0969da; border-bottom-color:#0969da; }
.pmt5-tab-badge { background:#eaeef2; color:#57606a; }
.pmt5-tab.pmt5-active .pmt5-tab-badge { background:#ddf4ff; color:#0969da; }
.pmt5-tab-badge.has-items { background:#ddf4ff; color:#0969da; }

/* \u2500\u2500 Zone 9: Output \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-search     { background:#f6f8fa; border-bottom-color:#d0d7de; }
#pmt5-search-in  { background:#ffffff; color:#24292f; border-color:#d0d7de; }
#pmt5-search-in:focus { border-color:#0969da; }
#pmt5-search-in::placeholder { color:#8c959f; }
#pmt5-search-count { color:#57606a; }
#pmt5-out-scroll { scrollbar-color:#d0d7de transparent; }
#pmt5-out     { color:#57606a; }
.pmt5-hint    { color:#8c959f; }
.pmt5-c-ok    { color:#1a7f37; }
.pmt5-c-warn  { color:#9a6700; }
.pmt5-c-kept  { color:#24292f; }
.pmt5-c-gone  { color:#cf222e; }
.pmt5-c-sep   { color:#d0d7de; }
.pmt5-c-hl    { background:rgba(9,105,218,0.10); color:#0969da; }

/* \u2500\u2500 Entry chips \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pmt5-chip      { background:#eaeef2; border-color:#d0d7de; color:#57606a; }
.pmt5-chip-pin  { background:#ddf4ff; border-color:#b6d4fb; color:#0969da; }
.pmt5-chip-prot { background:#fff8e1; border-color:#e3b34155; color:#9a6700; }
.pmt5-chip-hot  { background:#ffebe9; border-color:#ffc1c055; color:#cf222e; }
.pmt5-chip-cont-h { background:#dafbe1; border-color:#aceebb; color:#1a7f37; }
.pmt5-chip-cont-m { background:#fff8e1; border-color:#e3b34155; color:#9a6700; }
.pmt5-chip-lore { background:#f0ebff; border-color:#c5b0fd; color:#6e40c9; }
.pmt5-chip-tok  { background:#eaeef2; border-color:#d0d7de; color:#57606a; }
.pmt5-annot-badge { background:#9a6700; }
.pmt5-btn-micro { color:#57606a; }
.pmt5-btn-micro:hover { background:#eaeef2; color:#24292f; }

/* \u2500\u2500 Settings pane \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-settings          { scrollbar-color:#d0d7de transparent; }
.pmt5-stg-group         { border-bottom-color:#d0d7de; }
.pmt5-stg-group-title   { color:#8c959f; }
.pmt5-stg-row           { background:#ffffff; border-color:#d0d7de; }
.pmt5-stg-label         { color:#24292f; }
.pmt5-stg-sub           { color:#57606a; }
.pmt5-tog-track         { background:#d0d7de; border-color:#d0d7de; }
.pmt5-tog input:checked + .pmt5-tog-track { background:#d4f0dc; border-color:#1a7f37; }
.pmt5-tog-thumb         { background:#8c959f; }
.pmt5-tog input:checked ~ .pmt5-tog-thumb { background:#1a7f37; }
.pmt5-stg-sel           { background:#ffffff; color:#24292f; border-color:#d0d7de; }
.pmt5-stg-sel:focus     { border-color:#0969da; }
.pmt5-stg-sel option    { background:#ffffff; color:#24292f; }
#pmt5-custom-css-area   { background:#f6f8fa; border-color:#d0d7de; }
#pmt5-import-file-btn   { background:#eaeef2; color:#24292f; border-color:#d0d7de; }
#pmt5-import-file-btn:hover { background:#dce1e7; border-color:#8c959f; }
.pmt5-css-hint          { color:#57606a; }
.pmt5-css-hint code     { background:#eaeef2; color:#24292f; }
#pmt5-custom-css-ta     { background:#ffffff; color:#24292f; border-color:#d0d7de; }
#pmt5-custom-css-ta:focus { border-color:#0969da; }
#pmt5-custom-css-ta::placeholder { color:#8c959f; }
#pmt5-stg-reset         { color:#cf222e; border-color:#cf222e66; }
#pmt5-stg-reset:hover   { background:rgba(207,34,46,0.08); }

/* \u2500\u2500 Diagnostics drawer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-diag-drawer { background:#f6f8fa; border-top-color:#d0d7de; color:#57606a; }
.pmt5-diag-key    { color:#8c959f; }
.pmt5-diag-val    { color:#24292f; }

/* \u2500\u2500 Compare area \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-compare-area textarea { background:#ffffff; color:#24292f; border-color:#d0d7de; }
#pmt5-compare-area textarea:focus { border-color:#0969da; }

/* \u2500\u2500 Onboarding banner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pmt5-onboard-inner { background:#f6f8fa; border-bottom-color:#d0d7de; color:#24292f; }
#pmt5-onboard code  { background:#eaeef2; }
#pmt5-onboard-close { color:#57606a; }

/* \u2500\u2500 Status bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-status     { background:#f6f8fa; border-top-color:#d0d7de; }
#pmt5-status-msg { color:#57606a; }
#pmt5-status-msg.pmt5-ok   { color:#1a7f37; }
#pmt5-status-msg.pmt5-warn { color:#9a6700; }
#pmt5-status-msg.pmt5-err  { color:#cf222e; }
#pmt5-undo-label { color:#8c959f; }

/* \u2500\u2500 Easter egg \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-egg       { background:#ffffff; }
#pmt5-egg-title { color:#cf222e; }
#pmt5-egg-msg   { color:#57606a; }
#pmt5-egg-close { background:#f6f8fa; color:#24292f; border-color:#d0d7de; }
#pmt5-egg-close:hover { background:#ebecf0; }

/* \u2500\u2500 select <option> elements (system-rendered, need explicit colors) \u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pmt5-sel option, .pmt5-stg-sel option { background:#ffffff; color:#24292f; }
/* Mode badge \u2014 light theme */
#pmt5-mode-badge[data-mode="daily"]    { color:#1a7f37; border-color:#aceebb; background:#dafbe1; }
#pmt5-mode-badge[data-mode="advanced"] { color:#9a6700; border-color:#e3b34155; background:#fff8e1; }
#pmt5-mode-badge[data-mode="debug"]    { color:#cf222e; border-color:#ffc1c0; background:#ffebe9; }

/* \u2500\u2500 BUG-15 fix: Q&A popup light theme (was entirely hardcoded dark) \u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pmt5-qa-badge.remote { background:#dafbe1; color:#1a7f37; }
.pmt5-qa-ask          { background:#0969da; }

/* \u2500\u2500 BUG-14 fix: Primary action buttons missing from light theme \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* Trim, Apply, Copy all stayed dark-themed in light mode */
.pmt5-btn-primary { background:#1a7f37; color:#ffffff; }
.pmt5-btn-primary:hover:not(:disabled) { filter:brightness(1.1); }
.pmt5-btn-caution { background:#dafbe1; color:#1a7f37; border-color:#aceebb; }
.pmt5-btn-caution:hover:not(:disabled) { border-color:#1a7f37; filter:brightness(0.97); }
.pmt5-btn-neutral { background:#0969da; color:#ffffff; }
.pmt5-btn-neutral:hover:not(:disabled) { filter:brightness(1.1); }

/* \u2500\u2500 BUG-17 fix: 5 selectors absent from light theme \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pmt5-entry-pinned .pmt5-btn-micro     { color:#0969da; }
.pmt5-entry-sel                        { accent-color:#0969da; }
.pmt5-stat.pmt5-warn b                 { color:#9a6700; }
#pmt5-apply-css                        { background:#1a7f37; }
#pmt5-clear-css                        { color:#cf222e; border-color:#cf222e66; }
#pmt5-clear-css:hover                  { background:rgba(207,34,46,0.08); }
#pmt5-out-scroll::-webkit-scrollbar-thumb { background:#d0d7de; }

/* \u2500\u2500 BUG-13 fix: post-trim-hint light override \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pmt5-post-trim-hint { color:#0969da; background:#ddf4ff; border-top-color:#d0d7de; }

/* \u2500\u2500 Snapshot browser \u2014 light theme \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pmt5-snap-row           { background:#ffffff; border-color:#d0d7de; }
.pmt5-snap-row:hover     { border-color:#0969da; }
.pmt5-snap-label         { color:#24292f; }
.pmt5-snap-meta          { color:#57606a; }
.pmt5-snap-btn           { color:#57606a; border-color:#d0d7de; }
.pmt5-snap-btn:hover     { color:#24292f; border-color:#0969da; }
.pmt5-snap-load:hover    { color:#1a7f37; border-color:#1a7f37; }
.pmt5-snap-btn.danger:hover { color:#cf222e; border-color:#cf222e; }

/* ── Systematic parity pass — all remaining literal-colour gaps ─────────── */
#pmt5-onboard .pmt5-onboard-inner  { background:#f6f8fa; border-color:#d0d7de; }
#pmt5-onboard code                 { background:#eaeef2; }
.pmt5-stat b                       { color:#24292f; }
.pmt5-stat.pmt5-warn b             { color:#bc4c00; }
#pmt5-opts-toggle b                { color:#57606a; }
#pmt5-budget-og                    { border-color:#0969da44; }
#pmt5-budget-og .pmt5-og-hd        { color:#0969dabb; }
.pmt5-btn-tool.danger:hover:not(:disabled)  { color:#cf222e; border-color:#cf222e66; }
.pmt5-btn-tool.accent:hover:not(:disabled)  { border-color:#0969da55; }
.pmt5-btn-tool.lore:hover:not(:disabled)    { color:#9a6700; border-color:#e3b34155; }
.pmt5-btn-tool.qa:hover:not(:disabled)      { color:#8250df; border-color:#a371f755; }
#pmt5-fill                         { background: linear-gradient(90deg,#1a7f37,#0969da); }
.pmt5-tab.pmt5-active .pmt5-tab-badge       { background:#ddf4ff; color:#0969da; }
.pmt5-tab-badge.has-items          { background:#ddf4ff; color:#0969da; }
.pmt5-entry-pinned .pmt5-btn-micro { color:#0969da; }
.pmt5-tog input:checked + .pmt5-tog-track   { background:#dafbe1; border-color:#1a7f37; }
.pmt5-tog input:checked ~ .pmt5-tog-thumb   { background:#1a7f37; }
#pmt5-compare-area textarea        { background:#f6f8fa; color:#24292f; border-color:#d0d7de; }
#pmt5-compare-area textarea:focus  { border-color:#0969da; }
#pmt5-ta[style*="borderColor: rgb(240, 136, 62)"],
#pmt5-ta[style*="border-color: #f0883e"]    { box-shadow: 0 0 0 2px rgba(207,97,26,.18); }
.pmt5-warn-inline                  { color:#bc4c00; }
#pmt5-mode-badge                   { background:#eaeef2; color:#57606a; border-color:#d0d7de; }
.pmt5-btn-tool[data-maturity="experimental"]::after { color:#bc4c00; }
.pmt5-snap-row.pmt5-snap-starred   { border-color:#9a670055; background:#fffbdd; }
.pmt5-snap-starred .pmt5-snap-star { color:#9a6700; border-color:#e3b34155; }
#pmt5-auto-badge.connected         { color:#1a7f37; border-color:#aceebb; background:#dafbe1; }
#pmt5-auto-badge.windowed          { color:#0969da; border-color:#b6d4fb; background:#ddf4ff; }
.pmt5-bubble-overlay               { background: rgba(0,0,0,0.45); }
#pmt5-qa-popup                     { box-shadow: 0 8px 40px rgba(0,0,0,.18); }
.pmt5-sub-nav-btn.pmt5-sub-active  { background: rgba(9,105,218,.08); }
`;
  var lightStyleEl = null;
  var customStyleEl = null;
  function applyTheme(theme) {
    lightStyleEl == null ? void 0 : lightStyleEl.remove();
    lightStyleEl = null;
    customStyleEl == null ? void 0 : customStyleEl.remove();
    customStyleEl = null;
    if (theme === "light") {
      lightStyleEl = document.createElement("style");
      lightStyleEl.id = `${NS}-light-theme`;
      lightStyleEl.textContent = LIGHT_CSS;
      document.head.appendChild(lightStyleEl);
    } else if (theme === "custom") {
      const css = store.get(CUSTOM_CSS_KEY);
      if (css && css.trim()) {
        customStyleEl = document.createElement("style");
        customStyleEl.id = `${NS}-custom-theme`;
        customStyleEl.textContent = css;
        document.head.appendChild(customStyleEl);
      }
    }
  }

  // src/ui/drag.js
  init_constants();
  function makeDraggable(element, handle, onMoved) {
    let startX, startY, startL, startT;
    let active = false;
    let dragged = false;
    let suppressNextClick = false;
    handle.addEventListener("pointerdown", function onPointerDown(e) {
      if (e.button !== 0) return;
      suppressNextClick = false;
      handle.setPointerCapture(e.pointerId);
      const r = element.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startL = r.left;
      startT = r.top;
      active = true;
      dragged = false;
    });
    handle.addEventListener("pointermove", function onPointerMove(e) {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!dragged) {
        if (Math.hypot(dx, dy) < DRAG_PX) return;
        dragged = true;
        handle.style.cursor = "grabbing";
        element.style.transform = "none";
        element.style.right = "auto";
        element.style.bottom = "auto";
        element.style.left = startL + "px";
        element.style.top = startT + "px";
        element.classList.remove(`${NS}-open-anim`);
      }
      const maxL = window.innerWidth - element.offsetWidth;
      const maxT = window.innerHeight - element.offsetHeight;
      element.style.left = Math.max(0, Math.min(maxL, startL + dx)) + "px";
      element.style.top = Math.max(0, Math.min(maxT, startT + dy)) + "px";
    });
    function endDrag() {
      if (!active) return;
      active = false;
      handle.style.cursor = "";
      if (dragged) {
        dragged = false;
        suppressNextClick = true;
        if (typeof onMoved === "function") {
          onMoved({ left: element.style.left, top: element.style.top });
        }
      }
    }
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
    handle.addEventListener("click", function onClickCapture(e) {
      if (suppressNextClick) {
        suppressNextClick = false;
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);
  }

  // src/utils/dom.js
  init_constants();
  function restorePosition(el, pos, addPositionedClass) {
    if (!(pos == null ? void 0 : pos.left) || !(pos == null ? void 0 : pos.top)) return false;
    el.style.left = pos.left;
    el.style.top = pos.top;
    el.style.right = "auto";
    el.style.bottom = "auto";
    if (addPositionedClass) el.classList.add(`${NS}-positioned`);
    return true;
  }

  // src/ui/panel.js
  init_constants();
  init_storage();
  init_defaults();

  // src/core/parse.js
  function parseEntries(raw) {
    return raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  }
  function countDups(entries) {
    const seen = /* @__PURE__ */ new Set();
    let n = 0;
    for (const e of entries) {
      seen.has(e) ? n++ : seen.add(e);
    }
    return n;
  }

  // src/core/tokens.js
  function estTokens(text) {
    return getNativeTokenCount(text);
  }

  // src/core/trim.js
  init_helpers();
  function runTrim(entries, opts) {
    const {
      charLimit,
      keepN,
      trimLong,
      dedup,
      trimMode = "newest",
      targetTokens = 0,
      protectedEntryIds = /* @__PURE__ */ new Set(),
      getEntryId: getEntryId2 = null,
      continuityScores = null
    } = opts;
    let work = entries.map((text, origIdx) => ({ text, origIdx }));
    const byDedup = [];
    if (dedup) {
      const seen = /* @__PURE__ */ new Set();
      const next = [];
      for (const rec of work) {
        if (seen.has(rec.text)) {
          byDedup.push(rec.text);
        } else {
          seen.add(rec.text);
          next.push(rec);
        }
      }
      work = next;
    }
    const byLong = [];
    if (trimLong) {
      const limit = Math.max(1, parseInt(charLimit, 10) || 200);
      const next = [];
      for (const rec of work) {
        const id = getEntryId2 ? getEntryId2(rec.text) : null;
        const protected_ = id && protectedEntryIds.has(id);
        if (!protected_ && rec.text.length > limit) byLong.push(rec.text);
        else next.push(rec);
      }
      work = next;
    }
    const byAge = [];
    if (trimMode === "token_budget" && targetTokens > 0) {
      const result = _tokenBudgetTrim(work, { targetTokens, protectedEntryIds, getEntryId: getEntryId2, continuityScores });
      const removed2 = result.removed.map((r) => r.text);
      byAge.push(...removed2);
      work = result.kept;
    } else {
      const n = parseInt(keepN, 10);
      if (!isNaN(n) && n > 0 && work.length > n) {
        if (getEntryId2 && protectedEntryIds.size > 0) {
          const pinned = work.filter((r) => protectedEntryIds.has(getEntryId2(r.text)));
          const unpinned = work.filter((r) => !protectedEntryIds.has(getEntryId2(r.text)));
          const keepCount = Math.max(0, n - pinned.length);
          const trimmed = unpinned.slice(0, unpinned.length - keepCount);
          byAge.push(...trimmed.map((r) => r.text));
          const kept2 = [...pinned, ...unpinned.slice(unpinned.length - keepCount)];
          kept2.sort((a, b) => a.origIdx - b.origIdx);
          work = kept2;
        } else {
          const trimmed = work.splice(0, work.length - n);
          byAge.push(...trimmed.map((r) => r.text));
        }
      }
    }
    const kept = work.map((r) => r.text);
    const removed = [...byDedup, ...byLong, ...byAge];
    const originalCount = entries.length;
    const finalCount = kept.length;
    let overBudgetPinWarning = false;
    if (trimMode === "token_budget" && targetTokens > 0 && getEntryId2) {
      const pinnedKept = kept.filter((e) => protectedEntryIds.has(getEntryId2(e)));
      const pinnedTok = getNativeTokenCount(pinnedKept.join("\n\n"));
      overBudgetPinWarning = pinnedTok > targetTokens;
    }
    return {
      kept,
      removed,
      byDedup,
      byLong,
      byAge,
      originalCount,
      finalCount,
      totalRemoved: removed.length,
      keptPct: originalCount > 0 ? Math.round(finalCount / originalCount * 100) : 100,
      overBudgetPinWarning,
      trimMode
    };
  }
  function _tokenBudgetTrim(records, { targetTokens, protectedEntryIds, getEntryId: getEntryId2, continuityScores }) {
    const scoreMap = /* @__PURE__ */ new Map();
    if (continuityScores) {
      continuityScores.forEach(({ entryId, score }) => scoreMap.set(entryId, score));
    }
    const pinned = records.filter((r) => getEntryId2 && protectedEntryIds.has(getEntryId2(r.text)));
    const unpinned = records.filter((r) => !getEntryId2 || !protectedEntryIds.has(getEntryId2(r.text)));
    if (continuityScores && getEntryId2) {
      unpinned.sort((a, b) => {
        var _a, _b;
        const sa = (_a = scoreMap.get(getEntryId2(a.text))) != null ? _a : 0;
        const sb = (_b = scoreMap.get(getEntryId2(b.text))) != null ? _b : 0;
        return sa - sb;
      });
    }
    const kept = [...pinned];
    const removed = [];
    const sortedUnpinned = [...unpinned].reverse();
    for (const rec of sortedUnpinned) {
      const candidate = [...kept, rec];
      const tokens = getNativeTokenCount(candidate.map((r) => r.text).join("\n\n"));
      if (tokens <= targetTokens) {
        kept.push(rec);
      } else {
        removed.unshift(rec);
      }
    }
    kept.sort((a, b) => a.origIdx - b.origIdx);
    removed.sort((a, b) => a.origIdx - b.origIdx);
    return { kept, removed };
  }

  // src/utils/clipboard.js
  async function writeClipboard(text) {
    var _a;
    if ((_a = navigator.clipboard) == null ? void 0 : _a.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    Object.assign(ta.style, {
      position: "fixed",
      top: "-9999px",
      left: "-9999px",
      opacity: "0",
      pointerEvents: "none"
    });
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (!ok) throw new Error('execCommand("copy") returned false');
  }

  // src/utils/html.js
  function escHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
  }
  function escRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // src/core/explain.js
  function explainRemoval(entry, trimResult2) {
    var _a, _b, _c;
    if ((_a = trimResult2.byDedup) == null ? void 0 : _a.includes(entry))
      return "Removed: duplicate of an earlier identical entry.";
    if ((_b = trimResult2.byLong) == null ? void 0 : _b.includes(entry))
      return `Removed: entry exceeds the character limit (${entry.length} chars).`;
    if ((_c = trimResult2.byAge) == null ? void 0 : _c.includes(entry))
      return "Removed: older entry trimmed to fit keep-newest or token-budget limit.";
    return "Removed during trim.";
  }
  function explainNearDup(similarity, reasons = []) {
    const pct = Math.round(similarity * 100);
    const base = `Near-duplicate cluster (${pct}% overlap).`;
    if (reasons.length) return `${base} Reason: ${reasons[0]}.`;
    return base;
  }
  function explainConflict(conflict) {
    var _a, _b;
    const sev = conflict.severity === "high" ? "High-confidence" : "Possible";
    const r = (_b = (_a = conflict.reasons) == null ? void 0 : _a[0]) != null ? _b : "opposing descriptors found";
    return `${sev} conflict: ${r}. Review both entries before applying.`;
  }
  function confidenceLabel(label) {
    var _a;
    const map = {
      high: { text: "High confidence", note: "Strong signal from multiple indicators." },
      medium: { text: "Medium confidence", note: "Moderate signal \u2014 review recommended." },
      low: { text: "Low confidence", note: "Heuristic estimate \u2014 treat as a hint." }
    };
    return (_a = map[label]) != null ? _a : { text: "Uncertain", note: "Insufficient signal to judge reliably." };
  }
  function explainHealth(health) {
    const { score, label, reasons, suggestions } = health;
    const conf = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
    const c = confidenceLabel(conf);
    const parts = [`Memory Health: ${label} (${score}/100). ${c.note}`];
    if (reasons == null ? void 0 : reasons.length) parts.push(`Issues: ${reasons.slice(0, 2).join("; ")}.`);
    if (suggestions == null ? void 0 : suggestions.length) parts.push(`Suggested: ${suggestions[0]}.`);
    return parts.join(" ");
  }

  // src/ui/render.js
  init_helpers();
  function highlight(raw, q2, ns = "pmt5") {
    if (!q2) return escHtml(raw);
    const re = new RegExp(escRegex(q2), "gi");
    let out = "", last = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(raw)) !== null) {
      out += escHtml(raw.slice(last, m.index));
      out += `<mark class="${ns}-c-hl">${escHtml(m[0])}</mark>`;
      last = m.index + m[0].length;
      if (m[0].length === 0) re.lastIndex++;
    }
    return out + escHtml(raw.slice(last));
  }
  function buildChips(opts, ns) {
    const chips = [];
    const { isPinned: isPinned2, isProtected, isHotspot, showTokens, continuityLabel, loreLabel, entryText, hasAnnotation } = opts;
    if (isPinned2) chips.push(`<span class="${ns}-chip ${ns}-chip-pin" title="Pinned \u2014 protected from removal">\u{1F4CC}</span>`);
    if (isProtected && !isPinned2) chips.push(`<span class="${ns}-chip ${ns}-chip-prot" title="Session-protected">\u{1F512}</span>`);
    if (isHotspot) chips.push(`<span class="${ns}-chip ${ns}-chip-hot" title="Involved in repetition hotspot">\u{1F525}</span>`);
    if (loreLabel) chips.push(`<span class="${ns}-chip ${ns}-chip-lore" title="Continuity label: ${escHtml(loreLabel)}">${escHtml(loreLabel)}</span>`);
    if (hasAnnotation) chips.push(`<span class="${ns}-annot-badge" title="Has annotation note">\u{1F4DD}</span>`);
    if (continuityLabel === "high")
      chips.push(`<span class="${ns}-chip ${ns}-chip-cont-h" title="High continuity importance">\u2605</span>`);
    else if (continuityLabel === "medium")
      chips.push(`<span class="${ns}-chip ${ns}-chip-cont-m" title="Medium continuity importance">\u25C6</span>`);
    if (showTokens && entryText) {
      const tok = getNativeTokenCount(entryText);
      chips.push(`<span class="${ns}-chip ${ns}-chip-tok" title="${tok} tokens">${tok}t</span>`);
    }
    return chips.join("");
  }
  function renderResultTab({
    outEl,
    searchCt,
    entries,
    filterQ: filterQ2,
    ns = "pmt5",
    selectedIds: selectedIds2 = /* @__PURE__ */ new Set(),
    pinnedIds = /* @__PURE__ */ new Set(),
    protectedIds = /* @__PURE__ */ new Set(),
    hotspotEntryIds = /* @__PURE__ */ new Set(),
    continuityMap: continuityMap2 = {},
    loreLabels: loreLabels2 = {},
    getEntryId: getEntryId2 = null,
    showPerEntryTokens = false,
    onSelect = null,
    onPinToggle = null,
    annotations = null
  }) {
    const q2 = filterQ2.toLowerCase().trim();
    if (!entries.length) {
      outEl.innerHTML = `<span class="${ns}-hint">No result yet \u2014 paste memory text above and click Trim.</span>`;
      searchCt.textContent = "";
      return;
    }
    let matched = 0;
    const parts = entries.map((entry) => {
      var _a, _b, _c;
      const visible = !q2 || entry.toLowerCase().includes(q2);
      if (visible) matched++;
      const entryId = getEntryId2 ? getEntryId2(entry) : null;
      const isPinned2 = entryId ? pinnedIds.has(entryId) : false;
      const isProt = entryId ? protectedIds.has(entryId) : false;
      const isHot = entryId ? hotspotEntryIds.has(entryId) : false;
      const isSel = entryId ? selectedIds2.has(entryId) : false;
      const contInfo = entryId ? (_a = continuityMap2[entryId]) != null ? _a : {} : {};
      const loreLabel = entryId ? (_b = loreLabels2[entryId]) != null ? _b : "" : "";
      const chips = buildChips({
        isPinned: isPinned2,
        isProtected: isProt,
        isHotspot: isHot,
        showTokens: showPerEntryTokens,
        continuityLabel: (_c = contInfo.label) != null ? _c : "",
        loreLabel,
        entryText: entry,
        hasAnnotation: !!(annotations && annotations[entryId])
      }, ns);
      const selAttr = entryId && onSelect ? `data-entry-id="${escHtml(entryId)}"` : "";
      const pinAttr = entryId && onPinToggle ? `data-pin-id="${escHtml(entryId)}"` : "";
      const selChk = entryId && onSelect ? `<input type="checkbox" class="${ns}-entry-sel" ${selAttr} ${isSel ? "checked" : ""} aria-label="Select entry">` : "";
      const pinBtn = entryId && onPinToggle ? `<button class="${ns}-entry-pin ${ns}-btn-micro" ${pinAttr} title="${isPinned2 ? "Unpin" : "Pin"} this entry">${isPinned2 ? "\u{1F4CC}" : "\u{1F4CE}"}</button>` : "";
      const controls = selChk || pinBtn ? `<span class="${ns}-entry-controls">${selChk}${pinBtn}</span>` : "";
      const entryIdx = entries.indexOf(entry);
      const entryClass = `${ns}-c-kept ${ns}-entry${isPinned2 ? ` ${ns}-entry-pinned` : ""}`;
      const visStyle = visible ? "" : ' style="display:none"';
      return `<span class="${entryClass}"${visStyle} data-entry-idx="${entryIdx}">${controls}${chips ? `<span class="${ns}-chips">${chips}</span>` : ""}<span class="${ns}-entry-text">${highlight(entry, q2, ns)}</span></span>`;
    });
    outEl.innerHTML = parts.join(`<span class="${ns}-c-sep">

</span>`);
    searchCt.textContent = q2 ? `${matched} of ${entries.length}` : `${entries.length} entries`;
    if (onSelect) {
      outEl.querySelectorAll(`.${ns}-entry-sel`).forEach((cb) => {
        cb.addEventListener("change", (e) => {
          const id = e.target.dataset.entryId;
          if (id) onSelect(id, e.target.checked);
        });
      });
    }
    if (onPinToggle) {
      outEl.querySelectorAll(`.${ns}-entry-pin`).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const id = e.currentTarget.dataset.pinId;
          if (id) onPinToggle(id);
        });
      });
    }
  }
  function renderRemovedTab({ outEl, searchCt, entries, filterQ: filterQ2, ns = "pmt5", trimResult: trimResult2 = null }) {
    const q2 = filterQ2.toLowerCase().trim();
    if (!entries.length) {
      outEl.innerHTML = `<span class="${ns}-hint">No entries were removed in the last trim.</span>`;
      searchCt.textContent = "";
      return;
    }
    let matched = 0;
    const parts = entries.map((entry) => {
      const visible = !q2 || entry.toLowerCase().includes(q2);
      if (visible) matched++;
      const _reason = trimResult2 ? explainRemoval(entry, trimResult2) : "";
      const _rsn = _reason ? `<span style="font-size:10px;opacity:0.55;display:block;padding-top:1px">${escHtml(_reason)}</span>` : "";
      return `<span class="${ns}-c-gone ${ns}-entry" ${visible ? "" : 'style="display:none"'}>${highlight(entry, q2, ns)}${_rsn}</span>`;
    });
    outEl.innerHTML = parts.join(`<span class="${ns}-c-sep">

</span>`);
    searchCt.textContent = q2 ? `${matched} of ${entries.length}` : `${entries.length} entries`;
  }
  function renderPreviewTab({ outEl, outScroll, trimResult: trimResult2, ns = "pmt5" }) {
    if (!trimResult2) {
      outEl.innerHTML = `<span class="${ns}-hint">Run Trim first to see a diff preview.</span>`;
      return;
    }
    const r = trimResult2;
    const lines = [
      `<span class="${ns}-c-ok">Kept ${r.finalCount} entries (${r.keptPct}%)</span>`,
      `<span class="${ns}-c-warn">Removed ${r.totalRemoved} entries</span>`,
      r.trimMode === "token_budget" ? `<span class="${ns}-c-ok">Mode: token-budget</span>` : "",
      r.overBudgetPinWarning ? `<span class="${ns}-c-warn">\u26A0 Pinned entries alone exceed the token budget</span>` : "",
      `<span class="${ns}-c-sep">${"\u2500".repeat(46)}</span>`,
      "",
      ...r.kept.map((e) => `<span class="${ns}-c-kept">  ${escHtml(e)}</span>`)
    ].filter((l) => l !== null);
    if (r.removed.length) {
      lines.push("", `<span class="${ns}-c-sep">${"\u2500".repeat(46)}</span>`, "");
      r.removed.forEach((e) => lines.push(`<span class="${ns}-c-gone">  ${escHtml(e)}</span>`));
    }
    outEl.innerHTML = lines.join("\n");
    outScroll.scrollTop = 0;
  }
  function renderHealthTab({ outEl, healthResult: healthResult2, ns = "pmt5" }) {
    var _a;
    if (!healthResult2) {
      outEl.innerHTML = `<span class="${ns}-hint">Run Trim first to see health metrics.</span>`;
      return;
    }
    const h = healthResult2;
    const labelColor = (_a = {
      healthy: "ok",
      "needs review": "warn",
      bloated: "warn",
      "high risk": "err"
    }[h.label]) != null ? _a : "";
    const lines = [
      `<span class="${ns}-c-${labelColor || "kept"}"><b>Health: ${h.label.toUpperCase()}</b> (score ${h.score}/100)</span>`,
      `<span class="${ns}-c-kept">Tokens: ${h.totalTokens}${h.budget ? ` / ${h.budget} budget` : ""}</span>`,
      `<span class="${ns}-c-kept">Repetition hotspots: ${h.hotspotCount}</span>`,
      "",
      `<span class="${ns}-c-sep">${"\u2500".repeat(46)}</span>`,
      `<span class="${ns}-c-warn">Issues:</span>`,
      ...h.reasons.map((r) => `<span class="${ns}-c-warn">  \xB7 ${escHtml(r)}</span>`)
    ];
    if (h.suggestions.length) {
      lines.push("", `<span class="${ns}-c-ok">Suggestions:</span>`);
      h.suggestions.forEach((s) => lines.push(`<span class="${ns}-c-ok">  \u2192 ${escHtml(s)}</span>`));
    }
    outEl.innerHTML = lines.join("\n");
  }
  function renderDupsTab({ outEl, clusters, ns = "pmt5" }) {
    if (!clusters || !clusters.length) {
      outEl.innerHTML = `<span class="${ns}-hint">No near-duplicate clusters found.</span>`;
      return;
    }
    const lines = [
      `<span class="${ns}-c-warn">${clusters.length} near-duplicate cluster${clusters.length !== 1 ? "s" : ""} found:</span>`,
      ""
    ];
    clusters.forEach((cluster, i) => {
      lines.push(`<span class="${ns}-c-sep">\u2500\u2500 Cluster ${i + 1} (${Math.round(cluster.maxSimilarity * 100)}% similar) \u2500\u2500</span>`);
      cluster.entries.forEach((e, j) => {
        lines.push(`<span class="${ns}-c-${j === 0 ? "kept" : "gone"}">  ${j === 0 ? "\u2713" : "~"} ${escHtml(e)}</span>`);
      });
      lines.push("");
    });
    outEl.innerHTML = lines.join("\n");
  }

  // src/ui/settings.js
  function mkToggleRow(ns, id, label, sub, checked) {
    return `
    <div class="${ns}-stg-row">
      <div>
        <div class="${ns}-stg-label">${label}</div>
        <div class="${ns}-stg-sub">${sub}</div>
      </div>
      <label class="${ns}-tog">
        <input type="checkbox" id="${ns}-${id}" ${checked ? "checked" : ""}>
        <div class="${ns}-tog-track"></div>
        <div class="${ns}-tog-thumb"></div>
      </label>
    </div>`;
  }
  function mkThemeRow(ns, currentTheme, customCss = "") {
    return `
    <div class="${ns}-stg-row">
      <div>
        <div class="${ns}-stg-label">Theme</div>
        <div class="${ns}-stg-sub">Color theme for the tool interface</div>
      </div>
      <select id="${ns}-stg-theme" class="${ns}-stg-sel">
        <option value="dark"   ${currentTheme === "dark" ? "selected" : ""}>Dark</option>
        <option value="light"  ${currentTheme === "light" ? "selected" : ""}>Light</option>
        <option value="custom" ${currentTheme === "custom" ? "selected" : ""}>Custom CSS\u2026</option>
      </select>
    </div>
    <div id="${ns}-custom-css-area" class="${currentTheme !== "custom" ? ns + "-hidden" : ""}">
      <div class="${ns}-css-row">
        <button id="${ns}-import-file-btn">Import .css file</button>
        <input type="file" id="${ns}-import-file" accept=".css,.txt" style="display:none;position:absolute;opacity:0;pointer-events:none">
        <span class="${ns}-css-hint">Target <code>#${ns}-panel</code> and <code>#${ns}-fab</code> to style the tool.</span>
      </div>
      <textarea id="${ns}-custom-css-ta" placeholder="Paste your CSS here, or use the file importer above\u2026" spellcheck="false">${customCss}</textarea>
      <div class="${ns}-css-footer">
        <button id="${ns}-apply-css">Apply</button>
        <button id="${ns}-clear-css">Clear custom CSS</button>
      </div>
    </div>`;
  }
  function mkGroupRow(ns, title, rows) {
    return `<div class="${ns}-stg-group">
    <div class="${ns}-stg-group-title">${title}</div>
    ${rows.join("")}
  </div>`;
  }

  // src/ui/panel.js
  init_helpers();
  init_repetition();

  // src/core/snapshot.js
  init_storage();
  init_helpers();
  var SNAPSHOT_KEY_PREFIX = "pmt5_snaps_";
  var MAX_UNSTARRED = 20;
  var SCHEMA_VERSION2 = 1;
  function snapKey(scopeId) {
    return `${SNAPSHOT_KEY_PREFIX}${scopeId}`;
  }
  function loadSnaps(scopeId) {
    var _a;
    return (_a = store.get(snapKey(scopeId))) != null ? _a : [];
  }
  function saveSnaps(scopeId, snaps) {
    store.set(snapKey(scopeId), snaps);
  }
  function saveSnapshot(scopeId, rawText, label = "") {
    const entries = normalizeEntries(rawText);
    const normalized = serializeEntries(entries);
    const tokens = getNativeTokenCount(rawText);
    const snap = {
      schemaVersion: SCHEMA_VERSION2,
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      scopeId,
      createdAt: Date.now(),
      label: label || (/* @__PURE__ */ new Date()).toLocaleString(),
      starred: false,
      stats: { entries: entries.length, chars: rawText.length, tokens },
      content: { raw: rawText, normalized }
    };
    let snaps = loadSnaps(scopeId);
    snaps.push(snap);
    const starred = snaps.filter((s) => s.starred);
    const unstarred = snaps.filter((s) => !s.starred);
    const pruned = unstarred.slice(-MAX_UNSTARRED);
    snaps = [...starred, ...pruned].sort((a, b) => a.createdAt - b.createdAt);
    saveSnaps(scopeId, snaps);
    return snap;
  }
  function listSnapshots(scopeId) {
    return [...loadSnaps(scopeId)].reverse();
  }
  function getLastSnapshot(scopeId) {
    const snaps = loadSnaps(scopeId);
    return snaps.length ? snaps[snaps.length - 1] : null;
  }
  function deleteSnapshot(scopeId, snapId) {
    const snaps = loadSnaps(scopeId).filter((s) => s.id !== snapId);
    saveSnaps(scopeId, snaps);
  }
  function toggleStarSnapshot(scopeId, snapId) {
    const snaps = loadSnaps(scopeId).map(
      (s) => s.id === snapId ? { ...s, starred: !s.starred } : s
    );
    saveSnaps(scopeId, snaps);
  }
  function exportSnapshots(scopeId) {
    return JSON.stringify({ schemaVersion: SCHEMA_VERSION2, scopeId, snapshots: loadSnaps(scopeId) }, null, 2);
  }

  // src/core/export.js
  init_helpers();
  init_helpers();
  function exportWorkspaceFiles({ keptEntries = [], removedEntries: removedEntries2 = [], scopeLabel = "pmt" } = {}) {
    const kept = serializeEntries(keptEntries);
    const removed = serializeEntries(removedEntries2);
    return { kept, removed };
  }
  function downloadKept(keptEntries, scopeLabel = "pmt") {
    const { kept } = exportWorkspaceFiles({ keptEntries });
    downloadText(`${scopeLabel}-kept.txt`, kept);
  }
  function downloadRemoved(removedEntries2, scopeLabel = "pmt") {
    const { removed } = exportWorkspaceFiles({ removedEntries: removedEntries2 });
    downloadText(`${scopeLabel}-removed.txt`, removed);
  }

  // src/core/pins.js
  init_storage();
  var PIN_KEY_PREFIX = "pmt5_pins_";
  function pinKey(scopeId) {
    return `${PIN_KEY_PREFIX}${scopeId}`;
  }
  function loadPins(scopeId) {
    var _a;
    return (_a = store.get(pinKey(scopeId))) != null ? _a : {};
  }
  function savePins(scopeId, pins) {
    store.set(pinKey(scopeId), pins);
  }
  function togglePin(scopeId, entryId, label = "") {
    const pins = loadPins(scopeId);
    if (pins[entryId]) {
      delete pins[entryId];
      savePins(scopeId, pins);
      return false;
    }
    pins[entryId] = { label, createdAt: Date.now(), policy: "protect" };
    savePins(scopeId, pins);
    return true;
  }
  function getPinnedIds(scopeId) {
    return new Set(Object.keys(loadPins(scopeId)));
  }

  // src/core/continuity.js
  var HIGH_SIGNAL_RE = /\b(relationship|loves?|hates?|married|sister|brother|father|mother|family|friend|enemy|rival|ally|betrayed?|trust|key|important|remember|always|never|must|critical|core|secret|sworn|promised?|turned|became|discovered?|realized?|revealed?|established?|origin|history|backstory|goal|mission|rule|law|forbidden)\b/i;
  var WORLD_FACT_RE = /\b(world|realm|kingdom|city|place|location|town|village|region|land|continent|planet|era|age|period|century|culture|government|empire|faction|guild|order|religion|magic|system|power|ability|skill|class|rank|title)\b/i;
  var SCENE_RE = /\b(happened?|occurred?|during|when|after|before|scene|moment|event|battle|fight|encounter|conversation|meeting|ritual|ceremony|quest|journey|first|last|finally|conclusion|ending|beginning|starting)\b/i;
  function scoreContinuity(entry, { isPinned: isPinned2 = false, isProtected = false, index = 0, total = 1 } = {}) {
    const reasons = [];
    let score = 0;
    if (isPinned2) {
      score += 40;
      reasons.push("pinned");
    }
    if (isProtected) {
      score += 30;
      reasons.push("protected");
    }
    if (HIGH_SIGNAL_RE.test(entry)) {
      score += 20;
      reasons.push("relationship/key-fact signal");
    }
    if (WORLD_FACT_RE.test(entry)) {
      score += 15;
      reasons.push("world-fact signal");
    }
    if (SCENE_RE.test(entry)) {
      score += 10;
      reasons.push("scene/event signal");
    }
    const recencyThreshold = Math.max(1, Math.floor(total * 0.8));
    if (index >= recencyThreshold) {
      score += 10;
      reasons.push("recent");
    }
    const len = entry.length;
    if (len >= 30 && len <= 300) {
      score += 5;
      reasons.push("good length");
    }
    const label = score >= 40 ? "high" : score >= 20 ? "medium" : "low";
    return { score, label, reasons };
  }
  function scoreAllEntries(entries, pinnedIds = /* @__PURE__ */ new Set(), protectedIds = /* @__PURE__ */ new Set(), getEntryId2 = (e) => e) {
    const total = entries.length;
    return entries.map((entry, index) => {
      const entryId = getEntryId2(entry);
      const isPinned2 = pinnedIds.has(entryId);
      const isProtected = protectedIds.has(entryId);
      const { score, label, reasons } = scoreContinuity(entry, { isPinned: isPinned2, isProtected, index, total });
      return { entry, entryId, score, label, reasons };
    });
  }

  // src/core/lore.js
  function formatLoreDraft(entries, header = "# Lore draft") {
    if (!entries.length) return "";
    const lines = entries.map((e) => `- ${e.trim()}`);
    return `${header}
${lines.join("\n")}`;
  }
  function formatSteeringDraft(hotspots) {
    if (!hotspots.length) return "";
    const phrases = hotspots.slice(0, 10).map((h) => `"${h.gram}"`).join(", ");
    return `[Steering note: the following phrases appear repeatedly in memory and may be driving fixation \u2014 consider varying or reducing them: ${phrases}]`;
  }
  function getEntryLabels(scopeId, storeRef) {
    var _a;
    return (_a = storeRef.get(`pmt5_labels_${scopeId}`)) != null ? _a : {};
  }

  // src/core/duplicates.js
  function tokenize(text) {
    return String(text != null ? text : "").toLowerCase().replace(/[^a-z0-9\s']/g, " ").split(/\s+/).filter(Boolean);
  }
  function jaccard(setA, setB) {
    if (!setA.size && !setB.size) return 1;
    if (!setA.size || !setB.size) return 0;
    let intersection = 0;
    for (const t of setA) if (setB.has(t)) intersection++;
    return intersection / (setA.size + setB.size - intersection);
  }
  function compareEntries(a, b) {
    const tokA = new Set(tokenize(a));
    const tokB = new Set(tokenize(b));
    const sim = jaccard(tokA, tokB);
    const reasons = [];
    if (sim >= 0.9) reasons.push("near-identical phrasing");
    else if (sim >= 0.7) reasons.push("high token overlap");
    else if (sim >= 0.5) reasons.push("moderate token overlap");
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    if (ratio < 0.5) reasons.push("length mismatch (possible paraphrase)");
    return { similarity: sim, reasons };
  }
  function buildNearDupClusters(entries, getEntryId2, threshold = 0.6) {
    const clusters = [];
    const assigned = /* @__PURE__ */ new Set();
    for (let i = 0; i < entries.length; i++) {
      if (assigned.has(i)) continue;
      const cluster = { indices: [i], maxSimilarity: 0, reasons: /* @__PURE__ */ new Set() };
      for (let j = i + 1; j < entries.length; j++) {
        if (assigned.has(j)) continue;
        const { similarity, reasons } = compareEntries(entries[i], entries[j]);
        if (similarity >= threshold) {
          cluster.indices.push(j);
          cluster.maxSimilarity = Math.max(cluster.maxSimilarity, similarity);
          reasons.forEach((r) => cluster.reasons.add(r));
          assigned.add(j);
        }
      }
      if (cluster.indices.length > 1) {
        assigned.add(i);
        clusters.push({
          ids: cluster.indices.map((idx) => getEntryId2(entries[idx])),
          entries: cluster.indices.map((idx) => entries[idx]),
          maxSimilarity: cluster.maxSimilarity,
          reasons: [...cluster.reasons]
        });
      }
    }
    return clusters.sort((a, b) => b.maxSimilarity - a.maxSimilarity);
  }

  // src/core/health.js
  init_helpers();
  init_repetition();
  function computeHealthScore({
    entries = [],
    targetTokens = 0,
    pinnedIds = /* @__PURE__ */ new Set(),
    nearDupCount = 0
  } = {}) {
    const reasons = [];
    const suggestions = [];
    let deductions = 0;
    const totalText = entries.join("\n\n");
    const totalTokens = getNativeTokenCount(totalText);
    const idealMax = getIdealMaxContextTokens();
    const budget = targetTokens || (idealMax ? Math.floor(idealMax * 0.3) : 0);
    if (budget > 0) {
      const pressureRatio = totalTokens / budget;
      if (pressureRatio > 1.2) {
        deductions += 30;
        reasons.push("over token budget");
        suggestions.push("Switch to token-budget trim mode");
      } else if (pressureRatio > 0.9) {
        deductions += 15;
        reasons.push("near token budget");
        suggestions.push("Consider trimming to reduce pressure");
      }
    }
    const hotspots = scanRepetitionHotspots(entries);
    const riskLabel = getRepetitionRiskLabel(hotspots);
    if (riskLabel === "high") {
      deductions += 25;
      reasons.push("high repetition risk");
      suggestions.push("Run repetition review");
    } else if (riskLabel === "moderate") {
      deductions += 10;
      reasons.push("moderate repetition");
    }
    if (nearDupCount > 5) {
      deductions += 20;
      reasons.push(`${nearDupCount} near-duplicate clusters`);
      suggestions.push("Review near-duplicate suggestions");
    } else if (nearDupCount > 0) {
      deductions += 8;
      reasons.push(`${nearDupCount} near-duplicate clusters`);
    }
    if (entries.length > 150) {
      deductions += 15;
      reasons.push("very high entry count");
      suggestions.push("Consider a deep trim pass");
    } else if (entries.length > 80) {
      deductions += 5;
      reasons.push("high entry count");
    }
    const maxLen = entries.reduce((m, e) => Math.max(m, e.length), 0);
    if (maxLen > 800) {
      deductions += 10;
      reasons.push("very long entry present");
      suggestions.push("Trim long entries");
    }
    const score = Math.max(0, 100 - deductions);
    const label = score >= 80 ? "healthy" : score >= 55 ? "needs review" : score >= 30 ? "bloated" : "high risk";
    if (!reasons.length) reasons.push("no significant issues detected");
    return { score, label, reasons, suggestions, totalTokens, budget, hotspotCount: hotspots.length };
  }
  function computeBudgetPressure(allEntries, pinnedIds, getEntryId2, targetTokens) {
    const pinnedEntries = allEntries.filter((e) => pinnedIds.has(getEntryId2(e)));
    const pinnedTokens = getNativeTokenCount(pinnedEntries.join("\n\n"));
    const totalTokens = getNativeTokenCount(allEntries.join("\n\n"));
    const pinnedExceeds = targetTokens > 0 && pinnedTokens > targetTokens;
    const freeTokens = targetTokens > 0 ? Math.max(0, targetTokens - pinnedTokens) : null;
    return {
      totalTokens,
      pinnedTokens,
      pinnedExceeds,
      freeTokens,
      pinnedCount: pinnedEntries.length,
      totalCount: allEntries.length
    };
  }

  // src/host/automation.js
  init_helpers();
  var AUTO_STATES = {
    IDLE: "idle",
    DISPATCHING: "dispatching",
    WAITING: "waiting_for_window",
    READING: "reading",
    READY: "ready",
    APPLYING: "applying",
    VERIFYING: "verifying",
    FAILED: "failed",
    MANUAL_FALLBACK: "manual_fallback"
  };
  async function dispatchMemCommand() {
    var _a;
    const input = document.querySelector("#messageInput");
    const send = document.querySelector("#sendButton");
    if (!input || !send) return false;
    const nativeInputSetter = (_a = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")) == null ? void 0 : _a.set;
    if (nativeInputSetter) {
      nativeInputSetter.call(input, "/mem");
    } else {
      input.value = "/mem";
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
    send.click();
    return true;
  }
  function waitForMemoryWindow({ timeoutMs = 6e3, onStateChange } = {}) {
    return new Promise((resolve) => {
      onStateChange == null ? void 0 : onStateChange(AUTO_STATES.WAITING);
      const immediate = findBestMemoryWindow();
      if (immediate) {
        resolve(immediate.el);
        return;
      }
      const deadline = Date.now() + timeoutMs;
      const observer = new MutationObserver(() => {
        const found = findBestMemoryWindow();
        if (found) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(found.el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, Math.max(0, deadline - Date.now()));
    });
  }
  function readMemoryWindow(windowEl) {
    var _a;
    const textarea = windowEl == null ? void 0 : windowEl.querySelector("textarea");
    const raw = (_a = textarea == null ? void 0 : textarea.value) != null ? _a : "";
    return { raw, entries: normalizeEntries(raw), textarea };
  }
  async function applyMemoryWindowText(windowEl, outgoingText, scopeId, opts = {}) {
    var _a;
    const { textarea, raw: priorRaw } = readMemoryWindow(windowEl);
    if (!textarea) return { status: "unverified", snapshot: null };
    const snapshot = saveSnapshot(scopeId, priorRaw, "pre-apply");
    const normalized = serializeEntries(normalizeEntries(outgoingText));
    const nativeSetter = (_a = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")) == null ? void 0 : _a.set;
    if (nativeSetter) {
      nativeSetter.call(textarea, normalized);
    } else {
      textarea.value = normalized;
    }
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    const { raw: actualRaw } = readMemoryWindow(windowEl);
    if (!actualRaw) return { status: "unverified", snapshot };
    const { ok } = verifyNormalizedApply(normalized, actualRaw);
    return { status: ok ? "verified" : "mismatch", snapshot, actual: ok ? null : actualRaw };
  }
  async function fetchMemWorkflow({ onStateChange, timeoutMs = 6e3 } = {}) {
    onStateChange == null ? void 0 : onStateChange(AUTO_STATES.DISPATCHING);
    const dispatched = await dispatchMemCommand();
    if (!dispatched) {
      onStateChange == null ? void 0 : onStateChange(AUTO_STATES.MANUAL_FALLBACK);
      return { ok: false, raw: "", entries: [], windowEl: null, error: "Host anchors not found \u2014 use manual copy/paste" };
    }
    const windowEl = await waitForMemoryWindow({ timeoutMs, onStateChange });
    if (!windowEl) {
      onStateChange == null ? void 0 : onStateChange(AUTO_STATES.MANUAL_FALLBACK);
      return { ok: false, raw: "", entries: [], windowEl: null, error: "Memory window did not appear \u2014 use manual copy/paste" };
    }
    onStateChange == null ? void 0 : onStateChange(AUTO_STATES.READING);
    await new Promise((r) => setTimeout(r, 300));
    const { raw, entries } = readMemoryWindow(windowEl);
    onStateChange == null ? void 0 : onStateChange(AUTO_STATES.READY);
    return { ok: true, raw, entries, windowEl };
  }

  // src/ui/panel.js
  init_protection();

  // src/ui/qa_popup.js
  init_constants();
  init_storage();
  var QA_ID = `${NS}-qa-popup`;
  var QA_KEY_STORE = "pmt5_anthropic_key";
  var KEY_STORE = QA_KEY_STORE;
  function getStoredKey() {
    var _a;
    return (_a = store.get(KEY_STORE)) != null ? _a : "";
  }
  function setStoredKey(k) {
    if (k) store.set(KEY_STORE, k);
    else store.del(KEY_STORE);
  }
  function localAnswer(question, entries) {
    const q2 = question.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    const terms = [...new Set(q2.split(/\s+/).filter((t) => t.length > 2))];
    if (!terms.length) return { answer: "Please ask a more specific question.", matches: [], charCount: 0 };
    const scored = entries.map((entry, i) => {
      const lower = entry.toLowerCase();
      const matchCount = terms.filter((t) => lower.includes(t)).length;
      return { entry, i, matchCount, score: matchCount / terms.length };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length) {
      return {
        answer: `No entries found matching "${terms.join('", "')}".`,
        matches: [],
        charCount: 0
      };
    }
    const topMatches = scored.slice(0, 5);
    const answer = `Found ${scored.length} matching entr${scored.length > 1 ? "ies" : "y"} (local search \u2014 enter an API key for AI-powered answers):

` + topMatches.map((r) => `\u2022 ${r.entry.slice(0, 120)}${r.entry.length > 120 ? "\u2026" : ""}`).join("\n");
    return { answer, matches: topMatches.map((r) => r.entry), charCount: entries.join("\n\n").length };
  }
  function buildSystemPrompt(memoryText, scope) {
    var _a;
    const lines = [
      "You are a memory-inspection assistant for a Perchance AI chat tool called PMT.",
      "Answer ONLY from the memory text below. Do not speculate beyond it.",
      'If the answer is not in the memory, say "Not found in memory."',
      "Keep answers concise (3\u20136 sentences max). Cite short excerpts when helpful."
    ];
    if (scope == null ? void 0 : scope.scopeLabel) {
      lines.push("", `Scope: ${scope.scopeLabel} (confidence: ${(_a = scope.confidence) != null ? _a : "unknown"})`);
    }
    lines.push(
      "",
      "--- MEMORY TEXT START ---",
      memoryText.slice(0, 12e3),
      "--- MEMORY TEXT END ---"
    );
    return lines.join("\n");
  }
  async function anthropicAnswer(question, memoryText, apiKey, scope = null) {
    var _a, _b, _c, _d, _e;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1e3,
        system: buildSystemPrompt(memoryText, scope),
        messages: [{ role: "user", content: question }]
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((_b = (_a = err == null ? void 0 : err.error) == null ? void 0 : _a.message) != null ? _b : `HTTP ${response.status}`);
    }
    const data = await response.json();
    return (_e = (_d = (_c = data.content) == null ? void 0 : _c.find((b) => b.type === "text")) == null ? void 0 : _d.text) != null ? _e : "(No response)";
  }
  function openQaPopup({ entries, selected = [], scope }) {
    const existing = document.getElementById(QA_ID);
    if (existing) {
      existing.remove();
      return;
    }
    const storedKey = getStoredKey();
    const hasKey = !!storedKey;
    const scopeChip = (scope == null ? void 0 : scope.scopeLabel) ? `<span id="${QA_ID}-scope" class="pmt5-qa-scope-chip"
         title="Scope: ${escHtml(scope.scopeLabel)}">${escHtml(scope.confidence)} scope</span>` : "";
    const popup = document.createElement("div");
    popup.id = QA_ID;
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "Memory Q&A");
    popup.style.cssText = "position:fixed;bottom:96px;right:18px;width:min(430px,95vw);z-index:2147483645;display:flex;flex-direction:column;font-family:system-ui,sans-serif;font-size:13px;overflow:hidden;max-height:72vh;";
    popup.innerHTML = `
    <div id="${QA_ID}-hdr" class="pmt5-qa-hdr">
      <span id="${QA_ID}-title" class="pmt5-qa-title">\u{1F9E0} Memory Q&amp;A</span>
      ${scopeChip}
      <span id="${QA_ID}-mode-badge" class="pmt5-qa-badge ${hasKey ? "remote" : "local"}">${hasKey ? "\u{1F310} Anthropic" : "\u{1F4BB} Local"}</span>
      <button id="${QA_ID}-close" class="pmt5-qa-close" title="Close" aria-label="Close Q&amp;A">\u2715</button>
    </div>
    <div id="${QA_ID}-privacy-notice" class="pmt5-qa-notice" style="${hasKey ? "display:none" : ""}">
      <b>Local mode:</b> keyword search only \u2014 no network requests.
      To use AI answers, enter an Anthropic API key below.
    </div>
    <div id="${QA_ID}-key-row" class="pmt5-qa-key-row">
      <input id="${QA_ID}-key-in" type="password" placeholder="Anthropic API key (optional \u2014 stays local)"
        value="${escHtml(storedKey)}" autocomplete="off" spellcheck="false" aria-label="Anthropic API key">
      <button id="${QA_ID}-key-save" class="pmt5-qa-btn">Save</button>
      <span class="pmt5-qa-key-warn" title="Your API key is stored in plain localStorage. Clear it when done.">\u26A0 localStorage</span>
      <button id="${QA_ID}-key-clear" class="pmt5-qa-btn" style="${hasKey ? "" : "display:none"}">Clear</button>
    </div>
    <div id="${QA_ID}-scope-row" class="pmt5-qa-scope-row">
      <label class="pmt5-qa-scope-label">Ask about:
        <select id="${QA_ID}-scope-sel" aria-label="Scope for Q&A">
          <option value="all">All ${entries.length} kept entries</option>
          ${selected.length ? `<option value="sel">Selected ${selected.length} entries</option>` : ""}
        </select>
      </label>
    </div>
    <div id="${QA_ID}-answer" class="pmt5-qa-answer" role="log" aria-live="polite">Ask a question about what is stored in memory\u2026</div>
    <div id="${QA_ID}-citations" class="pmt5-qa-citations" aria-live="polite"></div>
    <div id="${QA_ID}-footer" class="pmt5-qa-footer">
      <input id="${QA_ID}-input" type="text" placeholder="e.g. What does memory say about Alice?" autocomplete="off" spellcheck="false" aria-label="Your question">
      <button id="${QA_ID}-ask" class="pmt5-qa-ask">Ask</button>
    </div>`;
    document.body.appendChild(popup);
    const modeBadge = document.getElementById(`${QA_ID}-mode-badge`);
    const closeBtn = document.getElementById(`${QA_ID}-close`);
    const noticeEl = document.getElementById(`${QA_ID}-privacy-notice`);
    const keyIn = document.getElementById(`${QA_ID}-key-in`);
    const scopeSel = document.getElementById(`${QA_ID}-scope-sel`);
    const answerEl = document.getElementById(`${QA_ID}-answer`);
    const citEl = document.getElementById(`${QA_ID}-citations`);
    const inputEl = document.getElementById(`${QA_ID}-input`);
    const askBtn = document.getElementById(`${QA_ID}-ask`);
    closeBtn.addEventListener("click", () => popup.remove());
    document.getElementById(`${QA_ID}-key-save`).addEventListener("click", () => {
      const k = keyIn.value.trim();
      setStoredKey(k);
      const clearBtn = document.getElementById(`${QA_ID}-key-clear`);
      if (k) {
        modeBadge.textContent = "\u{1F310} Anthropic";
        modeBadge.className = "pmt5-qa-badge remote";
        if (noticeEl) noticeEl.style.display = "none";
        if (clearBtn) clearBtn.style.display = "";
      } else {
        modeBadge.textContent = "\u{1F4BB} Local";
        modeBadge.className = "pmt5-qa-badge local";
        if (noticeEl) noticeEl.style.display = "";
        if (clearBtn) clearBtn.style.display = "none";
      }
    });
    const clearBtn2 = document.getElementById(`${QA_ID}-key-clear`);
    if (clearBtn2) {
      clearBtn2.addEventListener("click", () => {
        keyIn.value = "";
        setStoredKey("");
        modeBadge.textContent = "\u{1F4BB} Local";
        modeBadge.className = "pmt5-qa-badge local";
        if (noticeEl) noticeEl.style.display = "";
        clearBtn2.style.display = "none";
      });
    }
    async function doAsk() {
      const question = inputEl.value.trim();
      if (!question) return;
      const scopeMode = scopeSel.value;
      const useEntries = scopeMode === "sel" && selected.length ? selected : entries;
      askBtn.disabled = true;
      askBtn.textContent = "\u2026";
      answerEl.textContent = "Thinking\u2026";
      answerEl.className = "pmt5-qa-answer thinking";
      citEl.textContent = "";
      try {
        const currentKey = getStoredKey();
        let answer;
        let charCount = 0;
        if (currentKey) {
          const memText = useEntries.join("\n\n");
          charCount = memText.length;
          answer = await anthropicAnswer(question, memText, currentKey, scope);
        } else {
          const localResult = localAnswer(question, useEntries);
          answer = localResult.answer;
          charCount = localResult.charCount;
        }
        answerEl.textContent = answer;
        answerEl.className = "pmt5-qa-answer";
        citEl.textContent = `${useEntries.length} entries searched \xB7 ${charCount.toLocaleString()} chars`;
      } catch (err) {
        answerEl.textContent = `Error: ${err.message}`;
        answerEl.className = "pmt5-qa-answer error";
        citEl.textContent = "";
      } finally {
        askBtn.disabled = false;
        askBtn.textContent = "Ask";
        inputEl.value = "";
        inputEl.focus();
      }
    }
    askBtn.addEventListener("click", doAsk);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doAsk();
      }
    });
    setTimeout(() => inputEl.focus(), 60);
  }

  // src/ui/bubble_map.js
  init_constants();
  init_helpers();

  // src/core/timeline.js
  var EVENT_RE = /\b(happened?|occurred?|during|discovered?|realized?|arrived?|defeated?|escaped?|revealed?|founded?|destroyed?|built|created?|ended?|began|started?|turned|became|chosen?|sworn?|learned?|died|killed?|saved?|betrayed?)\b/i;
  var REL_RE = /\b(loves?|hates?|trusts?|married?|ally|allied|enemies|friend|rival|bonded?|broke|left|joined?|betrayed?|forgave?)\b/i;
  var WORLD_RE = /\b(world|realm|kingdom|city|empire|era|age|war|peace|treaty|law|rule|forbidden|sacred)\b/i;
  var HOOK_RE = /\b(maybe|perhaps|unknown|mystery|secret|hidden|prophecy|destiny|rumor|might|could|unclear|warning)\b/i;
  var TEMPORAL_RE = /\b(before|after|then|next|finally|later|eventually|once|when|during|ago|now|recent)\b/i;
  function classifyBeat(entry) {
    let beatType = "misc";
    let score = 0;
    if (EVENT_RE.test(entry)) {
      beatType = "event";
      score += 3;
    }
    if (REL_RE.test(entry)) {
      beatType = "relationship_change";
      score += 2;
    }
    if (WORLD_RE.test(entry)) {
      beatType = "world_fact";
      score += 2;
    }
    if (HOOK_RE.test(entry)) {
      beatType = "hook";
      score += 1;
    }
    if (TEMPORAL_RE.test(entry)) score += 1;
    const confidence = score >= 4 ? "high" : score >= 2 ? "medium" : "low";
    return { beatType, confidence, score };
  }
  function extractStoryBeats(entries, getEntryId2) {
    return entries.map((entry, index) => {
      const { beatType, confidence, score } = classifyBeat(entry);
      return { entryId: getEntryId2(entry), entry, beatType, confidence, score, index };
    }).filter((b) => b.confidence !== "low" || b.beatType !== "misc").sort((a, b) => b.score - a.score);
  }

  // src/ui/bubble_map.js
  var MAP_ID = `${NS}-bubble-map`;
  var CANVAS_W = 980;
  var CANVAS_H = 620;
  var PAD_L = 84;
  var PAD_R = 36;
  var PAD_T = 70;
  var TIMELINE_Y = CANVAS_H - 44;
  var SIM_THRESHOLD = 0.22;
  function bubbleColor(label, isPinned2) {
    if (isPinned2) return "#388bfd";
    if (label === "high") return "#3fb950";
    if (label === "medium") return "#e3b341";
    return "#8b949e";
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  function buildSimilarityClusters(entries, getEntryId2, threshold = SIM_THRESHOLD) {
    const n = entries.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    function find(x) {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    }
    function union(a, b) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const { similarity } = compareEntries(entries[i], entries[j]);
        if (similarity >= threshold) union(i, j);
      }
    }
    const byRoot = /* @__PURE__ */ new Map();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!byRoot.has(root)) byRoot.set(root, []);
      byRoot.get(root).push(i);
    }
    const clusters = [...byRoot.values()].sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return a[0] - b[0];
    }).map((indices, idx) => ({
      id: `cluster-${idx + 1}`,
      indices,
      size: indices.length,
      anchorIndex: indices.reduce((sum, i) => sum + i, 0) / indices.length
    }));
    const clusterByEntryId = {};
    clusters.forEach((cluster, lane) => {
      cluster.indices.forEach((i) => {
        clusterByEntryId[getEntryId2(entries[i])] = { ...cluster, lane };
      });
    });
    return { clusters, clusterByEntryId };
  }
  function buildTimelineRank(entries) {
    const beats = entries.map((entry, index) => {
      const beat = classifyBeat(entry);
      const temporalBoost = /\b(before|after|then|next|finally|later|eventually|once|when|during|ago|now|recent)\b/i.test(entry) ? 0.35 : 0;
      return {
        index,
        score: index + beat.score * 0.08 + temporalBoost,
        beatType: beat.beatType,
        confidence: beat.confidence
      };
    });
    beats.sort((a, b) => a.score - b.score || a.index - b.index);
    const timelineRank = {};
    beats.forEach((item, rank) => {
      timelineRank[item.index] = rank;
    });
    return { beatsByIndex: beats.reduce((acc, b) => {
      acc[b.index] = b;
      return acc;
    }, {}), timelineRank };
  }
  function positionFor(rank, total, lane, laneCount, radius) {
    const usableW = CANVAS_W - PAD_L - PAD_R;
    const usableH = TIMELINE_Y - PAD_T - 18;
    const x = PAD_L + (total <= 1 ? usableW / 2 : rank / (total - 1) * usableW);
    const laneGap = laneCount <= 1 ? 0 : usableH / Math.max(1, laneCount - 1);
    const y = PAD_T + lane * laneGap;
    return {
      x: clamp(x, PAD_L + radius, CANVAS_W - PAD_R - radius),
      y: clamp(y, PAD_T + radius, TIMELINE_Y - 18 - radius)
    };
  }
  function openBubbleMap({ entries, continuityMap: continuityMap2 = {}, pinnedIds = /* @__PURE__ */ new Set(), getEntryId: getEntryId2, minClusterSize = 1, onApplyOrder = null }) {
    const existing = document.getElementById(MAP_ID);
    if (existing) existing.remove();
    if (!(entries == null ? void 0 : entries.length)) return;
    const { clusters, clusterByEntryId } = buildSimilarityClusters(entries, getEntryId2);
    const { beatsByIndex, timelineRank } = buildTimelineRank(entries);
    const visibleClusters = clusters.filter((cluster) => cluster.size >= Math.max(1, minClusterSize));
    const visibleEntrySet = new Set(visibleClusters.flatMap((cluster) => cluster.indices));
    const soloFallbackLane = visibleClusters.length;
    const laneCount = Math.max(1, visibleClusters.length + (visibleEntrySet.size < entries.length ? 1 : 0));
    const visibleEntries = entries.filter((_, index) => minClusterSize <= 1 || visibleEntrySet.has(index));

    // Local mutable pin state — survives slider changes and feeds back to call site via onApplyOrder
    const localPinnedIds = new Set(pinnedIds);
    // Track whether user has dragged any bubble (gates the Apply Order button)
    let orderDirty = false;
    // Color mode: 'continuity' | 'beat'
    let colorMode = "continuity";

    const bubbles = visibleEntries.map((entry, sourceIndex) => {
      var _a, _b, _c, _d, _e, _f, _g;
      const index = entries.indexOf(entry, sourceIndex === 0 ? 0 : entries.indexOf(visibleEntries[sourceIndex - 1]) + 1);
      const entryId = getEntryId2(entry);
      const contInfo = (_a = continuityMap2[entryId]) != null ? _a : { label: "low", score: 0 };
      const cluster = (_b = clusterByEntryId[entryId]) != null ? _b : { id: "solo", size: 1, lane: soloFallbackLane };
      const rank = (_c = timelineRank[index]) != null ? _c : index;
      const tokens = getNativeTokenCount(entry);
      const radius = Math.max(18, Math.min(54, Math.sqrt(tokens) * 3.4));
      const anchor = positionFor(rank, entries.length, cluster.size >= minClusterSize ? cluster.lane : soloFallbackLane, laneCount, radius);
      return {
        entry,
        entryId,
        index,
        rank,
        clusterId: cluster.id,
        clusterSize: cluster.size,
        beatType: (_e = (_d = beatsByIndex[index]) == null ? void 0 : _d.beatType) != null ? _e : "misc",
        beatConfidence: (_g = (_f = beatsByIndex[index]) == null ? void 0 : _f.confidence) != null ? _g : "low",
        radius,
        tokens,
        label: contInfo.label,
        isPinned: localPinnedIds.has(entryId),
        x: anchor.x,
        y: anchor.y,
        anchorX: anchor.x,
        anchorY: anchor.y
      };
    });
    for (let tick = 0; tick < 36; tick++) {
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const a = bubbles[i], b = bubbles[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const minDist = a.radius + b.radius + 8;
          if (dist < minDist) {
            const push = (minDist - dist) / dist * 0.48;
            a.x -= dx * push;
            a.y -= dy * push;
            b.x += dx * push;
            b.y += dy * push;
          }
        }
        const bubble = bubbles[i];
        bubble.x = clamp(bubble.x * 0.82 + bubble.anchorX * 0.18, PAD_L + bubble.radius, CANVAS_W - PAD_R - bubble.radius);
        bubble.y = clamp(bubble.y * 0.82 + bubble.anchorY * 0.18, PAD_T + bubble.radius, TIMELINE_Y - 18 - bubble.radius);
      }
    }

    // Build cluster → bubbles map for drawing intra-cluster connection lines
    const clusterBubbleMap2 = {};
    bubbles.forEach((b) => {
      if (!clusterBubbleMap2[b.clusterId]) clusterBubbleMap2[b.clusterId] = [];
      clusterBubbleMap2[b.clusterId].push(b);
    });

    // Beat-type colour palette
    function beatColor(beatType) {
      if (beatType === "event") return "#f0883e";
      if (beatType === "relationship_change") return "#d2a8ff";
      if (beatType === "world_fact") return "#79c0ff";
      if (beatType === "hook") return "#56d364";
      return "#8b949e";
    }
    function getBubbleColor(b) {
      if (b.isPinned) return "#388bfd";
      if (colorMode === "beat") return beatColor(b.beatType);
      return bubbleColor(b.label, false);
    }

    const overlay = document.createElement("div");
    overlay.id = MAP_ID;
    overlay.className = "pmt5-bubble-overlay";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483646;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;animation:pmt5-fade-in 0.2s ease;";
    overlay.innerHTML = `
    <div class="pmt5-bubble-shell" style="width:min(1040px,96vw);height:min(760px,94vh)">
      <div class="pmt5-bubble-hdr">
        <span class="pmt5-bubble-title">\u{1FAE7} Similar Memories \u2014 ${bubbles.length} bubbles</span>
        <label class="pmt5-bubble-cluster-label">Min cluster:
          <input id="${MAP_ID}-slider" type="range" min="1" max="5" value="${minClusterSize}"
            style="width:70px;accent-color:var(--pmt-accent,#388bfd);vertical-align:middle;margin-left:4px">
          <span id="${MAP_ID}-slider-val">${minClusterSize}</span>
        </label>
        <button id="${MAP_ID}-color-toggle" class="pmt5-bubble-close" title="Toggle colour mode between continuity priority and story beat type" style="font-size:11px;padding:3px 9px">\u{1F3A8} Continuity</button>
        <span class="pmt5-bubble-hint">drag = reorder \xB7 click = pin/unpin \xB7 lane = cluster</span>
        ${onApplyOrder ? `<button id="${MAP_ID}-apply" class="pmt5-bubble-close" title="Apply left-to-right bubble positions as new entry order in the workspace" style="font-size:11px;padding:3px 10px;opacity:0.35;cursor:default" disabled>\u2195 Apply Order</button>` : ""}
        <button id="${MAP_ID}-reset" class="pmt5-bubble-close" title="Reset layout" style="margin-right:6px">\u21BA</button>
        <button id="${MAP_ID}-close" class="pmt5-bubble-close" title="Close map">\u2715</button>
      </div>
      <div style="padding:0 16px 8px;font-size:11px;color:var(--pmt-text-muted);display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <span>${visibleClusters.length} similarity cluster${visibleClusters.length === 1 ? "" : "s"}${visibleEntrySet.size < entries.length ? ` \xB7 hiding ${entries.length - visibleEntrySet.size} singleton${entries.length - visibleEntrySet.size === 1 ? "" : "s"}` : ""}</span>
        <span id="${MAP_ID}-order-hint" style="color:var(--pmt-accent,#388bfd);display:none">\u2195 Order changed \u2014 click Apply Order to commit to workspace</span>
      </div>
      <div style="flex:1;overflow:auto;position:relative;padding:0 12px 12px">
        <canvas id="${MAP_ID}-canvas" width="${CANVAS_W}" height="${CANVAS_H}"
          role="application"
          tabindex="0"
          aria-label="Interactive memory bubble timeline with ${bubbles.length} entries. Drag a bubble to reorder it along the timeline; click a bubble to toggle its pinned state."
          style="display:block;cursor:grab;touch-action:none;width:100%;height:auto;max-height:100%">
          Interactive memory bubble timeline.
        </canvas>
      </div>
      <div id="${MAP_ID}-legend" style="padding:0 16px 14px;font-size:11px;color:var(--pmt-text-muted);display:flex;gap:14px;flex-wrap:wrap"></div>
      <div id="${MAP_ID}-tooltip" class="pmt5-bubble-tooltip" style="display:none;position:fixed;z-index:2147483647"></div>
    </div>`;
    document.body.appendChild(overlay);
    const canvas = document.getElementById(`${MAP_ID}-canvas`);
    const ctx = canvas.getContext("2d");
    const tooltip = document.getElementById(`${MAP_ID}-tooltip`);
    const legend = document.getElementById(`${MAP_ID}-legend`);
    const orderHint = document.getElementById(`${MAP_ID}-order-hint`);
    const applyBtn = document.getElementById(`${MAP_ID}-apply`);
    const colorToggleBtn = document.getElementById(`${MAP_ID}-color-toggle`);

    function updateApplyBtn() {
      if (!applyBtn) return;
      applyBtn.disabled = !orderDirty;
      applyBtn.style.opacity = orderDirty ? "1" : "0.35";
      applyBtn.style.cursor = orderDirty ? "pointer" : "default";
    }
    function renderLegend() {
      if (colorMode === "continuity") {
        legend.innerHTML = [
          "<span>\uD83D\uDFE2 high continuity</span>",
          "<span>\uD83D\uDFE1 medium</span>",
          "<span>\u26AB low</span>",
          "<span>\uD83D\uDCCC pinned = blue</span>",
          "<span>Lane = similarity cluster</span>",
          "<span>Timeline \u2192 left to right</span>"
        ].join("");
      } else {
        legend.innerHTML = [
          "<span>\uD83D\uDFE0 event</span>",
          "<span>\uD83D\uDFE3 relationship</span>",
          "<span>\uD83D\uDD35 world fact</span>",
          "<span>\uD83D\uDFE2 hook/mystery</span>",
          "<span>\uD83D\uDCCC pinned = blue</span>"
        ].join("");
      }
    }
    function laneLabel(laneIndex) {
      if (laneIndex < visibleClusters.length) {
        const cluster = visibleClusters[laneIndex];
        return `Cluster ${laneIndex + 1} \xB7 ${cluster.size} similar`;
      }
      return "Singleton / misc";
    }
    function drawTimelineAndLanes(textColor, mutedColor) {
      ctx.save();
      ctx.strokeStyle = mutedColor;
      ctx.fillStyle = mutedColor;
      ctx.lineWidth = 1;
      for (let lane = 0; lane < laneCount; lane++) {
        const laneY = laneCount <= 1 ? (PAD_T + TIMELINE_Y - 18) / 2 : PAD_T + lane * ((TIMELINE_Y - 18 - PAD_T) / Math.max(1, laneCount - 1));
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.moveTo(PAD_L - 18, laneY);
        ctx.lineTo(CANVAS_W - PAD_R + 8, laneY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "11px system-ui";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(laneLabel(lane), 10, laneY);
      }
      ctx.strokeStyle = textColor;
      ctx.beginPath();
      ctx.moveTo(PAD_L, TIMELINE_Y);
      ctx.lineTo(CANVAS_W - PAD_R, TIMELINE_Y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(CANVAS_W - PAD_R, TIMELINE_Y);
      ctx.lineTo(CANVAS_W - PAD_R - 10, TIMELINE_Y - 5);
      ctx.moveTo(CANVAS_W - PAD_R, TIMELINE_Y);
      ctx.lineTo(CANVAS_W - PAD_R - 10, TIMELINE_Y + 5);
      ctx.stroke();
      const tickCount = Math.min(entries.length, 8);
      for (let i = 0; i < tickCount; i++) {
        const rank = tickCount === 1 ? 0 : Math.round(i / (tickCount - 1) * Math.max(0, entries.length - 1));
        const x = PAD_L + (entries.length <= 1 ? (CANVAS_W - PAD_L - PAD_R) / 2 : rank / Math.max(1, entries.length - 1) * (CANVAS_W - PAD_L - PAD_R));
        ctx.beginPath();
        ctx.moveTo(x, TIMELINE_Y - 6);
        ctx.lineTo(x, TIMELINE_Y + 6);
        ctx.stroke();
        ctx.font = "10px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(`#${rank + 1}`, x, TIMELINE_Y + 9);
      }
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Live timeline", (PAD_L + CANVAS_W - PAD_R) / 2, CANVAS_H - 18);
      ctx.restore();
    }
    // Draw dashed connector lines between bubbles that share a cluster
    function drawClusterLines() {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      for (const cBubbles of Object.values(clusterBubbleMap2)) {
        if (cBubbles.length < 2) continue;
        const color = getBubbleColor(cBubbles[0]);
        ctx.strokeStyle = `${color}44`;
        const sorted2 = [...cBubbles].sort((a, b) => a.x - b.x);
        for (let i = 0; i < sorted2.length - 1; i++) {
          ctx.beginPath();
          ctx.moveTo(sorted2[i].x, sorted2[i].y);
          ctx.lineTo(sorted2[i + 1].x, sorted2[i + 1].y);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
    function drawBubble(b, textColor) {
      const color = getBubbleColor(b);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = `${color}55`;
      ctx.strokeStyle = color;
      ctx.lineWidth = b.isPinned ? 3 : 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = `${Math.max(9, Math.min(12, b.radius / 3))}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = b.entry.slice(0, 22).replace(/\s+/g, " ");
      ctx.fillText(label.length < b.entry.length ? `${label}\u2026` : label, b.x, b.y);
    }
    function draw() {
      const styles = getComputedStyle(document.documentElement);
      const textColor = styles.getPropertyValue("--pmt-text").trim() || "#e6edf3";
      const mutedColor = styles.getPropertyValue("--pmt-text-muted").trim() || "#8b949e";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawTimelineAndLanes(textColor, mutedColor);
      drawClusterLines();
      [...bubbles].sort((a, b) => a.radius - b.radius).forEach((b) => drawBubble(b, textColor));
    }
    function pointerToCanvas(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    }
    function hitTest(px, py) {
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (Math.hypot(px - b.x, py - b.y) <= b.radius) return b;
      }
      return null;
    }
    function updateTooltip(hit, e) {
      if (!hit) {
        tooltip.style.display = "none";
        return;
      }
      const liveRank = 1 + Math.round((clamp(hit.x, PAD_L, CANVAS_W - PAD_R) - PAD_L) / Math.max(1, CANVAS_W - PAD_L - PAD_R) * Math.max(0, entries.length - 1));
      tooltip.style.display = "block";
      tooltip.style.left = `${e.clientX + 14}px`;
      tooltip.style.top = `${e.clientY - 10}px`;
      tooltip.innerHTML = [
        `<b>${escHtml(hit.entry.slice(0, 120))}</b>`,
        `Tokens: ${hit.tokens}`,
        `Continuity: ${hit.label} \xB7 Beat: ${escHtml(hit.beatType)} (${escHtml(hit.beatConfidence)})`,
        `Cluster: ${hit.clusterId} (${hit.clusterSize}) \xB7 Position \u2192 slot #${liveRank}`,
        hit.isPinned ? "\uD83D\uDCCC pinned \u2014 click to unpin" : "Click to pin \xB7 drag to reorder"
      ].filter(Boolean).join("<br>");
    }
    let dragging = null;
    let dragOX = 0;
    let dragOY = 0;
    let pointerDownX = 0;
    let pointerDownY = 0;
    const CLICK_THRESHOLD_PX = 6;
    canvas.addEventListener("pointerdown", (e) => {
      const { x, y } = pointerToCanvas(e);
      const hit = hitTest(x, y);
      if (!hit) return;
      canvas.setPointerCapture(e.pointerId);
      dragging = hit;
      dragOX = x - hit.x;
      dragOY = y - hit.y;
      pointerDownX = x;
      pointerDownY = y;
      canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", (e) => {
      const { x, y } = pointerToCanvas(e);
      if (dragging) {
        dragging.x = clamp(x - dragOX, PAD_L + dragging.radius, CANVAS_W - PAD_R - dragging.radius);
        dragging.y = clamp(y - dragOY, PAD_T + dragging.radius, TIMELINE_Y - 18 - dragging.radius);
        draw();
        updateTooltip(dragging, e);
        return;
      }
      updateTooltip(hitTest(x, y), e);
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      const { x, y } = pointerToCanvas(e);
      const moved = Math.hypot(x - pointerDownX, y - pointerDownY);
      if (moved < CLICK_THRESHOLD_PX) {
        // Treat as click: toggle pin state
        dragging.isPinned = !dragging.isPinned;
        if (dragging.isPinned) localPinnedIds.add(dragging.entryId);
        else localPinnedIds.delete(dragging.entryId);
        draw();
        updateTooltip(dragging, e);
      } else {
        // Treat as drag: mark order as changed
        orderDirty = true;
        orderHint.style.display = "";
        updateApplyBtn();
      }
      dragging = null;
      canvas.style.cursor = "grab";
    });
    canvas.addEventListener("pointercancel", () => {
      dragging = null;
      canvas.style.cursor = "grab";
    });
    canvas.addEventListener("pointerleave", () => {
      if (!dragging) tooltip.style.display = "none";
    });
    // Apply Order: sort entries by current bubble X position and call back to the workspace
    if (applyBtn && onApplyOrder) {
      applyBtn.addEventListener("click", () => {
        if (!orderDirty) return;
        const sorted = [...bubbles].sort((a, b) => a.x - b.x).map((b) => b.entry);
        onApplyOrder(sorted, localPinnedIds);
        overlay.remove();
      });
    }
    // Color mode toggle
    if (colorToggleBtn) {
      colorToggleBtn.addEventListener("click", () => {
        colorMode = colorMode === "continuity" ? "beat" : "continuity";
        colorToggleBtn.textContent = colorMode === "continuity" ? "\u{1F3A8} Continuity" : "\u{1F3A8} Beat Type";
        renderLegend();
        draw();
      });
    }
    const slider = document.getElementById(`${MAP_ID}-slider`);
    const sliderVal = document.getElementById(`${MAP_ID}-slider-val`);
    slider.addEventListener("input", () => {
      sliderVal.textContent = slider.value;
      openBubbleMap({ entries, continuityMap: continuityMap2, pinnedIds: localPinnedIds, getEntryId: getEntryId2, minClusterSize: parseInt(slider.value, 10), onApplyOrder });
    });
    document.getElementById(`${MAP_ID}-reset`).addEventListener("click", () => {
      openBubbleMap({ entries, continuityMap: continuityMap2, pinnedIds: localPinnedIds, getEntryId: getEntryId2, minClusterSize, onApplyOrder });
    });
    document.getElementById(`${MAP_ID}-close`).addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    renderLegend();
    draw();
  }

  // src/ui/bubble_map_inline.js
  // Renders the bubble timeline directly into a DOM container (no overlay/modal).
  // Called from the Map tab inside the main panel.
  function renderBubbleMapInline(container, scrollEl, { entries, continuityMap: continuityMap2 = {}, pinnedIds = /* @__PURE__ */ new Set(), getEntryId: getEntryId2, minClusterSize = 1, onApplyOrder = null, onPinToggle = null }) {
    const INLINE_ID = `${MAP_ID}-inline`;
    const IID = `${MAP_ID}-inl`;
    if (!entries?.length) {
      container.innerHTML = `<span class="${NS}-hint">\u{1FAE7} Run Trim first to populate the Timeline.</span>`;
      scrollEl.classList.remove(`${NS}-map-active`);
      return;
    }
    scrollEl.classList.add(`${NS}-map-active`);
    const { clusters, clusterByEntryId } = buildSimilarityClusters(entries, getEntryId2);
    const { beatsByIndex, timelineRank } = buildTimelineRank(entries);
    const visibleClusters = clusters.filter((c) => c.size >= Math.max(1, minClusterSize));
    const visibleEntrySet = new Set(visibleClusters.flatMap((c) => c.indices));
    const soloFallbackLane = visibleClusters.length;
    const laneCount = Math.max(1, visibleClusters.length + (visibleEntrySet.size < entries.length ? 1 : 0));
    const visibleEntries = entries.filter((_, i) => minClusterSize <= 1 || visibleEntrySet.has(i));
    const localPinnedIds = new Set(pinnedIds);
    let orderDirty = false;
    let colorMode = "continuity";
    const bubbles = visibleEntries.map((entry, sourceIndex) => {
      var _a, _b, _c, _d, _e, _f, _g;
      const index = entries.indexOf(entry, sourceIndex === 0 ? 0 : entries.indexOf(visibleEntries[sourceIndex - 1]) + 1);
      const entryId = getEntryId2(entry);
      const contInfo = (_a = continuityMap2[entryId]) != null ? _a : { label: "low", score: 0 };
      const cluster = (_b = clusterByEntryId[entryId]) != null ? _b : { id: "solo", size: 1, lane: soloFallbackLane };
      const rank = (_c = timelineRank[index]) != null ? _c : index;
      const tokens = getNativeTokenCount(entry);
      const radius = Math.max(16, Math.min(48, Math.sqrt(tokens) * 3.1));
      const anchor = positionFor(rank, entries.length, cluster.size >= minClusterSize ? cluster.lane : soloFallbackLane, laneCount, radius);
      return {
        entry, entryId, index, rank,
        clusterId: cluster.id, clusterSize: cluster.size,
        beatType: (_e = (_d = beatsByIndex[index]) == null ? void 0 : _d.beatType) != null ? _e : "misc",
        beatConfidence: (_g = (_f = beatsByIndex[index]) == null ? void 0 : _f.confidence) != null ? _g : "low",
        radius, tokens, label: contInfo.label,
        isPinned: localPinnedIds.has(entryId),
        x: anchor.x, y: anchor.y, anchorX: anchor.x, anchorY: anchor.y
      };
    });
    for (let tick = 0; tick < 36; tick++) {
      for (let i = 0; i < bubbles.length; i++) {
        for (let j = i + 1; j < bubbles.length; j++) {
          const a = bubbles[i], b = bubbles[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const minDist = a.radius + b.radius + 8;
          if (dist < minDist) {
            const push = (minDist - dist) / dist * 0.48;
            a.x -= dx * push; a.y -= dy * push;
            b.x += dx * push; b.y += dy * push;
          }
        }
        const bbl = bubbles[i];
        bbl.x = clamp(bbl.x * 0.82 + bbl.anchorX * 0.18, PAD_L + bbl.radius, CANVAS_W - PAD_R - bbl.radius);
        bbl.y = clamp(bbl.y * 0.82 + bbl.anchorY * 0.18, PAD_T + bbl.radius, TIMELINE_Y - 18 - bbl.radius);
      }
    }
    const clusterBubbleMap3 = {};
    bubbles.forEach((b) => {
      if (!clusterBubbleMap3[b.clusterId]) clusterBubbleMap3[b.clusterId] = [];
      clusterBubbleMap3[b.clusterId].push(b);
    });
    function beatColor2(bt) {
      if (bt === "event") return "#f0883e";
      if (bt === "relationship_change") return "#d2a8ff";
      if (bt === "world_fact") return "#79c0ff";
      if (bt === "hook") return "#56d364";
      return "#8b949e";
    }
    function getColor(b) {
      if (b.isPinned) return "#388bfd";
      return colorMode === "beat" ? beatColor2(b.beatType) : bubbleColor(b.label, false);
    }
    const clusterStat = `${visibleClusters.length} cluster${visibleClusters.length === 1 ? "" : "s"}`;
    const hiddenStat = visibleEntrySet.size < entries.length ? ` \xB7 ${entries.length - visibleEntrySet.size} hidden` : "";
    container.innerHTML = `
      <div id="${INLINE_ID}" class="${NS}-bubble-inline">
        <div class="${NS}-bubble-inline-bar">
          <span class="${NS}-bubble-inline-stat">${clusterStat}${hiddenStat} \xB7 ${bubbles.length} entries</span>
          <label class="${NS}-bubble-inline-label">
            Min cluster
            <input id="${IID}-slider" type="range" min="1" max="5" value="${minClusterSize}" style="width:56px;accent-color:var(--pmt-accent,#388bfd);vertical-align:middle">
            <span id="${IID}-slider-val">${minClusterSize}</span>
          </label>
          <button id="${IID}-color-toggle" class="${NS}-bubble-inline-btn" title="Toggle colour mode">\u{1F3A8} Continuity</button>
          ${onApplyOrder ? `<button id="${IID}-apply" class="${NS}-bubble-inline-btn ${NS}-bubble-inline-apply" disabled title="Commit left-to-right bubble positions as new entry order">\u2195 Apply Order</button>` : ""}
          <button id="${IID}-reset" class="${NS}-bubble-inline-btn" title="Reset all bubble positions">\u21BA Reset</button>
          <span id="${IID}-order-hint" class="${NS}-bubble-inline-dirty" style="display:none">\u2195 Drag detected \u2014 Apply Order to commit</span>
        </div>
        <div class="${NS}-bubble-inline-canvas-wrap">
          <canvas id="${IID}-canvas" width="${CANVAS_W}" height="${CANVAS_H}"
            role="application" tabindex="0"
            aria-label="Inline memory timeline with ${bubbles.length} entries. Drag a bubble left or right to reorder it; click a bubble to toggle its pinned state."
            style="display:block;cursor:grab;touch-action:none;width:100%;height:100%">
          </canvas>
        </div>
        <div id="${IID}-legend" class="${NS}-bubble-inline-legend"></div>
        <div id="${IID}-tooltip" class="${NS}-bubble-tooltip" style="display:none;position:fixed;z-index:2147483647"></div>
      </div>`;
    const canvas = document.getElementById(`${IID}-canvas`);
    const ctx = canvas.getContext("2d");
    const tooltip = document.getElementById(`${IID}-tooltip`);
    const legend = document.getElementById(`${IID}-legend`);
    const orderHint2 = document.getElementById(`${IID}-order-hint`);
    const applyBtn2 = document.getElementById(`${IID}-apply`);
    const colorToggleBtn2 = document.getElementById(`${IID}-color-toggle`);
    function updateApplyBtn2() {
      if (!applyBtn2) return;
      applyBtn2.disabled = !orderDirty;
      applyBtn2.style.opacity = orderDirty ? "1" : "0.4";
    }
    function renderLegend2() {
      legend.innerHTML = colorMode === "continuity"
        ? ["<span>\uD83D\uDFE2 high continuity</span>", "<span>\uD83D\uDFE1 medium</span>", "<span>\u26AB low</span>", "<span>\uD83D\uDCCC pinned = blue</span>", "<span>Lane = cluster \xB7 left \u2192 right = order</span>"].join("")
        : ["<span>\uD83D\uDFE0 event</span>", "<span>\uD83D\uDFE3 relationship</span>", "<span>\uD83D\uDD35 world fact</span>", "<span>\uD83D\uDFE2 hook</span>", "<span>\uD83D\uDCCC pinned = blue</span>"].join("");
    }
    function laneLabel2(li) {
      if (li < visibleClusters.length) return `C${li + 1} \xB7 ${visibleClusters[li].size}`;
      return "solo";
    }
    function drawTimelineAndLanes2(textColor, mutedColor) {
      ctx.save();
      ctx.strokeStyle = mutedColor; ctx.fillStyle = mutedColor; ctx.lineWidth = 1;
      for (let lane = 0; lane < laneCount; lane++) {
        const laneY = laneCount <= 1 ? (PAD_T + TIMELINE_Y - 18) / 2 : PAD_T + lane * ((TIMELINE_Y - 18 - PAD_T) / Math.max(1, laneCount - 1));
        ctx.setLineDash([5, 7]);
        ctx.beginPath(); ctx.moveTo(PAD_L - 18, laneY); ctx.lineTo(CANVAS_W - PAD_R + 8, laneY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = "11px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillText(laneLabel2(lane), 6, laneY);
      }
      ctx.strokeStyle = textColor;
      ctx.beginPath(); ctx.moveTo(PAD_L, TIMELINE_Y); ctx.lineTo(CANVAS_W - PAD_R, TIMELINE_Y); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(CANVAS_W - PAD_R, TIMELINE_Y); ctx.lineTo(CANVAS_W - PAD_R - 10, TIMELINE_Y - 5);
      ctx.moveTo(CANVAS_W - PAD_R, TIMELINE_Y); ctx.lineTo(CANVAS_W - PAD_R - 10, TIMELINE_Y + 5);
      ctx.stroke();
      const tickCount = Math.min(entries.length, 8);
      for (let i = 0; i < tickCount; i++) {
        const rank = tickCount === 1 ? 0 : Math.round(i / (tickCount - 1) * Math.max(0, entries.length - 1));
        const x = PAD_L + (entries.length <= 1 ? (CANVAS_W - PAD_L - PAD_R) / 2 : rank / Math.max(1, entries.length - 1) * (CANVAS_W - PAD_L - PAD_R));
        ctx.beginPath(); ctx.moveTo(x, TIMELINE_Y - 5); ctx.lineTo(x, TIMELINE_Y + 5); ctx.stroke();
        ctx.font = "10px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(`#${rank + 1}`, x, TIMELINE_Y + 7);
      }
      ctx.font = "11px system-ui"; ctx.textAlign = "center";
      ctx.fillText("Timeline \u2192", (PAD_L + CANVAS_W - PAD_R) / 2, CANVAS_H - 16);
      ctx.restore();
    }
    function drawClusterLines2() {
      ctx.save(); ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
      for (const cBubbles of Object.values(clusterBubbleMap3)) {
        if (cBubbles.length < 2) continue;
        ctx.strokeStyle = `${getColor(cBubbles[0])}44`;
        const sorted2 = [...cBubbles].sort((a, b2) => a.x - b2.x);
        for (let i = 0; i < sorted2.length - 1; i++) {
          ctx.beginPath(); ctx.moveTo(sorted2[i].x, sorted2[i].y); ctx.lineTo(sorted2[i + 1].x, sorted2[i + 1].y); ctx.stroke();
        }
      }
      ctx.setLineDash([]); ctx.restore();
    }
    function drawBubble2(b, textColor) {
      const col = getColor(b);
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = `${col}55`; ctx.strokeStyle = col;
      ctx.lineWidth = b.isPinned ? 3 : 1.5;
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = textColor;
      ctx.font = `${Math.max(9, Math.min(12, b.radius / 3))}px system-ui`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const lbl = b.entry.slice(0, 20).replace(/\s+/g, " ");
      ctx.fillText(lbl.length < b.entry.length ? `${lbl}\u2026` : lbl, b.x, b.y);
    }
    function draw2() {
      const styles = getComputedStyle(document.documentElement);
      const textColor = styles.getPropertyValue("--pmt-text").trim() || "#e6edf3";
      const mutedColor = styles.getPropertyValue("--pmt-text-muted").trim() || "#8b949e";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawTimelineAndLanes2(textColor, mutedColor);
      drawClusterLines2();
      [...bubbles].sort((a, b) => a.radius - b.radius).forEach((b) => drawBubble2(b, textColor));
    }
    function p2c(e) {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
    }
    function hitTest2(px, py) {
      for (let i = bubbles.length - 1; i >= 0; i--) {
        if (Math.hypot(px - bubbles[i].x, py - bubbles[i].y) <= bubbles[i].radius) return bubbles[i];
      }
      return null;
    }
    function updateTooltip2(hit, e) {
      if (!hit) { tooltip.style.display = "none"; return; }
      const slot = 1 + Math.round((clamp(hit.x, PAD_L, CANVAS_W - PAD_R) - PAD_L) / Math.max(1, CANVAS_W - PAD_L - PAD_R) * Math.max(0, entries.length - 1));
      tooltip.style.display = "block";
      tooltip.style.left = `${e.clientX + 14}px`;
      tooltip.style.top = `${e.clientY - 10}px`;
      tooltip.innerHTML = [
        `<b>${escHtml(hit.entry.slice(0, 120))}</b>`,
        `Tokens: ${hit.tokens} \xB7 Continuity: ${hit.label} \xB7 Beat: ${escHtml(hit.beatType)}`,
        `Cluster: ${hit.clusterId} (${hit.clusterSize}) \xB7 Slot \u2192 #${slot}`,
        hit.isPinned ? "\uD83D\uDCCC pinned \u2014 click to unpin" : "Click to pin \xB7 drag to reorder"
      ].join("<br>");
    }
    let dragging2 = null, dragOX2 = 0, dragOY2 = 0, pDownX = 0, pDownY = 0;
    canvas.addEventListener("pointerdown", (e) => {
      const { x, y } = p2c(e);
      const hit = hitTest2(x, y);
      if (!hit) return;
      canvas.setPointerCapture(e.pointerId);
      dragging2 = hit; dragOX2 = x - hit.x; dragOY2 = y - hit.y;
      pDownX = x; pDownY = y;
      canvas.style.cursor = "grabbing";
    });
    canvas.addEventListener("pointermove", (e) => {
      const { x, y } = p2c(e);
      if (dragging2) {
        dragging2.x = clamp(x - dragOX2, PAD_L + dragging2.radius, CANVAS_W - PAD_R - dragging2.radius);
        dragging2.y = clamp(y - dragOY2, PAD_T + dragging2.radius, TIMELINE_Y - 18 - dragging2.radius);
        draw2(); updateTooltip2(dragging2, e); return;
      }
      updateTooltip2(hitTest2(x, y), e);
    });
    canvas.addEventListener("pointerup", (e) => {
      if (!dragging2) return;
      const { x, y } = p2c(e);
      if (Math.hypot(x - pDownX, y - pDownY) < 6) {
        dragging2.isPinned = !dragging2.isPinned;
        if (dragging2.isPinned) localPinnedIds.add(dragging2.entryId);
        else localPinnedIds.delete(dragging2.entryId);
        if (onPinToggle) onPinToggle(dragging2.entryId);
        draw2(); updateTooltip2(dragging2, e);
      } else {
        orderDirty = true;
        orderHint2.style.display = "";
        updateApplyBtn2();
      }
      dragging2 = null; canvas.style.cursor = "grab";
    });
    canvas.addEventListener("pointercancel", () => { dragging2 = null; canvas.style.cursor = "grab"; });
    canvas.addEventListener("pointerleave", () => { if (!dragging2) tooltip.style.display = "none"; });
    if (applyBtn2 && onApplyOrder) {
      applyBtn2.addEventListener("click", () => {
        if (!orderDirty) return;
        const sorted = [...bubbles].sort((a, b) => a.x - b.x).map((b) => b.entry);
        onApplyOrder(sorted, localPinnedIds);
      });
    }
    if (colorToggleBtn2) {
      colorToggleBtn2.addEventListener("click", () => {
        colorMode = colorMode === "continuity" ? "beat" : "continuity";
        colorToggleBtn2.textContent = colorMode === "continuity" ? "\u{1F3A8} Continuity" : "\u{1F3A8} Beat Type";
        renderLegend2(); draw2();
      });
    }
    const sliderEl = document.getElementById(`${IID}-slider`);
    const sliderValEl = document.getElementById(`${IID}-slider-val`);
    sliderEl.addEventListener("input", () => {
      sliderValEl.textContent = sliderEl.value;
      renderBubbleMapInline(container, scrollEl, { entries, continuityMap: continuityMap2, pinnedIds: localPinnedIds, getEntryId: getEntryId2, minClusterSize: parseInt(sliderEl.value, 10), onApplyOrder, onPinToggle });
    });
    document.getElementById(`${IID}-reset`).addEventListener("click", () => {
      renderBubbleMapInline(container, scrollEl, { entries, continuityMap: continuityMap2, pinnedIds: localPinnedIds, getEntryId: getEntryId2, minClusterSize, onApplyOrder, onPinToggle });
    });
    renderLegend2(); draw2();
  }

  // src/core/contradictions.js
  var OPPOSITE_PAIRS = [
    [/\balive\b/i, /\bdead\b/i],
    [/\bfriend\b/i, /\benemy\b/i],
    [/\bloves?\b/i, /\bhates?\b/i],
    [/\btrusts?\b/i, /\bbetrayed?\b/i],
    [/\bopen\b/i, /\bclosed\b/i],
    [/\bgood\b/i, /\bevil\b/i],
    [/\bking\b/i, /\bqueen\b/i],
    [/\bleader\b/i, /\bfollower\b/i],
    [/\bwon\b/i, /\blost\b/i],
    [/\bright\b/i, /\bleft\b/i]
  ];
  function extractSubject(text) {
    const m = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    return m ? m[1].toLowerCase() : null;
  }
  function sharedSubject(a, b) {
    const sa = extractSubject(a);
    const sb = extractSubject(b);
    return sa && sb && sa === sb;
  }
  function detectConflicts(entries, getEntryId2) {
    const conflicts = [];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i], b = entries[j];
        const reasons = [];
        for (const [posRe, negRe] of OPPOSITE_PAIRS) {
          if (posRe.test(a) && negRe.test(b) && sharedSubject(a, b))
            reasons.push(`conflicting state: "${posRe.source}" vs "${negRe.source}"`);
          if (posRe.test(b) && negRe.test(a) && sharedSubject(a, b))
            reasons.push(`conflicting state: "${negRe.source}" vs "${posRe.source}"`);
        }
        if (reasons.length) {
          const severity = reasons.length >= 2 ? "high" : "medium";
          conflicts.push({
            entryIdA: getEntryId2(a),
            entryIdB: getEntryId2(b),
            entryA: a,
            entryB: b,
            severity,
            reasons
          });
        }
      }
    }
    return conflicts.sort(
      (a, b) => (b.severity === "high" ? 1 : 0) - (a.severity === "high" ? 1 : 0)
    );
  }

  // src/core/annotations.js
  init_storage();
  function key(scopeId) {
    return `pmt5_annot_${scopeId}`;
  }
  function getAnnotations(scopeId) {
    var _a;
    return (_a = store.get(key(scopeId))) != null ? _a : {};
  }
  function saveAnnotation(scopeId, entryId, { note = "", flags = [] } = {}) {
    const data = getAnnotations(scopeId);
    if (!note && !flags.length) {
      delete data[entryId];
    } else {
      data[entryId] = { note, flags };
    }
    store.set(key(scopeId), data);
  }
  function getAnnotation(scopeId, entryId) {
    var _a;
    return (_a = getAnnotations(scopeId)[entryId]) != null ? _a : null;
  }

  // src/core/topics.js
  var PERSON_RE = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/g;
  var LOCATION_RE = /\b(the\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|[A-Z][a-z]+(ville|ton|burg|ford|field|wood|land|shire|port|haven|gate|keep|holm|dor|mor|wyn))\b/gi;
  var THEME_WORDS = ["relationship", "secret", "mission", "quest", "war", "magic", "power", "betrayal", "alliance", "memory", "death", "birth", "prophecy", "curse", "oath"];
  function extractEntities(entry) {
    const persons = [...new Set([...entry.matchAll(PERSON_RE)].map((m) => m[1]))];
    const locations = [...new Set([...entry.matchAll(LOCATION_RE)].map((m) => m[1]))];
    const themes = THEME_WORDS.filter((t) => new RegExp(`\\b${t}`, "i").test(entry));
    return { persons, locations, themes };
  }
  function buildTopicGroups(entries, getEntryId2) {
    const byPerson = /* @__PURE__ */ new Map();
    const byLocation = /* @__PURE__ */ new Map();
    const byTheme = /* @__PURE__ */ new Map();
    entries.forEach((entry) => {
      const id = getEntryId2(entry);
      const { persons, locations, themes } = extractEntities(entry);
      persons.forEach((p) => {
        if (!byPerson.has(p)) byPerson.set(p, []);
        byPerson.get(p).push({ id, entry });
      });
      locations.forEach((l) => {
        if (!byLocation.has(l)) byLocation.set(l, []);
        byLocation.get(l).push({ id, entry });
      });
      themes.forEach((t) => {
        if (!byTheme.has(t)) byTheme.set(t, []);
        byTheme.get(t).push({ id, entry });
      });
    });
    const filter = (map) => [...map.entries()].filter(([, items]) => items.length >= 2).sort((a, b) => b[1].length - a[1].length);
    return { persons: filter(byPerson), locations: filter(byLocation), themes: filter(byTheme) };
  }

  // src/core/history.js
  var MAX_HISTORY = 50;
  var _history = [];
  function recordAction(type, detail = {}) {
    _history.push({
      type,
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      ...detail
    });
    if (_history.length > MAX_HISTORY) _history.shift();
  }
  function formatHistory(maxItems = 10) {
    return _history.slice(-maxItems).map((r) => {
      const time = r.ts.slice(11, 19);
      const tag = r.status ? ` [${r.status}]` : "";
      const detail = r.detail ? ` \u2014 ${r.detail}` : "";
      return `${time} ${r.type}${tag}${detail}`;
    }).join("\n");
  }

  // src/core/modes.js
  var MODE_KEY = "pmt5_user_mode";
  var MODES = {
    DAILY: "daily",
    ADVANCED: "advanced",
    DEBUG: "debug"
  };
  var _memoryMode = MODES.DAILY;
  function _load() {
    var _a;
    try {
      return (_a = localStorage.getItem(MODE_KEY)) != null ? _a : MODES.DAILY;
    } catch {
      return _memoryMode;
    }
  }
  function _save(mode) {
    _memoryMode = mode;
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
    }
  }
  function getMode() {
    return _load();
  }
  function setMode(mode) {
    _save(mode);
  }
  function applyMode(mode, ns) {
    var _a;
    if (typeof document === "undefined") return;
    const panel = document.getElementById(`${ns}-panel`);
    if (!panel) return;
    const isAdv = mode !== MODES.DAILY;
    const isDebug = mode === MODES.DEBUG;
    ["analyse", "curate", "compare"].forEach((tab) => {
      const el = panel.querySelector(`[data-tab="${tab}"]`);
      if (el) el.style.display = isAdv ? "" : "none";
    });
    ["more-toggle", "presets"].forEach((id) => {
      const el = document.getElementById(`${ns}-${id}`);
      if (el) el.style.display = isAdv ? "" : "none";
    });
    const diagDrawer = document.getElementById(`${ns}-diag-drawer`);
    if (diagDrawer && !isDebug) diagDrawer.classList.remove(`${ns}-visible`);
    const modeBadge = document.getElementById(`${ns}-mode-badge`);
    if (modeBadge) {
      modeBadge.textContent = (_a = { daily: "Daily", advanced: "Advanced", debug: "Debug" }[mode]) != null ? _a : mode;
      modeBadge.dataset.mode = mode;
    }
  }

  // src/core/relevance.js
  function tokenize2(text) {
    return new Set(
      String(text != null ? text : "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((s) => s.length > 3)
    );
  }
  function scoreRelevance(entries, contextText, getEntryId2) {
    const ctxTokens = tokenize2(contextText);
    if (!ctxTokens.size) return entries.map((e) => ({ entryId: getEntryId2(e), entry: e, score: 0, matchingTerms: [] }));
    return entries.map((entry) => {
      const entryTokens = tokenize2(entry);
      const matchingTerms = [...entryTokens].filter((t) => ctxTokens.has(t));
      const score = matchingTerms.length / Math.sqrt(ctxTokens.size);
      return { entryId: getEntryId2(entry), entry, score: Math.round(score * 100) / 100, matchingTerms };
    }).sort((a, b) => b.score - a.score);
  }
  function readRecentContext(maxChars = 2e3) {
    if (typeof document === "undefined") return "";
    const feed = document.querySelector("#messageFeed");
    if (!feed) return "";
    return (feed.innerText || feed.textContent || "").slice(-maxChars);
  }

  // src/core/similarity_sort.js
  function adjacencySort(entries, threshold = 0.25) {
    if (entries.length <= 1) return { sorted: [...entries], groups: [] };
    const visited = new Array(entries.length).fill(false);
    const result = [];
    const groups = [];
    for (let start = 0; start < entries.length; start++) {
      if (visited[start]) continue;
      visited[start] = true;
      const group = [start];
      let current = start;
      for (let pass = 0; pass < entries.length; pass++) {
        let bestIdx = -1, bestSim = threshold;
        for (let j = 0; j < entries.length; j++) {
          if (visited[j]) continue;
          const { similarity } = compareEntries(entries[current], entries[j]);
          if (similarity > bestSim) {
            bestSim = similarity;
            bestIdx = j;
          }
        }
        if (bestIdx === -1) break;
        visited[bestIdx] = true;
        group.push(bestIdx);
        current = bestIdx;
      }
      const label = group.length > 1 ? `Cluster (${group.length} entries)` : "Entry";
      groups.push({ label, indices: group });
      result.push(...group);
    }
    return { sorted: result.map((i) => entries[i]), groups };
  }

  // src/core/performance.js
  var PERF_CAPS = {
    hotspotLimit: 25,
    // max hotspots returned
    clusterLimit: 30,
    // max near-dup clusters
    beatLimit: 50,
    // max story beats extracted
    topicGroupLimit: 20,
    // max topic groups shown
    conflictLimit: 15
    // max conflicts returned
  };
  function classifyWorkspaceSize(entries) {
    const reasons = [];
    let score = 0;
    if (entries.length > 200) {
      score += 2;
      reasons.push("very high entry count");
    } else if (entries.length > 80) {
      score += 1;
      reasons.push("high entry count");
    }
    const totalChars = entries.join("").length;
    if (totalChars > 8e4) {
      score += 2;
      reasons.push("very large character volume");
    } else if (totalChars > 3e4) {
      score += 1;
      reasons.push("large character volume");
    }
    const sizeClass = score >= 2 ? "very_large" : score >= 1 ? "large" : "normal";
    return { sizeClass, reasons, shouldDefer: score >= 2 };
  }
  function guardedAnalysis(fn, args, limit, shouldDefer = false) {
    if (shouldDefer) return { result: [], deferred: true, capped: false };
    const raw = fn(...args);
    const capped = Array.isArray(raw) && raw.length > limit;
    return { result: capped ? raw.slice(0, limit) : raw, deferred: false, capped };
  }

  // src/core/presets.js
  var BUILTIN_PRESETS = [
    {
      id: "fast_cleanup",
      label: "Fast cleanup",
      desc: "Remove duplicates and very long entries",
      opts: { dedup: true, trimLong: true, charLimit: 300 }
    },
    {
      id: "fit_budget",
      label: "Fit token budget",
      desc: "Trim to host context budget using continuity order",
      opts: { trimMode: "token_budget", dedup: true }
    },
    {
      id: "protect_key",
      label: "Protect key memories",
      desc: "Dedup only \u2014 keeps all entries but removes exact duplicates",
      opts: { dedup: true, trimLong: false, keepN: "" }
    },
    {
      id: "prep_lore",
      label: "Prep lore draft",
      desc: "Keep newest 30, normalize, then review for lore promotion",
      opts: { keepN: "30", dedup: true, normalizeSeparators: true }
    },
    {
      id: "fix_repetition",
      label: "Fix repetition",
      desc: "Dedup + keep newest 25 \u2014 reduces fixation pressure",
      opts: { dedup: true, keepN: "25", showRepetitionBadge: true }
    }
  ];
  function applyPreset(cfg, presetOpts) {
    return { ...cfg, ...presetOpts };
  }

  // src/core/tokens_exact.js
  init_helpers();
  var _source = "auto";
  function setTokenSource(src) {
    // 'exact' was accepted but never implemented; normalize to 'auto' on load
    const valid = ["auto", "native", "heuristic"];
    _source = valid.includes(src) ? src : "auto";
  }
  function getTokenSourceLabel() {
    if (typeof window !== "undefined" && typeof window.countTokens === "function") {
      return _source === "heuristic" ? "estimate" : "native";
    }
    return "estimate";
  }

  // src/ui/onboarding.js
  init_constants();
  init_storage();
  var ONBOARD_KEY = "pmt5_onboarded";
  function isFirstRun() {
    return !store.get(ONBOARD_KEY);
  }
  function markOnboarded() {
    store.set(ONBOARD_KEY, { version: 1, ts: Date.now() });
  }
  var HELP_CONTENT = `
<b>Welcome to Memory Trimmer!</b>

Here's how it works:
<ol style="margin:8px 0 0 16px;padding:0;line-height:1.8">
  <li>Paste your <code>/mem</code> text into the workspace \u2014 or click <b>\u2B07 Fetch</b> if Perchance controls are detected.</li>
  <li>Click <b>Trim</b> to remove old, duplicate, or oversized entries.</li>
  <li>The <b>\uD83EUDDE7 Timeline</b> tab shows your entries clustered by similarity \u2014 drag to reorder.</li>
  <li>Pin \uD83DCE important entries to protect them from future trims.</li>
  <li>Click <b>\u2B06 Apply</b> to write back automatically, or <b>Copy</b> to paste manually.</li>
  <li>Save a <b>\uD83DCF7 Snapshot</b> before any risky change \u2014 restore it any time from the Snapshots tab.</li>
</ol>

<b>Analysis tools</b> (Analyse tab after Trim): health score, near-duplicate clusters, contradiction detection, topic groups, story beats, relevance ranking.
<b>Curation tools</b> (Curate tab): topic groups, story beats, steering draft, relevance to recent chat.
<b>Snapshots</b>: save, load, export JSON, import JSON, download lore draft.
<b>Q&amp;A assistant</b>: requires an Anthropic API key in Settings.
<b>Fetch / Apply automation</b>: requires Perchance host page controls to be present.
`;
  function showOnboardingBanner(panel, onDismiss) {
    if (document.getElementById(`${NS}-onboard`)) return;
    const banner = document.createElement("div");
    banner.id = `${NS}-onboard`;
    banner.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;background:#161b22;border-bottom:1px solid #21262d;font-size:12px;color:#c9d1d9;line-height:1.6">
      <div style="flex:1">${HELP_CONTENT}</div>
      <button id="${NS}-onboard-close" style="all:unset;box-sizing:border-box;cursor:pointer;color:#6e7681;font-size:16px;padding:0 4px;flex-shrink:0" title="Dismiss">\u2715</button>
    </div>`;
    const topbar = panel.querySelector(`#${NS}-header`);
    if (topbar == null ? void 0 : topbar.nextSibling) panel.insertBefore(banner, topbar.nextSibling);
    else panel.appendChild(banner);
    document.getElementById(`${NS}-onboard-close`).addEventListener("click", () => {
      banner.remove();
      markOnboarded();
      onDismiss == null ? void 0 : onDismiss();
    });
  }

  // src/host/scope.js
  function djb2(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = (h << 5) + h ^ str.charCodeAt(i);
    return (h >>> 0).toString(36);
  }
  function readVisibleLabel() {
    var _a, _b, _c;
    if (typeof document === "undefined") return "";
    return ((_b = (_a = document.querySelector(".window .header")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim()) || ((_c = document.title) == null ? void 0 : _c.trim()) || "";
  }
  function getScopeIdentity() {
    const url = typeof location !== "undefined" ? location.href : "unknown://";
    const label = readVisibleLabel();
    const pathname = (typeof location !== "undefined" ? location.pathname : "/").replace(/\/$/, "");
    const segs = pathname.split("/").filter(Boolean);
    if (segs.length >= 2) {
      const scopeId2 = `thread:${djb2(url + label)}`;
      return { scopeId: scopeId2, scopeLabel: label || pathname, confidence: "high" };
    }
    if (label) {
      const scopeId2 = `page:${djb2(url + label)}`;
      return { scopeId: scopeId2, scopeLabel: label, confidence: "medium" };
    }
    const scopeId = `url:${djb2(pathname || url)}`;
    return { scopeId, scopeLabel: pathname || "unknown", confidence: "low" };
  }

  // src/ui/panel.js
  var isOpen = false;
  var activeTab = "map";
  var currentEntries = [];
  var removedEntries = [];
  var trimResult = null;
  var undoStack = [];
  var filterQ = "";
  var selectedIds = /* @__PURE__ */ new Set();
  var healthResult = null;
  var nearDupClusters = [];
  var continuityMap = {};
  var loreLabels = {};
  var lastWindowEl = null;
  var conflictList = [];
  var topicGroups = null;
  var storyBeats = [];
  var sortedEntries = null;
  var analyseSubView = "overview";
  function q(suffix) {
    return document.getElementById(`${NS}-${suffix}`);
  }
  function openPanel() {
    var _a, _b, _c;
    if (isOpen) return;
    isOpen = true;
    let cfg = loadCfg();
    setTokenSource(cfg.tokenizerSource || "auto");
    let savedPos = loadSavedPos(cfg);
    function _saveCfg() {
      saveCfg(cfg);
    }
    function _savePos() {
      savePos(cfg, savedPos);
    }
    (_a = document.getElementById(`${NS}-backdrop`)) == null ? void 0 : _a.remove();
    (_b = document.getElementById(`${NS}-panel`)) == null ? void 0 : _b.remove();
    const backdrop = document.createElement("div");
    backdrop.id = `${NS}-backdrop`;
    const panel = document.createElement("div");
    panel.id = `${NS}-panel`;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Memory Trimmer");
    panel.innerHTML = `
    <!-- ZONE 1: Header (drag handle) -->
    <div id="${NS}-header">
      <span id="${NS}-hdr-title">Memory Trimmer</span>
      <span id="${NS}-ver" title="Click 5\xD7 for a surprise">v${VERSION}</span>
      <span id="${NS}-auto-badge" class="manual" aria-live="polite">\u270B Manual</span>
      <span id="${NS}-verify-badge"></span>
      <span id="${NS}-mode-badge" data-mode="daily" title="Click to switch mode" style="cursor:pointer">Daily</span>
      <span id="${NS}-kbd">Ctrl+Enter=Trim \xB7 Ctrl+Z=Undo \xB7 Esc=Close</span>
      <button id="${NS}-close" title="Close (Esc)" aria-label="Close">\u2715</button>
    </div>

    <!-- Onboarding + Recovery banners (injected here dynamically) -->
    <div id="${NS}-recovery-banner" role="alert">
      <span class="pmt5-recovery-msg" id="${NS}-recovery-msg"></span>
      <button class="pmt5-recovery-act" id="${NS}-recovery-act"></button>
    </div>

    <!-- ZONE 2: Workspace -->
    <div id="${NS}-workspace">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:10px;color:var(--pmt-text-muted)">Paste /mem text or import a file</span>
        <label id="${NS}-import-lbl" class="pmt5-btn-tool" style="cursor:pointer;padding:3px 9px;font-size:11px" title="Import memory from .txt file">
          \u{1F4C2} Import
          <input type="file" id="${NS}-import-file-mem" accept=".txt,.md" style="display:none">
        </label>
      </div>
      <textarea id="${NS}-ta"
        placeholder="Paste /mem text here \u2014 or click \u2B07 Fetch to load automatically."
        spellcheck="false" aria-label="Memory text input"></textarea>
    </div>

    <!-- ZONE 3: Stats strip -->
    <div id="${NS}-stats" aria-live="polite" aria-label="Memory statistics">
      <span class="pmt5-stat">Entries <b id="${NS}-p-n">0</b></span>
      <span class="pmt5-stat">Chars <b id="${NS}-p-ch">0</b></span>
      <span class="pmt5-stat" id="${NS}-tok-pill">Tokens <b id="${NS}-p-tok">0</b><span id="${NS}-tok-src" class="pmt5-stat-src"></span></span>
      <span class="pmt5-stat" id="${NS}-dup-pill">Dups <b id="${NS}-p-dup">0</b></span>
      <span class="pmt5-stat" id="${NS}-max-pill">Longest <b id="${NS}-p-max">0</b>c</span>
      <span class="pmt5-stat" id="${NS}-rep-pill" style="display:none">Repetition <b id="${NS}-p-rep">\u2014</b></span>
      <span style="display:none" id="${NS}-dups-n">0</span>
      <span style="display:none" id="${NS}-conf-n">0</span>
    </div>

    <!-- ZONE 4: Presets strip -->
    <div id="${NS}-presets" aria-label="Trim presets">
      <span id="${NS}-preset-label">Presets</span>
    </div>

    <!-- ZONE 5: Options (collapsible) -->
    <div id="${NS}-opts-toggle" role="button" aria-expanded="false" aria-controls="pmt5-opts-body">
      <span>Options</span>
      <span id="${NS}-opts-summary" style="color:#3d444d;font-size:11px"></span>
      <span class="pmt5-opts-arrow">\u25BE</span>
    </div>
    <div id="${NS}-opts-body" role="region" aria-label="Trim options">
      <div id="${NS}-opts-grid">
        <div class="pmt5-og">
          <div class="pmt5-og-hd">Trim mode</div>
          <select id="${NS}-trim-mode" class="pmt5-sel" aria-label="Trim mode">
            <option value="newest">Keep newest N</option>
            <option value="token_budget">Fit token budget</option>
          </select>
        </div>
        <div class="pmt5-og">
          <div class="pmt5-og-hd">Keep newest</div>
          <select id="${NS}-keep" class="pmt5-sel" aria-label="Keep newest N entries">
            <option value="">No limit</option>
            <option value="10">10 entries</option>
            <option value="20">20 entries</option>
            <option value="25">25 entries</option>
            <option value="50">50 entries</option>
            <option value="75">75 entries</option>
            <option value="100">100 entries</option>
            <option value="custom">Custom\u2026</option>
          </select>
          <input type="number" id="${NS}-keep-n" class="pmt5-numbox"
            placeholder="N" min="1" max="9999" style="display:none;margin-top:4px" aria-label="Custom keep count">
        </div>
        <div class="pmt5-og" id="${NS}-budget-og" style="display:none">
          <div class="pmt5-og-hd">Token budget</div>
          <div class="pmt5-row">
            <input type="number" id="${NS}-budget-n" class="pmt5-numbox"
              placeholder="tokens" min="100" max="99999" aria-label="Target token budget">
            <span id="${NS}-budget-hint" style="font-size:10px;color:#6e7681"></span>
          </div>
        </div>
        <div class="pmt5-og">
          <div class="pmt5-og-hd">Long-entry filter</div>
          <label class="pmt5-lbl">
            <input type="checkbox" id="${NS}-opt-long" aria-label="Trim entries over char limit">
            Trim &gt; <span class="pmt5-cv" id="${NS}-cv">200</span>c
          </label>
          <input type="range" id="${NS}-slider" class="pmt5-slider" min="50" max="600" step="10" value="200" aria-label="Character limit slider">
        </div>
        <div class="pmt5-og">
          <div class="pmt5-og-hd">Extra</div>
          <label class="pmt5-lbl">
            <input type="checkbox" id="${NS}-opt-dedup" aria-label="Remove duplicate entries"> Remove duplicates
          </label>
        </div>
      </div>
    </div>

    <!-- ZONE 6: Primary actions -->
    <div id="${NS}-actions-primary" role="toolbar" aria-label="Primary actions">
      <button class="pmt5-btn pmt5-btn-primary" id="${NS}-run" title="Trim (Ctrl+Enter)">Trim</button>
      <button class="pmt5-btn pmt5-btn-caution" id="${NS}-apply-mem" disabled title="Apply to Perchance (Ctrl+Shift+Enter)">\u2B06 Apply</button>
      <button class="pmt5-btn pmt5-btn-recovery" id="${NS}-restore" disabled title="Restore last snapshot">\u21A9 Restore</button>
      <button class="pmt5-btn pmt5-btn-neutral"  id="${NS}-copy"    disabled title="Copy to clipboard (Ctrl+Shift+C)">Copy</button>
      <button class="pmt5-btn pmt5-btn-secondary" id="${NS}-undo" disabled title="Undo last trim (Ctrl+Z)">Undo</button>
      <span id="${NS}-undo-lbl"></span>
      <button id="${NS}-more-toggle" aria-expanded="false" aria-controls="pmt5-actions-secondary">More \u25BE</button>
    </div>

    <!-- ZONE 7: Secondary actions (hidden by default) -->
    <div id="${NS}-actions-secondary" role="toolbar" aria-label="More actions">
      <button class="pmt5-btn-tool accent" id="${NS}-fetch" data-maturity="beta"       title="Fetch /mem from Perchance">\u2B07 Fetch</button>
      <button class="pmt5-btn-tool"        id="${NS}-prev" data-maturity="stable"   disabled title="Preview diff">Preview</button>
      <button class="pmt5-btn-tool"        id="${NS}-snap" data-maturity="beta"   disabled title="Save snapshot">\u{1F4F7} Snap</button>
      <button class="pmt5-btn-tool"        id="${NS}-exp-kept" data-maturity="stable"    disabled title="Download kept entries">\u2B07 Kept</button>
      <button class="pmt5-btn-tool"        id="${NS}-exp-removed" data-maturity="stable" disabled title="Download removed entries">\u2B07 Removed</button>
      <button class="pmt5-btn-tool lore"   id="${NS}-lore" data-maturity="beta"  disabled title="Copy as lore draft">\u{1F4D6} Lore</button>
      <button class="pmt5-btn-tool"        id="${NS}-sort-sim" data-maturity="beta"    disabled title="Group similar entries">\u{1F500} Group</button>
      <button class="pmt5-btn-tool qa"     id="${NS}-qa" data-maturity="experimental"          title="Memory Q&amp;A \u2014 Experimental (needs API key in Settings)">\u{1F4AC} Q&amp;A <span style='font-size:9px;opacity:0.6'>Exp.</span></button>
      <button class="pmt5-btn-tool"        id="${NS}-map" data-maturity="beta"   disabled title="Expand Timeline to full-screen overlay">\u2922 Expand</button>
      <button class="pmt5-btn-tool danger" id="${NS}-clr" data-maturity="stable"         title="Clear all">Clear</button>
    </div>

    <!-- Progress rail -->
    <div id="${NS}-rail"><div id="${NS}-fill"></div></div>

    <!-- ZONE 8: Tabs (consolidated) -->
    <div id="${NS}-tabs" role="tablist">
      <div class="pmt5-tab pmt5-active" data-tab="map"      role="tab" aria-selected="true">\u{1FAE7} Timeline</div>
      <div class="pmt5-tab"             data-tab="result"   role="tab">Result</div>
      <div class="pmt5-tab"             data-tab="removed"  role="tab">Removed <span class="pmt5-tab-badge" id="${NS}-removed-n">0</span></div>
      <div class="pmt5-tab"             data-tab="preview"  role="tab">Preview</div>
      <div class="pmt5-tab"             data-tab="analyse"  role="tab">Analyse <span class="pmt5-tab-badge" id="${NS}-analyse-badge">\u2014</span></div>
      <div class="pmt5-tab"             data-tab="curate"   role="tab">Curate</div>
      <div class="pmt5-tab"             data-tab="compare"  role="tab">Compare</div>
      <div class="pmt5-tab"             data-tab="snapshots" role="tab">\u{1F4F8} Snapshots <span class="pmt5-tab-badge" id="${NS}-snap-n">0</span></div>
      <div class="pmt5-tab"             data-tab="settings" role="tab">Settings</div>
    </div>

    <!-- ZONE 9: Output -->
    <div id="${NS}-output-zone" role="tabpanel">
      <div id="${NS}-search" aria-label="Filter entries">
        <input id="${NS}-search-in" type="text" placeholder="Filter entries\u2026" autocomplete="off" spellcheck="false" aria-label="Search entries">
        <span id="${NS}-search-count" aria-live="polite"></span>
      </div>
      <div id="${NS}-out-scroll"><div id="${NS}-out"></div></div>
      <div id="${NS}-settings"></div>
      <div id="${NS}-diag-drawer" aria-label="Diagnostics">
        <div class="pmt5-diag-row"><span class="pmt5-diag-key">Host status:</span><span class="pmt5-diag-val" id="${NS}-diag-host">\u2014</span></div>
        <div class="pmt5-diag-row"><span class="pmt5-diag-key">Token source:</span><span class="pmt5-diag-val" id="${NS}-diag-tok">\u2014</span></div>
        <div class="pmt5-diag-row"><span class="pmt5-diag-key">Workspace size:</span><span class="pmt5-diag-val" id="${NS}-diag-size">\u2014</span></div>
        <div class="pmt5-diag-row"><span class="pmt5-diag-key">Storage:</span><span class="pmt5-diag-val" id="${NS}-diag-store">\u2014</span></div>
        <div class="pmt5-diag-row"><span class="pmt5-diag-key">Smoke tests:</span><span class="pmt5-diag-val" id="${NS}-diag-smoke">not run</span></div>
        <div class="pmt5-diag-row" style="flex-direction:column;gap:2px"><span class="pmt5-diag-key">Recent actions:</span><span class="pmt5-diag-val" id="${NS}-diag-hist" style="font-size:10px;white-space:pre;opacity:0.7">\u2014</span></div>
        <button id="${NS}-run-smoke" style="all:unset;box-sizing:border-box;cursor:pointer;color:#388bfd;font-size:11px;margin-top:4px">\u25B6 Run smoke tests</button>
        <button id="${NS}-copy-diag" style="all:unset;box-sizing:border-box;cursor:pointer;color:#8b949e;font-size:11px;margin-top:4px;margin-left:12px">\u{1F4CB} Copy diagnostic report</button>

      </div>
      <div id="${NS}-compare-area">
        <div style="font-size:11px;color:#6e7681">Paste lore or summary text to compare with current memory:</div>
        <textarea id="${NS}-lore-input"    placeholder="Paste lore text here\u2026"    spellcheck="false" aria-label="Lore text for comparison"></textarea>
        <textarea id="${NS}-summary-input" placeholder="Paste summary text here\u2026" spellcheck="false" aria-label="Summary text for comparison"></textarea>
        <button id="${NS}-run-compare" class="pmt5-btn pmt5-btn-secondary" style="width:fit-content">Compare</button>
      </div>
    </div>

    <!-- Post-trim guidance (Advanced/Debug mode only) -->
    <!-- BUG-13 fix: inline color/background removed \u2014 use CSS class so light theme can override -->
    <div id="${NS}-post-trim-hint" class="pmt5-post-trim-hint" style="display:none" aria-live="polite"></div>

    <!-- Status bar -->
    <div id="${NS}-status" role="status">
      <span id="${NS}-status-msg" aria-live="polite">Ready \u2014 paste memory text, then click Trim.</span>
      <!-- BUG-18 fix: removed orphaned #pmt5-undo-label here; undo count is shown in Zone 6 via #pmt5-undo-lbl -->
    </div>
  `;
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    const hadSavedPos = restorePosition(panel, savedPos.panel, true);
    if (!hadSavedPos) {
      panel.classList.add(`${NS}-open-anim`);
      panel.addEventListener("animationend", () => panel.classList.remove(`${NS}-open-anim`), { once: true });
    } else {
      panel.style.opacity = "0";
      requestAnimationFrame(() => requestAnimationFrame(() => {
        panel.style.transition = "opacity 0.18s ease";
        panel.style.opacity = "1";
        panel.addEventListener("transitionend", () => {
          panel.style.transition = "";
          panel.style.opacity = "";
        }, { once: true });
      }));
    }
    const ta = q("ta");
    const importFileMem = q("import-file-mem");
    if (importFileMem) {
      importFileMem.addEventListener("change", () => {
        const file = importFileMem.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          currentEntries = [];
          removedEntries = [];
          trimResult = null;
          ta.value = ev.target.result;
          updatePills();
          setStatus(`Imported "${file.name}" (${(file.size / 1024).toFixed(1)} KB).`, "ok", 4e3);
          if (cfg.autoFocus) ta.focus();
        };
        reader.onerror = () => setStatus("Could not read file.", "err", 4e3);
        reader.readAsText(file);
        importFileMem.value = "";
      });
    }
    const btnRun = q("run");
    const btnCopy = q("copy");
    const btnPrev = q("prev");
    const btnClr = q("clr");
    const btnClose = q("close");
    btnClose.addEventListener("pointerdown", (e) => e.stopPropagation());
    const optLong = q("opt-long");
    const slider = q("slider");
    const cvDisp = q("cv");
    const keepSel = q("keep");
    const keepN = q("keep-n");
    const optDedup = q("opt-dedup");
    const tabsEl = q("tabs");
    const settingEl = q("settings");
    const searchBar = q("search");
    const searchIn = q("search-in");
    const searchCt = q("search-count");
    const outScroll = q("out-scroll");
    const outEl = q("out");
    const progFill = q("fill");
    const statusMsg = q("status-msg");
    const undoLabel = q("undo-lbl");
    const removedN = q("removed-n");
    const verBadge = q("ver");
    const hdr = q("header");
    const btnExpKept = q("exp-kept");
    const btnExpRem = q("exp-removed");
    const btnSnap = q("snap");
    const repPill = q("rep-pill");
    const repVal = q("p-rep");
    const btnFetch = q("fetch");
    const btnApplyMem = q("apply-mem");
    const btnLore = q("lore");
    const trimModeEl = q("trim-mode");
    const budgetOg = q("budget-og");
    const budgetN = q("budget-n");
    const budgetHint = q("budget-hint");
    const dupsN = (_c = q("dups-n")) != null ? _c : { textContent: "" };
    const btnSortSim = q("sort-sim");
    const confN = q("conf-n");
    const recovBanner = q("recovery-banner");
    const recovMsg = q("recovery-msg");
    const recovAct = q("recovery-act");
    const diagDrawer = q("diag-drawer");
    const diagHost = q("diag-host");
    const diagTok = q("diag-tok");
    const diagSize = q("diag-size");
    const diagStore = q("diag-store");
    const diagSmoke = q("diag-smoke");
    const compareArea = q("compare-area");
    const btnQa = q("qa");
    const btnMap = q("map");
    const optsToggle = q("opts-toggle");
    const optsBody = q("opts-body");
    const optsSummary = q("opts-summary");
    const moreToggle = q("more-toggle");
    const morePanel = q("actions-secondary");
    const autoBadge = q("auto-badge");
    const verifyBadge = q("verify-badge");
    const analyseBadge = q("analyse-badge");
    const btnRestore = q("restore");
    const btnUndo = q("undo");
    const PP = {
      n: q("p-n"),
      ch: q("p-ch"),
      tok: q("p-tok"),
      dup: q("p-dup"),
      max: q("p-max"),
      tokPill: q("tok-pill"),
      dupPill: q("dup-pill"),
      maxPill: q("max-pill")
    };
    optLong.checked = cfg.trimLong;
    slider.value = cfg.charLimit;
    cvDisp.textContent = cfg.charLimit;
    optDedup.checked = cfg.dedup;
    PP.tokPill.style.display = cfg.showTokens ? "" : "none";
    const STD_KEEPS = ["", "10", "20", "25", "50", "75", "100"];
    if (STD_KEEPS.includes(String(cfg.keepN))) {
      keepSel.value = cfg.keepN;
    } else if (cfg.keepN) {
      keepSel.value = "custom";
      keepN.style.display = "block";
      keepN.value = cfg.keepN;
    }
    optsToggle.addEventListener("click", () => {
      const open = optsBody.classList.toggle("open");
      optsToggle.classList.toggle("open", open);
      optsToggle.setAttribute("aria-expanded", open);
      _updateOptsSummary();
    });
    moreToggle.addEventListener("click", () => {
      const open = morePanel.classList.toggle("open");
      moreToggle.textContent = open ? "Less \u25B4" : "More \u25BE";
      moreToggle.setAttribute("aria-expanded", open);
    });
    function _updateOptsSummary() {
      const parts = [];
      if (cfg.trimMode === "token_budget") parts.push(`budget ${cfg.targetTokens || "?"}t`);
      else if (cfg.keepN) parts.push(`keep ${cfg.keepN}`);
      if (cfg.trimLong) parts.push(`<${cfg.charLimit}c`);
      if (cfg.dedup) parts.push("dedup");
      optsSummary.textContent = parts.length ? `(${parts.join(", ")})` : "";
    }
    _updateOptsSummary();
    const scope = getScopeIdentity();
    function _updateAutoBadge() {
      var _a2;
      if (!autoBadge) return;
      const state = getAutomationState();
      const map = {
        "connected": { text: "\u26A1 Connected", cls: "connected" },
        "window-detected": { text: "\u{1FA9F} Window", cls: "windowed" },
        "manual": { text: "\u270B Manual", cls: "manual" }
      };
      const info = (_a2 = map[state.status]) != null ? _a2 : { text: "\u2014", cls: "manual" };
      autoBadge.textContent = info.text;
      autoBadge.className = info.cls;
    }
    if (cfg.showAutomationBadge) _updateAutoBadge();
    else if (autoBadge) autoBadge.style.display = "none";
    // Gate host-dependent controls based on live capability detection
    const caps = buildCapabilities(cfg);
    if (!caps.automation && btnFetch) {
      btnFetch.disabled = true;
      btnFetch.title = "Fetch unavailable \u2014 Perchance host controls not detected. Use manual paste.";
    }
    if (!caps.memoryWindowAccess && btnApplyMem) {
      btnApplyMem.title = "Apply may not work \u2014 no Perchance memory window detected. Use Copy instead.";
    }
    if (!caps.miniToolbar && document.getElementById(`${NS}-stg-inject-toolbar`)) {
      const el = document.getElementById(`${NS}-stg-inject-toolbar`);
      if (el) el.title = "Mini toolbar unavailable \u2014 no Perchance memory window found.";
    }
    // Gate Q&A button — still accessible for local mode, but label reflects key state
    if (btnQa && !caps.qaRemote) {
      btnQa.title = "Q\u26AC A \u2014 Local mode only (no API key). Add a key in Settings \u203A Experimental \u203A Q&A Assistant for remote mode.";
    }
    // Reflect native token availability in diagDrawer token source row on next update
    if (!caps.nativeTokens) {
      const tokSrcEl = q("tok-src");
      if (tokSrcEl) tokSrcEl.title = "Native token counter (window.countTokens) not available on this page \u2014 using heuristic";
    }
    function showRecovery(msg, actionLabel, onAction) {
      recovMsg.textContent = msg;
      recovAct.textContent = actionLabel;
      recovBanner.classList.add(`${NS}-visible`);
      const handler = () => {
        recovBanner.classList.remove(`${NS}-visible`);
        onAction == null ? void 0 : onAction();
      };
      recovAct.onclick = handler;
    }
    function hideRecovery() {
      recovBanner.classList.remove(`${NS}-visible`);
    }
    const presetsEl = q("presets");
    BUILTIN_PRESETS.forEach((preset) => {
      const btn = document.createElement("button");
      btn.className = `${NS}-preset-btn`;
      btn.textContent = preset.label;
      btn.title = preset.desc;
      btn.addEventListener("click", () => {
        const merged = applyPreset(cfg, preset.opts);
        if (merged.dedup !== void 0) optDedup.checked = merged.dedup;
        if (merged.trimLong !== void 0) optLong.checked = merged.trimLong;
        if (merged.charLimit !== void 0) {
          slider.value = merged.charLimit;
          cvDisp.textContent = merged.charLimit;
        }
        if (merged.keepN !== void 0) {
          const inStd = ["", "10", "20", "25", "30", "50", "75", "100"].includes(String(merged.keepN));
          keepSel.value = inStd ? String(merged.keepN) : "custom";
          if (!inStd) {
            keepN.style.display = "block";
            keepN.value = merged.keepN;
          } else keepN.style.display = "none";
        }
        if (merged.trimMode !== void 0) {
          trimModeEl.value = merged.trimMode;
          syncTrimModeUI();
        }
        cfg = merged;
        _saveCfg();
        setStatus(`Preset applied: ${preset.label}`, "ok", 3e3);
      });
      presetsEl.appendChild(btn);
    });
    if (isFirstRun()) {
      showOnboardingBanner(panel, () => {
      });
    }
    function updateDiagDrawer() {
      diagHost.textContent = getAutomationState().status;
      diagTok.textContent = getTokenSourceLabel();
      if (diagSize) diagSize.textContent = `${currentEntries.length} entr${currentEntries.length === 1 ? "y" : "ies"} \xB7 ~${getNativeTokenCount(currentEntries.join("\n\n")).toLocaleString()}t`;
      const hist = formatHistory(5);
      if (hist) {
        const histEl = document.getElementById(`${NS}-diag-hist`);
        if (histEl) histEl.textContent = hist;
      }
      diagStore.textContent = "calculating\u2026";
      Promise.resolve().then(() => (init_storage(), storage_exports)).then(({ getStorageHealthSnapshot: getStorageHealthSnapshot2 }) => {
        getStorageHealthSnapshot2().then((h) => {
          diagStore.textContent = `${h.pmtKb}KB used`;
        }).catch(() => {
          diagStore.textContent = "n/a";
        });
      }).catch(() => {
      });
    }
    const runSmokeBtn = q("run-smoke");
    const copyDiagBtn = q("copy-diag");
    if (runSmokeBtn) {
      runSmokeBtn.addEventListener("click", async () => {
        runSmokeBtn.textContent = "\u25B6 Running\u2026";
        const { runSmokeTests: runSmokeTests2 } = await Promise.resolve().then(() => (init_smoketests(), smoketests_exports));
        const r = runSmokeTests2();
        diagSmoke.textContent = `${r.passCount}/${r.passCount + r.failCount} passed`;
        diagSmoke.style.color = r.failCount > 0 ? "var(--pmt-danger)" : "var(--pmt-success)";
        runSmokeBtn.textContent = "\u25B6 Run smoke tests";
      });
    }
    if (copyDiagBtn) {
      copyDiagBtn.addEventListener("click", async () => {
        var _a2;
        const report = [
          `PMT Diagnostic Report`,
          `======================`,
          `Version     : ${VERSION}`,
          `Mode        : ${getMode()}`,
          `Scope       : ${scope.scopeLabel} (${scope.confidence} confidence)`,
          `Entries     : ${currentEntries.length} current, ${removedEntries.length} removed`,
          `Token source: ${getTokenSourceLabel()}`,
          `Host        : ${getAutomationState().status}`,
          `History     : ${formatHistory(5)}`,
          `Smoke       : ${(_a2 = diagSmoke == null ? void 0 : diagSmoke.textContent) != null ? _a2 : "not run"}`,
          `User agent  : ${navigator.userAgent.slice(0, 80)}`,
          `Timestamp   : ${(/* @__PURE__ */ new Date()).toISOString()}`
        ].join("\n");
        try {
          await writeClipboard(report);
          copyDiagBtn.textContent = "\u2713 Copied";
          setTimeout(() => {
            if (copyDiagBtn.isConnected) copyDiagBtn.textContent = "\u{1F4CB} Copy diagnostic report";
          }, 2500);
        } catch {
          copyDiagBtn.textContent = "\u2717 Failed";
        }
      });
    }
    function syncTrimModeUI() {
      var _a2;
      const isBudget = trimModeEl.value === "token_budget";
      budgetOg.style.display = isBudget ? "" : "none";
      if (isBudget) {
        const { getIdealMaxContextTokens: getIdealMaxContextTokens2 } = (_a2 = window.__PMT_HELPERS__) != null ? _a2 : {};
        const ideal = typeof window.idealMaxContextTokens === "number" ? Math.floor(window.idealMaxContextTokens * 0.3) : null;
        budgetHint.textContent = ideal ? `Host suggests ~${ideal} for memory` : "";
        if (ideal && !budgetN.value) budgetN.value = ideal;
      }
    }
    trimModeEl.addEventListener("change", syncTrimModeUI);
    if (cfg.trimMode === "token_budget") {
      trimModeEl.value = "token_budget";
      if (cfg.targetTokens) budgetN.value = cfg.targetTokens;
    }
    syncTrimModeUI();
    makeDraggable(panel, hdr, (pos) => {
      panel.classList.add(`${NS}-positioned`);
      savedPos.panel = pos;
      _savePos();
    });
    const currentMode = getMode();
    applyMode(currentMode, NS);
    const modeBadgeEl = q("mode-badge");
    if (modeBadgeEl) {
      modeBadgeEl.addEventListener("click", () => {
        const modes = [MODES.DAILY, MODES.ADVANCED, MODES.DEBUG];
        const curr = getMode();
        const next = modes[(modes.indexOf(curr) + 1) % modes.length];
        setMode(next);
        applyMode(next, NS);
        setStatus(`Switched to ${next} mode.`, "ok", 2500);
      });
    }
    let hasStaleResult = false;
    ta.addEventListener("input", () => {
      if (currentEntries.length > 0 && !hasStaleResult) {
        hasStaleResult = true;
        ta.style.borderColor = "#f0883e";
        ta.title = "Paste area has changed since last Trim \u2014 results may be stale";
      }
    });
    function clearStaleState() {
      hasStaleResult = false;
      ta.style.borderColor = "";
      ta.title = "";
    }
    if (currentEntries.length > 0 && !ta.value.trim()) {
      ta.value = currentEntries.join("\n\n");
      updatePills();
    }
    if (!currentEntries.length && activeTab !== "result" && activeTab !== "settings" && activeTab !== "map") {
      activeTab = "map";
    }
    if (cfg.autoFocus) setTimeout(() => ta.focus(), 50);
    panel._statusTimer = null;
    function setStatus(msg, type = "", clearMs = 0) {
      clearTimeout(panel._statusTimer);
      statusMsg.textContent = msg;
      statusMsg.className = type ? `${NS}-${type}` : "";
      if (clearMs > 0) {
        panel._statusTimer = setTimeout(() => {
          if (statusMsg.isConnected) {
            statusMsg.textContent = "";
            statusMsg.className = "";
          }
        }, clearMs);
      }
    }
    function _refreshUndo() {
      const n = undoStack.length;
      if (btnUndo) btnUndo.disabled = n === 0;
      if (undoLabel) {
        undoLabel.textContent = n > 0 ? `${n} undo${n > 1 ? "s" : ""}` : "";
      }
    }
    function updatePills() {
      try {
        const raw = ta.value;
        const ents = parseEntries(raw);
        const dups = countDups(ents);
        const maxL = ents.reduce((a, e) => Math.max(a, e.length), 0);
        PP.n.textContent = ents.length.toLocaleString();
        PP.ch.textContent = raw.length.toLocaleString();
        PP.tok.textContent = estTokens(raw).toLocaleString();
        const tokSrcEl = q("tok-src");
        if (tokSrcEl) tokSrcEl.textContent = getTokenSourceLabel();
        PP.dup.textContent = dups;
        PP.max.textContent = maxL;
        PP.dupPill.classList.toggle(`${NS}-warn`, dups > 0);
        PP.maxPill.classList.toggle(
          `${NS}-warn`,
          optLong.checked && maxL > parseInt(slider.value, 10)
        );
      } catch {
      }
    }
    ta.addEventListener("input", updatePills);
    updatePills();
    slider.addEventListener("input", () => {
      cvDisp.textContent = slider.value;
      updatePills();
    });
    keepSel.addEventListener("change", () => {
      keepN.style.display = keepSel.value === "custom" ? "block" : "none";
    });
    function persistOpts() {
      cfg.charLimit = parseInt(slider.value, 10) || 200;
      cfg.keepN = keepSel.value === "custom" ? keepN.value || "" : keepSel.value;
      cfg.trimLong = optLong.checked;
      cfg.dedup = optDedup.checked;
      cfg.trimMode = trimModeEl.value;
      cfg.targetTokens = parseInt(budgetN.value, 10) || 0;
      _saveCfg();
      _updateOptsSummary();
    }
    [optLong, optDedup].forEach((el) => el.addEventListener("change", persistOpts));
    slider.addEventListener("change", persistOpts);
    keepSel.addEventListener("change", persistOpts);
    keepN.addEventListener("input", persistOpts);
    function readOpts() {
      const pinnedIds = getPinnedIds(scope.scopeId);
      return {
        charLimit: parseInt(slider.value, 10) || 200,
        keepN: keepSel.value === "custom" ? keepN.value || "" : keepSel.value,
        trimLong: optLong.checked,
        dedup: optDedup.checked,
        trimMode: trimModeEl.value,
        targetTokens: parseInt(budgetN.value, 10) || 0,
        protectedEntryIds: pinnedIds,
        getEntryId,
        continuityScores: continuityMap ? Object.entries(continuityMap).map(([entryId, v]) => {
          var _a2;
          return { entryId, score: (_a2 = v.score) != null ? _a2 : 0 };
        }) : null
      };
    }
    function _pinToggle(entryId) {
      const nowPinned = togglePin(scope.scopeId, entryId);
      setStatus(nowPinned ? "Entry pinned (persists across sessions)." : "Entry unpinned.", "ok", 2500);
      renderOutput();
    }
    function _selectEntry(entryId, checked) {
      checked ? selectedIds.add(entryId) : selectedIds.delete(entryId);
      _updateBatchBar();
    }
    function renderOutput() {
      var _a2;
      const pinnedIds = getPinnedIds(scope.scopeId);
      loreLabels = getEntryLabels(scope.scopeId, store);
      if (activeTab === "result") {
        renderResultTab({
          outEl,
          searchCt,
          entries: currentEntries,
          filterQ,
          ns: NS,
          selectedIds,
          pinnedIds,
          protectedIds: /* @__PURE__ */ new Set(),
          hotspotEntryIds: /* @__PURE__ */ new Set(),
          continuityMap,
          loreLabels,
          getEntryId,
          showPerEntryTokens: (_a2 = cfg.showPerEntryTokens) != null ? _a2 : false,
          onSelect: _selectEntry,
          onPinToggle: _pinToggle,
          annotations: getAnnotations(scope.scopeId)
        });
      } else if (activeTab === "removed") {
        renderRemovedTab({ outEl, searchCt, entries: removedEntries, filterQ, ns: NS });
      } else if (activeTab === "preview") {
        renderPreviewTab({ outEl, outScroll, trimResult, ns: NS });
      } else if (activeTab === "map") {
        const pinnedIds2 = getPinnedIds(scope.scopeId);
        renderBubbleMapInline(outEl, outScroll, {
          entries: currentEntries,
          continuityMap,
          pinnedIds: pinnedIds2,
          getEntryId,
          onPinToggle: _pinToggle,
          onApplyOrder: (sorted) => {
            sortedEntries = sorted;
            currentEntries = sorted;
            setStatus("\u2195 Order applied \u2014 timeline re-rendered.", "ok", 4e3);
            switchTab("map");
          }
        });
      } else if (activeTab === "analyse") {
        _renderAnalyse();
      } else if (activeTab === "curate") {
        _renderCurate();
      } else if (activeTab === "compare") {
        outEl.style.display = "none";
        if (compareArea) compareArea.style.display = "flex";
        return;
      } else if (activeTab === "snapshots") {
        _renderSnapshots();
      }
      if (compareArea) compareArea.style.display = "none";
      outEl.style.display = "";
    }
    function _renderAnalyse() {
      if (!currentEntries.length) {
        outEl.innerHTML = `<span class="${NS}-hint">Run Trim first.</span>`;
        return;
      }
      const views = [
        { id: "overview",   label: "Overview" },
        { id: "health",     label: "\uD83C\uDFE5 Health",     badge: healthResult ? `${healthResult.score}/100` : null },
        { id: "dups",       label: "\u267B Dups",        badge: nearDupClusters.length > 0 ? nearDupClusters.length : null },
        { id: "conflicts",  label: "\u26A0 Conflicts",  badge: conflictList.length > 0 ? conflictList.length : null },
        { id: "topics",     label: "\uD83D\uDCDA Topics" },
        { id: "beats",      label: "\uD83D\uDCC5 Beats",      badge: storyBeats.length > 0 ? storyBeats.length : null },
        { id: "relevance",  label: "\uD83C\uDFAF Relevance" }
      ];
      const navHtml = `<div class="${NS}-sub-nav" role="tablist">${
        views.map(({ id, label, badge }) =>
          `<button class="${NS}-sub-nav-btn${analyseSubView === id ? " " + NS + "-sub-active" : ""}" data-sub="${escHtml(id)}" role="tab" aria-selected="${analyseSubView === id}">${escHtml(label)}${badge != null ? `<span class="${NS}-tab-badge">${badge}</span>` : ""}</button>`
        ).join("")
      }</div><div class="${NS}-sub-content"></div>`;
      outEl.innerHTML = navHtml;
      outEl.querySelectorAll(`.${NS}-sub-nav-btn`).forEach((btn) => {
        btn.addEventListener("click", () => {
          analyseSubView = btn.dataset.sub;
          _renderAnalyse();
        });
      });
      const sub = outEl.querySelector(`.${NS}-sub-content`);
      if (analyseSubView === "overview")  _renderAnalyseOverview(sub);
      else if (analyseSubView === "health")    _renderHealth(sub);
      else if (analyseSubView === "dups")      _renderDups(sub);
      else if (analyseSubView === "conflicts") _renderConflicts(sub);
      else if (analyseSubView === "topics")    _renderTopics(sub);
      else if (analyseSubView === "beats")     _renderTimeline(sub);
      else if (analyseSubView === "relevance") _renderRelevance(sub);
    }
    function _renderAnalyseOverview(el) {
      var _a2;
      const lines = [];
      if (healthResult) {
        const hc = { healthy: "ok", "needs review": "warn", bloated: "warn", "high risk": "err" }[healthResult.label] || "kept";
        lines.push(`<span class="${NS}-c-${hc}"><b>\uD83C\uDFE5 Health: ${healthResult.label.toUpperCase()}</b> (${healthResult.score}/100 \xB7 ${healthResult.totalTokens}t) \u2014 <em style="font-weight:normal">${escHtml(explainHealth(healthResult))}</em></span>`);
        healthResult.reasons.forEach((r) => lines.push(`<span class="${NS}-c-${hc}">  \xB7 ${escHtml(r)}</span>`));
        if (healthResult.suggestions.length) {
          lines.push("");
          healthResult.suggestions.forEach((s) => lines.push(`<span class="${NS}-c-ok">  \u2192 ${escHtml(s)}</span>`));
        }
      }
      if (repPill.style.display !== "none") {
        lines.push("", `<span class="${NS}-c-sep">${"\u2500".repeat(40)}</span>`);
        lines.push(`<span class="${NS}-c-warn"><b>\uD83D\uDD25 Repetition risk: ${(_a2 = repVal == null ? void 0 : repVal.textContent) != null ? _a2 : "\u2014"}</b></span>`);
      }
      if (nearDupClusters.length) {
        lines.push("", `<span class="${NS}-c-sep">${"\u2500".repeat(40)}</span>`);
        lines.push(`<span class="${NS}-c-warn"><b>\u267B Near-duplicates: ${nearDupClusters.length} cluster${nearDupClusters.length !== 1 ? "s" : ""}</b> \u2014 click \u267B Dups tab for detail</span>`);
        nearDupClusters.slice(0, 3).forEach((cl, i) => {
          var _a3;
          lines.push(`<span class="${NS}-c-kept">  Cluster ${i + 1}: ${escHtml(cl.entries[0].slice(0, 80))}\u2026</span>`);
          lines.push(`<span class="${NS}-hint">    ${explainNearDup(cl.maxSimilarity, (_a3 = cl.reasons) != null ? _a3 : [])}</span>`);
        });
      }
      if (conflictList.length) {
        lines.push("", `<span class="${NS}-c-sep">${"\u2500".repeat(40)}</span>`);
        lines.push(`<span class="${NS}-c-warn"><b>\u26A0 Conflicts: ${conflictList.length}</b> \u2014 click \u26A0 Conflicts tab for detail</span>`);
        conflictList.slice(0, 3).forEach((c) => lines.push(`<span class="${NS}-c-warn">  ${c.severity}: ${escHtml(c.reasons[0])}</span>`));
      }
      if (!lines.length) lines.push(`<span class="${NS}-hint">Run Trim to populate analysis.</span>`);
      el.innerHTML = lines.join("\n");
    }
    function _renderHealth(el) {
      if (!healthResult) { el.innerHTML = `<span class="${NS}-hint">Run Trim first.</span>`; return; }
      renderHealthTab({ outEl: el, healthResult, ns: NS });
    }
    function _renderDups(el) {
      if (!nearDupClusters.length) { el.innerHTML = `<span class="${NS}-hint">No near-duplicate clusters found.</span>`; return; }
      renderDupsTab({ outEl: el, clusters: nearDupClusters, ns: NS });
    }
    function _renderConflicts(el = null) {
      const target = el || outEl;
      const esc = escHtml;
      if (!conflictList.length) {
        target.innerHTML = `<span class="${NS}-hint">No conflicts detected in current kept entries.</span>`;
        return;
      }
      target.innerHTML = conflictList.slice(0, PERF_CAPS.conflictLimit).map(
        (c) => `<span class="${NS}-c-warn">\u26A0 ${esc(explainConflict(c))}</span>
<span class="${NS}-c-kept">  A: ${esc(c.entryA.slice(0, 120))}</span>
<span class="${NS}-c-gone">  B: ${esc(c.entryB.slice(0, 120))}</span>`
      ).join(`
<span class="${NS}-c-sep">${"\u2500".repeat(40)}</span>
`);
    }
    function _renderTopics(el = null) {
      const target = el || outEl;
      if (!topicGroups) {
        target.innerHTML = `<span class="${NS}-hint">Run Trim first to generate topic groups.</span>`;
        return;
      }
      const lines = [];
      const render = (label, groups) => {
        if (!groups.length) return;
        lines.push(`<span class="${NS}-c-ok"><b>${escHtml(label)}</b></span>`);
        groups.slice(0, 10).forEach(([name, items]) =>
          lines.push(`<span class="${NS}-c-kept">  ${escHtml(name)} (${items.length} entr${items.length === 1 ? "y" : "ies"})</span>`)
        );
        lines.push("");
      };
      render("Characters / People", topicGroups.persons);
      render("Locations", topicGroups.locations);
      render("Themes", topicGroups.themes);
      if (!lines.length) lines.push(`<span class="${NS}-hint">No topic groups found.</span>`);
      target.innerHTML = lines.join("\n");
    }
    function _renderTimeline(el = null) {
      const target = el || outEl;
      if (!storyBeats.length) {
        target.innerHTML = `<span class="${NS}-hint">Run Trim first to extract story beats.</span>`;
        return;
      }
      const beats = storyBeats.slice(0, PERF_CAPS.beatLimit);
      const typeIcon = { event: "\u26A1", relationship_change: "\uD83D\uDC9E", world_fact: "\uD83C\uDF0D", hook: "\u2753", misc: "\xB7" };
      target.innerHTML = beats.map((b) => {
        var _a2;
        return `<span class="${NS}-c-kept">${(_a2 = typeIcon[b.beatType]) != null ? _a2 : "\xB7"} <b>[${escHtml(b.beatType.replace("_", " "))}]</b> ${escHtml(b.entry.slice(0, 140))}</span>`;
      }).join(`\n<span class="${NS}-c-sep">\u2500</span>\n`);
    }
    function _renderRelevance(el = null) {
      const target = el || outEl;
      const ctx = readRecentContext();
      if (!ctx || !currentEntries.length) {
        target.innerHTML = `<span class="${NS}-hint">${!currentEntries.length ? "Run Trim first." : "No recent Perchance chat context found \u2014 open PMT within an active chat."}</span>`;
        return;
      }
      const scored = scoreRelevance(currentEntries, ctx, getEntryId).slice(0, 30);
      const ctxNote = `<span class="${NS}-c-sep">Scored against ${ctx.length} chars of recent chat context \u2500</span>\n`;
      target.innerHTML = ctxNote + scored.map((s) =>
        `<span class="${NS}-c-kept"><b>${String(Math.round(s.score * 100) / 100).padStart(4)}</b>  ${escHtml(s.entry.slice(0, 150))}</span>`
      ).join("\n");
    }
    function _renderCurate() {
      const lines = [];
      const ctx = readRecentContext();
      if (ctx) {
        lines.push(`<span class="${NS}-c-sep">\uD83C\uDFAF Context: ${ctx.length} chars captured from recent chat \u2500</span>`);
        lines.push("");
      }
      if (topicGroups) {
        lines.push(`<span class="${NS}-c-ok"><b>\uD83D\uDCDA Topic Groups</b></span>`);
        const render = (label, groups) => {
          if (!groups.length) return;
          lines.push(`<span class="${NS}-c-sep">${escHtml(label)}</span>`);
          groups.slice(0, 5).forEach(([name, items]) =>
            lines.push(`<span class="${NS}-c-kept">  ${escHtml(name)} \u2014 ${items.length} entries</span>`)
          );
        };
        render("Characters", topicGroups.persons);
        render("Locations", topicGroups.locations);
        render("Themes", topicGroups.themes);
      }
      if (storyBeats.length) {
        lines.push("", `<span class="${NS}-c-sep">${"\u2500".repeat(40)}</span>`);
        lines.push(`<span class="${NS}-c-ok"><b>\uD83D\uDCC5 Story Beats (${storyBeats.length})</b></span>`);
        const icons = { event: "\u26A1", relationship_change: "\uD83D\uDC9E", world_fact: "\uD83C\uDF0D", hook: "\u2753", misc: "\xB7" };
        storyBeats.slice(0, 8).forEach((b) =>
          lines.push(`<span class="${NS}-c-kept">${icons[b.beatType] || "\xB7"} ${escHtml(b.entry.slice(0, 120))}</span>`)
        );
      }
      if (ctx && currentEntries.length) {
        const scored = scoreRelevance(currentEntries, ctx, getEntryId).slice(0, 5).filter((s) => s.score > 0);
        if (scored.length) {
          lines.push("", `<span class="${NS}-c-sep">${"\u2500".repeat(40)}</span>`);
          lines.push(`<span class="${NS}-c-ok"><b>\uD83C\uDFAF Likely Relevant (top 5 \u2014 <em>Analyse \u203A Relevance</em> for full list)</b></span>`);
          scored.forEach((s) => lines.push(`<span class="${NS}-c-kept">  ${escHtml(s.entry.slice(0, 120))}</span>`));
        }
      }
      if (currentEntries.length) {
        try {
          const hotspotResult = scanRepetitionHotspots(currentEntries);
          if (hotspotResult.length >= 1) {
            const steering = formatSteeringDraft(hotspotResult);
            lines.push("", `<span class="${NS}-c-sep">${"\u2500".repeat(40)}</span>`);
            lines.push(`<span class="${NS}-c-ok"><b>\uD83E\uDDF9 Steering Draft (${hotspotResult.length} repetition hotspot${hotspotResult.length === 1 ? "" : "s"})</b></span>`);
            steering.split("\n").slice(0, 12).forEach((l) => lines.push(`<span class="${NS}-c-kept">${escHtml(l)}</span>`));
            lines.push(`<span class="${NS}-hint">  \u2192 Download full draft via \uD83D\uDCD6 Lore in Snapshots tab</span>`);
          }
        } catch {}
      }
      if (!lines.length) lines.push(`<span class="${NS}-hint">Run Trim first to see curation insights.</span>`);
      outEl.innerHTML = lines.join("\n");
    }
    function _updateSnapBadge() {
      const snapBadge = q("snap-n");
      if (!snapBadge) return;
      const snaps = listSnapshots(scope.scopeId);
      snapBadge.textContent = snaps.length || "0";
      snapBadge.className = "pmt5-tab-badge" + (snaps.length ? " has-items" : "");
    }
    function _renderSnapshots() {
      const snaps = listSnapshots(scope.scopeId);
      if (!snaps.length) {
        const canSave = currentEntries.length > 0;
        outEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;padding:8px 0">
          <span class="${NS}-hint">No snapshots yet \u2014 save a restore point before trimming or applying changes.</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="pmt5-btn-tool" id="${NS}-snap-save-now" ${canSave ? "" : "disabled"} style="font-size:11px;padding:4px 10px">\uD83D\uDCF7 Save Snapshot${canSave ? "" : " (trim first)"}</button>
            <label class="pmt5-btn-tool" style="font-size:11px;padding:4px 10px;cursor:pointer" title="Import previously exported snapshot JSON">
              \uD83D\uDCC2 Import JSON
              <input type="file" id="${NS}-snap-import-file" accept=".json" style="display:none">
            </label>
          </div>
        </div>`;
        const saveNowBtn = document.getElementById(`${NS}-snap-save-now`);
        if (saveNowBtn) {
          saveNowBtn.addEventListener("click", () => {
            const raw = currentEntries.join("\n\n");
            if (!raw.trim()) { setStatus("Nothing to snapshot \u2014 run Trim first.", "warn", 3e3); return; }
            saveSnapshot(scope.scopeId, raw, "manual");
            _updateSnapBadge();
            _renderSnapshots();
            setStatus("\uD83D\uDCF7 Snapshot saved.", "ok", 3e3);
          });
        }
        _wireSnapImport();
        return;
      }
      const rows = snaps.map((snap) => {
        var _a2;
        const ago = _timeAgo(snap.createdAt);
        const starred = snap.starred;
        const label = escHtml(snap.label || ago);
        const stats = `${snap.stats.entries} entr${snap.stats.entries === 1 ? "y" : "ies"} \xB7 ${snap.stats.tokens}t`;
        const isAuto = (_a2 = snap.label) == null ? void 0 : _a2.startsWith("auto (");
        return `<div class="pmt5-snap-row ${starred ? "pmt5-snap-starred" : ""}" data-snap-id="${escHtml(snap.id)}">
        <div class="pmt5-snap-info">
          <span class="pmt5-snap-label" title="${label}">${label}</span>
          <span class="pmt5-snap-meta">${ago} \xB7 ${escHtml(stats)}${isAuto ? " \xB7 <em>auto</em>" : ""}</span>
        </div>
        <div class="pmt5-snap-actions">
          <button class="pmt5-snap-btn pmt5-snap-star" data-snap-id="${escHtml(snap.id)}" title="${starred ? "Unstar" : "Star to keep"}">${starred ? "\u2605" : "\u2606"}</button>
          <button class="pmt5-snap-btn pmt5-snap-load" data-snap-id="${escHtml(snap.id)}" title="Load this snapshot into workspace">\u21A9 Load</button>
          <button class="pmt5-snap-btn pmt5-snap-del danger" data-snap-id="${escHtml(snap.id)}" title="Delete snapshot">\u2715</button>
        </div>
      </div>`;
      }).join("");
      const canSave2 = currentEntries.length > 0;
      const canLore = currentEntries.length > 0;
      const exportBtn = `<div style="padding:6px 0 2px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <span style="font-size:11px;color:var(--pmt-text-muted)">${snaps.length} snapshot${snaps.length === 1 ? "" : "s"} saved for this scope</span>
      <button class="pmt5-btn-tool" id="${NS}-snap-save-now" ${canSave2 ? "" : "disabled"} style="font-size:11px;padding:3px 9px">\uD83D\uDCF7 Save</button>
      <button class="pmt5-btn-tool" id="${NS}-snap-export-all" style="font-size:11px;padding:3px 9px">\u2B07 Export JSON</button>
      <label class="pmt5-btn-tool" style="font-size:11px;padding:3px 9px;cursor:pointer" title="Import snapshot JSON file">
        \uD83D\uDCC2 Import JSON
        <input type="file" id="${NS}-snap-import-file" accept=".json" style="display:none">
      </label>
      <button class="pmt5-btn-tool lore" id="${NS}-snap-lore-dl" ${canLore ? "" : "disabled"} style="font-size:11px;padding:3px 9px" title="Download current entries as a lore draft .txt file">\uD83D\uDCD6 Lore \u2B07</button>
    </div>`;
      outEl.innerHTML = exportBtn + `<div class="pmt5-snap-list">${rows}</div>`;
      outEl.querySelectorAll(".pmt5-snap-star").forEach((btn) => {
        btn.addEventListener("click", () => {
          toggleStarSnapshot(scope.scopeId, btn.dataset.snapId);
          _updateSnapBadge();
          _renderSnapshots();
          setStatus("Snapshot " + (btn.textContent === "\u2606" ? "starred." : "unstarred."), "ok", 2e3);
        });
      });
      outEl.querySelectorAll(".pmt5-snap-load").forEach((btn) => {
        btn.addEventListener("click", () => {
          const snap = listSnapshots(scope.scopeId).find((s) => s.id === btn.dataset.snapId);
          if (!snap) return;
          ta.value = snap.content.raw;
          currentEntries = [];
          removedEntries = [];
          trimResult = null;
          updatePills();
          setStatus(`Loaded snapshot "${snap.label}" \u2014 ${snap.stats.entries} entries. Run Trim to analyse.`, "ok", 5e3);
          switchTab("map");
        });
      });
      outEl.querySelectorAll(".pmt5-snap-del").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!confirm("Delete this snapshot? This cannot be undone.")) return;
          deleteSnapshot(scope.scopeId, btn.dataset.snapId);
          _updateSnapBadge();
          _renderSnapshots();
          setStatus("Snapshot deleted.", "", 2e3);
        });
      });
      const saveNowBtn2 = document.getElementById(`${NS}-snap-save-now`);
      if (saveNowBtn2) {
        saveNowBtn2.addEventListener("click", () => {
          const raw = currentEntries.join("\n\n");
          if (!raw.trim()) { setStatus("Nothing to snapshot \u2014 run Trim first.", "warn", 3e3); return; }
          saveSnapshot(scope.scopeId, raw, "manual");
          _updateSnapBadge();
          _renderSnapshots();
          setStatus("\uD83D\uDCF7 Snapshot saved.", "ok", 3e3);
        });
      }
      const exportAllBtn = document.getElementById(`${NS}-snap-export-all`);
      if (exportAllBtn) {
        exportAllBtn.addEventListener("click", () => {
          const json = exportSnapshots(scope.scopeId);
          const blob = new Blob([json], { type: "application/json;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = Object.assign(document.createElement("a"), {
            href: url,
            download: `pmt-snapshots-${scope.scopeLabel.slice(0, 20).replace(/\s+/g, "_") || "scope"}.json`
          });
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 3e4);
          setStatus("Snapshots exported as JSON.", "ok", 3e3);
        });
      }
      _wireSnapImport();
      const loreDlBtn = document.getElementById(`${NS}-snap-lore-dl`);
      if (loreDlBtn && canLore) {
        loreDlBtn.addEventListener("click", () => {
          const draft = formatLoreDraft(currentEntries);
          downloadText(`${scope.scopeLabel.slice(0, 30).replace(/\s+/g, "_") || "lore"}-draft.txt`, draft);
          setStatus("Lore draft downloaded.", "ok", 3e3);
        });
      }
    }
    function _wireSnapImport() {
      const fileInput = document.getElementById(`${NS}-snap-import-file`);
      if (!fileInput) return;
      fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            if (!data || !Array.isArray(data.snapshots)) {
              setStatus("Import failed \u2014 invalid snapshot JSON.", "err", 4e3);
              return;
            }
            const existingIds = new Set(listSnapshots(scope.scopeId).map((s) => s.id));
            const toAdd = data.snapshots.filter((s) => s && s.id && !existingIds.has(s.id));
            if (!toAdd.length) {
              setStatus("Nothing new to import \u2014 all snapshots already exist.", "", 3e3);
              fileInput.value = "";
              return;
            }
            const merged = [...listSnapshots(scope.scopeId).reverse(), ...toAdd]
              .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            saveSnaps(scope.scopeId, merged);
            _updateSnapBadge();
            _renderSnapshots();
            setStatus(`Imported ${toAdd.length} snapshot${toAdd.length === 1 ? "" : "s"}.`, "ok", 4e3);
          } catch {
            setStatus("Import failed \u2014 could not parse JSON.", "err", 4e3);
          }
          fileInput.value = "";
        };
        reader.onerror = () => setStatus("Could not read file.", "err", 3e3);
        reader.readAsText(file);
      });
    }
    function _timeAgo(ts) {
      const diff = Date.now() - ts;
      if (diff < 6e4) return "just now";
      if (diff < 36e5) return `${Math.floor(diff / 6e4)}m ago`;
      if (diff < 864e5) return `${Math.floor(diff / 36e5)}h ago`;
      return `${Math.floor(diff / 864e5)}d ago`;
    }
    function switchTab(name) {
      activeTab = name;
      tabsEl.querySelectorAll(`.${NS}-tab`).forEach((t) => {
        t.classList.toggle(`${NS}-active`, t.dataset.tab === name);
      });
      const isSettings = name === "settings";
      const isSearchable = name === "result" || name === "removed";
      const isMap = name === "map";
      outScroll.style.display = isSettings ? "none" : "";
      outScroll.classList.toggle(`${NS}-map-active`, isMap);
      settingEl.classList.toggle(`${NS}-visible`, isSettings);
      searchBar.classList.toggle(`${NS}-visible`, isSearchable);
      tabsEl.querySelectorAll(`.${NS}-tab`).forEach((t) => {
        t.setAttribute("aria-selected", t.dataset.tab === name ? "true" : "false");
      });
      if (isSettings) buildSettings();
      else renderOutput();
    }
    tabsEl.addEventListener("click", (e) => {
      const tab = e.target.closest(`.${NS}-tab`);
      if (tab == null ? void 0 : tab.dataset.tab) switchTab(tab.dataset.tab);
    });
    searchIn.addEventListener("input", () => {
      filterQ = searchIn.value;
      renderOutput();
    });
    let settingsReady = false;
    function buildSettings() {
      var _a2, _b2, _c2, _d, _e, _f, _g, _h, _i, _j;
      if (settingsReady) return;
      settingsReady = true;
      const customCss = (_a2 = store.get(CUSTOM_CSS_KEY)) != null ? _a2 : "";
      const caps = buildCapabilities(cfg);
      const autoNote = caps.automation ? "" : " \u2014 <em>host not detected, use manual paste</em>";
      const toolbarNote = caps.miniToolbar ? "" : " \u2014 <em>no memory window found</em>";
      const qaNote = caps.qaRemote ? " \u2014 <em>API key set</em>" : " \u2014 <em>requires API key below</em>";
      settingEl.innerHTML = [
        // ── Core ─────────────────────────────────────────────────────────
        `<div class="pmt5-stg-maturity-hdr">Core</div>`,
        mkGroupRow(NS, "Trimming", [
          mkToggleRow(
            NS,
            "stg-prev",
            "Auto-switch to Preview after Trim",
            "Shows the diff view automatically after trimming",
            cfg.previewOnTrim
          ),
          mkToggleRow(
            NS,
            "stg-norm",
            "Normalize separators on copy",
            "Strips CRLF and collapses blank lines before copying or exporting",
            (_b2 = cfg.normalizeSeparators) != null ? _b2 : true
          )
        ]),
        mkGroupRow(NS, "Display", [
          mkToggleRow(
            NS,
            "stg-tok",
            "Show token estimate",
            "Rough GPT/Claude token count shown in stats strip",
            cfg.showTokens
          ),
          `<div class="pmt5-stg-row">
          <div>
            <div class="pmt5-stg-label">Token count source</div>
            <div class="pmt5-stg-sub">Auto prefers native (window.countTokens), then heuristic (~4 chars/token). Ideal context: <b id="${NS}-stg-ideal-ctx">\u2026</b></div>
          </div>
          <select id="${NS}-stg-tok-src" class="pmt5-stg-sel">
            <option value="auto">Auto</option>
            <option value="native">Native</option>
            <option value="heuristic">Heuristic</option>
          </select>
        </div>`
        ]),
        mkGroupRow(NS, "Snapshots &amp; Restore", [
          mkToggleRow(
            NS,
            "stg-pos",
            "Remember window position",
            "Saves the panel position between sessions",
            cfg.rememberPos
          ),
          mkToggleRow(
            NS,
            "stg-focus",
            "Auto-focus textarea on open",
            "Cursor jumps to the paste area automatically",
            cfg.autoFocus
          )
        ]),
        // ── Enhanced ─────────────────────────────────────────────────────
        `<div class="pmt5-stg-maturity-hdr">Enhanced</div>`,
        mkGroupRow(NS, "Analysis", [
          mkToggleRow(
            NS,
            "stg-rep",
            "Show repetition risk badge",
            "Scans for repeated phrases after every Trim",
            (_c2 = cfg.showRepetitionBadge) != null ? _c2 : true
          ),
          mkToggleRow(
            NS,
            "stg-ptok",
            "Show per-entry token cost",
            "Display token count chip on each kept entry in results",
            (_d = cfg.showPerEntryTokens) != null ? _d : false
          )
        ]),
        mkGroupRow(NS, "Theme", [
          mkThemeRow(NS, (_e = cfg.theme) != null ? _e : "dark", escHtml(customCss))
        ]),
        // ── Experimental ─────────────────────────────────────────────────
        `<div class="pmt5-stg-maturity-hdr">Experimental</div>`,
        mkGroupRow(NS, "Host Automation", [
          mkToggleRow(
            NS,
            "stg-auto",
            "Show host connection badge",
            `Displays Perchance automation status in the header${autoNote}`,
            (_f = cfg.showAutomationBadge) != null ? _f : true
          ),
          mkToggleRow(
            NS,
            "stg-inject-toolbar",
            "Inject toolbar into memory window",
            `Adds a compact PMT toolbar strip directly into the memory window${toolbarNote}`,
            (_g = cfg.injectMiniToolbar) != null ? _g : false
          ),
          mkToggleRow(
            NS,
            "stg-host-theme",
            "Auto-match Perchance page theme",
            "Applies the host page\u2019s colour scheme to the PMT panel",
            (_h = cfg.autoMatchHostTheme) != null ? _h : false
          )
        ]),
        mkGroupRow(NS, "Q&amp;A Assistant", [
          `<div class="pmt5-stg-row">
          <div>
            <div class="pmt5-stg-label">Anthropic API Key${qaNote}</div>
            <div class="pmt5-stg-sub" id="${NS}-stg-api-key-hint">Used for the \u{1F4AC} Q&amp;A assistant. <b class="pmt5-warn-inline">Stored in plain localStorage</b> \u2014 visible to all scripts on this page. Clear when not in use.</div>
          </div>
          <input type="password" id="${NS}-stg-api-key" class="pmt5-stg-sel"
            placeholder="sk-ant-\u2026" autocomplete="off" spellcheck="false"
            aria-label="Anthropic API Key"
            aria-describedby="${NS}-stg-api-key-hint"
            style="width:140px;font-family:monospace;font-size:11px">
        </div>`
        ]),
        mkGroupRow(NS, "Diagnostics", [
          mkToggleRow(
            NS,
            "stg-debug",
            "Show diagnostics drawer",
            "Reveals host status, storage, smoke tests and recent action log",
            (_i = cfg.debugMode) != null ? _i : false
          ),
          `<div class="pmt5-stg-row">
            <div>
              <div class="pmt5-stg-label">Debug report</div>
              <div class="pmt5-stg-sub">Download a full JSON report: host diagnostics, storage health, smoke tests, continuity map</div>
            </div>
            <button id="${NS}-stg-dl-debug" class="pmt5-btn-tool" style="font-size:11px;padding:4px 10px;white-space:nowrap">\uD83D\uDCCB Download</button>
          </div>`
        ]),
        `<button id="${NS}-stg-reset">Reset all settings to defaults</button>`
      ].join("");
      const themeSelect = document.getElementById(`${NS}-stg-theme`);
      const cssArea = document.getElementById(`${NS}-custom-css-area`);
      const importFileBtn = document.getElementById(`${NS}-import-file-btn`);
      const importFileIn = document.getElementById(`${NS}-import-file`);
      const customCssTa = document.getElementById(`${NS}-custom-css-ta`);
      const applyBtn = document.getElementById(`${NS}-apply-css`);
      const clearBtn = document.getElementById(`${NS}-clear-css`);
      themeSelect.addEventListener("change", () => {
        const theme = themeSelect.value;
        cfg.theme = theme;
        _saveCfg();
        cssArea.classList.toggle(`${NS}-hidden`, theme !== "custom");
        applyTheme(theme);
      });
      importFileBtn.addEventListener("click", () => importFileIn.click());
      importFileIn.addEventListener("change", () => {
        const file = importFileIn.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          customCssTa.value = ev.target.result;
        };
        reader.onerror = () => setStatus("Could not read file.", "err", 4e3);
        reader.readAsText(file);
        importFileIn.value = "";
      });
      applyBtn.addEventListener("click", () => {
        const css = customCssTa.value.trim();
        store.set(CUSTOM_CSS_KEY, css || null);
        cfg.theme = "custom";
        themeSelect.value = "custom";
        _saveCfg();
        applyTheme("custom");
        setStatus("Custom CSS applied.", "ok", 3e3);
      });
      clearBtn.addEventListener("click", () => {
        if (!confirm("Clear the custom CSS and revert to the dark theme?")) return;
        customCssTa.value = "";
        store.del(CUSTOM_CSS_KEY);
        cfg.theme = "dark";
        themeSelect.value = "dark";
        _saveCfg();
        cssArea.classList.add(`${NS}-hidden`);
        applyTheme("dark");
        setStatus("Custom CSS cleared.", "ok", 3e3);
      });
      function bindToggle(id, key2, sideEffect) {
        const el = document.getElementById(`${NS}-${id}`);
        if (!el) return;
        el.addEventListener("change", () => {
          cfg[key2] = el.checked;
          _saveCfg();
          sideEffect == null ? void 0 : sideEffect(el.checked);
        });
      }
      bindToggle(
        "stg-pos",
        "rememberPos",
        (on) => {
          if (!on) {
            store.del(POS_KEY);
            savedPos = {};
          }
        }
      );
      bindToggle("stg-focus", "autoFocus");
      bindToggle(
        "stg-tok",
        "showTokens",
        (on) => {
          PP.tokPill.style.display = on ? "" : "none";
        }
      );
      bindToggle("stg-prev", "previewOnTrim");
      bindToggle("stg-norm", "normalizeSeparators");
      const tokSrcSel = document.getElementById(`${NS}-stg-tok-src`);
      if (tokSrcSel) {
        tokSrcSel.value = (_h = cfg.tokenizerSource) != null ? _h : "auto";
        tokSrcSel.addEventListener("change", () => {
          cfg.tokenizerSource = tokSrcSel.value;
          _saveCfg();
          setTokenSource(tokSrcSel.value);
          updatePills();
          setStatus(`Token source: ${tokSrcSel.value}`, "ok", 2e3);
        });
      }
      bindToggle("stg-debug", "debugMode", (on) => {
        if (on) {
          diagDrawer.classList.add(`${NS}-visible`);
          updateDiagDrawer();
        } else diagDrawer.classList.remove(`${NS}-visible`);
      });
      const apiKeyInput = document.getElementById(`${NS}-stg-api-key`);
      if (apiKeyInput) {
        try {
          apiKeyInput.value = (_i = localStorage.getItem(QA_KEY_STORE)) != null ? _i : "";
        } catch {
        }
        apiKeyInput.addEventListener("change", () => {
          const k = apiKeyInput.value.trim();
          try {
            if (k) localStorage.setItem(QA_KEY_STORE, k);
            else localStorage.removeItem(QA_KEY_STORE);
            setStatus(k ? "API key saved." : "API key cleared.", "ok", 2e3);
          } catch {
            setStatus("Could not save API key.", "warn", 3e3);
          }
        });
      }
      bindToggle("stg-auto", "showAutomationBadge", (on) => {
        if (autoBadge) {
          autoBadge.style.display = on ? "" : "none";
          if (on) _updateAutoBadge();
        }
      });
      bindToggle("stg-rep", "showRepetitionBadge", (on) => {
        if (!on && repPill) repPill.style.display = "none";
      });
      bindToggle("stg-ptok", "showPerEntryTokens", (on) => {
        cfg.showPerEntryTokens = on;
        renderOutput();
      });
      bindToggle("stg-inject-toolbar", "injectMiniToolbar", (on) => {
        if (on) {
          const win = findBestMemoryWindow();
          if (win == null ? void 0 : win.el) {
            const toolbar = injectMiniToolbar(win.el, { onOpen: () => openPanel() });
            setStatus(toolbar ? "Toolbar injected into memory window." : "No memory window header found.", toolbar ? "ok" : "warn", 3e3);
          } else {
            setStatus("No Perchance memory window found \u2014 open one first.", "warn", 4e3);
          }
        } else {
          const win = findBestMemoryWindow();
          if (win == null ? void 0 : win.el) removeMiniToolbar(win.el);
          setStatus("Mini toolbar removed.", "", 2e3);
        }
      });
      bindToggle("stg-host-theme", "autoMatchHostTheme", (on) => {
        if (on) {
          const vars = getHostThemeVars();
          const panelEl = document.getElementById(`${NS}-panel`);
          if (panelEl && vars.background) {
            panelEl.style.setProperty("--pmt-surface-2", vars.background);
            panelEl.style.setProperty("--pmt-surface", vars.boxColor || vars.background);
            panelEl.style.setProperty("--pmt-text", vars.textColor || "");
            panelEl.style.setProperty("--pmt-border", vars.borderColor || "");
            panelEl.style.setProperty("--pmt-accent", vars.buttonBg || "");
            setStatus("Host theme applied.", "ok", 2e3);
          } else {
            setStatus("No host theme variables found on this page.", "warn", 3e3);
          }
        } else {
          const panelEl = document.getElementById(`${NS}-panel`);
          if (panelEl) {
            ["--pmt-surface-2", "--pmt-surface", "--pmt-text", "--pmt-border", "--pmt-accent"].forEach((v) => panelEl.style.removeProperty(v));
            setStatus("Host theme removed \u2014 reverted to PMT theme.", "ok", 2e3);
          }
        }
      });
      const dlDebugBtn = document.getElementById(`${NS}-stg-dl-debug`);
      if (dlDebugBtn) {
        // Verify buildDebugReport is available at wire-up time so button state is accurate
        Promise.resolve().then(() => (init_smoketests(), smoketests_exports)).then(({ buildDebugReport: probe }) => {
          if (typeof probe !== "function") {
            dlDebugBtn.disabled = true;
            dlDebugBtn.title = "Debug report unavailable \u2014 module not loaded";
            dlDebugBtn.style.opacity = "0.4";
          }
        }).catch(() => {
          dlDebugBtn.disabled = true;
          dlDebugBtn.title = "Debug report unavailable";
        });
        dlDebugBtn.addEventListener("click", async () => {
          try {
            dlDebugBtn.textContent = "\u2026Building";
            dlDebugBtn.disabled = true;
            const { buildDebugReport: buildReport } = await Promise.resolve().then(() => (init_smoketests(), smoketests_exports));
            if (typeof buildReport !== "function") throw new Error("buildDebugReport not available");
            const report = await buildReport({ featureFlags: cfg });
            const json = JSON.stringify(report, null, 2);
            downloadText(`pmt-debug-report-${Date.now()}.json`, json);
            setStatus("Debug report downloaded.", "ok", 3e3);
          } catch (err) {
            setStatus(`Debug report failed: ${err.message || "unknown error"}`, "err", 4e3);
          } finally {
            dlDebugBtn.textContent = "\uD83D\uDCCB Download";
            dlDebugBtn.disabled = false;
          }
        });
      }
      const idealCtxEl = document.getElementById(`${NS}-stg-ideal-ctx`);
      if (idealCtxEl) {
        const idealToks = getIdealMaxContextTokens();
        idealCtxEl.textContent = idealToks ? `~${idealToks.toLocaleString()} tokens` : "unknown";
      }
      document.getElementById(`${NS}-stg-reset`).addEventListener("click", () => {
        if (!confirm("Reset all Memory Trimmer settings and saved positions to defaults?")) return;
        cfg = { ...DEFAULTS };
        _saveCfg();
        savedPos = {};
        store.del(POS_KEY);
        store.del(CUSTOM_CSS_KEY);
        applyTheme("dark");
        setStatus("Settings reset to defaults.", "ok", 3500);
        settingsReady = false;
        settingEl.innerHTML = "";
        buildSettings();
      });
    }
    btnRun.addEventListener("click", () => {
      clearStaleState();
      const raw = ta.value.trim();
      if (!raw) {
        setStatus("Paste your memory text first.", "warn", 4e3);
        if (cfg.autoFocus) ta.focus();
        return;
      }
      let parsed;
      try {
        parsed = parseEntries(raw);
      } catch {
        setStatus("Could not parse input \u2014 unexpected text format.", "err", 5e3);
        return;
      }
      if (!parsed.length) {
        setStatus("No entries found. Entries must be separated by blank lines.", "warn", 5e3);
        return;
      }
      const result = runTrim(parsed, readOpts());
      if (result.kept.length === 0) {
        setStatus("All entries would be removed \u2014 loosen the filters and try again.", "warn", 5e3);
        return;
      }
      undoStack.push(currentEntries.length > 0 ? [...currentEntries] : [...parsed]);
      if (undoStack.length > 20) undoStack.shift();
      trimResult = result;
      currentEntries = result.kept;
      removedEntries = result.removed;
      removedN.textContent = result.removed.length;
      progFill.style.width = `${result.keptPct}%`;
      btnCopy.disabled = false;
      btnPrev.disabled = false;
      btnExpKept.disabled = false;
      btnExpRem.disabled = result.removed.length === 0;
      btnSnap.disabled = false;
      btnApplyMem.disabled = false;
      btnLore.disabled = false;
      btnSortSim.disabled = false;
      btnMap.disabled = false;
      btnRestore.disabled = !getLastSnapshot(scope.scopeId);
      _refreshUndo();
      if (btnUndo) btnUndo.disabled = undoStack.length === 0;
      updatePills();
      if (cfg.showRepetitionBadge) {
        const hotspots = scanRepetitionHotspots(result.kept);
        const riskLabel = getRepetitionRiskLabel(hotspots);
        repVal.textContent = riskLabel;
        repPill.style.display = "";
        repPill.classList.toggle(`${NS}-warn`, riskLabel === "moderate" || riskLabel === "high");
        repPill.title = hotspots.length > 0 ? `${hotspots.length} repeated phrase${hotspots.length !== 1 ? "s" : ""} detected` : "No repeated phrases detected";
      }
      const pinnedIds2 = getPinnedIds(scope.scopeId);
      const scored = scoreAllEntries(result.kept, pinnedIds2, /* @__PURE__ */ new Set(), getEntryId);
      continuityMap = Object.fromEntries(scored.map((s) => [s.entryId, { score: s.score, label: s.label, reasons: s.reasons }]));
      const perfClass = classifyWorkspaceSize(result.kept);
      const defer = perfClass.shouldDefer;
      const _dupResult = guardedAnalysis(buildNearDupClusters, [result.kept, getEntryId], PERF_CAPS.clusterLimit, defer);
      nearDupClusters = _dupResult.result;
      dupsN.textContent = nearDupClusters.length;
      const _budgetPressure = computeBudgetPressure(
        result.kept,
        pinnedIds2,
        getEntryId,
        parseInt(budgetN.value, 10) || 0
      );
      const _confResult = guardedAnalysis(detectConflicts, [result.kept, getEntryId], PERF_CAPS.conflictLimit, defer);
      conflictList = _confResult.result;
      confN.textContent = conflictList.length;
      const _issues = conflictList.length + nearDupClusters.length + ((healthResult == null ? void 0 : healthResult.score) < 60 ? 1 : 0);
      if (analyseBadge) {
        analyseBadge.textContent = _issues > 0 ? `${_issues}` : "\u2713";
        analyseBadge.className = `pmt5-tab-badge${_issues > 0 ? " has-items" : ""}`;
      }
      topicGroups = defer ? null : buildTopicGroups(result.kept, getEntryId);
      const _beatResult = guardedAnalysis(extractStoryBeats, [result.kept, getEntryId], PERF_CAPS.beatLimit, defer);
      storyBeats = _beatResult.result;
      sortedEntries = null;
      healthResult = computeHealthScore({
        entries: result.kept,
        targetTokens: parseInt(budgetN.value, 10) || 0,
        pinnedIds: pinnedIds2,
        nearDupCount: nearDupClusters.length
      });
      if (result.overBudgetPinWarning) {
        setStatus("\u26A0 Pinned entries alone exceed the token budget!", "warn", 7e3);
      }
      const parts = [`${result.totalRemoved} removed, ${result.finalCount} kept (${result.keptPct}%)`];
      if (result.byDedup.length) parts.push(`${result.byDedup.length} dups`);
      if (result.byLong.length) parts.push(`${result.byLong.length} too-long`);
      if (result.byAge.length) parts.push(`${result.byAge.length} oldest`);
      setStatus(parts.join(" \xB7 "), "ok", 7e3);
      const _guideHints = [];
      if (conflictList.length > 0) _guideHints.push(`${conflictList.length} conflict${conflictList.length > 1 ? "s" : ""} in Analyse`);
      if (nearDupClusters.length > 0) _guideHints.push(`${nearDupClusters.length} near-dup cluster${nearDupClusters.length > 1 ? "s" : ""}`);
      if (storyBeats.length > 5) _guideHints.push("story beats in Curate");
      if (_guideHints.length && isAdvancedMode()) {
        const hintEl = document.getElementById(`${NS}-post-trim-hint`);
        if (hintEl) {
          hintEl.textContent = `\u25B8 ${_guideHints.join(" \xB7 ")} \u2014 click to open Analyse`;
          hintEl.style.display = "";
          hintEl.onclick = () => switchTab("analyse");
        }
      } else {
        const hintEl = document.getElementById(`${NS}-post-trim-hint`);
        if (hintEl) hintEl.style.display = "none";
      }
      switchTab(cfg.previewOnTrim ? "preview" : "map");
      if (diagDrawer && diagDrawer.classList.contains(`${NS}-visible`)) updateDiagDrawer();
      recordAction("trim", {
        mode: getMode(),
        status: "ok",
        detail: `${result.kept.length} kept, ${result.totalRemoved} removed`
      });
    });
    btnCopy.addEventListener("click", async () => {
      if (!currentEntries.length) {
        setStatus("Nothing to copy \u2014 run Trim first.", "warn", 3e3);
        return;
      }
      try {
        const outputText = cfg.normalizeSeparators ? serializeEntries(normalizeEntries(currentEntries.join("\n\n"))) : currentEntries.join("\n\n");
        await writeClipboard(outputText);
        setStatus("Copied! Close this window and paste (Ctrl+V) into the Memory box.", "ok", 8e3);
        const orig = btnCopy.innerHTML;
        btnCopy.innerHTML = "Copied!";
        btnCopy.disabled = true;
        setTimeout(() => {
          if (btnCopy.isConnected) {
            btnCopy.innerHTML = orig;
            btnCopy.disabled = false;
          }
        }, 2500);
      } catch {
        setStatus("Clipboard blocked \u2014 switch to the Result tab and copy manually (Ctrl+A, Ctrl+C).", "warn");
        switchTab("result");
      }
    });
    btnExpKept.addEventListener("click", () => {
      if (!currentEntries.length) return;
      const entries = cfg.normalizeSeparators ? normalizeEntries(currentEntries.join("\n\n")) : currentEntries;
      downloadKept(entries, scope.scopeLabel.slice(0, 20).replace(/\s+/g, "_") || "pmt");
      setStatus("Kept entries downloaded.", "ok", 3e3);
    });
    btnExpRem.addEventListener("click", () => {
      if (!removedEntries.length) return;
      downloadRemoved(removedEntries, scope.scopeLabel.slice(0, 20).replace(/\s+/g, "_") || "pmt");
      setStatus("Removed entries downloaded.", "ok", 3e3);
    });
    btnSnap.addEventListener("click", () => {
      if (!currentEntries.length) return;
      const raw = currentEntries.join("\n\n");
      const snap = saveSnapshot(scope.scopeId, raw);
      _updateSnapBadge();
      setStatus(`Snapshot saved: ${snap.stats.entries} entries.`, "ok", 4e3);
    });
    let _fetchBusy = false;
    btnFetch.addEventListener("click", async () => {
      var _a2;
      if (_fetchBusy) {
        setStatus("Fetch already in progress\u2026", "warn", 2e3);
        return;
      }
      _fetchBusy = true;
      btnFetch.disabled = true;
      btnFetch.textContent = "\u2026Fetching";
      setStatus("Fetching /mem from Perchance\u2026", "", 0);
      const result = await fetchMemWorkflow({
        onStateChange: (state) => {
          const labels = {
            [AUTO_STATES.DISPATCHING]: "\u2026Sending /mem",
            [AUTO_STATES.WAITING]: "\u2026Waiting for window",
            [AUTO_STATES.READING]: "\u2026Reading memory",
            [AUTO_STATES.MANUAL_FALLBACK]: "Auto-fetch failed \u2014 paste manually"
          };
          if (labels[state]) setStatus(labels[state], "", 0);
        }
      });
      btnFetch.disabled = false;
      btnFetch.textContent = "\u2B07 Fetch";
      if (!result.ok) {
        setStatus((_a2 = result.error) != null ? _a2 : "Fetch failed \u2014 paste manually.", "warn", 6e3);
        return;
      }
      lastWindowEl = result.windowEl;
      currentEntries = [];
      removedEntries = [];
      trimResult = null;
      healthResult = null;
      nearDupClusters = [];
      conflictList = [];
      topicGroups = null;
      storyBeats = [];
      continuityMap = {};
      selectedIds.clear();
      btnCopy.disabled = true;
      btnPrev.disabled = true;
      btnExpKept.disabled = true;
      btnExpRem.disabled = true;
      btnSnap.disabled = true;
      btnApplyMem.disabled = true;
      btnLore.disabled = true;
      btnSortSim.disabled = true;
      btnMap.disabled = true;
      if (btnUndo) btnUndo.disabled = true;
      if (repPill) repPill.style.display = "none";
      progFill.style.width = "0%";
      _refreshUndo();
      hideRecovery();
      ta.value = result.raw;
      lastWindowEl = result.windowEl;
      updatePills();
      _updateAutoBadge();
      setStatus(`Fetched ${result.entries.length} entries from /mem window.`, "ok", 5e3);
      recordAction("fetch", { status: "ok", detail: `${result.entries.length} entries` });
      if (cfg.autoFocus) ta.focus();
    });
    let _applyBusy = false;
    btnApplyMem.addEventListener("click", async () => {
      var _a2, _b2;
      if (_applyBusy) {
        setStatus("Apply is already in progress\u2026", "warn", 2e3);
        return;
      }
      _applyBusy = true;
      try {
        if (!currentEntries.length) {
          setStatus("Nothing to apply \u2014 run Trim first.", "warn", 3e3);
          _applyBusy = false;
          return;
        }
        const raw = currentEntries.join("\n\n");
        saveSnapshot(scope.scopeId, raw, "auto (before Apply)");
        const tokEst = Math.ceil(raw.length / 4);
        setStatus(`Saving snapshot, then applying ${currentEntries.length} entries (~${tokEst} tokens) to /mem window\u2026`, "ok");
        let windowEl = lastWindowEl;
        if (!windowEl || !windowEl.isConnected) {
          const { findBestMemoryWindow: findW } = await Promise.resolve().then(() => (init_helpers(), helpers_exports));
          const found = findW();
          windowEl = (_a2 = found == null ? void 0 : found.el) != null ? _a2 : null;
        }
        if (!windowEl) {
          setStatus("No memory window found \u2014 use Copy and paste manually.", "warn", 6e3);
          return;
        }
        btnApplyMem.disabled = true;
        btnApplyMem.textContent = "\u2026Applying";
        const outText = currentEntries.join("\n\n");
        const applyResult = await applyMemoryWindowText(windowEl, outText, scope.scopeId);
        const { status } = applyResult;
        btnApplyMem.disabled = false;
        btnApplyMem.textContent = "\u2B06 Apply";
        const msgs = {
          verified: { text: "\u2713 Applied and verified!", type: "ok", ms: 6e3 },
          mismatch: { text: "\u26A0 Apply mismatch \u2014 Restore is available.", type: "warn", ms: 8e3 },
          unverified: { text: "Applied (unverified \u2014 could not re-read window).", type: "", ms: 5e3 }
        };
        const m = (_b2 = msgs[status]) != null ? _b2 : msgs.unverified;
        setStatus(m.text, m.type, m.ms);
        if (status === "mismatch") {
          const expectedLen = serializeEntries(normalizeEntries(outText)).length;
          const actualLen = applyResult.actual ? applyResult.actual.length : 0;
          const diffNote = actualLen ? ` (expected ${expectedLen} chars, got ${actualLen})` : "";
          showRecovery(`Apply mismatch detected${diffNote} \u2014 restore last known good?`, "Restore", () => {
            const snap = getLastSnapshot(scope.scopeId);
            if (snap) {
              ta.value = snap.content.raw;
              updatePills();
              setStatus("Snapshot restored into workspace.", "ok", 4e3);
            } else setStatus("No snapshot available to restore.", "warn", 3e3);
          });
        } else hideRecovery();
        recordAction("apply", { status, detail: `scope: ${scope.scopeLabel}` });
        if (diagDrawer && diagDrawer.classList.contains(`${NS}-visible`)) updateDiagDrawer();
      } finally {
        _applyBusy = false;
      }
    });
    btnLore.addEventListener("click", async () => {
      const ids = [...selectedIds];
      const selected = ids.length > 0 ? currentEntries.filter((e) => selectedIds.has(getEntryId(e))) : currentEntries.filter((e) => {
        var _a2, _b2;
        return ((_b2 = (_a2 = continuityMap[getEntryId(e)]) == null ? void 0 : _a2.label) != null ? _b2 : "low") === "high";
      });
      if (!selected.length) {
        setStatus("Select some entries first (or trim to generate continuity scores).", "warn", 4e3);
        return;
      }
      const { scanRepetitionHotspots: _scan } = await Promise.resolve().then(() => (init_repetition(), repetition_exports));
      const _hotspots = _scan(selected);
      const steeringNote = _hotspots.length >= 3 ? "\n\n" + formatSteeringDraft(_hotspots) : "";
      const draft = formatLoreDraft(selected) + steeringNote;
      try {
        await navigator.clipboard.writeText(draft);
        setStatus(`Lore draft copied (${selected.length} entries).`, "ok", 4e3);
      } catch {
        setStatus("Clipboard blocked \u2014 lore draft shown in Result tab.", "warn", 4e3);
      }
    });
    btnSortSim.addEventListener("click", () => {
      if (!currentEntries.length) return;
      const { sorted, groups } = adjacencySort(currentEntries);
      sortedEntries = sorted;
      currentEntries = sorted;
      switchTab("map");
      setStatus(`Grouped ${groups.length} similarity clusters \u2014 see Timeline.`, "ok", 4e3);
    });
    btnQa.addEventListener("click", () => {
      const sel = currentEntries.filter((e) => selectedIds.has(getEntryId(e)));
      openQaPopup({ entries: currentEntries, selected: sel, scope });
    });
    btnMap.addEventListener("click", () => {
      if (!currentEntries.length) {
        setStatus("Run Trim first.", "warn", 2e3);
        return;
      }
      const pinnedIds = getPinnedIds(scope.scopeId);
      openBubbleMap({ entries: currentEntries, continuityMap, pinnedIds, getEntryId,
        onApplyOrder: (sorted) => {
          sortedEntries = sorted;
          currentEntries = sorted;
          switchTab("map");
          setStatus("\u2195 Order applied from expanded view \u2014 timeline updated.", "ok", 4e3);
        }
      });
    });
    const runCompareBtn = q("run-compare");
    if (runCompareBtn) {
      runCompareBtn.addEventListener("click", async () => {
        var _a2, _b2, _c2, _d;
        const { compareMemoryVsLoreVsSummary: compareMemoryVsLoreVsSummary2 } = await Promise.resolve().then(() => (init_comparison(), comparison_exports));
        const loreText = (_b2 = (_a2 = document.getElementById(`${NS}-lore-input`)) == null ? void 0 : _a2.value) != null ? _b2 : "";
        const summaryText = (_d = (_c2 = document.getElementById(`${NS}-summary-input`)) == null ? void 0 : _c2.value) != null ? _d : "";
        const result = compareMemoryVsLoreVsSummary2(currentEntries, loreText, summaryText);
        const lines = [
          `<span class="${NS}-c-ok">Memory only: ${result.onlyInMemory.length} entries</span>`,
          `<span class="${NS}-c-warn">Overlap with lore: ${result.inMemoryAndLore.length} entries</span>`,
          `<span class="${NS}-c-warn">Overlap with summary: ${result.inMemoryAndSummary.length} entries</span>`,
          `<span class="${NS}-c-ok">In all three: ${result.inAll.length} entries</span>`,
          "",
          `<span class="${NS}-c-sep">\u2500\u2500 Lore candidates (memory only, top 5) \u2500\u2500</span>`,
          ...result.loreSuggestions.slice(0, 5).map((e) => `<span class="${NS}-c-kept">  ${escHtml(e.slice(0, 120))}</span>`)
          // XSS fix
        ];
        outEl.style.display = "";
        compareArea.style.display = "none";
        outEl.innerHTML = lines.join("\n");
        setStatus("Comparison complete.", "ok", 4e3);
      });
    }
    function extKeyHandler(e) {
      if (!panel.isConnected) return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
        e.preventDefault();
        btnCopy.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        btnApplyMem.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        diagDrawer.classList.toggle(`${NS}-visible`);
        if (diagDrawer.classList.contains(`${NS}-visible`)) updateDiagDrawer();
      }
    }
    document.addEventListener("keydown", extKeyHandler);
    const _origClose = panel._origClose;
    function _updateBatchBar() {
      const n = selectedIds.size;
      btnLore.disabled = !currentEntries.length;
      if (n > 0) {
        setStatus(`${n} entr${n === 1 ? "y" : "ies"} selected \u2014 use Lore or Clear to act`, "", 0);
      }
    }
    btnRestore.addEventListener("click", () => {
      const snap = getLastSnapshot(scope.scopeId);
      if (!snap) {
        setStatus("No snapshot available \u2014 click \u{1F4F7} Snap before trimming.", "warn", 4e3);
        return;
      }
      currentEntries = [];
      removedEntries = [];
      trimResult = null;
      healthResult = null;
      nearDupClusters = [];
      conflictList = [];
      topicGroups = null;
      storyBeats = [];
      continuityMap = {};
      selectedIds.clear();
      btnCopy.disabled = true;
      btnPrev.disabled = true;
      btnExpKept.disabled = true;
      btnExpRem.disabled = true;
      btnApplyMem.disabled = true;
      btnLore.disabled = true;
      btnSortSim.disabled = true;
      btnMap.disabled = true;
      if (btnUndo) btnUndo.disabled = true;
      if (repPill) repPill.style.display = "none";
      progFill.style.width = "0%";
      _refreshUndo();
      hideRecovery();
      ta.value = snap.content.raw;
      updatePills();
      setStatus(`Restored: ${snap.stats.entries} entries from ${snap.label}. Run Trim to reanalyse.`, "ok", 5e3);
      switchTab("result");
    });
    function _handleAnnotationClick(entryId) {
      const existing = getAnnotation(scope.scopeId, entryId);
      const existingNote = (existing == null ? void 0 : existing.note) || "";
      const existingFlags = (existing == null ? void 0 : existing.flags) || [];
      const popId = `${NS}-annot-pop`;
      document.getElementById(popId)?.remove();
      const pop = document.createElement("div");
      pop.id = popId;
      pop.style.cssText = `position:fixed;z-index:2147483645;top:50%;left:50%;transform:translate(-50%,-50%);
        background:var(--pmt-surface);border:1px solid var(--pmt-border);border-radius:10px;
        padding:16px;width:min(340px,92vw);box-shadow:0 8px 40px rgba(0,0,0,.65);
        font-family:system-ui,sans-serif;display:flex;flex-direction:column;gap:10px;`;
      const FLAG_OPTS = [
        { id: "keep",   emoji: "\uD83D\uDD12", label: "Keep" },
        { id: "review", emoji: "\uD83D\uDD0D", label: "Review" },
        { id: "lore",   emoji: "\uD83D\uDCD6", label: "Lore" },
        { id: "delete", emoji: "\uD83D\uDDD1", label: "Delete" }
      ];
      pop.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between">
          <b style="color:var(--pmt-text);font-size:13px">\uD83D\uDCDD Annotation</b>
          <button id="${NS}-annot-close" style="all:unset;cursor:pointer;color:var(--pmt-text-muted);font-size:18px;padding:2px 6px;border-radius:4px">\u2715</button>
        </div>
        <div style="font-size:10px;color:var(--pmt-text-muted);word-break:break-all">${escHtml(entryId.slice(0, 80))}</div>
        <textarea id="${NS}-annot-note" rows="3" placeholder="Note (optional)\u2026" spellcheck="true"
          style="width:100%;box-sizing:border-box;background:var(--pmt-surface-2);color:var(--pmt-text);
                 border:1px solid var(--pmt-border);border-radius:6px;padding:6px 8px;font-size:12px;resize:vertical"
        >${escHtml(existingNote)}</textarea>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${FLAG_OPTS.map(({ id, emoji, label }) => `
            <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--pmt-text);cursor:pointer;user-select:none">
              <input type="checkbox" data-flag="${id}" ${existingFlags.includes(id) ? "checked" : ""}
                style="accent-color:var(--pmt-accent);width:13px;height:13px">
              ${emoji} ${label}
            </label>`).join("")}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="${NS}-annot-clear" style="all:unset;box-sizing:border-box;cursor:pointer;
            padding:5px 12px;border:1px solid var(--pmt-border);border-radius:6px;
            font-size:12px;color:var(--pmt-text-muted)">Clear</button>
          <button id="${NS}-annot-save" style="all:unset;box-sizing:border-box;cursor:pointer;
            padding:5px 14px;background:var(--pmt-accent);color:#fff;border-radius:6px;
            font-size:12px;font-weight:600">Save</button>
        </div>`;
      document.body.appendChild(pop);
      document.getElementById(`${NS}-annot-close`).addEventListener("click", () => pop.remove());
      document.getElementById(`${NS}-annot-clear`).addEventListener("click", () => {
        saveAnnotation(scope.scopeId, entryId, { note: "", flags: [] });
        setStatus("Annotation cleared.", "ok", 2e3);
        pop.remove();
        renderOutput();
      });
      document.getElementById(`${NS}-annot-save`).addEventListener("click", () => {
        const note = document.getElementById(`${NS}-annot-note`).value.trim();
        const flags = [...pop.querySelectorAll("input[data-flag]:checked")].map((cb) => cb.dataset.flag);
        saveAnnotation(scope.scopeId, entryId, { note, flags });
        setStatus(note || flags.length ? "Annotation saved." : "Annotation cleared.", "ok", 2e3);
        pop.remove();
        renderOutput();
      });
    }
    outEl.addEventListener("click", (e) => {
      var _a2;
      const badge = e.target.closest(".pmt5-annot-badge");
      if ((_a2 = badge == null ? void 0 : badge.dataset) == null ? void 0 : _a2.entryId) _handleAnnotationClick(badge.dataset.entryId);
    });
    outEl.addEventListener("dblclick", (e) => {
      var _a2, _b2;
      if (activeTab !== "result") return;
      const textSpan = e.target.closest(`.${NS}-entry-text`);
      if (!textSpan) return;
      const row = textSpan.closest(`.${NS}-entry`);
      const idx = parseInt((_b2 = (_a2 = row == null ? void 0 : row.dataset) == null ? void 0 : _a2.entryIdx) != null ? _b2 : "-1", 10);
      if (idx < 0 || idx >= currentEntries.length) return;
      const original = currentEntries[idx];
      const ta2 = document.createElement("textarea");
      ta2.value = original;
      ta2.className = `${NS}-inline-edit`;
      ta2.style.cssText = "width:100%;min-height:3em;background:var(--pmt-surface-2);color:var(--pmt-text);border:1px solid var(--pmt-accent);border-radius:4px;padding:4px 6px;font:inherit;resize:vertical;box-sizing:border-box;";
      textSpan.replaceWith(ta2);
      ta2.focus();
      ta2.select();
      function commitEdit() {
        const newVal = ta2.value.trim();
        if (newVal && newVal !== original) {
          undoStack.push([...currentEntries]);
          _refreshUndo();
          currentEntries[idx] = newVal;
          setStatus("Entry updated. Re-run Trim to refresh analysis.", "ok", 4e3);
          recordAction("inline-edit", { mode: getMode(), status: "ok", detail: `entry ${idx}` });
        }
        renderOutput();
      }
      ta2.addEventListener("blur", commitEdit);
      ta2.addEventListener("keydown", (e2) => {
        if (e2.key === "Enter" && !e2.shiftKey) {
          e2.preventDefault();
          commitEdit();
        }
        if (e2.key === "Escape") {
          ta2.value = original;
          ta2.blur();
        }
      });
    });
    if (btnUndo) {
      btnUndo.addEventListener("click", () => {
        if (!undoStack.length) return;
        currentEntries = undoStack.pop();
        removedEntries = [];
        trimResult = null;
        removedN.textContent = "0";
        progFill.style.width = "100%";
        btnPrev.disabled = true;
        btnCopy.disabled = false;
        btnSnap.disabled = false;
        btnApplyMem.disabled = false;
        btnExpKept.disabled = false;
        btnLore.disabled = false;
        _refreshUndo();
        switchTab("result");
        setStatus(`Restored ${currentEntries.length} entries (Undo).`, "ok", 4e3);
      });
    }
    btnPrev.addEventListener("click", () => switchTab("preview"));
    btnClr.addEventListener("click", () => {
      if (currentEntries.length > 0) {
        saveSnapshot(scope.scopeId, currentEntries.join("\n\n"), "auto (before Clear)");
      }
      ta.value = "";
      currentEntries = [];
      removedEntries = [];
      trimResult = null;
      undoStack = [];
      filterQ = "";
      searchIn.value = "";
      removedN.textContent = "0";
      progFill.style.width = "0%";
      btnCopy.disabled = true;
      btnPrev.disabled = true;
      btnExpKept.disabled = true;
      btnExpRem.disabled = true;
      btnSnap.disabled = true;
      btnSortSim.disabled = true;
      btnMap.disabled = true;
      repPill.style.display = "none";
      confN.textContent = "0";
      dupsN.textContent = "0";
      conflictList = [];
      topicGroups = null;
      storyBeats = [];
      sortedEntries = null;
      hideRecovery();
      _refreshUndo();
      updatePills();
      switchTab("result");
      setStatus("Cleared.", "", 2e3);
      if (cfg.autoFocus) ta.focus();
    });
    function closePanel() {
      clearTimeout(panel._statusTimer);
      document.removeEventListener("keydown", keyHandler);
      document.removeEventListener("keydown", extKeyHandler);
      panel.style.pointerEvents = "none";
      backdrop.style.pointerEvents = "none";
      isOpen = false;
      panel.style.transition = "opacity 0.15s ease";
      backdrop.style.transition = "opacity 0.15s ease";
      panel.style.opacity = "0";
      backdrop.style.opacity = "0";
      setTimeout(() => {
        panel.remove();
        backdrop.remove();
      }, 160);
    }
    btnClose.addEventListener("click", closePanel);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closePanel();
    });
    function keyHandler(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePanel();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        btnRun.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (undoStack.length) {
          currentEntries = undoStack.pop();
          removedEntries = [];
          trimResult = null;
          progFill.style.width = "100%";
          _refreshUndo();
          switchTab("result");
          setStatus(`Restored ${currentEntries.length} entries (Ctrl+Z).`, "ok", 4e3);
        }
      }
    }
    document.addEventListener("keydown", keyHandler);
    let eggCount = 0;
    let eggTimer = null;
    verBadge.style.cursor = "pointer";
    verBadge.style.transition = "color 0.15s, border-color 0.15s";
    verBadge.addEventListener("pointerdown", (e) => e.stopPropagation());
    verBadge.addEventListener("click", () => {
      eggCount++;
      clearTimeout(eggTimer);
      eggTimer = setTimeout(() => {
        eggCount = 0;
      }, 2500);
      verBadge.style.color = "#3fb950";
      verBadge.style.borderColor = "#3fb95077";
      setTimeout(() => {
        if (verBadge.isConnected) {
          verBadge.style.color = "";
          verBadge.style.borderColor = "";
        }
      }, 280);
      if (eggCount >= 5) {
        eggCount = 0;
        clearTimeout(eggTimer);
        _showEasterEgg(panel);
      }
    });
    switchTab(activeTab);
    _refreshUndo();
    _updateSnapBadge();
  }
  function _showEasterEgg(panel) {
    if (document.getElementById(`${NS}-egg`)) return;
    const egg = document.createElement("div");
    egg.id = `${NS}-egg`;
    egg.innerHTML = `
    <div id="${NS}-egg-title">MEMORY PURGE INITIATED</div>
    <div id="${NS}-egg-msg">
      Just kidding \u2014 your memories are perfectly safe! \u{1F604}<br><br>
      <span style="color:#3fb950;font-family:monospace;font-size:12px">
        Achievement unlocked: <b>Memory Hacker</b>
      </span>
    </div>
    <button id="${NS}-egg-close">Phew, close this!</button>
  `;
    panel.appendChild(egg);
    function dismiss() {
      egg.style.transition = "opacity 0.22s";
      egg.style.opacity = "0";
      setTimeout(() => egg.remove(), 240);
    }
    document.getElementById(`${NS}-egg-close`).addEventListener("click", dismiss);
    setTimeout(() => {
      if (egg.isConnected) dismiss();
    }, 6e3);
  }

  // src/app/bootstrap.js
  init_helpers();
  function bootstrap(cssText) {
    var _a;
    if (document.getElementById(SENTINEL_ID)) return null;
    const sentinel = document.createElement("div");
    sentinel.id = SENTINEL_ID;
    sentinel.style.cssText = "display:none!important";
    document.body.appendChild(sentinel);
    const styleEl = document.createElement("style");
    styleEl.id = `${NS}-styles`;
    styleEl.textContent = cssText;
    document.head.appendChild(styleEl);
    const cfg = loadCfg();
    applyTheme((_a = cfg.theme) != null ? _a : "dark");
    const fab = document.createElement("button");
    fab.id = `${NS}-fab`;
    fab.title = "Open Memory Trimmer  (Alt+M)";
    fab.textContent = "Trim Memories";
    const savedPos = loadSavedPos(cfg);
    restorePosition(fab, savedPos.fab, false);
    document.body.appendChild(fab);
    makeDraggable(fab, fab, (pos) => {
      const fresh = loadSavedPos(cfg);
      fresh.fab = pos;
      savePos(cfg, fresh);
    });
    fab.addEventListener("click", () => openPanel());
    function tryInjectShortcut() {
      if (!cfg.showAutomationBadge) return;
      const result = injectShortcutButton({
        label: "\u{1F9E0} Trim mem",
        title: "Open Memory Trimmer",
        onClick: () => openPanel()
      });
      if (!result && cfg.showAutomationBadge) {
        console.debug("[PMT] Shortcut button injection failed — host toolbar container not found");
      }
      if (cfg.injectMiniToolbar) {
        const win = findBestMemoryWindow();
        if (win == null ? void 0 : win.el) injectMiniToolbar(win.el, { onOpen: () => openPanel() });
      }
    }
    tryInjectShortcut();
    setTimeout(tryInjectShortcut, 2e3);
    const automationState = getAutomationState();
    if (automationState.status !== "manual") {
      console.debug(`[PMT] Host status: ${automationState.status}`);
    }
    return { sentinel, fab, styleEl, tryInjectShortcut };
  }

  // src/app/events.js
  function registerGlobalKeys() {
    document.addEventListener("keydown", (e) => {
      if (e.altKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        openPanel();
      }
    });
  }

  // src/app/mount.js
  init_constants();
  function createMountObserver({ sentinel, fab, styleEl, tryInjectShortcut }) {
    let reinjectTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(reinjectTimer);
      reinjectTimer = setTimeout(() => {
        if (!document.getElementById(SENTINEL_ID)) document.body.appendChild(sentinel);
        if (!document.getElementById(`${NS}-fab`)) document.body.appendChild(fab);
        if (!document.head.contains(styleEl)) document.head.appendChild(styleEl);
        if (typeof tryInjectShortcut === "function") {
          tryInjectShortcut();
        }
        // Clean up stale mini-toolbars on any window if the feature is disabled
        const cfg2 = (() => { try { return JSON.parse(localStorage.getItem("pmt5_cfg") || "{}"); } catch { return {}; } })();
        if (!cfg2.injectMiniToolbar) {
          [...document.querySelectorAll(".window")].forEach((win) => {
            const stale = win.querySelector('[data-pmt-toolbar="true"]');
            if (stale) stale.remove();
          });
        }
      }, 250);
    });
    observer.observe(document.body, { childList: true });
    return observer;
  }

  // src/app/main.js
  init_smoketests();
  init_constants();
  init_storage();
  var CSS_TEXT = true ? `/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   PMT Styles \u2014 redesigned information architecture
   patch-spec-ui-ux-optimization-pass-v2 + theme-form-controls-and-readability
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

/* \u2500\u2500 Reset \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-fab, #pmt5-panel, #pmt5-backdrop, #pmt5-panel * {
  box-sizing: border-box;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: normal;
  -webkit-font-smoothing: antialiased;
}

/* ── CSS token layer — unified semantic token set ────────────────────────── */
#pmt5-panel, #pmt5-fab {
  --pmt-bg        : var(--box-color,       #161b22);
  --pmt-surface   : var(--box-color,       #161b22);
  --pmt-surface-2 : var(--background,      #0d1117);
  --pmt-surface-3 : #21262d;
  --pmt-text      : var(--text-color,      #c9d1d9);
  --pmt-text-muted: #8b949e;
  --pmt-text-faint: #6e7681;
  --pmt-text-dim  : #3d444d;
  --pmt-text-bright: #e6edf3;
  --pmt-border    : var(--border-color,    #30363d);
  --pmt-accent    : var(--button-bg,       #388bfd);
  --pmt-accent-hi : #58a6ff;
  --pmt-focus     : var(--button-bg,       #388bfd);
  --pmt-success   : #3fb950;
  --pmt-success-bg: #1a3a1a;
  --pmt-warning   : #f0883e;
  --pmt-danger    : #f85149;
  --pmt-danger-bg : #2d1a1a;
  --pmt-gold      : #e3b341;
  --pmt-gold-dim  : #e3b34155;
  --pmt-purple    : #a371f7;
  --pmt-chip-bg   : #21262d;
  --pmt-chip-text : #8b949e;
}

/* \u2500\u2500 Floating action button \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-fab {
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
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  transition: background .15s, border-color .15s, color .15s;
}
#pmt5-fab:hover  { background: #1c2128; border-color: #8b949e; color: #e6edf3; }
#pmt5-fab:active { background: #21262d; }

/* \u2500\u2500 Backdrop \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-backdrop {
  position: fixed; inset: 0; z-index: 2147483641;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(2px);
  animation: pmt5-fade-in 0.18s ease;
}
@keyframes pmt5-fade-in { from { opacity:0 } to { opacity:1 } }

/* \u2500\u2500 Panel shell \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-panel {
  position: fixed;
  z-index: 2147483642;
  top: 50%; left: 50%;
  transform: translate(-50%,-50%);
  width: min(780px, 95vw);
  max-height: 92vh;
  min-width: 340px;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 10px;
  box-shadow: 0 8px 40px rgba(0,0,0,.65);
  resize: both;
}
#pmt5-panel.pmt5-open-anim {
  animation: pmt5-panel-in .2s cubic-bezier(.22,.61,.36,1) both;
}
@keyframes pmt5-panel-in {
  from { opacity:0; transform:translate(-50%,-48%) }
  to   { opacity:1; transform:translate(-50%,-50%) }
}
#pmt5-panel.pmt5-positioned { transform: none; }

/* \u2500\u2500 ZONE 1: Header \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: #161b22;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
}
#pmt5-hdr-title {
  font-size: 13px;
  font-weight: 700;
  color: #e6edf3;
  pointer-events: none;
  white-space: nowrap;
}
#pmt5-ver {
  font-size: 10px; font-weight: 600; color: #6e7681;
  background: #21262d; border: 1px solid #30363d;
  border-radius: 20px; padding: 2px 7px;
  white-space: nowrap; flex-shrink: 0;
}
#pmt5-auto-badge {
  font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: 20px;
  border: 1px solid #30363d;
  background: #21262d; color: #6e7681;
  white-space: nowrap; flex-shrink: 0;
  transition: color .2s, border-color .2s;
}
#pmt5-auto-badge.connected   { color: #3fb950; border-color: #3fb95055; }
#pmt5-auto-badge.windowed    { color: #388bfd; border-color: #388bfd55; }
#pmt5-verify-badge {
  font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: 20px;
  border: 1px solid transparent;
  display: none; white-space: nowrap; flex-shrink: 0;
}
#pmt5-verify-badge.verified  { display:inline; color:#3fb950; border-color:#3fb95055; background:#1a3a1a; }
#pmt5-verify-badge.mismatch  { display:inline; color:#f85149; border-color:#f8514955; background:#2d1a1a; }
#pmt5-verify-badge.unverified{ display:inline; color:#8b949e; border-color:#30363d;   background:#21262d; }
#pmt5-kbd { font-size:10px; color:#3d444d; white-space:nowrap; flex-shrink:0; margin-left:auto; pointer-events:none; }
#pmt5-close {
  all: unset; box-sizing: border-box;
  color: #6e7681; font-size: 18px; line-height: 1;
  padding: 3px 7px; border-radius: 6px; cursor: pointer; flex-shrink: 0;
  transition: background .15s, color .15s;
}
#pmt5-close:hover { background: rgba(248,81,73,.14); color: #f85149; }

/* \u2500\u2500 Recovery banner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-recovery-banner {
  display: none; align-items: center; gap: 10px;
  padding: 6px 14px;
  background: #2d1a1a; border-bottom: 1px solid #f8514944;
  font-size: 11.5px; color: #f85149; flex-shrink: 0;
}
#pmt5-recovery-banner.pmt5-visible { display: flex; }
#pmt5-recovery-msg { flex: 1; }
#pmt5-recovery-act {
  all: unset; box-sizing: border-box;
  padding: 3px 10px; border: 1px solid #f8514966; border-radius: 5px;
  cursor: pointer; font-size: 11px; font-weight: 600; color: #f85149;
  white-space: nowrap; transition: background .15s;
}
#pmt5-recovery-act:hover { background: rgba(248,81,73,.12); }

/* \u2500\u2500 Onboarding banner \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-onboard { animation: pmt5-fade-in 0.25s ease; }
#pmt5-onboard .pmt5-onboard-inner {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px;
  background: #161b22; border-bottom: 1px solid #21262d;
  font-size: 12px; color: #c9d1d9; line-height: 1.6;
}
#pmt5-onboard code { background:#21262d; border-radius:3px; padding:1px 5px; font-family:monospace; font-size:11px; }
#pmt5-onboard-close {
  all: unset; box-sizing:border-box; cursor:pointer;
  color:#6e7681; font-size:16px; padding:2px 6px; flex-shrink:0;
}

/* \u2500\u2500 ZONE 2: Workspace / paste area \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-workspace { padding: 10px 12px 8px; border-bottom: 1px solid #21262d; flex-shrink: 0; }
#pmt5-ta {
  display: block; width: 100%; height: 110px; min-height: 50px;
  resize: vertical;
  background: var(--pmt-surface-2); color: var(--pmt-text);
  border: 1px solid var(--pmt-border); border-radius: 7px;
  padding: 7px 9px;
  font: 12.5px/1.6 'Cascadia Code','Fira Code',Consolas,monospace;
  transition: border-color .2s;
}
#pmt5-ta:focus { outline: none; border-color: var(--pmt-focus); }
#pmt5-ta::placeholder { color: #3d444d; }

/* \u2500\u2500 ZONE 3: Stats strip \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-stats {
  display: flex; flex-wrap: wrap; gap: 5px;
  padding: 6px 12px;
  border-bottom: 1px solid #21262d;
  background: var(--pmt-surface-2);
  flex-shrink: 0;
}
.pmt5-stat {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 8px; background: #161b22;
  border: 1px solid #21262d; border-radius: 20px;
  font-size: 11px; color: #8b949e; white-space: nowrap;
}
.pmt5-stat b { color: #c9d1d9; font-weight: 600; }
.pmt5-stat.pmt5-warn b { color: #f0883e; }
.pmt5-stat-src { font-size: 9px; opacity: .6; margin-left: 2px; }

/* \u2500\u2500 ZONE 4: Preset strip \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-presets {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 12px;
  border-bottom: 1px solid #21262d;
  background: var(--pmt-surface-2);
  overflow-x: auto; scrollbar-width: none; flex-shrink: 0;
}
#pmt5-presets::-webkit-scrollbar { display: none; }
#pmt5-preset-label { font-size: 9px; color: #3d444d; text-transform: uppercase; letter-spacing: .5px; white-space: nowrap; flex-shrink: 0; }
.pmt5-preset-btn {
  all: unset; box-sizing: border-box;
  padding: 3px 9px; border: 1px solid #21262d; border-radius: 20px;
  font-size: 11px; color: #6e7681; cursor: pointer; white-space: nowrap;
  transition: border-color .15s, color .15s, background .15s;
}
.pmt5-preset-btn:hover { border-color: var(--pmt-accent); color: var(--pmt-accent); }

/* \u2500\u2500 ZONE 5: Options (collapsible) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-opts-toggle {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 12px;
  border-bottom: 1px solid #21262d;
  background: var(--pmt-bg);
  cursor: pointer; user-select: none; flex-shrink: 0;
  font-size: 11px; color: #6e7681;
  transition: color .15s;
}
#pmt5-opts-toggle:hover { color: #c9d1d9; }
#pmt5-opts-toggle b { color: #8b949e; }
#pmt5-opts-toggle .pmt5-opts-arrow { margin-left: auto; transition: transform .2s; }
#pmt5-opts-toggle.open .pmt5-opts-arrow { transform: rotate(180deg); }
#pmt5-opts-body {
  display: none; flex-direction: column; gap: 0;
  border-bottom: 1px solid #21262d; flex-shrink: 0;
}
#pmt5-opts-body.open { display: flex; }

/* Options grid inside collapsible */
#pmt5-opts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
  padding: 8px 12px;
}
.pmt5-og { background: #161b22; border: 1px solid #21262d; border-radius: 7px; padding: 8px 10px; display: flex; flex-direction: column; gap: 5px; }
.pmt5-og-hd { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #3d444d; }
.pmt5-lbl { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--pmt-text-muted); cursor: pointer; user-select: none; }
.pmt5-lbl:hover { color: var(--pmt-text); }
.pmt5-lbl input[type=checkbox] { accent-color: var(--pmt-accent); width:13px; height:13px; cursor:pointer; flex-shrink:0; margin:0; }
.pmt5-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.pmt5-slider { flex:1; min-width:50px; accent-color: var(--pmt-accent); cursor:pointer; }
.pmt5-cv { font-size:11px; font-weight:600; color: var(--pmt-accent); min-width:24px; text-align:right; }
.pmt5-sel, .pmt5-numbox {
  background: var(--pmt-surface-2); color: var(--pmt-text);
  border: 1px solid var(--pmt-border); border-radius: 5px;
  padding: 4px 7px; font-size: 12px; transition: border-color .2s; min-width: 0;
}
.pmt5-sel  { flex: 1; }
.pmt5-numbox { width: 70px; }
.pmt5-sel:focus, .pmt5-numbox:focus { outline: none; border-color: var(--pmt-focus); }

#pmt5-budget-og { border-color: #388bfd33; }
#pmt5-budget-og .pmt5-og-hd { color: #388bfd99; }

/* \u2500\u2500 ZONE 6: Primary actions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-actions-primary {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid #21262d;
  background: var(--pmt-surface);
  flex-shrink: 0; flex-wrap: wrap;
}

/* Action buttons \u2014 base */
.pmt5-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 7px 13px; border: none; border-radius: 7px;
  font: 600 12.5px/1 system-ui, sans-serif;
  cursor: pointer; white-space: nowrap;
  transition: filter .12s, transform .1s, opacity .15s;
}
.pmt5-btn:active:not(:disabled) { transform: scale(.96); }
.pmt5-btn:disabled { opacity: .35; cursor: not-allowed; }

/* Primary action hierarchy */
.pmt5-btn-primary  { background: #238636; color: #fff; }        /* Trim */
.pmt5-btn-caution  { background: #1a4232; color: #3fb950; border: 1px solid #3fb95044; } /* Apply */
.pmt5-btn-recovery { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; }  /* Restore */
.pmt5-btn-neutral  { background: #1f6feb; color: #fff; }        /* Copy */
.pmt5-btn-secondary{ background: #21262d; color: #c9d1d9; border: 1px solid #30363d; }

.pmt5-btn-primary:hover:not(:disabled)  { filter: brightness(1.15); }
.pmt5-btn-caution:hover:not(:disabled)  { border-color: #3fb950; filter: brightness(1.2); }
.pmt5-btn-recovery:hover:not(:disabled) { border-color: #8b949e; color: #e6edf3; }
.pmt5-btn-neutral:hover:not(:disabled)  { filter: brightness(1.15); }
.pmt5-btn-secondary:hover:not(:disabled){ border-color: #8b949e; color: #e6edf3; }

/* "More" toggle for secondary actions */
#pmt5-more-toggle {
  margin-left: auto;
  background: transparent; color: #6e7681;
  border: 1px solid #30363d; border-radius: 6px;
  padding: 5px 10px; font-size: 11px; font-weight: 600;
  cursor: pointer; white-space: nowrap;
  transition: color .15s, border-color .15s;
}
#pmt5-more-toggle:hover { color: #c9d1d9; border-color: #8b949e; }
#pmt5-undo-label { font-size: 11px; color: #3d444d; white-space: nowrap; }

/* \u2500\u2500 ZONE 7: Secondary actions (collapsible) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-actions-secondary {
  display: none; align-items: center; gap: 5px; flex-wrap: wrap;
  padding: 6px 12px;
  border-bottom: 1px solid #21262d;
  background: var(--pmt-surface-2);
  flex-shrink: 0;
}
#pmt5-actions-secondary.open { display: flex; }
.pmt5-btn-tool {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 5px 10px; border: 1px solid #21262d; border-radius: 6px;
  background: transparent; color: #6e7681;
  font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;
  transition: color .15s, border-color .15s, background .15s;
}
.pmt5-btn-tool:hover:not(:disabled) { color: #c9d1d9; border-color: #30363d; background: #161b22; }
.pmt5-btn-tool:disabled { opacity: .35; cursor: not-allowed; }
.pmt5-btn-tool.danger:hover:not(:disabled) { color: #f85149; border-color: #f8514966; }
.pmt5-btn-tool.accent:hover:not(:disabled) { color: var(--pmt-accent); border-color: #388bfd55; }
.pmt5-btn-tool.lore:hover:not(:disabled)   { color: #e3b341; border-color: #e3b34155; }
.pmt5-btn-tool.qa:hover:not(:disabled)     { color: #a371f7; border-color: #a371f755; }

/* \u2500\u2500 Progress rail \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-rail { height: 3px; background: #161b22; flex-shrink: 0; overflow: hidden; }
#pmt5-fill { height: 100%; width: 0%; background: linear-gradient(90deg,#238636,#388bfd); border-radius:1px; transition: width .5s cubic-bezier(.22,.61,.36,1); }

/* \u2500\u2500 ZONE 8: Tabs \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-tabs {
  display: flex; background: var(--pmt-surface);
  border-bottom: 1px solid var(--pmt-border);
  flex-shrink: 0; overflow-x: auto; scrollbar-width: none;
}
#pmt5-tabs::-webkit-scrollbar { display: none; }
.pmt5-tab {
  padding: 7px 12px; font-size: 12px; font-weight: 600;
  color: #6e7681; cursor: pointer; white-space: nowrap;
  border-bottom: 2px solid transparent;
  transition: color .15s, border-color .15s; user-select: none;
  display: flex; align-items: center; gap: 4px;
}
.pmt5-tab:hover { color: #c9d1d9; }
.pmt5-tab.pmt5-active { color: #58a6ff; border-bottom-color: #58a6ff; }
.pmt5-tab-badge {
  font-size: 9px; font-weight: 700;
  background: #21262d; border-radius: 20px; padding: 1px 5px;
  color: #8b949e; min-width: 16px; text-align: center;
}
.pmt5-tab.pmt5-active .pmt5-tab-badge { background: #388bfd22; color: #58a6ff; }
.pmt5-tab-badge.has-items { background: #388bfd22; color: #58a6ff; }

/* \u2500\u2500 ZONE 9: Output area \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-output-zone { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }

/* Search bar */
#pmt5-search {
  display: none; align-items: center; gap: 8px;
  padding: 5px 12px; border-bottom: 1px solid #21262d;
  background: var(--pmt-surface); flex-shrink: 0;
}
#pmt5-search.pmt5-visible { display: flex; }
#pmt5-search-in {
  flex: 1; background: var(--pmt-surface-2); color: var(--pmt-text);
  border: 1px solid var(--pmt-border); border-radius: 6px;
  padding: 4px 8px; font-size: 12px; transition: border-color .2s;
}
#pmt5-search-in:focus { outline: none; border-color: var(--pmt-focus); }
#pmt5-search-in::placeholder { color: #3d444d; }
#pmt5-search-count { font-size: 11px; color: #6e7681; white-space: nowrap; flex-shrink: 0; }

/* Output scroll */
#pmt5-out-scroll {
  flex: 1 1 auto; overflow-y: auto; overflow-x: hidden; min-height: 60px;
  scrollbar-width: thin; scrollbar-color: #30363d transparent;
}
#pmt5-out-scroll::-webkit-scrollbar { width: 5px; }
#pmt5-out-scroll::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
#pmt5-out {
  padding: 10px 12px;
  font: 12.5px/1.7 'Cascadia Code','Fira Code',Consolas,monospace;
  white-space: pre-wrap; word-break: break-word; color: #8b949e;
}
.pmt5-hint   { color: #3d444d; font-style: italic; }
.pmt5-c-ok   { color: #3fb950; }
.pmt5-c-warn { color: #f0883e; }
.pmt5-c-kept { color: #c9d1d9; }
.pmt5-c-gone { color: #f85149; text-decoration: line-through; opacity: .6; }
.pmt5-c-sep  { color: #21262d; user-select: none; }
.pmt5-c-hl   { background: rgba(88,166,255,.18); color: #58a6ff; border-radius: 2px; }

/* \u2500\u2500 Entry chips (diff-readability patch) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pmt5-entry { display: flex; align-items: flex-start; gap: 5px; }
.pmt5-entry-controls { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; padding-top: 1px; }
.pmt5-entry-sel { accent-color: #388bfd; width:13px; height:13px; cursor:pointer; margin:0; flex-shrink:0; }
.pmt5-btn-micro {
  all: unset; box-sizing: border-box;
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; font-size: 11px; border-radius: 3px;
  cursor: pointer; color: #6e7681; transition: background .12s, color .12s; flex-shrink: 0;
}
.pmt5-btn-micro:hover { background: #21262d; color: #c9d1d9; }
.pmt5-entry-pinned .pmt5-btn-micro { color: #58a6ff; }
.pmt5-chips { display: inline-flex; gap: 3px; margin-right: 4px; vertical-align: middle; flex-shrink: 0; }
.pmt5-chip {
  display: inline-flex; align-items: center; padding: 1px 5px;
  border-radius: 10px; font-size: 10px; font-weight: 600;
  white-space: nowrap; cursor: default; user-select: none;
  background: #21262d; border: 1px solid #30363d; color: #8b949e;
}
.pmt5-chip-pin   { background:#161b22; border-color:#58a6ff55; color:#58a6ff; }
.pmt5-chip-prot  { background:#161b22; border-color:#f0883e55; color:#f0883e; }
.pmt5-chip-hot   { background:#161b22; border-color:#f8514955; color:#f85149; }
.pmt5-chip-cont-h{ background:#1a3a1a; border-color:#3fb95055; color:#3fb950; }
.pmt5-chip-cont-m{ background:#1e2a1e; border-color:#e3b34155; color:#e3b341; }
.pmt5-chip-lore  { background:#1e1e2e; border-color:#a371f755; color:#a371f7; }
.pmt5-chip-tok   { background:#161b22; border-color:#30363d;   color:#6e7681; }
.pmt5-annot-badge { display:inline-block; width:6px; height:6px; border-radius:50%; background:#e3b341; margin-left:3px; vertical-align:middle; cursor:pointer; flex-shrink:0; }

/* \u2500\u2500 Settings pane \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-settings {
  display: none; flex: 1 1 auto; flex-direction: column;
  overflow-y: auto; min-height: 0;
  scrollbar-width: thin; scrollbar-color: #30363d transparent;
}
#pmt5-settings.pmt5-visible { display: flex; }
.pmt5-stg-group { padding: 10px 12px; border-bottom: 1px solid #21262d; }
.pmt5-stg-group-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #3d444d; margin-bottom: 6px; }
.pmt5-stg-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px; background: #161b22; border: 1px solid #21262d; border-radius: 7px; margin-bottom: 5px; }
.pmt5-stg-label { font-size: 12.5px; font-weight: 600; color: #c9d1d9; }
.pmt5-stg-sub   { font-size: 11px; color: #6e7681; margin-top: 2px; }
.pmt5-tog { position:relative; width:38px; height:21px; flex-shrink:0; }
.pmt5-tog input { position:absolute; opacity:0; width:0; height:0; }
.pmt5-tog-track { position:absolute; inset:0; background:#21262d; border:1px solid #30363d; border-radius:21px; cursor:pointer; transition:background .2s,border-color .2s; }
.pmt5-tog input:checked + .pmt5-tog-track { background:#1a4232; border-color:#3fb950; }
.pmt5-tog-thumb { position:absolute; width:14px; height:14px; top:3px; left:3px; background:#6e7681; border-radius:50%; pointer-events:none; transition:left .2s,background .2s; }
.pmt5-tog input:checked ~ .pmt5-tog-thumb { left:20px; background:#3fb950; }
.pmt5-stg-sel { background:var(--pmt-surface-2); color:var(--pmt-text); border:1px solid var(--pmt-border); border-radius:6px; padding:5px 8px; font-size:12.5px; font-family:inherit; cursor:pointer; transition:border-color .2s; flex-shrink:0; min-width:110px; }
.pmt5-stg-sel:focus { outline:none; border-color:var(--pmt-focus); }
#pmt5-custom-css-area { background:#161b22; border:1px solid #21262d; border-radius:7px; padding:10px 12px; display:flex; flex-direction:column; gap:8px; margin:0 12px 8px; }
#pmt5-custom-css-area.pmt5-hidden { display:none; }
.pmt5-css-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
#pmt5-import-file-btn { all:unset; box-sizing:border-box; padding:5px 10px; background:#21262d; color:#c9d1d9; border:1px solid #30363d; border-radius:6px; font:600 12px/1 system-ui,sans-serif; cursor:pointer; white-space:nowrap; transition:background .15s,border-color .15s; }
#pmt5-import-file-btn:hover { background:#2d333b; border-color:#8b949e; }
.pmt5-css-hint { font-size:11px; color:#6e7681; flex:1; line-height:1.4; }
#pmt5-custom-css-ta { display:block; width:100%; height:90px; min-height:50px; resize:vertical; background:#010409; color:#c9d1d9; border:1px solid #30363d; border-radius:6px; padding:7px 9px; font:12px/1.5 'Cascadia Code',Consolas,monospace; transition:border-color .2s; box-sizing:border-box; }
#pmt5-custom-css-ta:focus { outline:none; border-color:#388bfd; }
.pmt5-css-footer { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
#pmt5-apply-css { all:unset; box-sizing:border-box; padding:5px 12px; background:#238636; color:#fff; border-radius:6px; font:600 12px/1 system-ui,sans-serif; cursor:pointer; transition:filter .12s; }
#pmt5-apply-css:hover { filter:brightness(1.15); }
#pmt5-clear-css { all:unset; box-sizing:border-box; padding:5px 10px; color:#f85149; border:1px solid #f8514966; border-radius:6px; font:600 12px/1 system-ui,sans-serif; cursor:pointer; transition:background .15s; }
#pmt5-clear-css:hover { background:rgba(248,81,73,.1); }
#pmt5-stg-reset { all:unset; box-sizing:border-box; margin:4px 12px 8px; padding:7px 14px; color:#f85149; border:1px solid #f8514966; border-radius:7px; font:600 12px/1 system-ui,sans-serif; cursor:pointer; align-self:flex-start; transition:background .15s; }
#pmt5-stg-reset:hover { background:rgba(248,81,73,.1); }

/* \u2500\u2500 Diagnostics drawer \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-diag-drawer { display:none; flex-direction:column; gap:6px; padding:8px 12px; background:#010409; border-top:1px solid #21262d; font-size:11px; color:#8b949e; font-family:monospace; flex-shrink:0; }
#pmt5-diag-drawer.pmt5-visible { display:flex; }
.pmt5-diag-row { display:flex; gap:8px; }
.pmt5-diag-key { color:#3d444d; min-width:130px; }
.pmt5-diag-val { color:#c9d1d9; }

/* \u2500\u2500 Compare area \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-compare-area { display:none; flex-direction:column; gap:8px; padding:10px 12px; flex:1; overflow-y:auto; }
#pmt5-compare-area textarea { height:75px; resize:vertical; background:#010409; color:#c9d1d9; border:1px solid #30363d; border-radius:6px; padding:7px 9px; font:12px/1.5 monospace; width:100%; box-sizing:border-box; }
#pmt5-compare-area textarea:focus { outline:none; border-color:#388bfd; }

/* \u2500\u2500 Security / warning inline helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pmt5-warn-inline { color: var(--pmt-warning); font-weight: 600; }
.pmt5-qa-key-warn {
  font-size: 10px; color: var(--pmt-warning);
  white-space: nowrap; cursor: help; flex-shrink: 0;
  padding: 2px 6px; border: 1px solid var(--pmt-warning);
  border-radius: 4px; opacity: 0.8;
}

/* \u2500\u2500 Bubble map overlay (BUG-16 fix: was entirely inline hardcoded dark) \u2500\u2500\u2500\u2500 */
.pmt5-bubble-overlay { background: rgba(0,0,0,0.82); }
.pmt5-bubble-shell {
  position:relative; border-radius:10px; overflow:hidden;
  width:min(860px,97vw); max-height:92vh;
  display:flex; flex-direction:column;
  background: var(--pmt-surface-2); border: 1px solid var(--pmt-border);
}
.pmt5-bubble-hdr {
  display:flex; align-items:center; gap:10px;
  padding:9px 14px; flex-shrink:0;
  background: var(--pmt-surface); border-bottom: 1px solid var(--pmt-border);
}
.pmt5-bubble-title   { font-weight:700; color: var(--pmt-text); flex:1; }
.pmt5-bubble-cluster-label { font-size:11px; color: var(--pmt-text-muted); }
.pmt5-bubble-hint    { font-size:11px; color: var(--pmt-text-muted); }
.pmt5-bubble-close {
  all:unset; box-sizing:border-box; cursor:pointer;
  color: var(--pmt-text-muted); font-size:18px; padding:2px 7px; border-radius:5px;
  transition: color .15s;
}
.pmt5-bubble-close:hover { color: var(--pmt-danger); }
.pmt5-bubble-tooltip {
  background: var(--pmt-surface); border: 1px solid var(--pmt-border);
  border-radius:7px; padding:8px 12px; font-size:12px;
  color: var(--pmt-text); max-width:280px; pointer-events:none; line-height:1.5;
}

/* \u2500\u2500 Q&A popup (BUG-15 fix: was entirely inline hardcoded dark) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* Popup shell layout (colors via vars so theme can override) */
#pmt5-qa-popup {
  border: 1px solid var(--pmt-border);
  border-radius: 10px;
  box-shadow: 0 8px 40px rgba(0,0,0,.65);
  background: var(--pmt-surface-2);
}
.pmt5-qa-hdr {
  display:flex; align-items:center; gap:8px;
  padding:9px 12px;
  background: var(--pmt-surface); border-bottom: 1px solid var(--pmt-border);
  flex-shrink:0;
}
.pmt5-qa-title { font-weight:700; color: var(--pmt-text); flex:1; }
.pmt5-qa-badge {
  font-size:10px; padding:2px 7px; border-radius:10px;
  font-weight:600; flex-shrink:0;
  background: var(--pmt-chip-bg); color: var(--pmt-text-muted);
}
.pmt5-qa-badge.remote { background:#1a4232; color:#3fb950; }
.pmt5-qa-close {
  all:unset; box-sizing:border-box; cursor:pointer;
  color: var(--pmt-text-muted); font-size:16px; padding:2px 7px; border-radius:4px;
  transition: color .15s;
}
.pmt5-qa-close:hover { color: var(--pmt-danger); }
.pmt5-qa-notice {
  padding:7px 12px; font-size:11px;
  color: var(--pmt-text-muted); background: var(--pmt-surface);
  border-bottom: 1px solid var(--pmt-border); flex-shrink:0;
}
.pmt5-qa-key-row {
  display:flex; gap:5px; align-items:center;
  padding:7px 12px; border-bottom: 1px solid var(--pmt-border);
  flex-shrink:0; background: var(--pmt-surface);
}
.pmt5-qa-key-in {
  flex:1; background: var(--pmt-surface-2); color: var(--pmt-text);
  border: 1px solid var(--pmt-border); border-radius:6px;
  padding:5px 8px; font-size:12px; min-width:0;
}
.pmt5-qa-btn {
  all:unset; box-sizing:border-box;
  padding:4px 10px; border: 1px solid var(--pmt-border); border-radius:6px;
  cursor:pointer; font-size:11px; font-weight:600;
  color: var(--pmt-text); white-space:nowrap;
  transition: border-color .15s;
}
.pmt5-qa-btn:hover { border-color: var(--pmt-accent); }
.pmt5-qa-scope-row {
  padding:6px 12px; border-bottom: 1px solid var(--pmt-border);
  background: var(--pmt-surface); flex-shrink:0;
}
.pmt5-qa-scope-label { font-size:11px; color: var(--pmt-text-muted); }
.pmt5-qa-sel {
  margin-left:6px; background: var(--pmt-surface-2); color: var(--pmt-text);
  border: 1px solid var(--pmt-border); border-radius:4px;
  padding:2px 6px; font-size:11px;
}
.pmt5-qa-answer {
  padding:10px 12px; color: var(--pmt-text); line-height:1.65;
  overflow-y:auto; flex:1; white-space:pre-wrap; word-break:break-word; min-height:60px;
}
.pmt5-qa-answer.thinking { color: var(--pmt-text-muted); }
.pmt5-qa-answer.error    { color: var(--pmt-danger); }
.pmt5-qa-footer {
  display:flex; gap:7px; padding:8px 12px;
  border-top: 1px solid var(--pmt-border);
  background: var(--pmt-surface); flex-shrink:0;
}
.pmt5-qa-input {
  flex:1; background: var(--pmt-surface-2); color: var(--pmt-text);
  border: 1px solid var(--pmt-border); border-radius:6px; padding:6px 9px; font-size:12px;
}
.pmt5-qa-input:focus { outline:none; border-color: var(--pmt-focus); }
.pmt5-qa-ask {
  background: var(--pmt-accent); color:#fff; border:none;
  border-radius:6px; padding:6px 14px; font-weight:600; font-size:12px; cursor:pointer;
  transition: filter .12s;
}
.pmt5-qa-ask:hover { filter:brightness(1.1); }

/* \u2500\u2500 Restored from v2.03.0 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* Citations footer \u2014 "N entries searched \xB7 M chars" shown after each response */
.pmt5-qa-citations {
  padding: 0 12px 6px;
  font-size: 11px;
  color: var(--pmt-text-muted);
  min-height: 18px;
  flex-shrink: 0;
}
/* Scope confidence chip in QA popup header */
.pmt5-qa-scope-chip {
  font-size: 10px; padding: 2px 7px; border-radius: 20px;
  background: var(--pmt-chip-bg); color: var(--pmt-text-muted);
  white-space: nowrap; flex-shrink: 0;
}

/* \u2500\u2500 Post-trim guidance hint (BUG-13 fix: was inline dark style) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pmt5-post-trim-hint {
  padding: 4px 12px;
  font-size: 11px;
  color: var(--pmt-accent);
  background: var(--pmt-surface-2);
  border-top: 1px solid var(--pmt-border);
  cursor: pointer;
}
.pmt5-post-trim-hint:hover { opacity: 0.85; }

/* \u2500\u2500 Status bar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-status {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 5px 12px;
  background: var(--pmt-surface); border-top: 1px solid var(--pmt-border);
  flex-shrink: 0;
}
#pmt5-status-msg {
  font-size: 11.5px; color: #6e7681;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
}
#pmt5-status-msg.pmt5-ok   { color: #3fb950; }
#pmt5-status-msg.pmt5-warn { color: #f0883e; }
#pmt5-status-msg.pmt5-err  { color: #f85149; }
#pmt5-undo-lbl { font-size:11px; color:#3d444d; white-space:nowrap; flex-shrink:0; }

/* \u2500\u2500 Light theme override \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* Applied via applyTheme('light') */

/* \u2500\u2500 Easter egg \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-egg { position:absolute; inset:0; z-index:5; background:#0d1117; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; padding:24px; animation:pmt5-fade-in .2s ease; }
#pmt5-egg-title { font:700 17px/1.3 'Cascadia Code',Consolas,monospace; color:#f0883e; text-align:center; }
#pmt5-egg-msg   { font-size:13px; color:#8b949e; text-align:center; line-height:1.6; }
#pmt5-egg-close { all:unset; box-sizing:border-box; padding:8px 20px; background:#21262d; color:#c9d1d9; border:1px solid #30363d; border-radius:7px; font:600 13px/1 system-ui,sans-serif; cursor:pointer; transition:background .15s; }
#pmt5-egg-close:hover { background:#2d333b; }


/* \u2500\u2500 Snapshots tab \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pmt5-snap-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 0;
}
.pmt5-snap-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: var(--pmt-surface);
  border: 1px solid var(--pmt-border);
  border-radius: 7px;
  transition: border-color .15s;
}
.pmt5-snap-row:hover { border-color: var(--pmt-accent); }
.pmt5-snap-row.pmt5-snap-starred { border-color: #e3b34166; background: var(--pmt-surface); }
.pmt5-snap-info { flex: 1; min-width: 0; }
.pmt5-snap-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--pmt-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pmt5-snap-meta {
  display: block;
  font-size: 10px;
  color: var(--pmt-text-muted);
  margin-top: 1px;
}
.pmt5-snap-actions { display: flex; gap: 4px; flex-shrink: 0; }
.pmt5-snap-btn {
  all: unset;
  box-sizing: border-box;
  padding: 3px 8px;
  border: 1px solid var(--pmt-border);
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  color: var(--pmt-text-muted);
  transition: color .12s, border-color .12s, background .12s;
  white-space: nowrap;
}
.pmt5-snap-btn:hover { color: var(--pmt-text); border-color: var(--pmt-accent); }
.pmt5-snap-star { min-width: 26px; text-align: center; font-size: 13px; }
.pmt5-snap-starred .pmt5-snap-star { color: #e3b341; border-color: #e3b34155; }
.pmt5-snap-load:hover { color: var(--pmt-success); border-color: var(--pmt-success); }
.pmt5-snap-btn.danger:hover { color: var(--pmt-danger); border-color: var(--pmt-danger); }

/* \u2500\u2500 Workspace import label \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-import-lbl {
  font-size: 11px;
  padding: 2px 9px;
  cursor: pointer;
  user-select: none;
}
#pmt5-import-lbl:hover { color: var(--pmt-text); border-color: var(--pmt-accent); }

/* \u2500\u2500 Accessibility: focus-visible \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-panel *:focus-visible { outline: 2px solid var(--pmt-focus); outline-offset: 2px; }

/* \u2500\u2500 Mobile / compact \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
@media (max-width:699px) {
  #pmt5-panel { width:99vw!important; min-width:0!important; top:4px!important; left:50%!important; transform:translateX(-50%)!important; max-height:96vh; border-radius:6px; }
  #pmt5-kbd { display:none; }
  #pmt5-opts-grid { grid-template-columns:1fr 1fr; }
  .pmt5-btn { padding:6px 9px; font-size:11.5px; }
  .pmt5-tab { padding:6px 9px; }
  #pmt5-fab { bottom:70px; right:10px; font-size:12px; padding:6px 10px; }
}
@media (max-width:480px) {
  #pmt5-panel { top:0!important; border-radius:0 0 6px 6px; }
  #pmt5-opts-grid { grid-template-columns:1fr; }
  .pmt5-chips { display:none; }
  #pmt5-actions-secondary.open .pmt5-btn-tool:nth-child(n+6) { display:none; }
}

/* \u2500\u2500 Undo button (restored per review \u2014 was missing CSS) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-undo { opacity: 0.8; font-size: 12px; padding: 6px 10px; }
#pmt5-undo:not(:disabled):hover { opacity: 1; border-color: #6e7681; }
#pmt5-undo:disabled { opacity: 0.3; }

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   Round 1 additions \u2014 modes, maturity labels, stale state
   \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */

/* \u2500\u2500 Mode badge \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-mode-badge {
  font-size: 10px; font-weight: 700;
  padding: 2px 8px; border-radius: 20px;
  border: 1px solid #30363d; background: #21262d;
  color: #6e7681; cursor: pointer; white-space: nowrap; flex-shrink: 0;
  transition: background .15s, color .15s, border-color .15s;
  user-select: none;
}
#pmt5-mode-badge[data-mode="daily"]    { color:#3fb950; border-color:#3fb95044; background:#1a3a1a; }
#pmt5-mode-badge[data-mode="advanced"] { color:#e3b341; border-color:#e3b34144; background:#1e2a1a; }
#pmt5-mode-badge[data-mode="debug"]    { color:#f85149; border-color:#f8514944; background:#2d1a1a; }

/* \u2500\u2500 Stale indicator \u2014 textarea turns amber border \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
#pmt5-ta[style*="borderColor: rgb(240, 136, 62)"],
#pmt5-ta[style*="border-color: #f0883e"] {
  box-shadow: 0 0 0 2px rgba(240,136,62,.20);
}

/* \u2500\u2500 Feature maturity labels in secondary toolbar \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.pmt5-btn-tool[data-maturity="beta"]::after {
  content: " \u03B2";
  font-size: 9px;
  opacity: 0.7;
  vertical-align: super;
}
.pmt5-btn-tool[data-maturity="experimental"]::after {
  content: " \u2726";
  font-size: 9px;
  opacity: 0.6;
  vertical-align: super;
  color: #f0883e;
}

/* Light theme additions */
#pmt5-mode-badge[data-mode="daily"]    { }  /* inherits fine in light */

/* ── BUG-19 fix + Round 5: Inline Timeline + Analyse sub-nav CSS ───────── */
#pmt5-out-scroll.pmt5-map-active {
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
}
#pmt5-out-scroll.pmt5-map-active #pmt5-out {
  padding: 0 !important;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-height: 0;
  font: inherit;
  white-space: normal;
}
.pmt5-bubble-inline {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.pmt5-bubble-inline-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-bottom: 1px solid var(--pmt-border);
  background: var(--pmt-surface);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.pmt5-bubble-inline-stat {
  font-size: 10.5px;
  color: var(--pmt-text-muted);
  flex-shrink: 0;
}
.pmt5-bubble-inline-label {
  font-size: 10.5px;
  color: var(--pmt-text-muted);
  display: flex;
  align-items: center;
  gap: 3px;
}
.pmt5-bubble-inline-btn {
  all: unset;
  box-sizing: border-box;
  padding: 3px 9px;
  border: 1px solid var(--pmt-border);
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  color: var(--pmt-text-muted);
  transition: color .12s, border-color .12s;
  white-space: nowrap;
  flex-shrink: 0;
}
.pmt5-bubble-inline-btn:hover:not(:disabled) { color: var(--pmt-text); border-color: var(--pmt-accent); }
.pmt5-bubble-inline-btn:disabled { opacity: .35; cursor: default; }
.pmt5-bubble-inline-apply:not(:disabled) { color: var(--pmt-accent); border-color: var(--pmt-accent); }
.pmt5-bubble-inline-dirty {
  font-size: 10.5px;
  color: var(--pmt-accent, #388bfd);
  flex-shrink: 0;
  margin-left: auto;
}
.pmt5-bubble-inline-canvas-wrap {
  flex: 1 1 auto;
  min-height: 180px;
  position: relative;
  overflow: hidden;
}
.pmt5-bubble-inline-canvas-wrap canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.pmt5-bubble-inline-legend {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding: 4px 10px;
  font-size: 10px;
  color: var(--pmt-text-muted);
  border-top: 1px solid var(--pmt-border);
  background: var(--pmt-surface);
  flex-shrink: 0;
}

/* ── Settings maturity section headers ────────────────────────────────────── */
.pmt5-stg-maturity-hdr {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--pmt-text-faint, #6e7681);
  padding: 10px 12px 3px;
  border-top: 1px solid var(--pmt-border);
  margin-top: 4px;
}

/* ── Analyse tab sub-nav ──────────────────────────────────────────────── */
.pmt5-sub-nav {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 6px 0 8px;
  border-bottom: 1px solid var(--pmt-border);
  margin-bottom: 6px;
  flex-shrink: 0;
}
.pmt5-sub-nav-btn {
  all: unset;
  box-sizing: border-box;
  padding: 3px 9px;
  border: 1px solid var(--pmt-border);
  border-radius: 20px;
  font: 600 11px/1.4 system-ui, sans-serif;
  color: var(--pmt-text-muted);
  cursor: pointer;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color .12s, border-color .12s, background .12s;
}
.pmt5-sub-nav-btn:hover { color: var(--pmt-text); border-color: var(--pmt-accent); }
.pmt5-sub-nav-btn.pmt5-sub-active {
  color: var(--pmt-accent);
  border-color: var(--pmt-accent);
  background: rgba(56,139,253,.08);
}
.pmt5-sub-content {
  flex: 1;
  overflow: visible;
}
` : "";
  (function() {
    "use strict";
    saveSchema(loadSchema());
    const elements = bootstrap(CSS_TEXT);
    if (!elements) return;
    registerGlobalKeys();
    const mountObserver = createMountObserver(elements);
    Object.defineProperty(window, "PMT", {
      value: {
        version: VERSION,
        openPanel,
        debug: {
          runSmokeTests,
          buildDebugReport: (opts) => buildDebugReport(opts),
          // Issue 4 fix: expose observer disconnect for manual cleanup if needed
          disconnectObserver: () => {
            mountObserver.disconnect();
            console.debug("[PMT] Mount observer disconnected.");
          }
        }
      },
      writable: false,
      enumerable: false,
      configurable: false
    });
    if (typeof PMT !== "undefined" && localStorage.getItem("pmt5_user_mode") === "debug") {
      console.debug(`[PMT v${VERSION}] Loaded. Type PMT.debug.runSmokeTests() to verify.`);
    }
  })();
})();
