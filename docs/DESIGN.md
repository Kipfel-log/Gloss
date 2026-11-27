# 设计文档

## 一、架构（Chrome 插件，Manifest V3）

| 部分 | 职责 |
|---|---|
| **content script**（注入网页） | 检测选中文字，抓取上下文；在旁边弹出小窗（用 Shadow DOM 隔离样式，不受网页影响）；段落/全页翻译时在原文下方插入译文 |
| **background**（service worker） | 调用模型 API，把流式结果通过消息端口传给小窗。放在后台是为了避开网页跨域限制，API Key 也只保存在这里，不暴露给网页 |
| **小设置弹窗**（popup） | 点工具栏图标弹出：切换服务商、常用开关、今日用量 |
| **完整设置页**（options page） | 服务商卡片（Key / 模型 / 测试连接）、划词与段落设置、译文样式预览、用量统计 |
| **shared.js** | 服务商预设、默认设置，后台和设置页共用（content script 不加载，不接触 Key） |

数据流：

```
选中文字 → content script 抓取上下文
        → 发消息给 background
        → background 调用 DeepSeek（流式）
        → 逐段回传 → 小窗实时显示
```

## 二、模型

v0.2.0 起支持多家服务商（均为 OpenAI 兼容格式，地址与参数来自各家官方文档）：

| 服务商 | 接口地址 | 预设模型 | 关闭思考 |
|---|---|---|---|
| DeepSeek | `https://api.deepseek.com` | `deepseek-flash` | `"thinking": {"type": "disabled"}` |
| 千问（阿里云百炼，北京） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen3.8-flash` 等 | `"enable_thinking": false` |
| 硅基流动 | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V4-Flash` | `"enable_thinking": false` |
| OpenRouter | `https://openrouter.ai/api/v1` | `baidu/ernie-5.5-flash-preview:free` 等免费模型 | `"reasoning": {"effort": "none"}` |
| 自定义 | 用户填写（保存时申请该网址权限） | 用户填写 | 无 |

**思考强度**：v1.3.0 起按“服务商 + 模型”分别保存，划词和整句/段落各一档，可选 关闭 / 低 / 中 / 高 / 自动（默认关闭）。“自动”按英文单词数匹配规则列表（v1.8.0 起）：从短到长依次匹配“不超过 N 词 → 某档”，都不满足时用“更长的”那一档；规则可加可删。划词数所在句子，整句/段落数要翻译的内容；默认 ≤15 关闭、≤40 低、≤100 中、更长用高。各档对应参数：

| 服务商 | 低 / 中 / 高 |
|---|---|
| DeepSeek | `thinking: enabled` + `reasoning_effort` = low / high / max |
| 千问、硅基流动 | `enable_thinking: true` + `thinking_budget` = 512 / 2048 / 8192 |
| OpenRouter | `reasoning: {effort: low/medium/high}`（v1.2.0 起不再 exclude，用于展示思考过程） |
| 自定义 | `reasoning_effort` = low / medium / high |

开启思考时 max_tokens 额外放宽（+1500 / +4000 / +10000），避免思考用完额度后没有输出。

**不支持 OpenCode 免费模型**：OpenCode 官方文档说明免费模型只能在 OpenCode 客户端里使用。

每家都可以选"自定义模型名"。以下为 v0.1.0 时的 DeepSeek 说明：

- 服务商：**DeepSeek**
- 接口格式：OpenAI 兼容，Base URL `https://api.deepseek.com`
- 默认模型：**`deepseek-flash`**（划词、段落翻译都先用它；便宜、响应快）
- 可选模型：`deepseek-v4-pro`（更强但更贵，设置页可切换）
- **必须关闭思考模式**：DeepSeek 模型默认开启思考模式，会先推理再输出，划词时明显变慢
- 接口按 OpenAI 兼容格式统一封装，以后换其他服务商只需改地址和模型名

价格会变动，以官方页面为准：https://api-docs.deepseek.com/quick_start/pricing/
（注：官方区分高峰/非高峰时段，非高峰价为高峰价一半。）

### API Key 安全

- Key 只在设置页填写，保存在 `chrome.storage.local`
- 只由 background 读取和使用；content script 的代码不读取它，网页（与插件隔离）拿不到
- 不提交到仓库，不发在聊天里

