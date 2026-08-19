# Wordmark 交接文档（HANDOFF）

> 上一次对话的完整上下文。新对话开始时让 Claude 读本文件 + 下面列出的核心文件，即可恢复全部上下文。

## 这是什么项目

**Wordmark** —— 一个可上架 Edge Add-ons 商店的划词翻译书签插件。

核心流程：选中网页文字 → 右键建翻译书签 → 文字高亮（支持重叠嵌套、按词性自动配色）→ 点高亮弹卡片（中文词典释义 + 机器翻译）→ 右侧侧边栏笔记本统一管理 → 跨刷新持久化。

**技术栈**：TypeScript + Vite + @crxjs/vite-plugin（MV3 多入口构建），React（仅侧边栏 + 设置页），CSS Custom Highlight API（高亮，不碰 DOM）。

**环境**：Windows 11，node v24 / npm 11（未装 pnpm），开发目录 `C:\Users\16631\Desktop\wordmark`。MCP web 工具额度本月用尽，联网用内置 WebSearch/WebFetch（WebFetch 被网络策略挡，WebSearch 可用）。

## 开发命令

```bash
npm install
npm run build      # 产出 dist/，加载到 Edge
npm run typecheck  # 仅类型检查
npm run dev        # 开发 HMR
```

加载扩展：`edge://extensions` → 开发者模式 → 加载解压缩的扩展 → 选 `dist/`。
**重新加载时建议先删除再加载**（让 MV3 service worker 彻底重启，避免旧菜单/监听器残留）。

## 关键技术决策（别推翻）

1. **高亮用 CSS Custom Highlight API**：`CSS.highlights.set(name, new Highlight(range))`，对 Range 直接着色不碰 DOM，重叠天然支持，`Highlight.priority` 决定重叠区颜色。
   - **致命坑**：Highlight 伪元素**不可交互**（不能绑 click），卡片交互靠 `document` 级 click 监听 + `caretPositionFromPoint` 命中检测。
2. **持久化用文本锚点**：存容器 XPath（带 id 优先）+ 起止文本节点索引/偏移 + exactText + 前后 40 字 context。重建时精确匹配 → 失败则 prefix/suffix 模糊搜索 → 全失败标 stale（保留笔记，丢弃高亮）。
3. **XPath 必须含 `/html` 根**：否则 `document.evaluate` 绝对路径求值失败 → 刷新后高亮全消失。这是踩过的大坑，已验证修复。
4. **翻译路由**：单词查有道中文释义 + 任何文本都再跑一次机翻（给目标语言译文），并行 + 按 (textHash,src,tgt) 缓存。乐观更新：划词立即建书签+高亮，翻译异步回补。
5. **触发方式只留右键菜单**（已删掉 Alt/Shift/Ctrl+Shift+B）：键盘修饰键在浏览器有原生连选/菜单行为，导致"选不准一大片"。

## 已踩的坑（新对话别再踩）

| 坑 | 说明 |
|---|---|
| XPath 缺 `/html` | `document.evaluate` 绝对路径需从 html 起，缺根则求值失败，刷新后高亮全没。anchor.ts 的 buildXPath 已修。 |
| 键盘修饰键触发 | Alt/Shift 有浏览器原生行为（连选/菜单），不适合做标注触发键。已全部删掉，只留右键菜单。 |
| `data-wm-anchor` marker 机制 | 多书签场景 `querySelector([marker])` 会错乱定位到第一个匹配元素。已删除，纯靠 XPath+文本搜索。 |
| contextMenus 重复创建 | 更新扩展时同 id 菜单 create 会抛错。需 `removeAll` 再 create（install-handler.ts）。 |
| MV3 service worker 休眠 | SW ~30s 被杀，所有状态必须入 storage。重新加载扩展要重启 SW。 |
| `@crxjs` + Vite 版本 | 锁 vite@^5.4（>5.0.11 有构建回归 #874）。需装 `type-fest`、`@types/picomatch`、`@types/node`。 |
| `?raw` CSS 导入 | 需 `src/raw-imports.d.ts` 声明 `*.css?raw` 模块。 |

## 当前未解决的问题（上次对话改了但未实测）

用户反馈 4 个问题，已全部修复并 **build 通过**（见下「本次修复」）。`npm run build` 已重出 `dist/`，可直接加载。

**下次第一步**：让用户**重新加载扩展（不要删除再加！）**，然后逐项测试，反馈 DevTools console 的 `[Wordmark]` 日志。

