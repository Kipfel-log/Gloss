const DEFAULTS = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
  triggerMode: 'icon',
  autoCambridge: false,
};
const PRESET_MODELS = ['deepseek-flash', 'deepseek-v4-pro'];
const $ = (id) => document.getElementById(id);

function setStatus(text, kind = '') {
  const el = $('status');
  el.textContent = text;
  el.className = kind;
}

async function load() {
  const s = await chrome.storage.local.get(DEFAULTS);
  $('apiKey').value = s.apiKey;
  $('baseUrl').value = s.baseUrl;
  if (PRESET_MODELS.includes(s.model)) {
    $('modelSelect').value = s.model;
  } else {
    $('modelSelect').value = 'custom';
    $('modelCustom').hidden = false;
    $('modelCustom').value = s.model;
  }
  document.querySelector(`input[name=triggerMode][value=${s.triggerMode}]`).checked = true;
  $('autoCambridge').checked = s.autoCambridge;
}

async function save() {
  const baseUrl = ($('baseUrl').value.trim() || DEFAULTS.baseUrl).replace(/\/+$/, '');
  let origin;
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== 'https:') throw new Error();
    origin = u.origin;
  } catch {
    setStatus('接口地址需要是 https:// 开头的网址。', 'bad');
    return false;
  }
  if (origin !== 'https://api.deepseek.com') {
    const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
    if (!granted) {
      setStatus('没有获得访问该接口地址的权限，未保存。', 'bad');
      return false;
    }
  }

  const model = $('modelSelect').value === 'custom'
    ? $('modelCustom').value.trim()
    : $('modelSelect').value;
  if (!model) {
    setStatus('请填写模型名。', 'bad');
    return false;
  }

  await chrome.storage.local.set({
    apiKey: $('apiKey').value.trim(),
    baseUrl,
    model,
    triggerMode: document.querySelector('input[name=triggerMode]:checked').value,
    autoCambridge: $('autoCambridge').checked,
  });
  setStatus('已保存。', 'ok');
  return true;
}

$('modelSelect').addEventListener('change', () => {
  $('modelCustom').hidden = $('modelSelect').value !== 'custom';
});

$('toggleKey').addEventListener('click', () => {
  const shown = $('apiKey').type === 'text';
  $('apiKey').type = shown ? 'password' : 'text';
  $('toggleKey').textContent = shown ? '显示' : '隐藏';
});

$('save').addEventListener('click', save);

$('test').addEventListener('click', async () => {
  if (!(await save())) return;
  setStatus('正在测试…');
  const r = await chrome.runtime.sendMessage({ type: 'test' });
  setStatus(r?.message || '没有收到回应。', r?.ok ? 'ok' : 'bad');
});

load();
