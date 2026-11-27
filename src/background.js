// Gloss 后台：唯一读取 API Key、唯一调用模型接口的地方。
// 网页和 content script 都拿不到 Key，只能通过消息端口拿到翻译结果。

const DEFAULTS = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-flash',
};

const CAMBRIDGE_PREFIX = 'https://dictionary.cambridge.org/';

// ---------- 提示词 ----------

const WORD_SYSTEM = `你是英语阅读助手，帮助中国学生读懂网页上的英语。
用户会给出选中的词或短语，以及它所在的句子和段落。请根据语境作答。
严格按下面的格式输出，每项一行，不要输出其他任何内容，不要使用 Markdown：
LEMMA: 选中内容的词典原形（例：作形容词的 dedicated 仍是 dedicated；作动词过去式的 dedicated 是 dedicate；短语给出词典条目形式）
POS: 它在这句话里的词性，用 n. / v. / adj. / adv. / prep. / conj. / pron. / phr. 等缩写，必要时在括号里加简短说明
MEANING: 它在这句话里的中文意思，简洁，不超过一句话
COLLOCATION: 句中与它相关的固定搭配及中文意思，例如 be dedicated to doing 致力于做某事；没有就写 无
SENTENCE: 所在整句的通顺中文翻译`;

const SENTENCE_SYSTEM = `你是英语翻译助手。把用户选中的英文译成通顺、准确的中文。
结合给出的上下文处理指代、术语和语气。只输出译文，不要解释，不要使用 Markdown。`;

function buildMessages(req) {
  const ctx = [`网页标题：${req.title || '（无）'}`];
  if (req.paragraph && req.paragraph !== req.selection) ctx.push(`所在段落：${req.paragraph}`);
  if (req.mode === 'word') {
    if (req.sentence) ctx.push(`所在句子：${req.sentence}`);
    ctx.push(`选中：${req.selection}`);
    return [
      { role: 'system', content: WORD_SYSTEM },
      { role: 'user', content: ctx.join('\n') },
    ];
  }
  ctx.push(`需要翻译的内容：${req.selection}`);
  return [
    { role: 'system', content: SENTENCE_SYSTEM },
    { role: 'user', content: ctx.join('\n') },
  ];
}

// ---------- 工具函数 ----------

async function getSettings() {
  return chrome.storage.local.get(DEFAULTS);
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function errorMessage(status, bodyText) {
  switch (status) {
    case 401: return 'API Key 无效（401），请到设置页检查。';
    case 402: return '账户余额不足（402），请到 DeepSeek 平台充值。';
    case 429: return '请求太频繁（429），稍等一下再试。';
    case 500:
    case 503: return `DeepSeek 服务器繁忙（${status}），稍后再试。`;
    default: {
      let detail = '';
      try { detail = JSON.parse(bodyText)?.error?.message || ''; } catch { detail = bodyText || ''; }
      return `请求失败（${status}）${detail ? '：' + detail.slice(0, 120) : ''}`;
    }
  }
}

function safePost(port, msg) {
  try { port.postMessage(msg); } catch { /* 小窗已关闭 */ }
}

function apiUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, '') + '/chat/completions';
}

// ---------- 查询（流式） ----------

async function lookup(req, port, signal) {
  const s = await getSettings();
  if (!s.apiKey) {
    safePost(port, { type: 'error', code: 'no-key', message: '还没有填写 API Key。' });
    return;
  }

  const cacheKey = 'c_' + (await sha256(JSON.stringify([req.mode, s.model, req.selection, req.sentence])));
  const cached = (await chrome.storage.session.get(cacheKey))[cacheKey];
  if (cached) {
    safePost(port, { type: 'delta', text: cached });
    safePost(port, { type: 'done', cached: true });
    return;
  }

  const resp = await fetch(apiUrl(s.baseUrl), {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.apiKey}`,
    },
    body: JSON.stringify({
      model: s.model,
      messages: buildMessages(req),
      stream: true,
      max_tokens: req.mode === 'word' ? 400 : 1200,
      temperature: 0.3,
      thinking: { type: 'disabled' }, // DeepSeek 默认开启思考模式，划词必须关掉，否则很慢
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    safePost(port, { type: 'error', message: errorMessage(resp.status, body) });
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue; // 跳过空行和 keep-alive 注释
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      let json;
      try { json = JSON.parse(data); } catch { continue; }
      const text = json.choices?.[0]?.delta?.content;
      if (text) {
        full += text;
        safePost(port, { type: 'delta', text });
      }
    }
  }

  if (full) await chrome.storage.session.set({ [cacheKey]: full });
  safePost(port, { type: 'done', cached: false });
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
        safePost(port, { type: 'error', message: '网络错误：' + (e.message || e) });
      }
    }
  });
  port.onDisconnect.addListener(() => controller?.abort());
});

// ---------- 测试连接 ----------

async function testConnection() {
  const s = await getSettings();
  if (!s.apiKey) return { ok: false, message: '还没有填写 API Key。' };
  try {
    const resp = await fetch(apiUrl(s.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.apiKey}` },
      body: JSON.stringify({
        model: s.model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        thinking: { type: 'disabled' },
      }),
    });
    if (resp.ok) return { ok: true, message: `连接成功：${s.model}` };
    return { ok: false, message: errorMessage(resp.status, await resp.text().catch(() => '')) };
  } catch (e) {
    return { ok: false, message: '网络错误：' + (e.message || e) };
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
    testConnection().then(sendResponse);
    return true;
  }
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