## 三、划词：发送什么、返回什么

**发送给模型：**

- 选中的文字
- 所在句子
- 所在段落（过长时截取选中位置附近）
- 网页标题

**整句翻译单独请求（v0.3.0）：** 划词请求只返回 LEMMA / POS / MEANING / COLLOCATION；整句翻译另发一个"句子"请求，按句子文本缓存。关闭"显示整句翻译"时，点了才请求。

**小窗显示：**

1. 语境释义（这个词在这句话里的意思）
2. 词性（按这句话里的用法判断）
3. 所在整句的翻译
4. 固定搭配（如有，如 *be dedicated to doing*）

**由模型一并返回、但不直接显示：**

- 词的原形（用于剑桥跳转，如 `dedicated` → 视语境决定是否跳 `dedicate`）

**不交给 AI 的内容：**

- **音标**：大模型偶尔会编错音标，第一阶段不显示；以后如需要，接词典接口获取

**提示词原则：** 尽量短、限制输出长度，不让模型长篇大论。

## 四、剑桥词典跳转

- 小窗底部按钮"剑桥词典 ↗"，新标签页打开；支持快捷键
- 只对单词和短语显示，整句不显示
- 设置页开关"查词时自动打开剑桥"，**默认关闭**（每次都弹新标签会很烦）
- 链接格式（**待实测确认**，开发时未能在官方页面验证）：
  `https://dictionary.cambridge.org/dictionary/english-chinese-simplified/<单词>`

## 五、用量记录

- 请求时带 `stream_options: {include_usage: true}`，从最后一个数据块读取 `usage`
- 每次调用记录：时间、服务商、模型、类型、输入/输出 token、缓存命中 token、首字耗时、总耗时
- 按天汇总（保留 180 天），另计本地缓存命中次数和失败次数；逐条记录保留最近 2000 条
- 中途关闭小窗也会记账（已生成部分同样计费）；服务商未返回用量时标记为"—"

## 六、限流后备（v1.7.0）

- 设置按“服务商|模型”保存：`fallbacks[key] = { on, to }`
- 主服务商返回 429 且开了后备、后备已填好 Key 时，同一请求改用后备服务商重试一次；后备用它自己的模型、思考方案和价格
- 前端收到 `fallback` 消息时立即提示“XX 限流，改用 YY…”，完成后保留“XX 限流 → YY”的标注
- 缓存仍按主服务商的键保存，下次同样内容直接命中

## 六点五、翻译缓存

- 存在 `chrome.storage.session`：只在内存里，关闭浏览器、重新加载或更新插件时自动清空（官方上限 10 MB）
- 最多保留最近 300 条，超出删最旧的；万一写满，清空后重写
- 缓存键：类型 + 服务商 + 模型 + 选中内容 + 所在句子（段落翻译另加上一段）；缓存内容含思考过程

## 七、速度策略

- 流式输出
- 使用小模型 `deepseek-flash`，关闭思考模式
- 结果缓存（按"选中内容 + 句子"做 key）
- 提示词短、限制最大输出长度

## 八、界面风格

参考 Anthropic 官网的视觉感觉，**只借鉴风格，不使用其 logo 和字标**。

- 米白色暖底（不用纯白）
- 标题用衬线字体，正文用无衬线字体
- 点缀色：陶土橙，只用于按钮和高亮，用量很少
- 大量留白、圆角、细边框；不用花哨的渐变和重阴影
- 支持深色模式

## 九、已定决策

| 决策 | 结论 |
|---|---|
| 平台 | 只做电脑端 Chrome |
| 模型 | 默认 DeepSeek `deepseek-flash`；另支持千问、硅基流动、自定义；均关闭思考模式 |
| 词性 | 交给大模型按语境判断；剑桥跳转作为兜底核对 |
| 音标 | 不由 AI 生成 |
| 剑桥跳转 | 按钮 + 快捷键；自动打开默认关闭 |
| 界面 | 仿 Anthropic 风格，支持深色模式 |
| 协作 | Claude 主体开发，GPT 代码审查 |
| 名称 | Gloss |
