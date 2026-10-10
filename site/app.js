(async function () {
  const data = await fetch('data.json', { cache: 'no-store' }).then((r) => r.json());
  const $ = (id) => document.getElementById(id);
  const COLORS = { red: 'var(--red)', orange: 'var(--orange)', blue: 'var(--blue)' };
  const find = (model, task, variant) => data.runs.find((r) => r.model === model && r.task === task && r.variant === variant);
  const models = data.board.map((b) => b.model);
  const tasks = Object.keys(data.tasks).filter((t) => data.runs.some((r) => r.task === t));
  const state = { model: models.includes('sol') ? 'sol' : models[0], task: tasks[0], variant: 'raw' };
  // open on the first post (the ClutterBench results post), with the model whose two prompts differ most
  {
    let best = -1;
    for (const m of models) {
      const a = find(m, state.task, 'raw'), b = find(m, state.task, 'simple');
      if (a && b && a.clutter - b.clutter > best) { best = a.clutter - b.clutter; state.model = m; }
    }
  }
  const scored = (r) => !(data.showcase || []).includes(r.task);

  // the actual prompt text, in a modal
  function openPrompt(which) {
    $('modalTitle').textContent = which === 'raw' ? 'Raw prompt' : 'Simple prompt';
    $('modalMain').textContent = data.prompts[which];
    $('modalShared').textContent = data.prompts.shared;
    $('modal').showModal();
  }
  $('modalClose').onclick = () => $('modal').close();
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) $('modal').close(); });
  if (data.repo) $('repo').href = data.repo;

  function marks(run, withTips) {
    const frag = document.createDocumentFragment();
    for (const m of run.marks) {
      for (const [x, y, w, h] of m.boxes) {
        const d = document.createElement('div');
        d.className = 'm';
        d.style.cssText = `left:${x / 12}%;top:${y / 12}%;width:${w / 12}%;height:${h / 12}%;--c:${COLORS[m.label]}`;
        if (withTips) {
          d.addEventListener('pointerenter', () => showTip(m, d));
          d.addEventListener('pointerleave', () => showTip(null));
        }
        frag.appendChild(d);
      }
    }
    return frag;
  }
  // floating explanation next to the hovered mark, kept inside the frame
  function showTip(m, markEl) {
    const tip = $('tip');
    if (!m) { tip.hidden = true; return; }
    tip.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = `${m.label === 'red' ? 'Remove' : 'Shrink'}: ${m.name}. `;
    tip.append(b, m.reason);
    tip.style.setProperty('--c', COLORS[m.label]);
    tip.hidden = false;
    const f = $('frame').getBoundingClientRect(), r = markEl.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const left = Math.max(8, Math.min(f.width - tw - 8, r.left - f.left));
    const below = r.bottom - f.top + 8;
    tip.style.left = left + 'px';
    tip.style.top = (below + th > f.height - 8 ? Math.max(8, r.top - f.top - th - 8) : below) + 'px';
  }
  function pane(el, run) {
    el.innerHTML = '';
    if (!run) { el.innerHTML = '<div class="none">Not run yet</div>'; return; }
    const img = new Image();
    img.src = run.img; img.alt = ''; img.draggable = false;
    el.append(img, marks(run, true));
  }
  function caption(el, run, label) {
    el.innerHTML = '';
    if (!run) { el.textContent = label; return; }
    const b = document.createElement('b');
    b.textContent = `${Math.round(run.clutter)}% clutter`;
    const w = document.createElement('span');
    w.className = 'w'; w.textContent = ` · ${run.words} words`;
    const p = document.createElement('span');
    p.className = 'w'; p.textContent = ' prompt';
    const link = document.createElement('button');
    link.className = 'plink'; link.title = 'See the prompt';
    link.append(label.split(' ')[0], p);
    link.onclick = () => openPrompt(label.startsWith('Raw') ? 'raw' : 'simple');
    el.append(link, ' · ', b, w);
  }
  function renderCompare() {
    const raw = find(state.model, state.task, 'raw'), simple = find(state.model, state.task, 'simple');
    pane($('left'), raw); pane($('right'), simple);
    caption($('capL'), raw, 'Raw prompt'); caption($('capR'), simple, 'Simple prompt');
    for (const b of $('models').children) b.classList.toggle('on', b.dataset.m === state.model);
    $('task').value = state.task;
    showTip(null);
  }

  // controls
  for (const m of models) {
    const b = document.createElement('button');
    b.dataset.m = m; b.textContent = data.models[m].short; b.title = data.models[m].name; b.setAttribute('role', 'tab');
    b.onclick = () => { state.model = m; renderCompare(); };
    $('models').appendChild(b);
  }
  for (const t of tasks) $('task').add(new Option(data.tasks[t], t));
  $('task').onchange = (e) => { state.task = e.target.value; renderCompare(); };
  $('marks').onchange = (e) => $('frame').classList.toggle('nomarks', !e.target.checked);

  // slider
  const frame = $('frame'), handle = $('handle');
  const setPos = (p) => {
    p = Math.max(0, Math.min(100, p));
    frame.style.setProperty('--pos', p + '%');
    handle.setAttribute('aria-valuenow', Math.round(p));
  };
  const fromEvent = (e) => { const r = frame.getBoundingClientRect(); setPos(((e.clientX - r.left) / r.width) * 100); };
  handle.addEventListener('pointerdown', (e) => { handle.setPointerCapture(e.pointerId); e.preventDefault(); });
  handle.addEventListener('pointermove', (e) => { if (handle.hasPointerCapture(e.pointerId)) fromEvent(e); });
  handle.addEventListener('keydown', (e) => {
    const cur = Number(handle.getAttribute('aria-valuenow'));
    if (e.key === 'ArrowLeft') setPos(cur - 5);
    if (e.key === 'ArrowRight') setPos(cur + 5);
  });

  // leaderboard: one stacked bar per model and prompt, with every graphic as a dot beneath it
  const board = $('board'), pop = $('pop');
  const MEAN = { blue: 'Keep', orange: 'Shrink', red: 'Remove' };
  function showPop(html, anchor) {
    if (!html) { pop.hidden = true; return; }
    pop.innerHTML = html;
    pop.hidden = false;
    const s = pop.parentElement.getBoundingClientRect(), r = anchor.getBoundingClientRect();
    const left = Math.max(0, Math.min(s.width - pop.offsetWidth, r.left + r.width / 2 - s.left - pop.offsetWidth / 2));
    const above = r.top - s.top - pop.offsetHeight - 10;
    pop.style.left = left + 'px';
    pop.style.top = (above < 0 && r.top < pop.offsetHeight + 20 ? r.bottom - s.top + 10 : above) + 'px';
  }
  const tipOn = (el, html) => {
    el.addEventListener('pointerenter', () => showPop(html(), el));
    el.addEventListener('pointerleave', () => showPop(null));
    el.addEventListener('focus', () => showPop(html(), el));
    el.addEventListener('blur', () => showPop(null));
  };
  const nPosts = tasks.length;
  board.innerHTML = `<div class="h">Model</div><div class="h"><button class="plink" data-p="raw" title="See the prompt">Raw prompt</button><small>"make a tasteful graphic"</small></div><div class="h"><button class="plink" data-p="simple" title="See the prompt">Simple prompt</button><small>plus "keep it simple"</small></div>`;
  for (const b of board.querySelectorAll('[data-p]')) b.onclick = () => openPrompt(b.dataset.p);
  data.board.forEach((row, i) => {
    const name = document.createElement('div');
    name.className = 'name';
    name.innerHTML = `<i>${i + 1}</i>${row.name}`;
    board.appendChild(name);
    for (const v of ['raw', 'simple']) {
      const cell = document.createElement('div');
      cell.className = 'cellb'; cell.dataset.v = v === 'raw' ? 'Raw prompt' : 'Simple prompt';
      const s = row[v];
      if (!s) { cell.classList.add('wait'); cell.textContent = 'Not run yet'; board.appendChild(cell); continue; }
      const bar = document.createElement('div');
      bar.className = 'bar';
      const stack = document.createElement('div');
      stack.className = 'stack';
      for (const c of ['blue', 'orange', 'red']) {
        if (s[c] <= 0) continue;
        const seg = document.createElement('span');
        seg.className = c; seg.style.flex = `${s[c]} 1 0`;
        tipOn(seg, () => `<div class="k"><i class="${c}"></i><b>${MEAN[c]}: ${Math.round(s[c])}%</b></div>of what ${row.short} drew, averaged over ${s.n} graphics`);
        stack.appendChild(seg);
      }
      const num = document.createElement('b');
      num.textContent = `${Math.round(s.clutter)}%`;
      tipOn(num, () => `<b>${Math.round(s.clutter)}% clutter</b><br>Remove ${Math.round(s.red)}% + half of shrink ${Math.round(s.orange)}%.<br>About ${s.words} words per graphic.`);
      bar.append(stack, num);
      const dots = document.createElement('div');
      dots.className = 'dots';
      // dots at the same score stack downward instead of hiding each other
      const lanes = [];
      for (const run of data.runs.filter((r) => r.model === row.model && r.variant === v && scored(r)).sort((a, b) => a.clutter - b.clutter)) {
        let lane = lanes.findIndex((x) => run.clutter - x >= 2.6);
        if (lane === -1) lane = lanes.length;
        lanes[lane] = run.clutter;
        const d = document.createElement('button');
        d.className = 'dot'; d.style.left = `${Math.min(100, run.clutter)}%`; d.style.top = `${11 + lane * 13}px`;
        d.setAttribute('aria-label', `${data.tasks[run.task]}: ${Math.round(run.clutter)}% clutter. Open in the comparison.`);
        tipOn(d, () => `<img src="${run.img}" alt=""><b>${data.tasks[run.task]}</b><br>${Math.round(run.clutter)}% clutter · ${run.cut} removed · ${run.shrunk} shrunk`);
        d.onclick = () => { state.model = run.model; state.task = run.task; setPos(v === 'raw' ? 85 : 15); renderCompare(); document.getElementById('top').scrollIntoView(); };
        dots.appendChild(d);
      }
      const axis = document.createElement('div');
      axis.className = 'axis';
      axis.innerHTML = '<span>0% clutter</span><span>each dot is one graphic</span><span>100%</span>';
      dots.style.height = `${22 + (lanes.length - 1) * 13}px`;
      cell.append(bar, dots);
      if (i === data.board.length - 1) cell.appendChild(axis);
      board.appendChild(cell);
    }
  });

  // wall
  function renderWall() {
    const grid = $('grid');
    grid.style.setProperty('--cols', models.length);
    grid.innerHTML = '<div class="corner"></div>';
    for (const m of models) {
      const s = (data.board.find((b) => b.model === m) || {})[state.variant];
      const h = document.createElement('div');
      h.className = 'ch';
      h.innerHTML = `${data.models[m].short}<small>${s ? Math.round(s.clutter) + '% clutter' : ''}</small>`;
      grid.appendChild(h);
    }
    for (const t of tasks) {
      const rh = document.createElement('div');
      rh.className = 'rh'; rh.textContent = data.tasks[t];
      grid.appendChild(rh);
      for (const m of models) {
        const run = find(m, t, state.variant);
        if (!run) { const e = document.createElement('div'); e.className = 'cell empty'; e.textContent = 'Not run'; grid.appendChild(e); continue; }
        const c = document.createElement('button');
        c.className = 'cell';
        c.setAttribute('aria-label', `${data.models[m].name}, ${data.tasks[t]}, ${Math.round(run.clutter)}% clutter`);
        const img = new Image();
        img.src = run.img; img.alt = ''; img.loading = 'lazy';
        const em = document.createElement('em');
        em.textContent = `${Math.round(run.clutter)}%`;
        c.append(img, marks(run, false), em);
        c.onclick = () => {
          state.model = m; state.task = t;
          setPos(state.variant === 'raw' ? 85 : 15);
          renderCompare();
          document.getElementById('top').scrollIntoView();
        };
        grid.appendChild(c);
      }
    }
  }
  for (const b of $('variant').children) {
    b.onclick = () => {
      state.variant = b.dataset.v;
      for (const x of $('variant').children) x.classList.toggle('on', x === b);
      renderWall();
    };
  }

  if (data.grader !== 'consensus-v4') $('graderNote').textContent = 'Interim results: one pass of Claude Haiku 5.5 labels every element. The final protocol (two Haiku passes, with Claude Sonnet 5.5 breaking ties) is still running.';
  const nScored = data.runs.filter(scored).length, nPostsScored = tasks.filter((t) => !(data.showcase || []).includes(t)).length;
  $('fine').textContent = `Leaderboard: ${nScored} graphics from ${models.length} models, ${nPostsScored} posts and 2 prompts, one attempt each at low reasoning effort. `
    + 'Clutter is the share of drawn area marked remove, plus half the area marked shrink. With one attempt per cell, gaps of a few points between models are not meaningful. '
    + (data.showcase && data.showcase.length ? 'The ClutterBench results post is shown but not scored, because it tells the model what clutter is. ' : '')
    + `Updated ${new Date(data.builtAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}.`;

  renderCompare();
  renderWall();
})();
