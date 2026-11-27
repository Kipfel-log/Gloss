// Gloss 共享配置：后台、小设置弹窗、完整设置页共用。
// （content script 不加载这个文件，它只读取界面相关的开关，不接触 API Key。）

const GLOSS_VERSION = '1.4.0';

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

// 成本估算用的价格（每 100 万 tokens）。DeepSeek 预置官方价格（2026-11 核对）：
// deepseek-flash 高峰：命中缓存 $0.006 / 未命中 $0.3 / 输出 $1.2；非高峰为高峰的一半。
const PRICING_DEFAULTS = {
  deepseek: { cur: 'USD', hit: 0.006, miss: 0.3, out: 1.2, offpeak: true },
  qwen: { cur: 'CNY', hit: 0, miss: 0, out: 0, offpeak: false },
  siliconflow: { cur: 'CNY', hit: 0, miss: 0, out: 0, offpeak: false },
  openrouter: { cur: 'USD', hit: 0, miss: 0, out: 0, offpeak: false },
  custom: { cur: 'USD', hit: 0, miss: 0, out: 0, offpeak: false },
};

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
  pricing: PRICING_DEFAULTS,
  wordOnly: false,
  thinkProfiles: {},
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
  s.pricing = {};
  for (const id of PROVIDER_ORDER) s.pricing[id] = { ...PRICING_DEFAULTS[id], ...((raw.pricing || {})[id] || {}) };
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
    extra: p.extra,
    profile: glossThinkProfile(s, s.provider, s.models[s.provider] || ''),
  };
}

// ---------- 思考方案（按“服务商 + 模型”分别保存） ----------
// word：划词用的档位；para：整句 / 段落翻译用的档位；可选 off / low / medium / high / auto。
// auto 按英文单词数分档：≤ t1 关闭，≤ t2 低，≤ t3 中，更长用高。
// 划词时数的是“所在句子”的单词数（句子越长越绕），整句 / 段落数的是要翻译的文字本身。

const THINK_DEFAULT_PROFILE = { word: 'off', para: 'off', t1: 15, t2: 40, t3: 100 };

function glossProfileKey(id, model) {
  return `${id}|${model}`;
}

function glossThinkProfile(s, id, model) {
  const legacy = (s.thinking || {})[id];
  const base = legacy && legacy !== 'off' ? { word: legacy, para: legacy } : {};
  return { ...THINK_DEFAULT_PROFILE, ...base, ...((s.thinkProfiles || {})[glossProfileKey(id, model)] || {}) };
}

function glossWordCount(text) {
  return ((text || '').match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
}

function glossPickLevel(profile, mode, req) {
  const set = mode === 'word' ? profile.word : profile.para;
  if (set !== 'auto') return set || 'off';
  const n = glossWordCount(mode === 'word' ? req.sentence || req.selection : req.selection);
  if (n <= profile.t1) return 'off';
  if (n <= profile.t2) return 'low';
  if (n <= profile.t3) return 'medium';
  return 'high';
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
      // 不设 exclude，让思考过程传回来，小窗里可以展示
      return { reasoning: on ? { effort: level } : { effort: 'none' } };
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

// ---------- 成本估算 ----------

// DeepSeek 高峰时段：UTC 周一至周五 01:00–04:00、06:00–10:00（即北京时间 9–12 点、14–18 点）
// 官方规则里中国法定节假日全天算非高峰，这里不识别节假日，所以节假日的估算会偏高。
function glossIsPeak(t) {
  const d = new Date(t);
  const wd = d.getUTCDay();
  const h = d.getUTCHours();
  return wd >= 1 && wd <= 5 && ((h >= 1 && h < 4) || (h >= 6 && h < 10));
}

function glossCost(entry, pr) {
  if (!pr) return 0;
  const hit = entry.c || 0;
  const miss = Math.max(0, (entry.i || 0) - hit);
  let cost = (hit * pr.hit + miss * pr.miss + (entry.o || 0) * pr.out) / 1e6;
  if (pr.offpeak && !glossIsPeak(entry.t)) cost /= 2;
  return cost;
}

const CUR_SIGN = { USD: '$', CNY: '¥' };

function glossFmtMoney(n, cur) {
  const sign = CUR_SIGN[cur] || '';
  if (!n) return sign + '0';
  if (n < 0.01) return sign + n.toFixed(4);
  if (n < 1) return sign + n.toFixed(3);
  return sign + n.toFixed(2);
}

// costs: { USD: 0.01, CNY: 0.2 }
function glossFmtCosts(costs) {
  const parts = Object.entries(costs || {}).filter(([, v]) => v > 0).map(([c, v]) => glossFmtMoney(v, c));
  return parts.length ? parts.join(' + ') : '$0';
}
