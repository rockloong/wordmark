# Wordmark — 划词翻译书签

**Select text on any webpage → bookmark it with translation.** 一个可安装到 Edge / Chrome 的划词翻译书签扩展:选中文字 → 右键「添加为翻译书签」→ 高亮(支持重叠嵌套、按词性自动配色)→ 点击高亮弹卡片(音标/词性/释义/例句/机翻)→ 右侧侧边栏笔记本统一管理,跨刷新持久化。

<!-- TODO: 补一张主界面截图(GIF 更佳:选词 → 右键 → 高亮 → 点卡片) -->

## 功能特性

- **划词即书签**:任意网页选中文字,右键菜单一键创建,不打断阅读
- **词典 + 机翻混合**:英文单词查有道词典(中文释义、音标、双语例句),任何文本都再跑一次机器翻译拿目标语言译文,两者并行
- **非侵入式高亮**:基于 CSS Custom Highlight API,不修改页面 DOM;重叠嵌套天然支持,按词性自动配色(动词红、名词蓝、形容词琥珀…)
- **点击高亮弹卡片**:音标、词性、释义、例句、机翻、发音(英文单词);详细/简单两种模式可切换
- **侧边栏笔记本**:按页面归组管理全部书签,跳转定位、删除、一键清空;页面切换/刷新实时同步
- **跨刷新持久化**:文本锚点(XPath + 偏移 + 上下文)重建高亮,SPA/懒加载页面自动重试
- **重叠精准命中**:重叠区点击打开最内层(最短)书签的卡片;相同片段拒绝重复标记
- **翻译缓存**:按 (文本哈希, 源语言, 目标语言) 缓存 30 天,省 API 额度

## 安装(从源码)

扩展尚未上架商店,目前从源码构建安装。全程约 5 分钟。

### 环境要求

| 依赖 | 版本 | 检查命令 |
|---|---|---|
| Node.js | ≥ 18(开发用 24,推荐 20+) | `node -v` |
| npm | ≥ 9(随 Node 附带) | `npm -v` |
| 浏览器 | Edge 或 Chrome ≥ 114 | 地址栏输入 `edge://version` 查看 |

> 用 npm 即可,无需 pnpm / yarn。

### 第 1 步:获取源码

```bash
git clone https://github.com/<你的用户名>/wordmark.git
cd wordmark
```

(或直接下载 ZIP 解压后进入目录)

### 第 2 步:安装依赖

```bash
npm install
```

### 第 3 步:构建

```bash
npm run build
```

构建成功后末尾会输出 `✓ built in ...`,项目下出现 **`dist/`** 目录——这就是扩展本体。

### 第 4 步:加载到 Edge

1. 打开新标签页,地址栏输入 `edge://extensions` 回车
2. 打开页面左侧的**「开发人员模式」**开关
3. 点击**「加载解压缩的扩展」**按钮
4. 在文件选择框中选中项目的 **`dist/` 目录**(是 dist 本身,不是它的上级)→ 确定
5. 扩展列表出现 **Wordmark** 卡片即安装成功;建议点工具栏拼图图标 🧩 把 Wordmark 固定到工具栏

<details>
<summary>Chrome 用户点这里</summary>

Chrome 步骤相同:地址栏输入 `chrome://extensions`,右上角开启「开发者模式」,「加载已解压的扩展程序」选 `dist/`。需要 Chrome ≥ 114(sidePanel API)。
</details>

### 第 5 步:开始使用

1. 打开任意英文网页,选中一个单词(如 `ephemeral`)
2. **右键 → 点「添加为翻译书签」**
3. 该词出现高亮,稍候翻译回补;点击高亮处弹出释义卡片
4. 点工具栏 Wordmark 图标打开侧边栏笔记本,查看/跳转/删除本页全部书签

语言对默认 Auto Detect → Chinese,可在侧边栏顶部或设置页(`edge://extensions` → Wordmark → 扩展选项)修改;机翻默认 MyMemory(免费免 key)。

### 以后更新

```bash
git pull
npm install
npm run build
```

然后到 `edge://extensions` 点 Wordmark 卡片上的**「重新加载 ↻」图标**。

> ⚠️ **永远用 ↻ 重新加载,不要「删除」再重新加载。** 删除扩展会清空它的全部本地存储(书签/设置/缓存全没),症状像「持久化失效」,其实是数据被自己清掉了;↻ 同样会重启 service worker,数据完整保留。

## 开发

```bash
npm install
npm run dev        # 开发模式,HMR
npm run build      # 产出 dist/
npm run typecheck  # 仅类型检查
```

