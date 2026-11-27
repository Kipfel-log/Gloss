// Gloss 共享配置：后台、小设置弹窗、完整设置页共用。
// （content script 不加载这个文件，它只读取界面相关的开关，不接触 API Key。）

const GLOSS_VERSION = '0.4.0';

const PROVIDERS = {
  deepseek: {
    name: 'DeepSeek',
    hint: 'DeepSeek 开放平台',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-flash'],
    extra: { thinking: { type: 'disabled' } }, // 默认开启思考模式，必须关掉
    console: 'https://platform.deepseek.com/',
  },
  qwen: {
    name: '千问',
    hint: '阿里云百炼（北京地域）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3.8-flash', 'qwen3.7-flash', 'qwen-plus'],
    extra: { enable_thinking: false },
    console: 'https://bailian.console.aliyun.com/',
  },
  siliconflow: {
    name: '硅基流动',
    hint: 'SiliconCloud',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['deepseek-ai/DeepSeek-V4-Flash'],
    extra: { enable_thinking: false },
    console: 'https://cloud.siliconflow.cn/',
  },
  openrouter: {
    name: 'OpenRouter',
    hint: '含免费模型（带 :free 后缀，每天有次数限制）',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['baidu/ernie-5.5-flash-preview:free', 'inclusionai/ling-3.2-flash:free', 'openrouter/free'],
    extra: {},
    console: 'https://openrouter.ai/',
  },
  custom: {
    name: '自定义',
    hint: '任意 OpenAI 兼容接口',
    baseUrl: '',
    models: [],
    extra: {},
    console: '',
  },
};

const PROVIDER_ORDER = ['deepseek', 'qwen', 'siliconflow', 'openrouter', 'custom'];

const PARA_STYLES = [
  { id: 'plain', name: '普通', desc: '和原文一样' },
  { id: 'muted', name: '淡色', desc: '颜色浅一些，主次分明' },
  { id: 'dashed', name: '虚线下划线', desc: '一眼区分译文' },
  { id: 'quote', name: '左侧竖线', desc: '像引用块' },
  { id: 'highlight', name: '浅色底纹', desc: '整块淡橙色背景' },
];

const PARA_FONTS = [14, 15, 16, 17, 18];

const GLOSS_DEFAULTS = {
  provider: '',
  added: [], // 用户添加过的服务商；没添加的不显示
  keys: { deepseek: '', qwen: '', siliconflow: '', openrouter: '', custom: '' },
  models: {
    deepseek: 'deepseek-flash',
    qwen: 'qwen3.8-flash',
    siliconflow: 'deepseek-ai/DeepSeek-V4-Flash',
    openrouter: 'baidu/ernie-5.5-flash-preview:free',
    custom: '',
  },
  thinking: { deepseek: 'off', qwen: 'off', siliconflow: 'off', openrouter: 'off', custom: 'off' },
  customBaseUrl: '',
  enabled: true,
  triggerMode: 'icon',
  showSentence: true,
  autoCambridge: false,
  paraEnabled: true,
  paraStyle: 'muted',
  paraFont: 16,
};

async function glossLoad() {
  const raw = await chrome.storage.local.get(null);
  const s = { ...GLOSS_DEFAULTS, ...raw };
  s.keys = { ...GLOSS_DEFAULTS.keys, ...(raw.keys || {}) };
  s.models = { ...GLOSS_DEFAULTS.models, ...(raw.models || {}) };
  s.thinking = { ...GLOSS_DEFAULTS.thinking, ...(raw.thinking || {}) };
  // 0.1.0 的旧设置迁移
  if (raw.apiKey && !s.keys.deepseek) s.keys.deepseek = raw.apiKey;
  // 0.2.0 → 0.3.0：没有 added 列表时，把已经填过 Key 的服务商视为已添加
  if (!Array.isArray(raw.added)) s.added = PROVIDER_ORDER.filter((id) => s.keys[id]);
  s.added = s.added.filter((id) => PROVIDERS[id]);
  if (!s.added.includes(s.provider)) s.provider = s.added[0] || '';
  if (!PARA_FONTS.includes(Number(s.paraFont))) s.paraFont = 16;
  return s;
}

async function glossSave(patch) {
  await chrome.storage.local.set(patch);
}

function glossActive(s) {
  if (!s.provider || !PROVIDERS[s.provider]) return null;
  const p = PROVIDERS[s.provider];
  return {
    id: s.provider,
    name: p.name,
    baseUrl: (s.provider === 'custom' ? s.customBaseUrl : p.baseUrl).replace(/\/+$/, ''),
    key: s.keys[s.provider] || '',
    model: s.models[s.provider] || '',
    think: s.thinking[s.provider] || 'off',
    extra: { ...p.extra, ...glossThinkParams(s.provider, s.thinking[s.provider]) },
  };
}

// ---------- 思考强度 ----------
// 各家参数不同（均来自官方文档），这里统一成 关闭 / 低 / 中 / 高 四档。

const THINK_LEVELS = [
  { v: 'off', l: '关闭' },
  { v: 'low', l: '低' },
  { v: 'medium', l: '中' },
  { v: 'high', l: '高' },
];
const THINK_BUDGET = { low: 512, medium: 2048, high: 8192 };      // 千问 / 硅基流动：思考 token 上限
const THINK_EXTRA_TOKENS = { low: 1500, medium: 4000, high: 10000 }; // 开启思考时额外放宽 max_tokens，避免想完了没空间输出

function glossThinkParams(id, level) {
  const on = level && level !== 'off';
  switch (id) {
    case 'deepseek':
      // reasoning_effort 只接受 low / high / max
      return on
        ? { thinking: { type: 'enabled' }, reasoning_effort: { low: 'low', medium: 'high', high: 'max' }[level] }
        : { thinking: { type: 'disabled' } };
    case 'qwen':
    case 'siliconflow':
      return on ? { enable_thinking: true, thinking_budget: THINK_BUDGET[level] } : { enable_thinking: false };
    case 'openrouter':
      // exclude：模型照常思考，但不把思考过程传回来（照常计费）
      return { reasoning: on ? { effort: level, exclude: true } : { effort: 'none' } };
    default:
      return on ? { reasoning_effort: level } : {};
  }
}

function glossDayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function glossFmtTokens(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(0) + 'k';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}
