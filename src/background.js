// Gloss 后台：唯一读取 API Key、唯一调用模型接口的地方，同时负责记录用量。
importScripts('shared.js');

const CAMBRIDGE_PREFIX = 'https://dictionary.cambridge.org/';

// ---------- 提示词 ----------

const WORD_SYSTEM = `你是英语阅读助手，帮助中国学生读懂网页上的英语。
用户会给出选中的词或短语，以及它所在的句子和段落。请根据语境作答。
严格按下面的格式输出，每项一行，不要输出其他任何内容，不要使用 Markdown：
LEMMA: 选中内容的词典原形（例：作形容词的 dedicated 仍是 dedicated；作动词过去式的 dedicated 是 dedicate；短语给出词典条目形式）
POS: 它在这句话里的词性，用 n. / v. / adj. / adv. / prep. / conj. / pron. / phr. 等缩写，必要时在括号里加简短说明
MEANING: 它在这句话里的中文意思，简洁，不超过一句话
COLLOCATION: 句中与它相关的固定搭配及中文意思，例如 be dedicated to doing 致力于做某事；没有就写 无`;

const SENTENCE_SYSTEM = `你是英语翻译助手。把用户选中的英文译成通顺、准确的中文。
结合给出的上下文处理指代、术语和语气。只输出译文，不要解释，不要使用 Markdown。`;

const PARA_SYSTEM = `你是英语翻译助手。把用户给出的“需要翻译的段落”译成通顺、准确的中文。
“上一段”只用来理解指代和术语，不要翻译它。只输出这一段的译文，不要解释，不要使用 Markdown。`;

function buildMessages(req) {
  const ctx = [`网页标题：${req.title || '（无）'}`];
  if (req.mode === 'paragraph') {
    if (req.prev) ctx.push(`上一段：${req.prev}`);
    ctx.push(`需要翻译的段落：${req.selection}`);
    return [{ role: 'system', content: PARA_SYSTEM }, { role: 'user', content: ctx.join('\n') }];
  }
  if (req.paragraph && req.paragraph !== req.selection) ctx.push(`所在段落：${req.paragraph}`);
  if (req.mode === 'word') {
    if (req.sentence) ctx.push(`所在句子：${req.sentence}`);
    ctx.push(`选中：${req.selection}`);
    return [{ role: 'system', content: WORD_SYSTEM }, { role: 'user', content: ctx.join('\n') }];
  }
  ctx.push(`需要翻译的内容：${req.selection}`);
  return [{ role: 'system', content: SENTENCE_SYSTEM }, { role: 'user', content: ctx.join('\n') }];
}

const MAX_TOKENS = { word: 300, sentence: 1200, paragraph: 1600 };

// ---------- 工具函数 ----------

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function errorMessage(status, bodyText, providerName) {
  switch (status) {
    case 401: return `API Key 无效（401），请到设置里检查 ${providerName} 的 Key。`;
    case 402: return `账户余额不足（402），请到 ${providerName} 平台充值。`;
    case 429: return '请求太频繁（429），稍等一下再试。';
    case 500:
    case 503: return `${providerName} 服务器繁忙（${status}），稍后再试。`;
    default: {
      let detail = '';
      try { detail = JSON.parse(bodyText)?.error?.message || ''; } catch { detail = bodyText || ''; }
      return `请求失败（${status}）${detail ? '：' + detail.slice(0, 120) : ''}`;
    }
  }
}

function netError(e) {
  const m = String(e && e.message || e);
  if (/Failed to fetch|NetworkError|ERR_/i.test(m)) return '连不上服务器，请检查网络或代理设置。';
  return '网络错误：' + m;
}

function safePost(port, msg) {
  try { port.postMessage(msg); } catch { /* 小窗已关闭 */ }
}

// ---------- 用量记录（串行写入，避免并发覆盖） ----------

let usageChain = Promise.resolve();

function recordUsage(kind, entry, pricing) {
  usageChain = usageChain.then(async () => {
    const { usageLog = [], usageDaily = {} } = await chrome.storage.local.get(['usageLog', 'usageDaily']);
    const key = glossDayKey(entry.t);
    const day = { calls: 0, i: 0, o: 0, c: 0, ms: 0, hits: 0, err: 0, ...(usageDaily[key] || {}) };
    if (kind === 'call') {
      day.calls += 1; day.i += entry.i; day.o += entry.o; day.c += entry.c; day.ms += entry.ms;
      if (pricing) {
        entry.$ = glossCost(entry, pricing);
        entry.cur = pricing.cur;
        day.cost = { ...(day.cost || {}) };
        day.cost[pricing.cur] = (day.cost[pricing.cur] || 0) + entry.$;
      }
      usageLog.push(entry);
      if (usageLog.length > 2000) usageLog.splice(0, usageLog.length - 2000);
    } else if (kind === 'hit') {
      day.hits += 1;
    } else if (kind === 'error') {
      day.err += 1;
    }
    usageDaily[key] = day;
    const cutoff = glossDayKey(Date.now() - 180 * 864e5);
    for (const k of Object.keys(usageDaily)) if (k < cutoff) delete usageDaily[k];
    await chrome.storage.local.set({ usageLog, usageDaily });
  }).catch(() => {});
}

// ---------- 查询（流式） ----------

