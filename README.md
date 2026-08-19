# Wordmark — 划词翻译书签

选中网页上的任意文字 → 右键「添加为翻译书签」→ 高亮(支持重叠嵌套、按词性自动配色)→ 点击高亮弹卡片(音标/词性/释义/例句/机翻)→ 右侧侧边栏笔记本统一管理。

翻译来自**有道词典(中文释义,免 key)+ 机器翻译**混合:单词查词典释义,任意文本都再跑一次机翻拿目标语言译文,两者并行返回;机翻支持任意语言对,卡片内详细/简单两种模式可切换。书签跨刷新持久化。

## 技术栈

- TypeScript + Vite(`vite@^5.4`)
- [@crxjs/vite-plugin](https://github.com/crxjs/vite-plugin) v2(MV3 多入口构建)
- React(仅侧边栏 + 设置页)
- CSS Custom Highlight API(高亮,不碰 DOM,重叠天然支持)
- Edge / Chromium 114+(sidePanel API 地板)

## 开发

```bash
npm install
npm run dev      # 开发,HMR
npm run build    # 产出 dist/
npm run typecheck
```

### 在 Edge 中加载

1. `npm run build`
2. 打开 `edge://extensions`,开启右上角「开发人员模式」
3. 「加载解压缩的扩展」→ 选择项目下的 `dist/` 目录
4. 工具栏点击 Wordmark 图标 → 打开右侧侧边栏笔记本

改代码后重新加载:**点扩展卡片上的「重新加载 ↻」图标,绝不要「移除再加载」**。移除扩展会清空它的全部 `chrome.storage.local`——书签/设置/缓存全没,症状是「刷新后高亮和侧边栏全没了」,其实是被自己清空的。↻ 同样会重启 MV3 service worker,storage 完整保留。

## 当前状态(2026-08-19)

功能全部实现,`npm run typecheck` + `npm run build` 通过,`dist/` 可直接加载。近期改动(均待浏览器实测,逐项过下方清单):

- **有道词典正式接线**:词典释义走有道(免 key,中文释义),manifest 补上 `dict.youdao.com` host 权限;残留的 dictionaryapi.dev 文案/死代码已清理
- **中日互译修复**:auto 语言嗅探顺序改为 假名→谚文→西里尔→汉字(原先日文必被误判成中文,导致翻译失灵);韩文 auto 检测补齐
- **语言名统一英文全称**(Simplified Chinese 等);侧边栏下拉此前渲染的是原始码(zh/ja),已修
- **DeepL 修复**:中文目标码 `zh-CN` 曾被拼成非法的 `ZHCN`,改为取主语言码
- **重叠命中 + 去重**:重叠区点击取文本最短的书签;相同片段(同容器+同首尾偏移+同文本)拒绝重复标记,闪烁既有高亮提示
- **死代码清理**:删除未引用的 `dictionary-api.ts`、`broadcast()`、未使用的消息类型、无效的设置页「高亮颜色」区块(高亮颜色实际由词性决定,该设置从未生效)

## 端到端测试清单

1. 打开设置页(edge://extensions → Wordmark → 扩展选项):
   - 源语言 `auto`、目标 `zh`、模式 `detailed`、provider `MyMemory`
   - 点「测试连接」→ 应显示 `✓ 连接成功:你好`
2. 打开任意英文文章,选中一个单词(如 `ephemeral`)→ **右键 → 点「添加为翻译书签」** → 该词出现高亮(按词性配色)
3. 点击高亮处 → 弹出卡片:音标、词性、释义、例句、机翻、provider;卡片贴书签位置,**随页面滚动一起移动**(文档坐标 + absolute 定位)
4. 卡片点「切换简单」→ 只留简短释义;再切回详细
5. 选中一段话 → 高亮;再选中其中某个词 → **两者都高亮,重叠区可见**;点击重叠区内层短词 → 弹**短词**卡片,点击仅长句覆盖的区域 → 弹长句卡片
6. 再次选中与已标**完全相同**的片段 → 右键 → 不新建书签,既有高亮闪烁提示(侧边栏数量不变)
7. 选整句 → 卡片只有机翻(无词典)
8. **刷新页面** → 所有高亮重现(锚点重建);SPA/懒加载页面首轮可能失败,由 `[400,1200,3000,6000]ms` 递增重试兜底
9. 打开侧边栏 → 列表匹配当前页书签;**刷新/切换页面后列表自动更新**
10. 点列表项 → 页面滚动到该高亮并闪烁
11. 点列表项 ✕ → 高亮 + 列表项消失
12. 「一键清空」→ 当前页所有书签清除
13. 侧边栏切换语言对(下拉显示英文全称,如 Japanese)→ 仅影响**下次**新建的书签
14. 选中一段**日文**文本(语言对 Auto Detect→Chinese)→ 卡片应出中文机翻(验证嗅探顺序,曾是中日互译失灵的根因);再试一段韩文
15. (可选)DevTools 改动书签所在容器的文本 → 刷新 → 该书签标「已失效」,笔记文本保留

## 调试

刷新页面后,页面 DevTools → Console 应看到:

- `[Wordmark] content loaded, highlight supported: true` — 高亮 API 可用
- `[Wordmark] rebuildAll: 从 storage 取到 N 个书签 @<url>` — **N=0 → storage 是空的,多半是扩展被移除重载过**;N>0 正常
- `[Wordmark] rebuildAll: X 成功, Y 失败` — 失败的会递增重试;重试仍失败则出 `重试耗尽` 警告并标 stale(保留笔记、丢高亮)

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

- **高亮用 CSS Custom Highlight API**:`CSS.highlights.set(name, new Highlight(range))`,对 Range 直接着色,不包裹 DOM,重叠天然支持,`Highlight.priority` 决定重叠区颜色。代价:伪元素不可交互,卡片靠 `document` 级 click + `caretPositionFromPoint` 命中检测;**重叠区点击取文本最短的书签**(最内层,如 "linglong" 里标了 "ling",点 "ling" 弹 "ling" 的卡片,点 "long" 弹长条的),同长并列取最新注册的。
- **持久化用文本锚点**:存容器 XPath(必须含 `/html` 根,否则 `document.evaluate` 绝对路径求值失败,刷新后高亮全没)+ 文本节点索引/偏移 + exactText + 前后 context;重建时精确匹配 → 失败则 prefix/suffix 模糊搜索 → 全失败标 stale(保留笔记,丢弃高亮)。SPA/懒加载页面靠递增重试等 DOM 长出来。
- **卡片用 absolute + 文档坐标**:host 挂 `documentElement` 而非 body(避免宿主页给 body 设 relative 改变包含块),坐标用 `rect + scrollX/Y`,与高亮同一坐标系,随页面滚动滑出窗口是天然行为。
- **片段去重**:同一片段 = 同容器 XPath + 同首尾文本节点/偏移 + 同文本;background 的 CREATE_BOOKMARK 判重拒绝,内容脚本闪烁既有高亮作提示。同文不同位置(如两处 "ling")不算重复,仍可分别标记。
- **翻译乐观更新**:划词立即建书签+高亮(translation 空),后台异步翻译后回补 BOOKMARK_UPDATED。单词查有道中文释义 + 任意文本都再跑一次机翻,并行,按 (textHash, src, tgt) 缓存;MyMemory 额度耗尽后 1 小时冷却。
- **auto 源语言嗅探顺序敏感**(mymemory.ts resolveSrc):假名→ja、谚文→ko、西里尔→ru、**汉字→zh 必须排最后**——日文几乎必含汉字,先查汉字会把日文误判成中文;叠加默认目标 zh 会触发 `s===tgt` 原样返回,症状是「中日互译失灵」。语言名称在各 UI 统一英文全称(Simplified Chinese 等),`langLabel()` 单一出处。
- **侧边栏实时刷新**:监听 `tabs.onActivated` **和** `tabs.onUpdated`(刷新/导航后重新拉取);manifest 带 `tabs` 权限稳定读 `tab.url`(`activeTab` 仅手势期临时有效,刷新后失效)。
- **触发只留右键菜单**:键盘修饰键(Alt/Shift 等)有浏览器原生连选/菜单行为,「选不准一大片」,已全部移除。菜单 `removeAll` 后再 create,防止扩展更新时同 id 重复创建抛错。
- **MV3 service worker ~30s 休眠**:所有状态必须入 `chrome.storage`,不依赖内存。

## 翻译额度

- **有道词典(默认,免 key)**:`dict.youdao.com/jsonapi`,非官方网页接口,无明确每日上限;仅英文单词查词
- **MyMemory(默认机翻)**:免费约 5000 词/天/IP;在设置页填邮箱可提升到约 50000 词/天
- 想要无限额度/更高质量:设置页填自有 DeepL 或 LibreTranslate key/URL
- 想要牛津/柯林斯级别的详细释义:免费方案达不到,需自行注册词典 API key(约 3000~5000 次/月)

## 已知限制

- **语音朗读只有英文单词可用**:卡片的 🔊 发音走有道词典的 dictvoice 接口,只有词典词条(英文单词/短语)才带发音 URL——这是词典 API 的能力边界,不是 bug。其他语言的文本、整句机翻结果都没有语音,卡片上也不会显示发音按钮。
- 纯汉字(不含假名)的日文片段,auto 检测仍会判成中文;遇到时把侧边栏源语言手动切到 Japanese 即可。
- LibreTranslate 自建实例的 URL 无法预先声明 host 权限,跨源请求可能被浏览器拦截(需在 manifest 补 host_permission)。

## 相关文件

- `HANDOFF.md` — 上次会话的完整交接上下文(技术决策、已踩的坑、待测项)
- `PRIVACY.md` — 上架 Edge Add-ons 用的隐私政策
