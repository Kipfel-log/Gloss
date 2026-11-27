// Gloss 划词：检测选中文字、抓取上下文、在旁边显示小窗。
// 所有界面都放在 Shadow DOM 里，不受网页样式影响，也不影响网页。
(() => {
  if (window.__glossLoaded) return;
  window.__glossLoaded = true;

  const CAMBRIDGE = 'https://dictionary.cambridge.org/dictionary/english-chinese-simplified/';
  // 划词图标：直接内嵌 48px 图标，不需要把插件文件暴露给网页
  const ICON_DATA = 'data:image/png;base64,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';

  // 只读取界面相关的开关；API Key 只在后台读取
  const UI_DEFAULTS = {
    enabled: true, triggerMode: 'icon', showSentence: true, autoCambridge: false, wordOnly: false,
    paraEnabled: true, paraStyle: 'muted', paraFont: 16, paraMeta: 'hover',
  };
  const settings = { ...UI_DEFAULTS };
  chrome.storage.local.get(UI_DEFAULTS)
    .then((s) => { Object.assign(settings, s); })
    .catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let paraChanged = false;
    for (const k of Object.keys(UI_DEFAULTS)) {
      if (changes[k]) {
        settings[k] = changes[k].newValue;
        if (k === 'paraStyle' || k === 'paraFont' || k === 'paraMeta') paraChanged = true;
      }
    }
    if (paraChanged) paraNodes.forEach(applyParaClass); // 已插入的译文实时换样式
    if (!settings.enabled) { hideIcon(); closePopup(); }
  });

  // ---------- 样式 ----------

  const CSS = `
:host { all: initial; }
.g-icon, .g-pop {
  --bg: #FAF9F5; --surface: #FFFFFF; --text: #141413; --muted: #73726C;
  --line: #E6E3D8; --chip: #F0EEE6; --accent: #C96442; --accent-soft: rgba(201,100,66,.10);
  --shadow: 0 1px 2px rgba(20,20,19,.04), 0 8px 28px rgba(20,20,19,.10);
  --serif: "Iowan Old Style", "Source Serif 4", Georgia, "Times New Roman", serif;
  --sans: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) {
  .g-icon, .g-pop {
    --bg: #262624; --surface: #30302E; --text: #F3F2EC; --muted: #A5A399;
    --line: #3D3C38; --chip: #353431; --accent: #E0866A; --accent-soft: rgba(224,134,106,.14);
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 10px 32px rgba(0,0,0,.45);
  }
}
.g-icon {
  position: absolute; width: 26px; height: 26px; padding: 0; margin: 0; border: 0;
  border-radius: 7px; background: transparent; cursor: pointer; overflow: hidden;
  box-shadow: 0 1px 2px rgba(20,20,19,.12), 0 4px 14px rgba(20,20,19,.16);
  transition: transform .12s ease, box-shadow .12s ease;
}
.g-icon img { display: block; width: 26px; height: 26px; }
.g-icon:hover { transform: translateY(-1px) scale(1.06); box-shadow: 0 2px 4px rgba(20,20,19,.14), 0 8px 20px rgba(20,20,19,.2); }

.g-pop {
  position: absolute; box-sizing: border-box; width: 360px; max-width: calc(100vw - 16px);
  padding: 14px 16px 10px; border-radius: 14px;
  background: var(--bg); color: var(--text); border: 1px solid var(--line);
  box-shadow: var(--shadow); font: 400 14px/1.65 var(--sans);
  text-align: left; animation: g-in .14s ease-out;
}
.g-pop.wide { width: 440px; }
.g-pop.above { transform: translateY(-100%); animation: none; }
@keyframes g-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.g-top { display: flex; align-items: baseline; gap: 10px; margin-bottom: 6px; }
.g-head {
  font: 500 21px/1.25 var(--serif); letter-spacing: -.01em;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}
.g-kicker { font: 600 11px/1 var(--sans); letter-spacing: .08em; color: var(--muted); }
.g-pos {
  flex-shrink: 0; font: 500 12px/1.4 var(--sans); color: var(--accent);
  background: var(--accent-soft); padding: 1px 7px; border-radius: 6px;
}
.g-pos:empty:not(.skel) { display: none; }
.g-close {
  margin-left: auto; flex-shrink: 0; align-self: center; width: 24px; height: 24px; padding: 0;
  border: 0; border-radius: 6px; background: transparent; color: var(--muted);
  font: 18px/24px var(--sans); cursor: pointer;
}
.g-close:hover { background: var(--chip); color: var(--text); }

.g-meaning { font-size: 15px; margin: 2px 0 8px; }
.g-colloc {
  display: flex; gap: 8px; align-items: baseline; margin: 0 0 8px;
  padding: 6px 10px; background: var(--chip); border-radius: 8px; font-size: 13px;
}
.g-colloc[hidden] { display: none; }
.g-sep { height: 1px; background: var(--line); margin: 10px 0 8px; }
.g-label { font: 600 11px/1.6 var(--sans); letter-spacing: .06em; color: var(--muted); flex-shrink: 0; }
.g-sentence { font-size: 13.5px; color: var(--text); }
.g-sent-row { display: flex; align-items: center; justify-content: space-between; }
.g-reveal {
  border: 0; background: transparent; color: var(--accent); cursor: pointer;
  font: 500 12px/1.6 var(--sans); padding: 0;
}
.g-reveal:hover { text-decoration: underline; }
.g-sentence.veiled { display: none; }
.g-trans { font-size: 15px; margin-top: 2px; white-space: pre-wrap; }

.g-foot {
  display: flex; align-items: center; gap: 10px; margin-top: 10px; padding-top: 8px;
  border-top: 1px solid var(--line); font: 12px/1.4 var(--sans); color: var(--muted);
}
.g-cam {
  flex-shrink: 0; white-space: nowrap;
  border: 1px solid var(--line); background: var(--surface); color: var(--text);
  font: 500 12px/1 var(--sans); padding: 6px 10px; border-radius: 8px; cursor: pointer;
}
.g-cam:hover { border-color: var(--accent); color: var(--accent); }
.g-status {
  margin-left: auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  border: 0; background: transparent; padding: 0; color: var(--muted); font: 12px/1.4 var(--sans); cursor: default;
}
.g-status:focus { outline: none; }
.g-status:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
.g-status.warn { color: var(--accent); }
.g-status.has-think { cursor: pointer; }
.meta {
  font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 11.5px; font-weight: 400; font-style: normal; line-height: 1.6; letter-spacing: normal;
  text-align: right; opacity: .5; margin-top: .15em; transition: opacity .15s ease;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.meta:empty { display: none; }
.meta-never .meta { display: none; }
.meta-hover .meta { opacity: 0; }
.meta-hover:hover .meta, .think-open .meta { opacity: .5; }
.meta-never.think-open .meta { display: block; }
.fb .meta { display: block !important; opacity: .9 !important; color: var(--accent); }
.g-status.has-think:hover { color: var(--accent); }
.g-think {
  margin: 2px 0 10px; padding: 8px 10px; background: var(--chip); border-radius: 8px;
  max-height: 168px; overflow: auto; overscroll-behavior: contain;
}
.g-think[hidden] { display: none; }
.g-think-label { font: 600 11px/1.6 var(--sans); letter-spacing: .06em; color: var(--muted); margin-bottom: 2px; }
.g-think-text { font-size: 12.5px; line-height: 1.6; color: var(--muted); white-space: pre-wrap; }
.g-think.live .g-think-label::after { content: " · 进行中"; color: var(--accent); }

.g-error { font-size: 13.5px; color: var(--text); padding: 4px 0 2px; }
.g-error button {
  display: inline-block; margin-top: 10px; border: 0; border-radius: 8px; cursor: pointer;
  background: var(--accent); color: #fff; font: 500 13px/1 var(--sans); padding: 8px 12px;
}

.skel { display: inline-block; width: 44px; height: 1.2em; }
.skel-block { min-height: 1.3em; }
.skel, .skel-block {
  border-radius: 6px; color: transparent;
  background: linear-gradient(90deg, var(--chip) 0%, var(--line) 50%, var(--chip) 100%);
  background-size: 200% 100%; animation: g-shimmer 1.1s linear infinite;
}
@keyframes g-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
`;

  const THINK_TPL = `<div class="g-think" hidden><div class="g-think-label">思考过程</div><div class="g-think-text"></div></div>`;

  const WORD_TPL = `
<div class="g-top"><span class="g-head"></span><span class="g-pos skel"></span>
  <button class="g-close" title="关闭 (Esc)">×</button></div>
${THINK_TPL}
<div class="g-meaning skel-block"></div>
<div class="g-colloc" hidden><span class="g-label">搭配</span><span class="g-colloc-text"></span></div>
<div class="g-sep"></div>
<div class="g-sent-row"><span class="g-label">整句</span><button class="g-reveal" hidden>显示整句翻译</button></div>
<div class="g-sentence skel-block"></div>
<div class="g-foot"><button class="g-cam" title="Alt+C">剑桥词典 ↗</button><button class="g-status" type="button"></button></div>`;

  const SENT_TPL = `
<div class="g-top"><span class="g-kicker">翻译</span>
  <button class="g-close" title="关闭 (Esc)">×</button></div>
${THINK_TPL}
<div class="g-trans skel-block"></div>
<div class="g-foot"><button class="g-status" type="button"></button></div>`;

  // ---------- 根节点 ----------

  let host = null, root = null, iconEl = null, popEl = null, port = null, current = null;

  function ensureRoot() {
    if (host && host.isConnected) return;
    host = document.createElement('gloss-root');
    host.style.cssText = 'all:initial;position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;';
    root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
    document.documentElement.appendChild(host);
  }

  const q = (sel) => popEl && popEl.querySelector(sel);
  const inHost = (e) => host && e.composedPath().includes(host);

  // ---------- 上下文 ----------

  const BLOCK = 'p,li,td,th,dd,dt,blockquote,h1,h2,h3,h4,h5,h6,figcaption,pre,summary,caption,label';

  function getContext(range, text) {
    let node = range.commonAncestorContainer;
    if (node.nodeType !== 1) node = node.parentElement;
    const block = (node && node.closest(BLOCK)) || node;
    let para = ((block && (block.innerText || block.textContent)) || text).replace(/\s+/g, ' ').trim();
    let idx = para.indexOf(text);
    if (idx < 0) { para = text; idx = 0; }
    if (para.length > 1500) {
      const start = Math.max(0, idx - 700);
      para = para.slice(start, start + 1500);
      idx -= start;
    }
    // 句末：. ! ? 。！？ 后面接空白、引号或括号（或段落结束）
    const isEnd = (i) => /[.!?。！？]/.test(para[i]) && (i + 1 >= para.length || /[\s"'”’)\]]/.test(para[i + 1]));
    let a = idx;
    while (a > 0 && !isEnd(a - 1)) a--;
    let b = idx + text.length;
    while (b < para.length && !isEnd(b)) b++;
    if (b < para.length) b++;
    const sentence = para.slice(a, b).trim();

    const words = text.split(' ').length;
    const isWord = words <= 4 && text.length <= 60 && !/[.!?。！？;]\s/.test(text);
    return {
      selection: text,
      sentence,
      paragraph: para,
      title: document.title.slice(0, 200),
      mode: isWord ? 'word' : 'sentence',
    };
  }

  // ---------- 选中检测 ----------

  function handleSelection(e) {
    if (!settings.enabled) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text || text.length > 2000 || !/[A-Za-z]/.test(text)) return;
    const range = sel.getRangeAt(0);
    const r = range.getBoundingClientRect();
    if (!r.width && !r.height) return;

    const ctx = getContext(range, text);
    if (settings.wordOnly && ctx.mode !== 'word') return; // 习惯性框选长段文字时不打扰
    const payload = {
      ...ctx,
      rect: { left: r.left + scrollX, right: r.right + scrollX, top: r.top + scrollY, bottom: r.bottom + scrollY },
    };
    if (settings.triggerMode === 'direct') openPopup(payload);
    else showIcon(e.pageX + 8, e.pageY + 10, payload);
  }

  document.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || inHost(e)) return;
    setTimeout(() => handleSelection(e), 0);
  }, true);

  document.addEventListener('mousedown', (e) => {
    if (inHost(e)) return;
    hideIcon();
    closePopup();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!popEl) return;
    if (e.key === 'Escape') {
      closePopup();
    } else if (e.altKey && e.code === 'KeyC' && current && current.mode === 'word') {
      e.preventDefault();
      openCambridge(true);
    }
  }, true);

  // ---------- 小图标 ----------

  function showIcon(x, y, payload) {
    ensureRoot();
    hideIcon();
    iconEl = document.createElement('button');
    iconEl.className = 'g-icon';
    const img = document.createElement('img');
    img.src = ICON_DATA;
    img.alt = '';
    iconEl.appendChild(img);
    iconEl.title = 'Gloss 翻译';
    iconEl.style.left = Math.min(x, scrollX + innerWidth - 36) + 'px';
    iconEl.style.top = y + 'px';
    iconEl.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); });
    iconEl.addEventListener('click', (e) => { e.stopPropagation(); hideIcon(); openPopup(payload); });
    root.appendChild(iconEl);
  }

  function hideIcon() {
    if (iconEl) { iconEl.remove(); iconEl = null; }
  }

  // ---------- 小窗 ----------

  function openPopup(p) {
    ensureRoot();
    closePopup();
    current = { ...p, buffer: '', reason: '', fields: {}, done: false, thinkPinned: false };
    popEl = document.createElement('div');
    popEl.className = 'g-pop' + (p.mode === 'word' ? '' : ' wide');
    popEl.setAttribute('role', 'dialog');
    popEl.innerHTML = p.mode === 'word' ? WORD_TPL : SENT_TPL; // 模板是固定字符串，不含网页内容
    root.appendChild(popEl);
    popEl.addEventListener('mousedown', (e) => e.stopPropagation());
    q('.g-close').addEventListener('click', closePopup);
    q('.g-status').addEventListener('click', toggleThink);
    if (p.mode === 'word') {
      q('.g-head').textContent = p.selection;
      q('.g-cam').addEventListener('click', () => openCambridge(true));
      if (settings.showSentence) {
        startSentence();
      } else {
        // 先自己理解，需要时再点开才请求（同一句只翻一次，之后走缓存）
        const btn = q('.g-reveal');
        btn.hidden = false;
        q('.g-sentence').classList.add('veiled');
        btn.addEventListener('click', () => {
          q('.g-sentence').classList.remove('veiled');
          btn.hidden = true;
          startSentence();
        });
      }
    }
    position(p.rect);
    startLookup(p);
  }

  function position(rect) {
    const w = popEl.offsetWidth;
    const left = Math.max(scrollX + 8, Math.min(rect.left, scrollX + innerWidth - w - 8));
    popEl.style.left = left + 'px';
    const spaceBelow = scrollY + innerHeight - rect.bottom;
    if (spaceBelow < 260 && rect.top - scrollY > spaceBelow) {
      // 下方放不下就放到上方，并向上生长，流式输出时不会盖住原文
      popEl.classList.add('above');
      popEl.style.top = (rect.top - 8) + 'px';
    } else {
      popEl.style.top = (rect.bottom + 8) + 'px';
    }
  }

  function closePopup() {
    if (popEl) { popEl.remove(); popEl = null; }
    current = null;
    if (port) { try { port.disconnect(); } catch {} port = null; }
    if (sentPort) { try { sentPort.disconnect(); } catch {} sentPort = null; }
  }

  // 整句翻译单独请求：查同一句里的多个词时，整句只翻译一次（后面走缓存）
  let sentPort = null;
  function startSentence() {
    if (!current || !current.sentence) { fill('.g-sentence', '', true); return; }
    let my;
    try { my = chrome.runtime.connect({ name: 'gloss' }); } catch { return; }
    sentPort = my;
    let buf = '';
    my.onMessage.addListener((m) => {
      if (sentPort !== my || !popEl) return;
      if (m.type === 'delta') { buf += m.text; fill('.g-sentence', buf.trim(), false); }
      else if (m.type === 'done') { fill('.g-sentence', buf.trim(), true); try { my.disconnect(); } catch {} }
      else if (m.type === 'error') { fill('.g-sentence', m.message || '出错了。', true); }
    });
    my.postMessage({
      mode: 'sentence', selection: current.sentence, sentence: current.sentence,
      paragraph: current.paragraph, title: current.title,
    });
  }

  function toggleThink() {
    if (!current || !current.reason || !current.done) return;
    const box = q('.g-think');
    box.hidden = !box.hidden;
    current.thinkPinned = !box.hidden;
    q('.g-status').classList.toggle('open', !box.hidden);
    if (!box.hidden) box.scrollTop = 0;
  }

  function setStatus(text) {
    const el = q('.g-status');
    if (el) el.textContent = text;
  }

  // ---------- 请求与渲染 ----------

  function startLookup(p) {
    let myPort;
    try {
      myPort = chrome.runtime.connect({ name: 'gloss' });
    } catch {
      showError({ message: 'Gloss 刚刚更新过，请刷新这个网页后再试。' });
      return;
    }
    port = myPort;
    myPort.onMessage.addListener((m) => { if (port === myPort) onMessage(m); });
    myPort.onDisconnect.addListener(() => { if (port === myPort) port = null; });
    myPort.postMessage({
      mode: p.mode, selection: p.selection, sentence: p.sentence,
      paragraph: p.paragraph, title: p.title,
    });
  }

  function onMessage(m) {
    if (!current || !popEl) return;
    if (m.type === 'fallback') {
      setStatus(`${m.from} 限流，改用 ${m.to}…`);
      q('.g-status').classList.add('warn');
    } else if (m.type === 'thinking') {
      if (!q('.g-status').classList.contains('warn')) setStatus('思考中…');
    } else if (m.type === 'reason') {
      current.reason += m.text;
      const box = q('.g-think');
      q('.g-think-text').textContent = current.reason;
      if (!current.buffer) {
        // 思考阶段：展开并跟着滚动
        box.hidden = false;
        box.classList.add('live');
        box.scrollTop = box.scrollHeight;
      }
    } else if (m.type === 'delta') {
      if (!current.buffer) {
        if (!q('.g-status').classList.contains('warn')) setStatus('');
        // 开始输出正文：思考过程自动收起
        const box = q('.g-think');
        box.classList.remove('live');
        if (!current.thinkPinned) box.hidden = true;
      }
      current.buffer += m.text;
      render(false);
    } else if (m.type === 'done') {
      current.done = true;
      render(true);
      const name = m.alias || [m.provider, (m.model || '').split('/').pop()].filter(Boolean).join(' · ');
      const lv = { low: '思考·低', medium: '思考·中', high: '思考·高' }[m.level];
      const label = m.cached ? `来自缓存 · ${m.alias || (m.model || '').split('/').pop()}` : [name, lv].filter(Boolean).join(' · ');
      if (m.fallbackFrom) {
        // 限流提示显示 3 秒，然后换回正常的“模型 · 档位”
        setStatus(`${m.fallbackFrom} 限流 → 已改用 ${m.alias || m.provider}`);
        q('.g-status').classList.add('warn');
        const mine = current;
        setTimeout(() => {
          if (current !== mine || !popEl) return;
          setStatus(label);
          q('.g-status').classList.remove('warn');
        }, 3000);
      } else {
        setStatus(label);
        q('.g-status').classList.remove('warn');
      }
      q('.g-status').title = [m.provider, m.model].filter(Boolean).join(' · ');
      const st = q('.g-status');
      if (current.reason) {
        st.classList.add('has-think');
        st.title += '（点击查看思考过程）';
      }
      if (current.mode === 'word' && settings.autoCambridge) openCambridge(false);
    } else if (m.type === 'error') {
      showError(m);
    }
  }

  function parseFields(buf) {
    const f = {};
    let key = null;
    for (const raw of buf.split('\n')) {
      const line = raw.trim();
      const mm = line.match(/^(LEMMA|POS|MEANING|COLLOCATION|SENTENCE)\s*[:：]\s*(.*)$/i);
      if (mm) { key = mm[1].toUpperCase(); f[key] = mm[2]; }
      else if (key && line) f[key] += ' ' + line;
    }
    return f;
  }

  function fill(sel, value, final) {
    const el = q(sel);
    if (!el) return;
    if (value) {
      el.textContent = value;
      el.classList.remove('skel', 'skel-block');
    } else if (final) {
      el.textContent = sel === '.g-pos' ? '' : '—';
      el.classList.remove('skel', 'skel-block');
    }
  }

  function render(final) {
    if (current.mode === 'word') {
      const f = parseFields(current.buffer);
      current.fields = f;
      fill('.g-pos', f.POS, final);
      fill('.g-meaning', f.MEANING, final);
      const c = (f.COLLOCATION || '').trim();
      const box = q('.g-colloc');
      if (c && !/^(无|none|n\/a|-|—)[。.]?$/i.test(c)) {
        box.hidden = false;
        q('.g-colloc-text').textContent = c;
      } else {
        box.hidden = true;
      }
    } else {
      fill('.g-trans', current.buffer.trim(), final);
    }
  }

  function showError(m) {
    if (!popEl) return;
    [...popEl.children].forEach((el) => { if (!el.classList.contains('g-top')) el.remove(); });
    const box = document.createElement('div');
    box.className = 'g-error';
    box.textContent = m.message || '出错了。';
    if (m.code === 'no-key') {
      box.appendChild(document.createElement('br'));
      const btn = document.createElement('button');
      btn.textContent = '打开设置';
      btn.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'open-options' }));
      box.appendChild(btn);
    }
    popEl.appendChild(box);
  }

  function openCambridge(active) {
    if (!current || current.mode !== 'word') return;
    const word = (current.fields.LEMMA || current.selection)
      .toLowerCase()
      .replace(/[^a-z0-9'\- ]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    if (!word) return;
    try {
      chrome.runtime.sendMessage({ type: 'open-tab', url: CAMBRIDGE + encodeURIComponent(word), active });
    } catch { /* 插件已重新加载 */ }
  }

  // =====================================================================
  // 段落翻译：鼠标停在段落上，单独按一下 Shift → 在段落末尾插入译文；再按一次收起
  // =====================================================================

  const PARA_CSS = `
:host { display: block !important; margin: .4em 0 0 !important; padding: 0 !important; }
.w { --accent: #C96442; --tint: rgba(201,100,66,.08); }
@media (prefers-color-scheme: dark) { .w { --accent: #E0866A; --tint: rgba(224,134,106,.12); } }
.t {
  white-space: pre-wrap; font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: var(--fs, 16px); font-weight: 400; font-style: normal; line-height: 1.7;
  letter-spacing: normal; text-transform: none;
}
.muted .t { opacity: .66; }
.dashed .t {
  text-decoration: underline dashed; text-decoration-thickness: 1px;
  text-decoration-color: var(--accent); text-underline-offset: .28em;
}
.quote { border-left: 3px solid var(--accent); padding-left: .8em; }
.highlight { background: var(--tint); border-radius: 6px; padding: .45em .7em; }
.t:empty::before { content: "翻译中…"; opacity: .45; }
.t[data-thinking]:empty::before { content: "思考中…"; }
.think {
  font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: calc(var(--fs, 16px) * .8); font-weight: 400; font-style: normal; line-height: 1.65;
  white-space: pre-wrap; opacity: .55; max-height: 11em; overflow: auto; overscroll-behavior: contain;
  border-left: 2px dashed var(--accent); padding-left: .7em; margin-bottom: .5em;
}
.think[hidden] { display: none; }
.has-think { cursor: pointer; }
.meta {
  font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 11.5px; font-weight: 400; font-style: normal; line-height: 1.6; letter-spacing: normal;
  text-align: right; opacity: .5; margin-top: .15em; transition: opacity .15s ease;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.meta:empty { display: none; }
.meta-never .meta { display: none; }
.meta-hover .meta { opacity: 0; }
.meta-hover:hover .meta, .think-open .meta { opacity: .5; }
.meta-never.think-open .meta { display: block; }
.fb .meta { display: block !important; opacity: .9 !important; color: var(--accent); }
.err { color: #B4453A; font-size: .9em; }
`;

  const PARA_BLOCK = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,dd,dt,figcaption,td,th,summary,caption';
  const paraNodes = new Set();       // 当前页面上所有译文节点
  const paraOf = new WeakMap();      // 原文段落 → 译文节点
  let mouseX = -1, mouseY = -1;
  let shiftAt = 0, shiftClean = false;

  document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; }, { capture: true, passive: true });
  document.addEventListener('mousedown', () => { shiftClean = false; }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Shift') {
      if (!e.repeat) { shiftAt = Date.now(); shiftClean = true; }
    } else {
      shiftClean = false; // Shift+其他键（打大写字母、快捷键）不算
    }
  }, true);

  document.addEventListener('keyup', (e) => {
    if (e.key !== 'Shift' || !shiftClean) return;
    shiftClean = false;
    if (Date.now() - shiftAt > 500) return; // 按住太久不算“单按”
    if (!settings.enabled || !settings.paraEnabled || mouseX < 0) return;
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
    toggleParagraphAt(mouseX, mouseY);
  }, true);

  function blockOf(el) {
    const b = el.closest(PARA_BLOCK);
    if (b) return b;
    let n = el;
    while (n && n !== document.body) {
      const d = getComputedStyle(n).display;
      if (d !== 'inline' && d !== 'contents') break;
      n = n.parentElement;
    }
    return n;
  }

  function textOf(el) {
    return ((el && el.innerText) || '').replace(/\s+/g, ' ').trim(); // 影子 DOM 里的译文不会被算进来
  }

  function toggleParagraphAt(x, y) {
    hideIcon();
    const el = document.elementFromPoint(x, y);
    if (!el || el === host) return;
    const hit = el.closest('gloss-para');
    if (hit) { removePara(hit); return; }

    const block = blockOf(el);
    if (!block || block === document.body || block === document.documentElement) return;

    const existing = paraOf.get(block);
    if (existing && existing.isConnected) { removePara(existing); return; }

    const text = textOf(block);
    if (text.length < 2 || text.length > 4000 || !/[A-Za-z]{2}/.test(text)) return;

    // 上一段作为上下文
    let prev = '';
    let sib = block.previousElementSibling;
    while (sib && !prev) { prev = textOf(sib); sib = sib.previousElementSibling; }
    prev = prev.slice(-600);

    const node = document.createElement('gloss-para');
    node.setAttribute('translate', 'no');
    const shadow = node.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = PARA_CSS;
    const wrap = document.createElement('div');
    const think = document.createElement('div');
    think.className = 'think';
    think.hidden = true;
    const t = document.createElement('div');
    t.className = 't';
    const meta = document.createElement('div');
    meta.className = 'meta';
    wrap.append(think, t, meta);
    // 翻译完成后，点一下译文可以展开 / 收起思考过程（拖动选字时不触发）
    wrap.addEventListener('click', () => {
      if (!wrap.classList.contains('has-think')) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      think.hidden = !think.hidden;
      wrap.classList.toggle('think-open', !think.hidden);
    });
    shadow.append(style, wrap);
    node._wrap = wrap;
    node._t = t;
    applyParaClass(node);
    block.appendChild(node);
    paraNodes.add(node);
    paraOf.set(block, node);
    node._block = block;

    let p;
    try {
      p = chrome.runtime.connect({ name: 'gloss' });
    } catch {
      t.className = 'err';
      t.textContent = 'Gloss 刚刚更新过，请刷新这个网页后再试。';
      return;
    }
    node._port = p;
    p.onMessage.addListener((m) => {
      if (m.type === 'fallback') {
        wrap.classList.add('fb');
        meta.textContent = `${m.from} 限流，改用 ${m.to}…`;
      } else if (m.type === 'thinking') t.dataset.thinking = '1';
      else if (m.type === 'reason') {
        think.textContent += m.text;
        if (!t.textContent) { think.hidden = false; think.scrollTop = think.scrollHeight; }
      } else if (m.type === 'delta') {
        if (!t.textContent) think.hidden = true; // 开始输出译文：思考过程自动收起
        t.textContent += m.text;
      } else if (m.type === 'done') {
        t.textContent = t.textContent.trim();
        if (think.textContent) { wrap.classList.add('has-think'); wrap.title = '点击查看思考过程'; }
        const short = (m.model || '').split('/').pop();
        const lv = { low: '思考·低', medium: '思考·中', high: '思考·高' }[m.level];
        const label = m.cached
          ? `来自缓存 · ${m.alias || short}`
          : (m.alias ? [m.alias, lv] : [m.provider, short, lv]).filter(Boolean).join(' · ');
        if (m.fallbackFrom) {
          meta.textContent = `${m.fallbackFrom} 限流 → 已改用 ${m.alias || m.provider}`;
          setTimeout(() => { meta.textContent = label; wrap.classList.remove('fb'); }, 3000);
        } else {
          meta.textContent = label;
        }
        try { p.disconnect(); } catch {}
      }
      else if (m.type === 'error') { t.className = 'err'; t.textContent = m.message || '出错了。'; think.hidden = true; }
    });
    p.postMessage({ mode: 'paragraph', selection: text, prev, title: document.title.slice(0, 200) });
  }

  function applyParaClass(node) {
    if (!node._wrap) return;
    const keep = ['has-think', 'think-open', 'fb'].filter((c) => node._wrap.classList.contains(c));
    node._wrap.className = ['w', settings.paraStyle || 'muted', 'meta-' + (settings.paraMeta || 'hover'), ...keep].join(' ');
    node._wrap.style.setProperty('--fs', (Number(settings.paraFont) || 16) + 'px'); // 固定字号，不跟着标题变大
  }

  function removePara(node) {
    try { node._port && node._port.disconnect(); } catch {}
    paraNodes.delete(node);
    if (node._block) paraOf.delete(node._block);
    node.remove();
  }
})();
