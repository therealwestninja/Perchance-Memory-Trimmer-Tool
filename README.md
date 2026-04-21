# Perchance Memory Trimmer Tool — v2.04.3

A userscript for [Perchance AI chat](https://perchance.org/ai-character-chat) that helps you manage, trim, inspect, and curate your `/mem` memory block.

**Install from [Greasy Fork](https://greasyfork.org/en/scripts/553173)** · Works with Violentmonkey and Tampermonkey

---

## Quick start

1. Install the script, then open your Perchance AI chat page
2. Click the **Trim Memories** button (bottom-right of the page) — or press `Alt+M`
3. Click **⬇ Fetch** to auto-load your current `/mem` block, or paste it manually into the text area
4. Click **Trim** — the 🫧 Timeline tab opens automatically showing your entries clustered by similarity
5. Review, reorder, and adjust, then click **⬆ Apply** to write back — or **Copy** to paste manually
6. If anything goes wrong: **Ctrl+Z** to undo, or **↩ Restore** to roll back to the last saved snapshot

---

## The panel at a glance

```
┌─ Header (drag to move) ─────────────────────────────── [mode] [✕] ─┐
│ Workspace  ── paste or import your /mem text here ──────────────── │
│ Options    ── char limit · keep N · deduplicate · token budget ──── │
│ [Trim] [⬆ Apply] [↩ Restore] [Copy] [Undo]       [More ▾]         │
├─ Tabs ──────────────────────────────────────────────────────────────┤
│ 🫧 Timeline │ Result │ Removed │ Preview │ Analyse │ Curate │ …    │
├─ Output area ───────────────────────────────────────────────────────┤
│ (tab content here)                                                  │
└─ Status bar ────────────────────────────────────────────────────────┘
```

---

## Tabs

### 🫧 Timeline *(default)*

An interactive canvas showing all your kept entries as bubbles after every Trim.

- **X axis** — entry order (left = earlier, right = later)
- **Y axis / lane** — similarity cluster (related entries share a lane)
- **Bubble size** — proportional to token count
- **Bubble colour** — continuity priority (green = high, amber = medium, grey = low), or switch to Story Beat mode via the 🎨 button
- **Drag** a bubble left or right to reorder it. When ready, click **↕ Apply Order** to commit the new order back to the workspace
- **Click** a bubble to pin or unpin it (blue outline = pinned, survives all future trims)
- **Min cluster slider** — filter out singletons to focus on related groups
- **⤢ Expand** (More ▾ toolbar) — opens the same map as a full-screen overlay

### Result

Line-by-line view of every entry that was kept. Each row shows:
- Pin button (📌) · Selection checkbox · Continuity chip · Token count
- Annotation dot (📝) — click to add a note and flag the entry as **Keep / Review / Lore / Delete**
- Double-click any entry text to edit it inline

Use the **search bar** (appears above results) to filter by keyword.

### Removed

Every entry that was cut in the last Trim, with a brief explanation of why (too long, duplicate, oldest, etc.).

### Preview

A coloured diff — green lines kept, red lines removed — so you can see exactly what changed before applying.

### Analyse

Seven sub-views accessible from a pill nav bar at the top:

| Sub-view | What it shows |
|---|---|
| **Overview** | Summary of all issues with counts and pointers to detail views |
| **🏥 Health** `score/100` | Workspace health score, reasons, and improvement suggestions |
| **♻ Dups** `N` | Full near-duplicate cluster detail with similarity percentages |
| **⚠ Conflicts** `N` | Contradiction pairs (e.g. "alive" vs "dead" for the same character) with severity |
| **📚 Topics** | Characters, Locations, and Themes extracted from your entries (up to 10 per group) |
| **📅 Beats** `N` | Full story-beat list with type icons (⚡ event, 💞 relationship, 🌍 world fact, ❓ hook) |
| **🎯 Relevance** | All entries ranked by relevance to the last 2 000 chars of visible chat context |

Badge counts on each button update automatically after every Trim.

### Curate

Insights to help you decide what to keep, promote, or move to lore:

- **Context captured** — shows how many chars of recent chat were read for relevance scoring
- **Topic Groups** — Characters, Locations, Themes (5 per group; full list in Analyse → Topics)
- **Story Beats** — top 8 classified beats
- **Likely Relevant** — top 5 entries matching recent chat (full ranked list in Analyse → Relevance)
- **Steering Draft** — when repetition hotspots are detected, a copy-ready steering note is shown here. Download the full draft via 📖 Lore ⬇ in the Snapshots tab

### Compare

Paste lore text and/or a summary into the two text boxes, then click **Compare** to see which memory entries overlap, which are memory-only, and which are good lore promotion candidates.

### 📸 Snapshots

Save, restore, import, and export restore points:

| Button | Action |
|---|---|
| **📷 Save** | Save current entries as a named snapshot right now |
| **⬇ Export JSON** | Download all snapshots for this scope as a `.json` file |
| **📂 Import JSON** | Load a previously exported `.json` file — deduplicates by ID |
| **📖 Lore ⬇** | Download current entries as a formatted lore draft `.txt` |

Each snapshot row has: ★ Star (prevent auto-pruning) · ↩ Load · ✕ Delete.

PMT auto-saves a snapshot before every **Apply** and **Clear**, labelled `auto (before Apply)`.

### Settings

| Group | What you can configure |
|---|---|
| **Trimming** | Auto-switch to Preview after Trim · Normalize separators on copy · Repetition badge |
| **Display** | Show token estimate · Token count source (Auto / Native / Heuristic) · Ideal context size |
| **Automation** | Host connection badge · Inject toolbar into memory window · Auto-match Perchance page theme |
| **Analysis** | Repetition risk badge · Per-entry token cost chip |
| **Diagnostics** | Show diagnostics drawer · Download full debug report (JSON) |
| **Theme** | Dark (default) · Light · Custom CSS |
| **Provider / Assistant** | Anthropic API key for Q&A feature |
| **Window** | Remember position · Auto-focus textarea on open |

---

## Modes

Click the mode badge in the header to cycle through modes. The badge remembers your choice between sessions.

### Daily
Core workflow only — Trim, Apply, Copy, Undo, Restore, Timeline, Result, Removed, Preview, Snapshots, Settings. No advanced tooling shown.

### Advanced
Everything in Daily, plus: Analyse, Curate, Compare, the More ▾ secondary toolbar (Fetch, Preview, Group, Lore, Q&A, Expand, Export).

### Debug
Everything in Advanced, plus the diagnostics drawer — host status, token source, workspace size, storage usage, smoke test runner, and recent action log.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Alt+M` | Open / close the panel |
| `Ctrl+Enter` | Run Trim |
| `Ctrl+Shift+Enter` | Apply to Perchance |
| `Ctrl+Shift+C` | Copy to clipboard |
| `Ctrl+Z` | Undo last Trim |
| `Esc` | Close the panel |

---

## More ▾ toolbar (Advanced / Debug mode)

| Button | What it does |
|---|---|
| **⬇ Fetch** | Auto-loads the `/mem` block from the active Perchance window |
| **Preview** | Shows the diff view immediately |
| **📷 Snap** | Saves a manual snapshot |
| **⬇ Kept** | Downloads kept entries as a `.txt` file |
| **⬇ Removed** | Downloads removed entries as a `.txt` file |
| **📖 Lore** | Copies selected entries (or all high-continuity entries) as a lore draft to clipboard |
| **🔀 Group** | Reorders entries by similarity using adjacency clustering, then shows the result in Timeline |
| **💬 Q&A** | Opens the AI assistant popup (requires Anthropic API key in Settings) |
| **⤢ Expand** | Opens the Timeline as a full-screen overlay |
| **Clear** | Clears the workspace (auto-saves a snapshot first) |

---

## Build from source

```sh
git clone https://github.com/therealwestninja/Perchance-Memory-Trimmer-Tool
cd Perchance-Memory-Trimmer-Tool
npm install
npm run build   # → dist/perchance-memory-trimmer.user.js
npm test        # 89 tests: parse, trim, panel contract, explain, modes, history
```

---

## Architecture

```
src/
  app/      bootstrap · mount · events · main
  core/     parse · trim · tokens · continuity · lore · duplicates · health
            pins · protection · snapshot · presets · performance
            annotations · contradictions · topics · timeline · relevance
            similarity_sort · comparison · export · modes · history · explain
  host/     helpers · scope · automation
  ui/       panel · render · settings · tabs · styles · theme · drag
            onboarding · qa_popup · bubble_map · bubble_map_inline · diagnostics
  utils/    clipboard · html · dom · text · ids
  debug/    smoketests
```

The build pipeline (esbuild) bundles `src/app/main.js` → `dist/perchance-memory-trimmer.user.js` with CSS and metadata header inlined.

---

## Stability labels

| Label | Meaning |
|---|---|
| **Stable** | Core workflow — fully supported |
| **Beta** | Works well, still evolving (Fetch/Apply, Analyse, Curate, Timeline, Snapshots) |
| **Experimental** | Provider-backed features (Q&A assistant) |

---

## Contributing

Bug reports and focused pull requests are welcome. Open an issue first for larger changes.

When reporting a bug, include: what you did, what you expected, what happened, and your browser and userscript manager version.

---

## Privacy

- All trimming, analysis, and curation is **local** — no data leaves your browser
- The **Q&A assistant** (Experimental) sends memory text to `api.anthropic.com/v1/messages` when you click Ask — this is opt-in and requires your own API key in Settings
- Your API key is stored in your browser's `localStorage` only, never transmitted except as a request header to Anthropic
- Fetch/Apply automation only reads and writes the Perchance page you currently have open

---

## License

MIT — see LICENSE.md
