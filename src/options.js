const $ = (id) => document.getElementById(id);
let S; // 当前设置

// ---------- 小工具 ----------

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1400);
}

async function save(patch, quiet) {
  Object.assign(S, patch);
  await glossSave(patch);
  if (!quiet) toast('已保存');
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------- 模型服务 ----------

let addHolder = null;
document.addEventListener('mousedown', (e) => {
  if (addHolder && !addHolder.contains(e.target)) addHolder.querySelector('.dd-list').hidden = true;
});

function renderProviders() {
  const box = $('providers');
  box.textContent = '';
  for (const id of S.added) box.appendChild(providerCard(id));

  const row = $('addRow');
  row.textContent = '';
  addHolder = null;
  if (!S.added.length) row.appendChild(el('p', 'empty-note', '还没有添加模型服务，先添加一个才能开始翻译。'));
  const rest = PROVIDER_ORDER.filter((id) => !S.added.includes(id));
  if (!rest.length) return;

  const holder = el('div', 'add-menu');
  const btn = el('button', 'btn' + (S.added.length ? '' : ' primary'), '＋ 添加服务商');
  btn.type = 'button';
  const menu = el('div', 'dd-list');
  menu.hidden = true;
  for (const id of rest) {
    const it = el('button', 'dd-item');
    it.type = 'button';
    const lab = el('span', 'dd-label');
    lab.append(el('span', 'dd-main', PROVIDERS[id].name), el('span', 'dd-sub', PROVIDERS[id].hint));
    it.appendChild(lab);
    it.addEventListener('click', async () => {
      openCards.add(id);
      const patch = { added: [...S.added, id] };
      if (!S.provider || !S.added.includes(S.provider)) patch.provider = id;
      await save(patch, true);
      renderProviders();
    });
    menu.appendChild(it);
  }
  btn.addEventListener('click', () => { menu.hidden = !menu.hidden; });
  holder.append(btn, menu);
  row.appendChild(holder);
  addHolder = holder;
}

async function removeProvider(id) {
  if (!confirm(`移除 ${PROVIDERS[id].name}？这家的 API Key 也会一起删除。`)) return;
  const added = S.added.filter((x) => x !== id);
  const patch = { added, keys: { ...S.keys, [id]: '' } };
  if (S.provider === id) patch.provider = added[0] || '';
  await save(patch, true);
  renderProviders();
  toast('已移除');
}

const openCards = new Set(); // 当前展开的服务商（只记在页面里）

function providerCard(id) {
  const P = PROVIDERS[id];
  const isOpen = openCards.has(id);
  const card = el('div', 'pv' + (S.provider === id ? ' active' : '') + (isOpen ? ' open' : ''));

  // ---------- 摘要行（点击展开 / 折叠） ----------
  const sum = el('div', 'pv-sum');
  sum.setAttribute('role', 'button');
  sum.tabIndex = 0;
  const title = el('div', 'pv-title');
  title.append(el('span', 'pv-name', P.name), el('span', 'pv-hint', P.hint));
  const aliasNow = ((S.aliases || {})[glossProfileKey(id, S.models[id] || '')] || '').trim();
  const model = el('span', 'pv-chip' + (aliasNow ? '' : ' mono'), aliasNow || S.models[id] || '未设置模型');
  model.title = S.models[id] || '';
  const keyChip = el('span', 'pv-chip');
  const paintKey = () => {
    const has = !!(S.keys[id] || '').trim();
    keyChip.textContent = has ? 'Key 已填' : '未填 Key';
    keyChip.classList.toggle('warn', !has);
  };
  paintKey();
  sum.append(title, model, keyChip);
  if (S.provider === id) {
    sum.appendChild(el('span', 'badge', '正在使用'));
  } else {
    const use = el('button', 'btn use', '设为当前');
    use.type = 'button';
    use.addEventListener('click', async (e) => {
      e.stopPropagation();
      await save({ provider: id });
      renderProviders();
    });
    sum.appendChild(use);
  }
  sum.insertAdjacentHTML('beforeend', '<svg class="pv-chev" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>');
  const toggle = () => {
    if (openCards.has(id)) openCards.delete(id); else openCards.add(id);
    card.classList.toggle('open', openCards.has(id));
    body.hidden = !openCards.has(id);
  };
  sum.addEventListener('click', toggle);
  sum.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  card.appendChild(sum);

  // ---------- 展开内容：三栏 ----------
  const body = el('div', 'pv-body');
  body.hidden = !isOpen;

  // 第一栏：连接
  const conn = el('div', 'pv-col');
  conn.appendChild(el('h4', null, '连接'));

  if (id === 'custom') {
    const f = el('label', 'fl');
    f.appendChild(el('span', null, '接口地址（OpenAI 兼容）'));
    const row = el('div', 'key-row');
    const url = el('input', 'input mono');
    url.placeholder = 'https://example.com/v1';
    url.value = S.customBaseUrl;
    const ok = el('button', 'btn', '授权并保存');
    ok.addEventListener('click', async () => {
      const v = url.value.trim().replace(/\/+$/, '');
      let origin;
      try {
        const u = new URL(v);
        if (u.protocol !== 'https:') throw new Error();
        origin = u.origin;
      } catch {
        toast('需要 https:// 开头的网址');
        return;
      }
      const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
      if (!granted) { toast('没有获得访问权限，未保存'); return; }
      await save({ customBaseUrl: v });
    });
    row.append(url, ok);
    f.appendChild(row);
    conn.appendChild(f);
  }

  const kf = el('label', 'fl');
  kf.appendChild(el('span', null, 'API Key'));
  const krow = el('div', 'key-row');
  const key = el('input', 'input mono');
  key.type = 'password';
  key.autocomplete = 'off';
  key.spellcheck = false;
  key.placeholder = '粘贴 Key';
  key.value = S.keys[id] || '';
  const saveKey = debounce(() => save({ keys: { ...S.keys, [id]: key.value.trim() } }).then(paintKey), 500);
  key.addEventListener('input', saveKey);
  const eye = el('button', 'btn', '显示');
  eye.type = 'button';
  eye.addEventListener('click', () => {
    const shown = key.type === 'text';
    key.type = shown ? 'password' : 'text';
    eye.textContent = shown ? '显示' : '隐藏';
  });
  krow.append(key, eye);
  kf.appendChild(krow);
  conn.appendChild(kf);

  const mf = el('div', 'fl');
  mf.appendChild(el('span', null, '模型'));
  const custom = el('input', 'input mono');
  custom.placeholder = '模型名，例如 ' + (P.models[0] || 'gpt-4o-mini');
  const saveModel = debounce(() => save({ models: { ...S.models, [id]: custom.value.trim() } }), 500);
  custom.addEventListener('input', saveModel);
  custom.addEventListener('change', () => setTimeout(renderProviders, 600));
  if (P.models.length) {
    const cur = S.models[id];
    const isPreset = P.models.includes(cur);
    const holder = el('div');
    makeDropdown(holder, {
      options: [
        ...P.models.map((m) => ({ value: m, label: m })),
        { value: '__custom', label: '自定义模型名…', sub: '填写服务商支持的其他模型' },
      ],
      value: isPreset ? cur : '__custom',
      onChange: (v) => {
        if (v === '__custom') {
          custom.hidden = false;
          custom.value = '';
          custom.focus();
        } else {
          custom.hidden = true;
          save({ models: { ...S.models, [id]: v } }).then(renderProviders); // 换模型后显示该模型自己的思考方案
        }
      },
    });
    custom.hidden = isPreset;
    if (!isPreset) custom.value = cur || '';
    mf.append(holder, custom);
  } else {
    custom.value = S.models[id] || '';
    mf.appendChild(custom);
  }
  conn.appendChild(mf);

  // 显示名称（代称）：小窗和段落译文里用它代替“服务商 · 模型名”
  const af = el('label', 'fl');
  af.appendChild(el('span', null, '显示名称（可选）'));
  const alias = el('input', 'input');
  const aliasKey = glossProfileKey(id, S.models[id] || '');
  alias.placeholder = '例如 “DS 快速”，留空则显示“服务商 · 模型名”';
  alias.maxLength = 24;
  alias.value = (S.aliases || {})[aliasKey] || '';
  alias.addEventListener('input', debounce(() => {
    save({ aliases: { ...(S.aliases || {}), [aliasKey]: alias.value.trim() } }).then(() => {
      const v = alias.value.trim();
      model.textContent = v || S.models[id] || '未设置模型';
      model.classList.toggle('mono', !v);
    });
  }, 500));
  af.append(alias, el('p', 'hint', '按模型分别保存，用在小窗右下角和段落译文的标注里。'));
  conn.appendChild(af);

  const foot = el('div', 'pv-foot');
  const test = el('button', 'btn', '测试连接');
  const status = el('span', 'status');
  test.addEventListener('click', async () => {
    status.className = 'status';
    status.textContent = '正在测试…';
    const r = await chrome.runtime.sendMessage({ type: 'test', provider: id });
    status.textContent = r?.message || '没有收到回应。';
    status.className = 'status ' + (r?.ok ? 'ok' : 'bad');
  });
  foot.append(test, status);
  conn.appendChild(foot);
  const links = el('div', 'pv-links');
  if (P.console) {
    const a = el('a', null, '获取 Key ↗');
    a.href = P.console;
    a.target = '_blank';
    a.rel = 'noopener';
    links.appendChild(a);
  }
  const rm = el('button', 'btn quiet danger', '移除这家服务商');
  rm.type = 'button';
  rm.addEventListener('click', () => removeProvider(id));
  links.appendChild(rm);
  conn.appendChild(links);

  // 第二栏：思考强度；第三栏：价格
  const think = el('div', 'pv-col');
  think.appendChild(thinkBlock(id));
  const price = el('div', 'pv-col');
  price.appendChild(pricingBlock(id));

  body.append(conn, think, price);
  card.appendChild(body);
  return card;
}

const THINK_CHOICES = [...THINK_LEVELS, { v: 'auto', l: '自动' }];

function thinkBlock(id) {
  const model = S.models[id] || '';
  const prof = glossThinkProfile(S, id, model);
  const saveProf = () => {
    const key = glossProfileKey(id, model);
    save({ thinkProfiles: { ...S.thinkProfiles, [key]: { ...prof } } });
  };

  const box = el('div', 'fl think-block');
  const head = el('div', 'think-head');
  const tag = el('span', 'think-model', '按模型保存 · ' + (model || '未设置模型'));
  tag.title = model;
  head.append(el('h4', null, '思考强度'), tag);
  box.appendChild(head);

  const autoBox = el('div', 'auto-box');
  const syncAuto = () => { autoBox.hidden = !(prof.word === 'auto' || prof.para === 'auto'); };

  const row = (label, field) => {
    const r = el('div', 'think-row');
    r.appendChild(el('span', 'think-lab', label));
    const seg = el('div', 'seg');
    for (const t of THINK_CHOICES) {
      const b = el('button', null, t.l);
      b.type = 'button';
      b.dataset.v = t.v;
      seg.appendChild(b);
    }
    makeSeg(seg, prof[field], (v) => { prof[field] = v; saveProf(); syncAuto(); });
    r.appendChild(seg);
    return r;
  };

  const line = el('div', 'auto-line');
  const num = (field) => {
    const inp = el('input', 'input mono');
    inp.type = 'number';
    inp.min = '1';
    inp.value = prof[field];
    inp.addEventListener('input', debounce(() => {
      const v = Math.max(1, Math.round(Number(inp.value) || 1));
      prof[field] = v;
      saveProf();
    }, 500));
    return inp;
  };
  line.append(
    el('span', 'lv off', '关闭'), el('span', null, '≤'), num('t1'), el('span', null, '词 <'),
    el('span', 'lv', '低'), el('span', null, '≤'), num('t2'), el('span', null, '词 <'),
    el('span', 'lv', '中'), el('span', null, '≤'), num('t3'), el('span', null, '词 <'),
    el('span', 'lv', '高'),
  );
  autoBox.append(
    el('div', 'auto-title', '自动档位（按英文单词数）'),
    line,
    el('p', 'hint', '划词按所在句子的单词数，整句 / 段落按要翻译的内容本身。'),
  );
  syncAuto();

  box.append(
    row('划词', 'word'),
    row('整句 / 段落', 'para'),
    autoBox,
    el('p', 'hint', '关闭最快、最省；开启后对难句更准，但会更慢，思考过程也按输出 token 计费。换模型后会切换到那个模型自己的方案。'),
  );
  return box;
}

function pricingBlock(id) {
  const pr = { ...S.pricing[id] };
  const savePr = () => save({ pricing: { ...S.pricing, [id]: { ...pr } } });
  const box = el('div', 'price');
  box.appendChild(el('h4', null, '价格'));

  const cur = el('div', 'seg');
  for (const [v, l] of [['USD', '美元 $'], ['CNY', '人民币 ¥']]) {
    const b = el('button', null, l);
    b.type = 'button';
    b.dataset.v = v;
    cur.appendChild(b);
  }
  makeSeg(cur, pr.cur, (v) => { pr.cur = v; savePr(); });

  const grid = el('div', 'price-grid');
  const field = (key, label) => {
    const w = el('label', 'fl');
    w.appendChild(el('span', null, label));
    const inp = el('input', 'input mono');
    inp.type = 'number';
    inp.min = '0';
    inp.step = 'any';
    inp.value = pr[key];
    inp.addEventListener('input', debounce(() => { pr[key] = Math.max(0, Number(inp.value) || 0); savePr(); }, 500));
    w.appendChild(inp);
    return w;
  };
  grid.append(field('miss', '输入'), field('hit', '缓存命中'), field('out', '输出'));

  const row = el('div', 'price-row');
  const sw = el('label', 'sw');
  const cb = el('input');
  cb.type = 'checkbox';
  sw.append(cb, el('span', 'track'));
  makeSwitch(cb, pr.offpeak, (v) => { pr.offpeak = v; savePr(); });
  row.append(el('span', null, '峰谷计价：非高峰时段半价'), sw);

  box.append(el('p', 'hint', '单位：每 100 万 tokens，填高峰时段的价格。'), cur, grid, row);

  if (id === 'deepseek') {
    const reset = el('button', 'btn', '恢复 DeepSeek 官方价格');
    reset.type = 'button';
    reset.addEventListener('click', async () => {
      await save({ pricing: { ...S.pricing, deepseek: { ...PRICING_DEFAULTS.deepseek } } });
      renderProviders();
    });
    box.append(
      el('p', 'hint', '已预置 deepseek-flash 官方价格（2026 年 11 月核对）。高峰时段为北京时间工作日 9–12 点、14–18 点，其余时间半价；法定节假日全天也是半价，但这里识别不了节假日，那几天的估算会偏高。'),
      reset,
    );
  }
  return box;
}

// ---------- 划词 & 段落 ----------

function renderBehavior() {
  makeSwitch($('enabled'), S.enabled, (v) => save({ enabled: v }));
  makeSeg($('triggerMode'), S.triggerMode, (v) => save({ triggerMode: v }));
  makeSwitch($('showSentence'), S.showSentence, (v) => save({ showSentence: v }));
  makeSwitch($('autoCambridge'), S.autoCambridge, (v) => save({ autoCambridge: v }));
  makeSwitch($('wordOnly'), S.wordOnly, (v) => save({ wordOnly: v }));
  makeSwitch($('paraEnabled'), S.paraEnabled, (v) => save({ paraEnabled: v }));
  makeSeg($('paraMeta'), S.paraMeta, (v) => save({ paraMeta: v }));
  makeSeg($('paraFont'), String(S.paraFont), (v) => { save({ paraFont: Number(v) }); renderStyles(); });
  renderStyles();
}

function renderStyles() {
  const box = $('styles');
  box.textContent = '';
  for (const st of PARA_STYLES) {
    const b = el('button', 'st' + (S.paraStyle === st.id ? ' on' : ''));
    b.type = 'button';
    const name = el('div', 'st-name');
    name.append(el('span', null, st.name), el('small', null, st.desc));
    const tr = el('div', 'st-trans ' + st.id, 'AI 将对世界产生深远影响。');
    tr.style.fontSize = S.paraFont + 'px';
    b.append(name, el('div', 'st-sample', 'AI will have a vast impact on the world.'), tr);
    b.addEventListener('click', () => { save({ paraStyle: st.id }); renderStyles(); });
    box.appendChild(b);
  }
}

// ---------- 用量 ----------

let range = 30;
let usageCache = { usageDaily: {}, usageLog: [] };

async function loadUsage() {
  usageCache = await chrome.storage.local.get({ usageDaily: {}, usageLog: [] });
  renderUsage();
}

function daysBack(n) {
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const t = Date.now() - k * 864e5;
    const key = glossDayKey(t);
    out.push({ key, ...{ calls: 0, i: 0, o: 0, c: 0, ms: 0, hits: 0, err: 0 }, ...(usageCache.usageDaily[key] || {}) });
  }
  return out;
}