### ⚠️ 测试铁律：绝不要「先删除扩展再加载」
删除扩展 = 清空该扩展的全部 `chrome.storage.local`（所有书签/设置/缓存）。上一轮反复出现「刷新后高亮和侧边栏全没了」，**头号真凶就是这个**——每次删了重加等于从零开始，看起来像"没持久化"，其实是被自己清空的。正确做法：`edge://extensions` → 点扩展卡片上的「重新加载 ↻」图标即可（MV3 会重启 service worker，storage 完整保留）。

### 本次修复（2026-08-14）
| 问题 | 根因 | 修复 |
|---|---|---|
| 点高亮卡片飞出屏幕/不在视口 | `.card` 用 `position:fixed`（相对视口），但 JS 给的坐标是文档绝对坐标（`rect+scrollX/Y`）。两者坐标系不匹配 → 卡片被定位到视口外几千 px。 | `popup-card.css` 改 `position:absolute`；host 挂到 `documentElement` 而非 body（避免宿主页给 body 设 relative 改变包含块）。卡片现贴书签文档坐标，**随滚动滑出窗口**正是 absolute 的天然行为。 |
| 刷新/重开页面高亮消失 | (a) DOM 时序：`document_idle` 时 SPA/懒加载目标文本还没出现，`rebuildRange` 静默失败；(b) 重建全程无日志，无法定位。 | `index.ts` 的 `rebuildAll` 加完整诊断日志 + 失败书签按 `[400,1200,3000,6000]ms` 递增重试；重试耗尽才标 stale。 |
| 刷新/重开侧边栏记录也没了 | (a) 只有 `activeTab` 权限——它是**手势期临时权限**，刷新/导航后失效，`tab.url` 变空 → 侧边栏查空；(b) 侧边栏只监听 `onActivated`，**没监听 `onUpdated`**，刷新页面不会重新拉取。 | `manifest.config.ts` 加 `tabs` 权限（稳定读 `tab.url`）；`App.tsx` 监听 `tabs.onUpdated`（complete/url/title 变化时刷新）。 |

### 测试时如何自检（看 console 日志）
刷新页面后打开页面 DevTools → Console，应看到：
- `[Wordmark] content loaded, highlight supported: true`（高亮 API 可用）
- `[Wordmark] rebuildAll: 从 storage 取到 N 个书签 @<url>`（**N=0 → storage 是空的，多半是删了扩展；N>0 正常**）
- `[Wordmark] rebuildAll: X 成功, Y 失败`（Y 个会重试；若重试仍失败会 `重试耗尽` 警告）
侧边栏 DevTools → Console 看 `[Wordmark][diag] sidepanel init` 的 `tabUrl` 是否为空（空=tabs 权限没生效/扩展没重载）。


## 2026-08-19 修复（语言检测 + 展示名）

| 问题 | 根因 | 修复 |
|---|---|---|
| 中日互译失灵（中英/中韩正常） | mymemory.ts resolveSrc 汉字正则排在假名前：日文必被嗅探成 zh；默认目标恰是 zh → `s===tgt` 原样返回。已实测 MyMemory 的 zh→ja、ja→zh 语言对本身没问题。 | 嗅探顺序改为 假名→ja、谚文→ko、西里尔→ru、汉字→zh（顺带补了韩文 auto 嗅探缺谚文规则、原先落到 en 的问题）。 |
| 语言名称显示原始码/原生名混杂 | LanguagePairSwitcher 渲染的是 `l.code` 而非 `l.label`；lang-codes 标签中英日韩混杂。 | lang-codes 全改英文全称（Simplified Chinese 等），侧边栏下拉改渲染 label；卡片/列表走 langLabel 自动生效。 |
| DeepL 中文目标必挂 | dlLang('zh-CN')→'ZHCN'，DeepL 不认。 | 改 `split('-')[0].toUpperCase()`，zh 系→ZH。 |
| 有道词典缺 host_permission（此前能通全靠对方 CORS 放行） | manifest host_permissions 仍是 dictionaryapi.dev。 | 换成 `https://dict.youdao.com/*`（jsonapi 与 dictvoice 发音同主机）；dictionary-api.ts 已确认零引用。 |
| 设置页词典文案仍写 dictionaryapi.dev | — | 改为有道；translation-router 头注释同步。 |
| 重叠区点击总命中先建的大书签（标 "linglong" 后再标 "ling"，点谁都弹前者卡片） | bookmarkIdAtPoint 按注册顺序取**首个**命中即返回。 | 收集全部命中取**文本最短**者（最内层最具体），同长并列取后注册的；点 "long" 区仍只有长条命中。 |
| 同一片段可无限重复标记 | CREATE_BOOKMARK 无判重。 | background 按锚点判重（同容器 XPath + 同首尾文本节点/偏移 + 同 exactText = 相同片段），拒绝并返回 duplicate+existingId；content 闪烁既有高亮提示。同文不同位置不算重复。 |

