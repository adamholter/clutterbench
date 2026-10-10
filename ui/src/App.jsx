import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, convertToExcalidrawElements } from '@excalidraw/excalidraw';

const COLORS = { red: '#e03131', orange: '#f08c00', blue: '#1971c2' };
const LABEL_HELP = { red: 'remove', orange: 'shrink / shorten', blue: 'keep' };
const KEYS = { 1: 'red', 2: 'orange', 3: 'blue', 0: 'clear' };
const SHORT = (id) => id.replace(/^(improving-|how-we-|how-afterquery-helped-|building-a-)/, '').replace(/-/g, ' ');

const api = {
  runs: () => fetch('/api/runs').then((r) => r.json()),
  run: (id) => fetch(`/api/runs/${encodeURIComponent(id)}`).then((r) => r.json()),
  save: (id, body) => fetch(`/api/annotations/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }),
};

async function toDataURL(url) {
  const blob = await fetch(url).then((r) => r.blob());
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(blob);
  });
}

const graderLabelMap = (grade) => {
  const m = {};
  if (grade) for (const r of grade.regions) for (const id of r.ids) m[id] = r.label;
  return m;
};

// Click mode: every element of the graphic is a clickable box. Click or drag
// across boxes to give them the active colour.
function ClickStage({ run, shot, labels, brush, onPaint, graderOf, activeIds }) {
  const wrap = useRef(null);
  const painting = useRef(false);
  const [scale, setScale] = useState(0.5);
  const { w, h } = run.canvas || run.meta.canvas;
  useEffect(() => {
    const fit = () => {
      const r = wrap.current.getBoundingClientRect();
      setScale(Math.min((r.width - 32) / w, (r.height - 32) / h));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap.current);
    const up = () => { painting.current = false; };
    window.addEventListener('pointerup', up);
    return () => { ro.disconnect(); window.removeEventListener('pointerup', up); };
  }, [w, h]);
  // big boxes underneath, small ones on top, so the smallest element under the cursor wins
  const boxes = useMemo(() => [...run.elements].sort((a, b) => b.w * b.h - a.w * a.h), [run]);
  return (
    <div className="stage-wrap" ref={wrap}>
      <div className="stage" style={{ width: w * scale, height: h * scale }}>
        <img src={shot} alt="" draggable={false} />
        {boxes.map((e) => {
          const mine = labels[e.id];
          const g = graderOf && graderOf[e.id];
          const pad = e.kind === 'box' ? 0 : 3;
          return (
            <div
              key={e.id}
              className={`el ${mine ? 'set' : ''} ${e.kind} ${activeIds && activeIds.has(e.id) ? 'hot' : ''} ${g && mine && g !== mine ? 'diff' : ''}`}
              title={`${e.kind}${e.text ? `: ${e.text}` : ''}`}
              style={{
                left: (e.x - pad) * scale, top: (e.y - pad) * scale, width: (e.w + pad * 2) * scale, height: (e.h + pad * 2) * scale,
                '--mine': mine ? COLORS[mine] : 'transparent', '--grader': g ? COLORS[g] : 'transparent',
              }}
              onPointerDown={(ev) => {
                ev.preventDefault();
                ev.currentTarget.releasePointerCapture?.(ev.pointerId);
                // a plain click toggles; a drag paints everything it crosses
                onPaint([e.id], brush === 'clear' || labels[e.id] === brush ? null : brush);
                painting.current = true;
              }}
              onPointerEnter={() => { if (painting.current) onPaint([e.id], brush === 'clear' ? null : brush); }}
            />
          );
        })}
      </div>
    </div>
  );
}

function Mean({ runs, grader }) {
  const cells = useMemo(() => {
    const m = {};
    for (const r of runs) {
      const g = r.metrics[grader];
      if (!g) continue;
      const k = `${r.model} / ${r.variant}`;
      (m[k] = m[k] || []).push(g);
    }
    const avg = (v, f) => v.reduce((a, b) => a + (f(b) || 0), 0) / v.length;
    return Object.entries(m).map(([k, v]) => [k, avg(v, (g) => g.clutterShare), v[0].missingCount == null ? null : avg(v, (g) => g.missingCount), v.length]).sort((a, b) => a[1] - b[1]);
  }, [runs, grader]);
  if (!cells.length) return null;
  return (
    <table className="mean">
      <thead><tr><th>model / prompt</th><th>clutter</th><th>missing</th><th>n</th></tr></thead>
      <tbody>{cells.map(([k, c, m, n]) => <tr key={k}><td>{k}</td><td>{c.toFixed(0)}%</td><td>{m == null ? '–' : m.toFixed(1)}</td><td>{n}</td></tr>)}</tbody>
    </table>
  );
}

const EMPTY = { labels: {}, verdicts: {}, notes: '', missing: '', myScore: '', reviewed: false };
const isUserEl = (e) => !e.isDeleted && e.type !== 'image' && !(e.customData && (e.customData.grader || e.customData.base));

export default function App() {
  const [runs, setRuns] = useState([]);
  const [runId, setRunId] = useState(null);
  const [run, setRun] = useState(null);
  const [initial, setInitial] = useState(null);
  const [grader, setGrader] = useState(null);
  const [mode, setMode] = useState('click');
  const [brush, setBrush] = useState('red');
  const [showGrader, setShowGrader] = useState(false);
  const [activeRid, setActiveRid] = useState(null);
  const [ann, setAnn] = useState(EMPTY);
  const [saved, setSaved] = useState('');
  const ex = useRef(null);
  const baseEls = useRef([]);
  const drawEls = useRef([]);
  const annRef = useRef(ann);
  const saveTimer = useRef(null);
  const lastSig = useRef(null);

  const refreshRuns = useCallback(() => api.runs().then(setRuns), []);
  useEffect(() => { refreshRuns(); }, [refreshRuns]);
  useEffect(() => { if (!runId && runs.length) setRunId(runs[0].id); }, [runs, runId]);

  const graders = useMemo(() => [...new Set(runs.flatMap((r) => Object.keys(r.metrics)))].sort(), [runs]);
  useEffect(() => {
    if (grader || !graders.length) return;
    // newest prompt version, then the one with the most graded runs
    const count = (g) => runs.filter((r) => r.metrics[g]).length;
    const ver = (g) => Number((g.match(/v(\d+)$/) || [0, 0])[1]);
    const preferred = 'luna-low-v4'; // best trade-off in reports/eval.md
    setGrader(graders.includes(preferred) ? preferred : [...graders].sort((a, b) => ver(b) - ver(a) || count(b) - count(a))[0]);
  }, [graders, grader, runs]);
  const grade = run && grader && run.grades[grader];
  const graderOf = useMemo(() => graderLabelMap(grade), [grade]);

  useEffect(() => {
    if (!runId) return;
    let dead = false;
    setInitial(null); setRun(null); setShowGrader(false); setActiveRid(null); ex.current = null; lastSig.current = null;
    (async () => {
      const [data, dataURL] = await Promise.all([api.run(runId), toDataURL(`/runs/${encodeURIComponent(runId)}/shot.png`)]);
      if (dead) return;
      const { w, h } = data.canvas || data.meta.canvas;
      const fileId = `shot-${runId}`.slice(0, 40);
      baseEls.current = convertToExcalidrawElements([
        { type: 'image', x: 0, y: 0, width: w, height: h, fileId, status: 'saved', locked: true, customData: { base: true } },
        { type: 'rectangle', x: 0, y: 0, width: w, height: h, strokeColor: '#ced4da', backgroundColor: 'transparent', strokeWidth: 1, roughness: 0, locked: true, customData: { base: true } },
      ]);
      const a = data.annotation || {};
      drawEls.current = a.elements || [];
      const next = { ...EMPTY, labels: a.labels || {}, verdicts: a.verdicts || {}, notes: a.notes || '', missing: a.missing || '', myScore: a.myScore ?? '', reviewed: !!a.reviewed };
      annRef.current = next;
      setAnn(next);
      setRun(data);
      setInitial({
        files: { [fileId]: { id: fileId, dataURL, mimeType: 'image/png', created: Date.now() } },
        appState: { viewBackgroundColor: '#f1f3f5', currentItemRoughness: 0, currentItemStrokeWidth: 4 },
        dataURL,
      });
      setSaved('');
    })();
    return () => { dead = true; };
  }, [runId]);

  const persist = useCallback(() => {
    if (!runId) return;
    setSaved('saving…');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.save(runId, { ...annRef.current, elements: drawEls.current }).then(() => { setSaved('saved'); refreshRuns(); });
    }, 500);
  }, [runId, refreshRuns]);

  const updateAnn = useCallback((patch) => {
    annRef.current = { ...annRef.current, ...patch };
    setAnn(annRef.current);
    persist();
  }, [persist]);
  const paint = useCallback((ids, colour) => {
    const labels = { ...annRef.current.labels };
    for (const id of ids) { if (colour) labels[id] = colour; else delete labels[id]; }
    updateAnn({ labels });
  }, [updateAnn]);
  const setVerdict = (key, patch) => {
    const cur = annRef.current.verdicts;
    const all = { ...cur, [grader]: { ...(cur[grader] || {}) } };
    all[grader][key] = { ...(all[grader][key] || {}), ...patch };
    updateAnn({ verdicts: all });
  };

  // draw mode (Excalidraw): free marks and text notes on top of the screenshot
  const onDrawChange = useCallback((elements) => {
    const user = elements.filter(isUserEl);
    const sig = user.map((e) => `${e.id}:${e.version}`).join(',');
    if (lastSig.current === null) { lastSig.current = sig; return; }
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    drawEls.current = user;
    persist();
  }, [persist]);
  const graderOverlay = useCallback(() => {
    if (!showGrader || !grade || !run) return [];
    const byId = Object.fromEntries(run.elements.map((e) => [e.id, e]));
    return convertToExcalidrawElements(grade.regions.flatMap((r) => r.ids.filter((id) => byId[id]).map((id) => {
      const e = byId[id];
      const dim = activeRid && activeRid !== r.rid;
      return { type: 'rectangle', x: e.x, y: e.y, width: e.w, height: e.h, strokeColor: COLORS[r.label], backgroundColor: COLORS[r.label], fillStyle: 'solid', strokeWidth: 1, roughness: 0, locked: true, opacity: dim ? 6 : activeRid ? 55 : e.kind === 'box' ? 10 : 28, customData: { grader: true } };
    })));
  }, [showGrader, grade, run, activeRid]);
  useEffect(() => {
    if (mode !== 'draw' || !ex.current) return;
    ex.current.updateScene({ elements: [...baseEls.current, ...graderOverlay(), ...ex.current.getSceneElements().filter(isUserEl)] });
  }, [graderOverlay, mode]);

  const pick = (c) => {
    setBrush(c);
    if (mode === 'draw' && ex.current && c !== 'clear') {
      ex.current.updateScene({ appState: { currentItemStrokeColor: COLORS[c], currentItemStrokeWidth: 4, currentItemOpacity: 100, currentItemRoughness: 0 } });
      ex.current.setActiveTool({ type: 'freedraw' });
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable || e.metaKey || e.ctrlKey) return;
      const i = runs.findIndex((r) => r.id === runId);
      if (e.key === ']' && i < runs.length - 1) setRunId(runs[i + 1].id);
      if (e.key === '[' && i > 0) setRunId(runs[i - 1].id);
      if (mode === 'click' && KEYS[e.key]) setBrush(KEYS[e.key]);
      if (mode === 'click' && e.key === 'g' && grade) setShowGrader((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runs, runId, mode, grade]);

  const tasks = useMemo(() => {
    const m = new Map();
    for (const r of runs) { if (!m.has(r.task)) m.set(r.task, []); m.get(r.task).push(r); }
    return [...m.entries()];
  }, [runs]);
  const verdicts = (grader && ann.verdicts[grader]) || {};
  const meta = run && run.meta;
  const counts = useMemo(() => {
    const c = { red: 0, orange: 0, blue: 0 };
    for (const v of Object.values(ann.labels)) if (c[v] !== undefined) c[v]++;
    return c;
  }, [ann.labels]);
  const unlabelled = run ? run.elements.filter((e) => !ann.labels[e.id]).map((e) => e.id) : [];
  const activeIds = useMemo(() => {
    const r = grade && activeRid && grade.regions.find((x) => x.rid === activeRid);
    return r ? new Set(r.ids) : null;
  }, [grade, activeRid]);

  return (
    <div className="app">
      <aside className="left">
        <h1>ClutterBench <span>v1</span></h1>
        <label className="row">grader
          <select value={grader || ''} onChange={(e) => setGrader(e.target.value)}>
            {graders.map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        <Mean runs={runs} grader={grader} />
        <div className="hint">{runs.filter((r) => r.reviewed).length}/{runs.length} reviewed · <kbd>[</kbd> <kbd>]</kbd> prev / next</div>
        <div className="list">
          {tasks.map(([task, rs]) => (
            <div key={task}>
              <div className="task">{SHORT(task)}</div>
              {rs.map((r) => (
                <button key={r.id} className={`run ${r.id === runId ? 'on' : ''}`} onClick={() => setRunId(r.id)}>
                  <span className="dot" data-s={r.reviewed ? 'done' : r.annotated ? 'wip' : ''} />
                  <span className="name">{r.model} · {r.variant}</span>
                  {r.flags && r.flags.length > 0 && <span className="flag" title={r.flags.join(', ')}>!</span>}
                  {/* the grader's number stays hidden until you have reviewed the run */}
                  <span className="num">{r.reviewed && r.metrics[grader] ? `${Math.round(r.metrics[grader].clutterShare)}%` : ''}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <main className="center">
        <div className="bar">
          <div className="seg">
            <button className={mode === 'click' ? 'on' : ''} onClick={() => setMode('click')}>Click</button>
            <button className={mode === 'draw' ? 'on' : ''} onClick={() => { lastSig.current = null; setMode('draw'); }}>Draw</button>
          </div>
          {Object.keys(COLORS).map((c, i) => (
            <button key={c} className={`pen ${brush === c ? 'on' : ''}`} style={{ '--c': COLORS[c] }} onClick={() => pick(c)} title={LABEL_HELP[c]}>
              <i />{c}{mode === 'click' && <kbd>{i + 1}</kbd>}
            </button>
          ))}
          {mode === 'click' && (
            <>
              <button className={`pen ${brush === 'clear' ? 'on' : ''}`} style={{ '--c': '#868e96' }} onClick={() => pick('clear')}>erase <kbd>0</kbd></button>
              <button className="act" disabled={!unlabelled.length} onClick={() => paint(unlabelled, 'blue')} title="Label every unlabelled element blue">Rest → blue</button>
              {showGrader && grade && <button className="act" onClick={() => updateAnn({ labels: { ...graderOf } })} title="Start from the grader's labels and fix what is wrong">Copy grader</button>}
              <button className="act" disabled={!Object.keys(ann.labels).length} onClick={() => updateAnn({ labels: {} })}>Clear</button>
            </>
          )}
          <span className="grow" />
          {mode === 'click' && run && <span className="saved">{unlabelled.length} left</span>}
          <span className="saved">{saved}</span>
          <button className={`toggle ${showGrader ? 'on' : ''}`} onClick={() => setShowGrader((v) => !v)} disabled={!grade}>
            {showGrader ? 'Hide grader' : 'Show grader'}
          </button>
        </div>
        <div className="canvas">
          {!initial && <div className="empty">{runs.length ? 'Loading…' : 'No runs yet. Generate, render and grade first.'}</div>}
          {initial && mode === 'click' && (
            <ClickStage run={run} shot={initial.dataURL} labels={ann.labels} brush={brush} onPaint={paint} graderOf={showGrader ? graderOf : null} activeIds={activeIds} />
          )}
          {initial && mode === 'draw' && (
            <Excalidraw key={runId} initialData={{ ...initial, elements: [...baseEls.current, ...graderOverlay(), ...drawEls.current] }} onChange={onDrawChange}
              excalidrawAPI={(a) => { ex.current = a; setTimeout(() => a.scrollToContent(undefined, { fitToViewport: true, viewportZoomFactor: 0.95, animate: false }), 80); }}
              UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false, changeViewBackgroundColor: false } }} />
          )}
        </div>
        {mode === 'click' && showGrader && <div className="legend">Fill = your label · dashed outline = grader's label · solid outline = you and the grader disagree</div>}
      </main>

      <aside className="right">
        {meta && (
          <>
            <div className="meta">
              <b>{meta.model} · {meta.variant}</b>
              <div>{meta.title}</div>
              <div className="sub">{run.stats.words} words · {run.stats.textElements} text elements · {run.stats.fontSizes} font sizes{run.stats.overflow ? ' · overflows canvas' : ''}</div>
              {meta.flags.length > 0 && <div className="warn">flags: {meta.flags.join(', ')}</div>}
            </div>

            <h2>Your verdict</h2>
            <label className="row">clutter 0–10
              <input type="number" min="0" max="10" value={ann.myScore} onChange={(e) => updateAnn({ myScore: e.target.value })} />
            </label>
            <textarea placeholder="Notes: what is cluttered, what is missing, what the grader got wrong…" value={ann.notes} onChange={(e) => updateAnn({ notes: e.target.value })} />
            <label className="check"><input type="checkbox" checked={ann.reviewed} onChange={(e) => updateAnn({ reviewed: e.target.checked })} /> reviewed</label>

            <h2>Grader {grade ? `· ${grader}` : ''}</h2>
            {!grade && <div className="sub">Not graded by {grader}.</div>}
            {grade && !showGrader && <div className="sub">Hidden so your labels stay unbiased. Label first, then press Show grader (<kbd>g</kbd>).</div>}
            {grade && showGrader && (
              <>
                <div className="shares">
                  {['blue', 'orange', 'red'].map((c) => <span key={c} style={{ flex: grade.metrics.shares[c] || 0.01, background: COLORS[c] }} title={`${c} ${grade.metrics.shares[c]}%`}>{grade.metrics.shares[c] >= 8 ? `${Math.round(grade.metrics.shares[c])}%` : ''}</span>)}
                </div>
                <div className="sub">clutter share {grade.metrics.clutterShare}% · clutter {grade.clutter_score}/10{grade.completeness_score != null ? ` · complete ${grade.completeness_score}/10` : ''} · {grade.metrics.ideaCount} idea{grade.metrics.ideaCount === 1 ? '' : 's'}</div>
                <p className="summary">{grade.summary}</p>
                <div className="sub">Main idea: {grade.main_idea}</div>
                {grade.ideas.length > 1 && <ol className="ideas">{grade.ideas.map((x, i) => <li key={i}>{x}</li>)}</ol>}

                {grade.missing && (
                  <>
                    <h3>Missing information</h3>
                    {!grade.missing.length && <div className="sub">Grader found nothing missing.</div>}
                    <div className="regions">
                      {grade.missing.map((m) => {
                        const v = verdicts[m.mid] || {};
                        return (
                          <div key={m.mid} className="region">
                            <div className="rhead">
                              <i className="miss" />
                              <b>{m.what}</b>
                              <span className="grow" />
                              <button className={v.agree === true ? 'yes on' : 'yes'} onClick={() => setVerdict(m.mid, { agree: v.agree === true ? null : true })} title="agree">✓</button>
                              <button className={v.agree === false ? 'no on' : 'no'} onClick={() => setVerdict(m.mid, { agree: v.agree === false ? null : false })} title="disagree">✗</button>
                            </div>
                            <div className="reason">{m.why}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {grade.defects && grade.defects.length > 0 && (
                  <>
                    <h3>Rendering defects</h3>
                    <ul className="ideas">{grade.defects.map((d, i) => <li key={i}>{d}</li>)}</ul>
                  </>
                )}

                <h3>Regions</h3>
                <div className="regions">
                  {grade.regions.map((r) => {
                    const v = verdicts[r.rid] || {};
                    return (
                      <div key={r.rid} className={`region ${activeRid === r.rid ? 'on' : ''}`} onMouseEnter={() => setActiveRid(r.rid)} onMouseLeave={() => setActiveRid(null)}>
                        <div className="rhead">
                          <i style={{ background: COLORS[r.label] }} />
                          <b>{r.name || r.type}</b>
                          <span className="type">{r.type}</span>
                          <span className="grow" />
                          <button className={v.agree === true ? 'yes on' : 'yes'} onClick={() => setVerdict(r.rid, { agree: v.agree === true ? null : true, shouldBe: null })} title="agree">✓</button>
                          <button className={v.agree === false ? 'no on' : 'no'} onClick={() => setVerdict(r.rid, { agree: v.agree === false ? null : false })} title="disagree">✗</button>
                        </div>
                        <div className="reason">{r.reason}</div>
                        {v.agree === false && (
                          <div className="fix">
                            should be
                            {Object.keys(COLORS).filter((c) => c !== r.label).map((c) => (
                              <button key={c} className={v.shouldBe === c ? 'on' : ''} style={{ '--c': COLORS[c] }} onClick={() => { setVerdict(r.rid, { shouldBe: c }); paint(r.ids, c); }}>{c}</button>
                            ))}
                            <input placeholder="why" value={v.comment || ''} onChange={(e) => setVerdict(r.rid, { comment: e.target.value })} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
