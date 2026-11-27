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

function providerCard(id) {
  const P = PROVIDERS[id];
  const card = el('div', 'pv' + (S.provider === id ? ' active' : ''));

  // 头部
  const head = el('div', 'pv-head');
  const title = el('div');
  title.append(el('div', 'pv-name', P.name), el('div', 'pv-hint', P.hint));
  head.appendChild(title);
  if (S.provider === id) {
    head.appendChild(el('span', 'badge', '正在使用'));
  } else {
    const use = el('button', 'btn use', '设为当前');
    use.addEventListener('click', async () => { await save({ provider: id }); renderProviders(); });
    head.appendChild(use);
  }
  card.appendChild(head);

  // 自定义：接口地址
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
    card.appendChild(f);
  }

  // API Key
  const kf = el('label', 'fl');
  kf.appendChild(el('span', null, 'API Key'));
  const krow = el('div', 'key-row');
  const key = el('input', 'input mono');
  key.type = 'password';
  key.autocomplete = 'off';
  key.spellcheck = false;
  key.placeholder = '粘贴 Key';
  key.value = S.keys[id] || '';
  const saveKey = debounce(() => save({ keys: { ...S.keys, [id]: key.value.trim() } }), 500);
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
  card.appendChild(kf);

  // 模型
  const mf = el('div', 'fl');
  mf.appendChild(el('span', null, '模型'));
  const custom = el('input', 'input mono');
  custom.placeholder = '模型名，例如 ' + (P.models[0] || 'gpt-4o-mini');
  const saveModel = debounce(() => save({ models: { ...S.models, [id]: custom.value.trim() } }), 500);
  custom.addEventListener('input', saveModel);

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
          save({ models: { ...S.models, [id]: v } });
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
  card.appendChild(mf);

  // 底部：测试 + 获取 Key
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
  if (P.console) {
    const a = el('a', null, '获取 Key ↗');
    a.href = P.console;
    a.target = '_blank';
    a.rel = 'noopener';
    foot.appendChild(a);
  }
  const rm = el('button', 'btn quiet danger', '移除');
  rm.type = 'button';
  rm.addEventListener('click', () => removeProvider(id));
  foot.appendChild(rm);
  card.appendChild(foot);
  return card;
}

// ---------- 划词 & 段落 ----------

function renderBehavior() {
  makeSwitch($('enabled'), S.enabled, (v) => save({ enabled: v }));
  makeSeg($('triggerMode'), S.triggerMode, (v) => save({ triggerMode: v }));
  makeSwitch($('showSentence'), S.showSentence, (v) => save({ showSentence: v }));
  makeSwitch($('autoCambridge'), S.autoCambridge, (v) => save({ autoCambridge: v }));
  makeSwitch($('paraEnabled'), S.paraEnabled, (v) => save({ paraEnabled: v }));
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
    return a;
  }, { calls: 0, i: 0, o: 0, c: 0, ms: 0, hits: 0, err: 0 });

  const tiles = [
    ['调用次数', String(sum.calls)],
    ['输入 tokens', glossFmtTokens(sum.i)],
    ['输出 tokens', glossFmtTokens(sum.o)],
    ['平均耗时', sum.calls ? (sum.ms / sum.calls / 1000).toFixed(2) + ' s' : '—'],
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
      d.calls ? `平均 ${(d.ms / d.calls / 1000).toFixed(2)} s` : '',
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

function renderRecent() {
  const body = $('recent');
  body.textContent = '';
  const rows = usageCache.usageLog.slice(-50).reverse();
  $('recentEmpty').hidden = rows.length > 0;
  for (const r of rows) {
    const tr = el('tr');
    const d = new Date(r.t);
    const time = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const who = el('td');
    who.append((PROVIDERS[r.p]?.name || r.p) + ' ', el('span', 'm', r.m));
    tr.append(
      el('td', null, time),
      who,
      el('td', null, KIND[r.k] || r.k),
      el('td', 'r', r.nu ? '—' : r.i.toLocaleString()),
      el('td', 'r', r.nu ? '—' : r.o.toLocaleString()),
      el('td', 'r', r.f ? (r.f / 1000).toFixed(2) + ' s' : '—'),
      el('td', 'r', (r.ms / 1000).toFixed(2) + ' s'),
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
  $('ver').textContent = 'v' + GLOSS_VERSION;
  renderProviders();
  renderBehavior();
  makeSeg($('range'), String(range), (v) => { range = Number(v); renderUsage(); });
  await loadUsage();
  setupNav();
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();

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