死代码清理（同日）：删除零引用的 `providers/dictionary-api.ts`、`messaging.broadcast()`、消息类型 BOOKMARK_CREATED/CREATE_RESULT、`hit-test.BookmarkLookup`、`constants.PROVIDERS.dictionaryApi`、`DEFAULT_HIGHLIGHT`、`DEFAULT_FLASH_COLOR`；**设置页「高亮颜色」区块整体移除**（settings.highlight 无渲染代码消费，配色实际由 POS_COLORS 按词性决定，该设置从未生效）；Settings.highlight 字段及 DEFAULT_SETTINGS/getSettings/testConnection 同步删除（旧 storage 里残留的 highlight 键无害，spread 会带上但类型已不含）。

已知限制（README「已知限制」节有写）：语音朗读仅英文单词（有道 dictvoice 只给词典词条发音 URL）；纯汉字日文 auto 检测仍判中文；LibreTranslate 自建 URL 的 host 权限问题。

typecheck + build 已过，dist/ 已重出。测试仍用「重新加载 ↻」，别删除重加。

## 核心文件（新对话读这几个就懂上下文）

| 文件 | 作用 | 易出 bug |
|---|---|---|
| `src/content/index.ts` | 内容脚本主入口：触发建书签、刷新重建、消息分发 | ⚠️ 高 |
| `src/content/anchor.ts` | 持久化锚点：computeAnchor / rebuildRange | ⚠️ 最高 |
| `src/content/popup-card.ts` | 弹出卡片：absolute 定位、渲染、删除 | ⚠️ 高 |
| `src/content/highlight-engine.ts` | 高亮注册/移除/闪烁，按词性配色 | 中 |
| `src/content/hit-test.ts` | caretPositionFromPoint 命中检测 | 中 |
| `src/background/index.ts` | 消息路由、翻译编排、右键菜单转发 | ⚠️ 高 |
| `src/background/translation-router.ts` | 词典+机翻路由、缓存、额度 | 中 |
| `src/background/install-handler.ts` | 默认设置、sidePanel、右键菜单注册 | 中 |
| `src/sidepanel/App.tsx` | 侧边栏笔记本，实时刷新 | ⚠️ 高 |
| `src/options/App.tsx` | 设置页：语言/provider/key/测试连接 | 低 |
| `src/shared/types.ts` | 全部数据模型 + 消息契约 | 参考 |
| `src/shared/storage.ts` | chrome.storage.local 封装 | 参考 |
| `src/shared/messaging.ts` | 类型安全消息收发（防回环） | 参考 |
| `src/providers/youdao.ts` | 有道中文词典（默认，免 key） | 参考 |
| `manifest.config.ts` | MV3 manifest 单一真相源 | 参考 |

## 翻译 API 现状

- **有道**（默认，已接入验证）：`https://dict.youdao.com/jsonapi?q=<word>`，中文释义在 `ec.word[0].trs[].tr[].l.i[]`（形如 `adj. 短暂的`），音标 `ukphone/usphone`，发音拼 `dict.youdao?audio=`。非官方接口，免 key。
- **dictionaryapi.dev**（旧，已被有道替代）：英文释义，代码保留在 `providers/dictionary-api.ts` 但未引用。
- **MyMemory**（默认机翻）：免 key ~5000 词/天，填邮箱提额。
- **DeepL / LibreTranslate**：用户填 key 才启用。
- 用户曾想要"对标牛津详细"——诚实结论：免费方案达不到，牛津/柯林斯需注册 key（3000~5000 次/月）。

## 已验证过的（命令行层面）

- SHA1 实现正确（对比 node crypto）
- 有道词典归一化正确（`ephemeral`→`adj. 短暂的` 等实测通过）
- MyMemory 机翻真实通过
- anchor round-trip 在 jsdom 跨全新 DOM 重建成功（XPath 含 `/html` 后）

## 完整设计方案

见 `C:\Users\16631\.claude\plans\edge-1-2-https-github-com-51750-mark-my-delightful-jellyfish.md`。
项目内还有 `README.md`（含端到端测试清单）和 `PRIVACY.md`（上架隐私政策）。