async function lookup(req, port, signal) {
  const s = await glossLoad();
  const a = glossActive(s);
  if (!a) {
    safePost(port, { type: 'error', code: 'no-key', message: '还没有添加模型服务。' });
    return;
  }
  if (!a.key) {
    safePost(port, { type: 'error', code: 'no-key', message: `还没有填写 ${a.name} 的 API Key。` });
    return;
  }
  if (!a.baseUrl || !a.model) {
    safePost(port, { type: 'error', code: 'no-key', message: '接口地址或模型名还没填好。' });
    return;
  }

  const cacheKey = 'c_' + (await sha256(JSON.stringify([req.mode, a.id, a.model, req.selection, req.sentence || '', req.prev || ''])));
  const cached = (await chrome.storage.session.get(cacheKey))[cacheKey];
  if (cached) {
    safePost(port, { type: 'delta', text: cached });
    safePost(port, { type: 'done', cached: true, provider: a.name, model: a.model });
    recordUsage('hit', { t: Date.now() });
    return;
  }

  const t0 = Date.now();
  if (a.think !== 'off') safePost(port, { type: 'thinking' });
  let resp;
  try {
    resp = await fetch(a.baseUrl + '/chat/completions', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.key}` },
      body: JSON.stringify({
        model: a.model,
        messages: buildMessages(req),
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: (MAX_TOKENS[req.mode] || 1200) + (a.think !== 'off' ? THINK_EXTRA_TOKENS[a.think] || 0 : 0),
        temperature: 0.3,
        ...a.extra,
      }),
    });
  } catch (e) {
    if (e.name !== 'AbortError') recordUsage('error', { t: Date.now() });
    throw e;
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    recordUsage('error', { t: Date.now() });
    safePost(port, { type: 'error', message: errorMessage(resp.status, body, a.name) });
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let usage = null;
  let firstMs = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue; // 空行、keep-alive 注释
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let json;
        try { json = JSON.parse(data); } catch { continue; }
        if (json.usage) usage = json.usage;
        const text = json.choices?.[0]?.delta?.content;
        if (text) {
          if (!firstMs) firstMs = Date.now() - t0;
          full += text;
          safePost(port, { type: 'delta', text });
        }
      }
    }
  } finally {
    // 中途关掉小窗也照样记账：已经生成的部分同样计费
    recordUsage('call', {
      t: t0,
      p: a.id,
      m: a.model,
      k: req.mode,
      i: usage?.prompt_tokens || 0,
      o: usage?.completion_tokens || 0,
      c: usage?.prompt_tokens_details?.cached_tokens ?? usage?.prompt_cache_hit_tokens ?? 0,
      r: usage?.completion_tokens_details?.reasoning_tokens || 0,
      ms: Date.now() - t0,
      f: firstMs,
      nu: usage ? 0 : 1, // 1 = 服务商没有返回用量（多半是中途取消）
    }, s.pricing[a.id]);
  }

  if (full) await chrome.storage.session.set({ [cacheKey]: full });
  safePost(port, { type: 'done', cached: false, provider: a.name, model: a.model });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'gloss') return;
  let controller = null;
  port.onMessage.addListener(async (req) => {
    controller?.abort();
    controller = new AbortController();
    try {
      await lookup(req, port, controller.signal);
    } catch (e) {
      if (e.name !== 'AbortError') {
        safePost(port, { type: 'error', message: netError(e) });
      }
    }
  });
  port.onDisconnect.addListener(() => controller?.abort());
});

// ---------- 测试连接 ----------

async function testConnection(providerId) {
  const s = await glossLoad();
  if (providerId) s.provider = providerId;
  const a = glossActive(s);
  if (!a) return { ok: false, message: '还没有添加模型服务。' };
  if (!a.key) return { ok: false, message: '还没有填写 API Key。' };
  if (!a.baseUrl || !a.model) return { ok: false, message: '接口地址或模型名还没填好。' };
  const t0 = Date.now();
  try {
    const resp = await fetch(a.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.key}` },
      body: JSON.stringify({
        model: a.model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: a.think !== 'off' ? 64 : 1,
        ...a.extra,
      }),
    });
    if (resp.ok) return { ok: true, message: `连接成功 · ${a.model} · ${Date.now() - t0} ms${a.think !== 'off' ? ' · 思考已开启' : ''}` };
    return { ok: false, message: errorMessage(resp.status, await resp.text().catch(() => ''), a.name) };
  } catch (e) {
    return { ok: false, message: netError(e) };
  }
}

// ---------- 其他消息 ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'open-tab') {
    // 只允许打开剑桥词典，防止被滥用来打开任意网址
    if (typeof msg.url === 'string' && msg.url.startsWith(CAMBRIDGE_PREFIX)) {
      chrome.tabs.create({
        url: msg.url,
        active: msg.active !== false,
        index: sender.tab ? sender.tab.index + 1 : undefined,
      });
    }
  } else if (msg?.type === 'open-options') {
    chrome.runtime.openOptionsPage();
  } else if (msg?.type === 'test') {
    testConnection(msg.provider).then(sendResponse);
    return true;
  }
});

// 0.1.0 → 0.2.0：把旧的单个 Key 迁移到 DeepSeek 名下
chrome.runtime.onInstalled.addListener(async () => {
  const raw = await chrome.storage.local.get(['apiKey', 'keys', 'model']);
  if (raw.apiKey) {
    const keys = { ...GLOSS_DEFAULTS.keys, ...(raw.keys || {}) };
    if (!keys.deepseek) keys.deepseek = raw.apiKey;
    await chrome.storage.local.set({ keys, added: ['deepseek'], provider: 'deepseek' });
    await chrome.storage.local.remove(['apiKey', 'model', 'baseUrl']);
  }
});
