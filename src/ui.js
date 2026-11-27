// Gloss 设置界面共用组件：自定义下拉框、开关、分段选择。

const CHEVRON = '<svg class="dd-chev" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// options: [{ value, label, sub }]
function makeDropdown(container, { options, value, onChange, placeholder = '请选择' }) {
  container.classList.add('dd');
  container.textContent = '';
  const btn = el('button', 'dd-btn');
  btn.type = 'button';
  btn.setAttribute('aria-haspopup', 'listbox');
  const label = el('span', 'dd-label');
  const main = el('span', 'dd-main');
  const sub = el('span', 'dd-sub');
  label.append(main, sub);
  btn.appendChild(label);
  btn.insertAdjacentHTML('beforeend', CHEVRON);
  const list = el('div', 'dd-list');
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  container.append(btn, list);

  let focusIdx = -1;

  function update() {
    const o = options.find((x) => x.value === value);
    main.textContent = o ? o.label : placeholder;
    sub.textContent = o && o.sub ? o.sub : '';
    sub.hidden = !(o && o.sub);
  }

  function renderList() {
    list.textContent = '';
    options.forEach((o, i) => {
      const it = el('button', 'dd-item' + (o.value === value ? ' on' : '') + (i === focusIdx ? ' focus' : ''));
      it.type = 'button';
      it.setAttribute('role', 'option');
      const chk = el('span', 'dd-check');
      chk.innerHTML = CHECK;
      const lab = el('span', 'dd-label');
      lab.append(el('span', 'dd-main', o.label));
      if (o.sub) lab.append(el('span', 'dd-sub', o.sub));
      it.append(chk, lab);
      it.addEventListener('click', () => choose(o.value));
      list.appendChild(it);
    });
  }

  function choose(v) {
    const changed = v !== value;
    value = v;
    close();
    update();
    if (changed && onChange) onChange(v);
  }

  function open() {
    focusIdx = Math.max(0, options.findIndex((x) => x.value === value));
    renderList();
    list.hidden = false;
    container.classList.add('open');
  }

  function close() {
    list.hidden = true;
    container.classList.remove('open');
  }

  btn.addEventListener('click', () => (list.hidden ? open() : close()));
  btn.addEventListener('keydown', (e) => {
    if (list.hidden) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx = Math.min(options.length - 1, focusIdx + 1); renderList(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusIdx = Math.max(0, focusIdx - 1); renderList(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (options[focusIdx]) choose(options[focusIdx].value); }
  });
  document.addEventListener('mousedown', (e) => { if (!container.contains(e.target)) close(); });

  update();
  return {
    get value() { return value; },
    set(v) { value = v; update(); },
    setOptions(o) { options = o; update(); },
  };
}

function makeSwitch(input, value, onChange) {
  input.checked = !!value;
  input.addEventListener('change', () => onChange(input.checked));
}

// container 里放若干 <button data-v="…">
function makeSeg(container, value, onChange) {
  const btns = [...container.querySelectorAll('button')];
  const paint = () => btns.forEach((b) => b.classList.toggle('on', b.dataset.v === value));
  btns.forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.v === value) return;
    value = b.dataset.v;
    paint();
    onChange(value);
  }));
  paint();
  return { set(v) { value = v; paint(); } };
}

function providerOptions(s) {
  return PROVIDER_ORDER.map((id) => ({
    value: id,
    label: PROVIDERS[id].name,
    sub: (s.models[id] || '未设置模型') + (s.keys[id] ? '' : ' · 未填 Key'),
  }));
}
