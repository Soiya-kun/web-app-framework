// 開発パネルの見た目。開発パネルは画面と別の影の木（Shadow DOM）に置くので、画面の CSS とは混ざらない。
// 色は画面（src/style.css）のトークンにそろえる。

export const panelWidth = 400

export const panelStyle = `
:host { all: initial; }
* { box-sizing: border-box; }
.root {
  --canvas: #f4f5f7; --surface: #ffffff; --line: #d5d9e0; --ink: #1d2330; --muted: #5a6273;
  --primary: #1f4fd1; --primary-soft: #e8f0fe; --danger: #b42318; --danger-soft: #fdecea; --done: #2e7d4f; --pending: #a15c00;
  font-family: "Noto Sans JP", "Hiragino Sans", system-ui, sans-serif; font-size: 13px; line-height: 1.55; color: var(--ink);
}
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; border: 1px solid var(--line); background: var(--surface); border-radius: 6px; padding: 3px 10px; white-space: nowrap; }
button:hover { border-color: var(--primary); color: var(--primary); }
button:disabled { cursor: default; opacity: .5; }
button.primary { background: var(--primary); border-color: var(--primary); color: #fff; }
button.primary:hover { background: #173c9f; color: #fff; }
button.quiet { border-color: transparent; background: transparent; color: var(--muted); padding: 2px 6px; }
button.quiet:hover { color: var(--primary); }
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
select, input[type="search"], input[type="text"], textarea { width: 100%; border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; background: var(--surface); }
kbd { font-family: ui-monospace, monospace; font-size: 11px; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 4px; padding: 0 4px; color: var(--muted); background: var(--canvas); }
.muted { color: var(--muted); }
.small { font-size: 12px; }
.mono { font-family: ui-monospace, monospace; font-size: 12px; }
.row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.grow { flex: 1; min-width: 0; }

.opener { position: fixed; right: 0; top: 40%; z-index: 2147483000; writing-mode: vertical-rl; border-radius: 8px 0 0 8px; padding: 12px 6px; background: var(--ink); color: #fff; border: none; letter-spacing: .1em; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
.opener:hover { background: var(--primary); color: #fff; }

.panel { position: fixed; top: 0; right: 0; bottom: 0; width: ${panelWidth}px; z-index: 2147483000; display: flex; flex-direction: column; background: var(--canvas); border-left: 1px solid var(--line); box-shadow: -2px 0 12px rgba(0,0,0,.08); }
.panel-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--ink); color: #fff; }
.panel-head strong { font-size: 14px; }
.panel-head button { background: transparent; color: #fff; border-color: rgba(255,255,255,.35); }
.panel-head button:hover { border-color: #fff; color: #fff; }
.facts { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 8px 12px; background: var(--surface); border-bottom: 1px solid var(--line); }
.facts span b { font-weight: 600; }
.panel-body { flex: 1; overflow-y: auto; padding: 10px 12px 24px; display: flex; flex-direction: column; gap: 12px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.card h2 { margin: 0; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
.card h2 .row { margin-left: auto; font-weight: 400; }
details summary { cursor: pointer; color: var(--muted); }

.status { border-radius: 6px; padding: 6px 8px; font-size: 12px; }
.status.running { background: var(--primary-soft); color: var(--primary); }
.status.failed { background: var(--danger-soft); color: var(--danger); }
.bar { height: 4px; border-radius: 2px; background: rgba(31,79,209,.15); overflow: hidden; margin-top: 4px; }
.bar i { display: block; height: 100%; background: var(--primary); }

ol.steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
ol.steps li { border-radius: 6px; padding: 5px 6px; display: flex; flex-direction: column; gap: 3px; border: 1px solid transparent; }
ol.steps li:hover { background: var(--canvas); }
ol.steps li.done .title { color: var(--muted); }
ol.steps li.current { border-color: var(--primary); background: var(--primary-soft); }
.step-line { display: flex; gap: 6px; align-items: baseline; }
.step-number { font-family: ui-monospace, monospace; font-size: 12px; color: var(--muted); min-width: 34px; }
.mark { width: 14px; text-align: center; font-size: 12px; }
.done .mark { color: var(--done); }
.current .mark { color: var(--primary); }
.title { flex: 1; min-width: 0; }
.tag { font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; white-space: nowrap; }
.tag.warn { color: var(--danger); border-color: var(--danger); }
.step-tools { display: none; gap: 4px; flex-wrap: wrap; padding-left: 54px; }
ol.steps li:hover .step-tools, ol.steps li.current .step-tools { display: flex; }
.inputs { padding-left: 54px; display: flex; flex-direction: column; gap: 1px; font-size: 12px; }
.inputs span { color: var(--muted); margin-right: 4px; }
.operations { margin: 0; padding-left: 74px; font-size: 12px; color: var(--ink); }

ul.plain { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.basis { border-left: 3px solid var(--line); padding-left: 6px; }
.basis.open { border-left-color: var(--danger); }

.highlight { position: fixed; z-index: 2147482999; border: 3px solid #f59e0b; border-radius: 6px; box-shadow: 0 0 0 4000px rgba(15,23,42,.18); pointer-events: none; }
.caption { position: fixed; z-index: 2147483001; max-width: 420px; background: var(--ink); color: #fff; border-radius: 6px; padding: 4px 10px; font-size: 13px; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
.blocker { position: fixed; inset: 0; z-index: 2147482998; cursor: progress; }

.index { position: fixed; inset: 0; z-index: 2147483100; background: rgba(15,23,42,.35); display: flex; justify-content: center; padding: 32px 16px; }
.index-sheet { width: min(1100px, 100%); max-height: 100%; display: flex; flex-direction: column; background: var(--canvas); border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,.3); overflow: hidden; }
.index-head { padding: 12px 16px; background: var(--surface); border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px; }
.index-head h1 { margin: 0; font-size: 16px; }
.index-body { overflow-y: auto; padding: 8px 16px 24px; }
.index-body h2 { font-size: 13px; margin: 16px 0 6px; color: var(--muted); }
table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-top: 1px solid var(--line); font-size: 12px; }
th { background: var(--canvas); color: var(--muted); font-weight: 600; border-top: none; }
td.check { width: 28px; }
td.name { width: 230px; }
td.name button { border: none; padding: 0; background: none; color: var(--primary); text-align: left; white-space: normal; font-weight: 600; }
td.name button:hover { text-decoration: underline; }
td.memo { width: 220px; }
td.memo input { padding: 2px 6px; font-size: 12px; }
tr.checked td.name button { color: var(--muted); font-weight: 400; }
.chips { display: flex; flex-wrap: wrap; gap: 3px; }
.chip { font-size: 11px; border: 1px solid var(--line); border-radius: 999px; padding: 0 7px; background: var(--canvas); white-space: nowrap; }
button.chip { padding: 0 7px; }
.chip.warn { border-color: var(--danger); color: var(--danger); background: var(--danger-soft); }
.chip.none { border-style: dashed; color: var(--pending); }
`