function renderUsage() {
  const days = daysBack(range);
  const sum = days.reduce((a, d) => {
    for (const k of ['calls', 'i', 'o', 'c', 'ms', 'hits', 'err']) a[k] += d[k] || 0;
    for (const [c, v] of Object.entries(d.cost || {})) a.cost[c] = (a.cost[c] || 0) + v;
    return a;
  }, { calls: 0, i: 0, o: 0, c: 0, ms: 0, hits: 0, err: 0, cost: {} });

  const tiles = [
    ['调用次数', String(sum.calls)],
    ['输入 tokens', glossFmtTokens(sum.i)],
    ['输出 tokens', glossFmtTokens(sum.o)],
    ['平均耗时', sum.calls ? (sum.ms / sum.calls / 1000).toFixed(2) + ' s' : '—'],
    ['估计成本', glossFmtCosts(sum.cost)],
    ['本地缓存命中', String(sum.hits)],
    ['失败次数', String(sum.err), sum.err > 0],
  ];
  const tb = $('tiles');
  tb.textContent = '';
  for (const [l, v, warn] of tiles) {
    const t = el('div', 'tile' + (warn ? ' warn' : ''));
    t.append(el('div', 'v', v), el('div', 'l', l));
    tb.appendChild(t);
  }

  drawChart(days);
  renderRecent();
}

