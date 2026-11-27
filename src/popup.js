const $ = (id) => document.getElementById(id);

function openOptions(hash = '') {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/options.html') + hash });
  window.close();
}

async function init() {
  const s = await glossLoad();
  $('ver').textContent = 'v' + GLOSS_VERSION;

  const showKeyWarn = () => {
    $('noKey').hidden = !!(s.provider && s.keys[s.provider]);
    $('noKeyText').textContent = s.added.length ? '还没有填写 API Key' : '还没有添加模型服务';
  };
  $('provider').hidden = !s.added.length;
  const dd = makeDropdown($('provider'), {
    options: providerOptions(s),
    value: s.provider,
    onChange: async (v) => { s.provider = v; await glossSave({ provider: v }); showKeyWarn(); },
  });
  showKeyWarn();

  const dim = () => document.querySelectorAll('.row.dep').forEach((r) => r.classList.toggle('dim', !s.enabled));
  makeSwitch($('enabled'), s.enabled, (v) => { s.enabled = v; glossSave({ enabled: v }); dim(); });
  makeSwitch($('direct'), s.triggerMode === 'direct', (v) => glossSave({ triggerMode: v ? 'direct' : 'icon' }));
  makeSwitch($('showSentence'), s.showSentence, (v) => glossSave({ showSentence: v }));
  makeSwitch($('autoCambridge'), s.autoCambridge, (v) => glossSave({ autoCambridge: v }));
  makeSwitch($('paraEnabled'), s.paraEnabled, (v) => glossSave({ paraEnabled: v }));
  makeDropdown($('paraStyle'), {
    options: PARA_STYLES.map((p) => ({ value: p.id, label: p.name })),
    value: s.paraStyle,
    onChange: (v) => glossSave({ paraStyle: v }),
  });
  dim();

  // 今日用量
  const { usageDaily = {} } = await chrome.storage.local.get('usageDaily');
  const d = usageDaily[glossDayKey(Date.now())];
  if (d) {
    $('uCalls').textContent = d.calls;
    $('uTokens').textContent = glossFmtTokens(d.i + d.o);
    $('uMs').textContent = d.calls ? (d.ms / d.calls / 1000).toFixed(1) + 's' : '—';
  }

  $('openOptions').addEventListener('click', () => openOptions());
  $('goKey').addEventListener('click', (e) => { e.preventDefault(); openOptions('#models'); });
  $('usage').addEventListener('click', () => openOptions('#usage'));
  void dd;
}

init();