技术栈:TypeScript + Vite(`vite@^5.4`)+ [@crxjs/vite-plugin](https://github.com/crxjs/vite-plugin) v2(MV3 多入口)、React(仅侧边栏 + 设置页)、CSS Custom Highlight API。`manifest.config.ts` 是 MV3 manifest 的单一真相源。

## 使用说明

| 操作 | 结果 |
|---|---|
| 选中文字 → 右键「添加为翻译书签」 | 立即高亮(乐观更新),翻译异步回补到卡片 |
| 点击高亮 | 弹出卡片;重叠区打开**最内层**书签的卡片 |
| 重复标记完全相同的片段 | 拒绝创建,既有高亮闪烁提示 |
| 卡片「切换简单/详细」 | 精简/完整释义切换 |
| 卡片 🗑 | 删除该书签(高亮+侧边栏同步消失) |
| 侧边栏点列表项 | 页面滚动到该高亮并闪烁 |
| 侧边栏切换语言对 | 仅影响**下次**新建的书签 |
| 侧边栏「一键清空」 | 清除当前页全部书签 |

## 端到端测试清单

1. 设置页(扩展选项):源 `auto`、目标 `zh`、模式 `detailed`、provider `MyMemory`;「测试连接」→ `✓ 连接成功:你好`
2. 选一个英文单词 → 右键 → 出现按词性配色的高亮
3. 点高亮 → 卡片含音标/词性/释义/例句/机翻;卡片贴词旁、随页面滚动
4. 切换简单/详细
5. 标一段话,再标其中一词 → 两者高亮重叠可见;点重叠区弹**短词**卡片,点长句独有区弹长句卡片
6. 重复标记完全相同片段 → 不新建,既有高亮闪烁
7. 选整句 → 卡片只有机翻
8. 刷新页面 → 高亮重现(SPA/懒加载由 `[400,1200,3000,6000]ms` 递增重试兜底)
9. 侧边栏列表与当前页一致;刷新/切页自动更新
10. 点列表项 → 滚动定位 + 闪烁
11. 点 ✕ → 高亮 + 列表项消失
12. 一键清空
13. 切语言对(下拉为英文全称,如 Japanese)→ 仅影响下次新建
14. 选**日文**文本(Auto Detect→Chinese)→ 应出中文机翻(嗅探顺序回归项);韩文同理
15. (可选)DevTools 改书签容器文本 → 刷新 → 标「已失效」,笔记保留

## 调试

刷新页面后,页面 DevTools → Console 应看到:

- `[Wordmark] content loaded, highlight supported: true` — 高亮 API 可用
- `[Wordmark] rebuildAll: 从 storage 取到 N 个书签 @<url>` — **N=0 → storage 是空的,多半是扩展被删除重载过**;N>0 正常
- `[Wordmark] rebuildAll: X 成功, Y 失败` — 失败项递增重试,耗尽出 `重试耗尽` 警告并标 stale(保留笔记、丢高亮)

侧边栏 DevTools → Console 看 `[Wordmark][diag] sidepanel init` 的 `tabUrl`:为空说明 `tabs` 权限没生效或扩展没重载。

## 架构

```
src/
  background/     service worker:设置、sidePanel、右键菜单、消息路由、翻译编排
  content/        内容脚本:选词捕获、锚点、高亮引擎、命中检测、卡片
  sidepanel/      侧边栏笔记本(React)
  options/        设置页(React)
  providers/      翻译 provider:youdao(默认词典)/ mymemory / deepl / libretranslate
  shared/         类型、存储、消息、id/hash、常量、语言码
```

### 关键设计

- **高亮用 CSS Custom Highlight API**:`CSS.highlights.set(name, new Highlight(range))`,对 Range 直接着色,不包裹 DOM,重叠天然支持,`Highlight.priority` 决定重叠区颜色。代价:伪元素不可交互,卡片靠 `document` 级 click + `caretPositionFromPoint` 命中检测;重叠区点击取文本最短的书签(最内层),同长取最新注册的。
- **持久化用文本锚点**:存容器 XPath(必须含 `/html` 根)+ 文本节点索引/偏移 + exactText + 前后 context;重建时精确匹配 → 失败则 prefix/suffix 模糊搜索 → 全失败标 stale(保留笔记,丢弃高亮)。SPA/懒加载靠递增重试等 DOM。
- **卡片 absolute + 文档坐标**:host 挂 `documentElement`(防宿主页给 body 设 relative 改包含块),坐标 `rect + scrollX/Y`,随页面滚动。
- **翻译乐观更新**:先建书签+高亮,后台词典+机翻并行回补;按 (textHash, src, tgt) 缓存;MyMemory 额度耗尽冷却 1 小时。
- **auto 嗅探顺序敏感**:假名→ja、谚文→ko、西里尔→ru、**汉字→zh 必须垫底**(日文几乎必含汉字,先查会把日文误判成中文,默认目标 zh 时直接原样返回)。
- **片段去重**:同容器 XPath + 同首尾节点/偏移 + 同文本 = 相同片段,CREATE_BOOKMARK 拒绝;同文不同位置不算重复。
- **侧边栏实时刷新**:`tabs.onActivated` + `tabs.onUpdated` 双监听;manifest 带 `tabs` 权限稳定读 `tab.url`(`activeTab` 仅手势期有效)。
- **MV3 service worker ~30s 休眠**:所有状态入 `chrome.storage`,不依赖内存。

## 翻译来源与额度

| 来源 | 用途 | 额度 |
|---|---|---|
| 有道词典(默认) | 英文单词中文释义/音标/例句/发音 | 免 key,非官方接口 |
| MyMemory(默认机翻) | 任意语言对机翻 | 免费 ~5000 词/天;设置页填邮箱提额到 ~50000 |
| DeepL / LibreTranslate | 可选机翻 | 用户自有 key / 自建实例 |

想要牛津/柯林斯级别详细释义:免费方案达不到,需注册词典 API key(~3000-5000 次/月)。

## 已知限制

- **语音朗读只有英文单词可用**:🔊 发音走有道词典 dictvoice 接口,只有词典词条才带发音 URL——是词典 API 的能力边界,不是 bug;其他语言文本、整句机翻没有语音(卡片也不显示发音按钮)。
- 纯汉字(不含假名)的日文片段 auto 检测仍判中文,手动把源语言切到 Japanese 即可。
- LibreTranslate 自建实例 URL 无法预声明 host 权限,跨源请求可能被拦(需在 manifest 补 host_permission)。

## 隐私

见 [PRIVACY.md](./PRIVACY.md)。所有书签/设置仅存于浏览器本地(`chrome.storage.local`),不上传任何服务器;翻译请求直连所选 provider。

## 相关文件

- [PRIVACY.md](./PRIVACY.md) — 上架 Edge Add-ons 用隐私政策
- `HANDOFF.md` — 开发交接文档(技术决策、已踩的坑、修复历史)