const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

function niceMax(v) {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function drawChart(days) {
  const W = 760, H = 230, L = 46, R = 12, T = 14, B = 28;
  const box = $('chart');
  box.textContent = '';
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '每日 token 用量折线图' }, box);
  const max = niceMax(Math.max(...days.map((d) => Math.max(d.i, d.o))));
  const n = days.length;
  const x = (i) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (H - T - B) * (1 - v / max);

  for (let g = 0; g <= 4; g++) {
    const v = (max * g) / 4;
    svg('line', { class: 'grid', x1: L, x2: W - R, y1: y(v), y2: y(v) }, root);
    const t = svg('text', { class: 'axis', x: L - 8, y: y(v) + 4, 'text-anchor': 'end' }, root);
    t.textContent = glossFmtTokens(v);
  }
  const step = Math.ceil(n / 7);
  days.forEach((d, i) => {
    if (i % step !== 0 && i !== n - 1) return;
    if (i !== n - 1 && n - 1 - i < step / 2) return;
    const t = svg('text', { class: 'axis', x: x(i), y: H - 8, 'text-anchor': 'middle' }, root);
    t.textContent = d.key.slice(5);
  });

  const pts = (k) => days.map((d, i) => `${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ');
  svg('polygon', { class: 'a-out', points: `${x(0)},${y(0)} ${pts('o')} ${x(n - 1)},${y(0)}` }, root);
  svg('polyline', { class: 'l-in', points: pts('i') }, root);
  svg('polyline', { class: 'l-out', points: pts('o') }, root);

  const cursor = svg('line', { class: 'cursor', y1: T, y2: H - B, visibility: 'hidden' }, root);
  const dIn = svg('circle', { class: 'dot-in', r: 4, visibility: 'hidden' }, root);
  const dOut = svg('circle', { class: 'dot-out', r: 4, visibility: 'hidden' }, root);
  const hit = svg('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'transparent' }, root);
  const tip = $('tip');

  hit.addEventListener('mousemove', (e) => {
    const r = root.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((sx - L) / (W - L - R)) * (n - 1))));
    const d = days[i];
    for (const [node, attrs] of [
      [cursor, { x1: x(i), x2: x(i) }], [dIn, { cx: x(i), cy: y(d.i) }], [dOut, { cx: x(i), cy: y(d.o) }],
    ]) { for (const k in attrs) node.setAttribute(k, attrs[k]); node.setAttribute('visibility', 'visible'); }

    tip.textContent = '';
    tip.append(el('b', null, d.key));
    const lines = [
      `调用 ${d.calls} 次${d.err ? ` · 失败 ${d.err}` : ''}`,
      `输入 ${d.i.toLocaleString()} · 输出 ${d.o.toLocaleString()}`,
      d.calls ? `平均 ${(d.ms / d.calls / 1000).toFixed(2)} s · 成本 ${glossFmtCosts(d.cost)}` : '',
    ];
    for (const l of lines) if (l) { tip.append(document.createElement('br'), l); }
    tip.hidden = false;
    const card = tip.parentElement.getBoundingClientRect();
    const px = e.clientX - card.left;
    tip.style.left = Math.min(px + 14, card.width - tip.offsetWidth - 8) + 'px';
    tip.style.top = (e.clientY - card.top - tip.offsetHeight - 12) + 'px';
  });
  hit.addEventListener('mouseleave', () => {
    tip.hidden = true;
    for (const node of [cursor, dIn, dOut]) node.setAttribute('visibility', 'hidden');
  });
}

const KIND = { word: '划词', sentence: '句子', paragraph: '段落' };
const LEVEL_LABEL = { low: '低', medium: '中', high: '高' };

function thinkCell(r) {
  const lv = LEVEL_LABEL[r.tl];
  if (!lv) return r.r ? r.r.toLocaleString() : '—';
  return `${lv}${r.r ? ' · ' + r.r.toLocaleString() : ''}`;
}

let recentOpen = false;

function renderRecent() {
  const body = $('recent');
  body.textContent = '';
  const all = usageCache.usageLog.slice(-50).reverse();
  const rows = recentOpen ? all : all.slice(0, 5);
  $('recentEmpty').hidden = all.length > 0;
  $('moreRow').hidden = all.length <= 5;
  $('moreBtn').textContent = recentOpen ? '收起' : `展开更多（最近 ${all.length} 条）`;
  for (const r of rows) {
    const tr = el('tr');
    const d = new Date(r.t);
    const time = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const who = el('td');
    const mEl = el('span', 'm', r.m);
    mEl.title = r.m;
    who.append((PROVIDERS[r.p]?.name || r.p) + ' ', mEl);
    tr.append(
      el('td', null, time),
      who,
      el('td', null, KIND[r.k] || r.k),
      el('td', 'r', r.nu ? '—' : r.i.toLocaleString()),
      el('td', 'r', r.nu ? '—' : r.o.toLocaleString()),
      el('td', 'r', thinkCell(r)),
      el('td', 'r', r.f ? (r.f / 1000).toFixed(2) + ' s' : '—'),
      el('td', 'r', (r.ms / 1000).toFixed(2) + ' s'),
      el('td', 'r', r.$ != null ? glossFmtMoney(r.$, r.cur) : '—'),
    );
    body.appendChild(tr);
  }
}

// ---------- 导航高亮 ----------

function setupNav() {
  const links = [...document.querySelectorAll('nav a[data-sec]')];
  const secs = [...document.querySelectorAll('main section')];
  const update = () => {
    // 取最后一个顶部已经滚过视口上方 1/4 的章节；到底部时选最后一个
    let cur = secs[0].id;
    for (const s of secs) if (s.getBoundingClientRect().top <= innerHeight * 0.25) cur = s.id;
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) cur = secs[secs.length - 1].id;
    links.forEach((a) => a.classList.toggle('on', a.dataset.sec === cur));
  };
  addEventListener('scroll', update, { passive: true });
  update();
}

// ---------- 启动 ----------

async function init() {
  S = await glossLoad();
  if (S.provider) openCards.add(S.provider);
  $('ver').textContent = 'v' + GLOSS_VERSION;
  renderProviders();
  renderBehavior();
  makeSeg($('range'), String(range), (v) => { range = Number(v); renderUsage(); });
  await loadUsage();
  setupNav();
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();

  $('moreBtn').addEventListener('click', () => { recentOpen = !recentOpen; renderRecent(); });
  $('clearCache').addEventListener('click', async () => {
    const all = await chrome.storage.session.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith('c_'));
    await chrome.storage.session.remove(keys);
    toast(`已清空 ${Math.max(0, keys.length - 1)} 条翻译缓存`);
  });
  $('clearUsage').addEventListener('click', async () => {
    if (!confirm('确定清空所有用量记录吗？这一步不能撤销。')) return;
    await chrome.storage.local.remove(['usageDaily', 'usageLog']);
    toast('已清空');
  });

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    if (ch.usageDaily || ch.usageLog) loadUsage();
    if (ch.provider && ch.provider.newValue !== S.provider) { S.provider = ch.provider.newValue; renderProviders(); }
  });
}

init();
