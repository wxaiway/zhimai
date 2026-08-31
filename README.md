# 知脉 · 看清每个知识的来龙去脉

基于K12的教材知识库，把隐性的学习顺序显性化——看清每个概念从哪来、到哪去。

## 功能

- **知识链**：每个概念的前置→当前→去向可视化，支持学习旅程/学习路径多视图
- **学年时间线**：按学期铺开概念分布，支持数学/物理/化学/生物四学科
- **教材目录**：按册别→章→节梳理，与时间线互为补充
- **搜索**：多词 AND 即时搜索，支持名称/别名/册名/定义
- **AI 讲解**：用户自带密钥（百炼/DeepSeek/OpenAI/自定义），基于概念图谱上下文流式对话
- **练习模式**：隐藏答案先做再自评，做错自动收录错题本
- **错题本**：Leitner 间隔复习，连续答对达标即毕业移出
- **掌握度标记**：已掌握/薄弱三态，全站联动着色
- **年级视角**：设定"我是几年级"，聚焦当前学期、灰显已学内容
- **主题**：深色/护眼双主题，渲染前恢复避免闪烁

## 运行

纯静态站点，无构建步骤。需通过 HTTP 服务打开（fetch 不支持 file:// 协议）：

```bash
cd zhimai
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 技术栈

- 原生 ES Module，零框架零依赖
- KaTeX 自托管（vendor/katex）渲染数学公式
- localStorage 持久化（掌握度/错题本/视角/AI 密钥）
- 数据为预构建 JSON（data/），克隆即可部署

## 数据说明

`data/` 下的 JSON 为预构建站点数据（非运行时生成），按学科+学段拆分以按需加载：

| 文件 | 内容 |
|------|------|
| `index.json` | 全站索引（概念+技能的 id/名称/学段/册名/链深度），供搜索与首页统计 |
| `{subject}_{stage}.json` | 学科概念全景，stage 为 xx(小学)/cz(初中)/bx(高中必修)/xzx(高中选必修) |
| `skills.json` | 技能数据（与概念同节出现的配套技能） |

例如 `math_cz.json` = 数学·初中，`physics_bx.json` = 物理·高中必修。打开单个概念时只加载对应学段分片；时间线/教材目录页并行加载该学科所有分片。

字段含义：`prereq_chain`（前置知识链，有序）、`dependents`（后续概念）、`related`（关联概念）、`location`（教材位置 book/chapter/section）、`exercises`/`afterclass`（例题/课后练习，含 stem/answer/analysis）、`experiments`（实验，含器材/步骤/现象/结论）。

## 目录结构

```
zhimai/
├── index.html          # 入口
├── css/style.css       # 全站样式（深色/护眼主题）
├── js/
│   ├── main.js         # 路由入口
│   ├── store.js        # 数据加载 + localStorage 状态管理
│   ├── ai.js           # AI 对话（多平台/流式/thinking）
│   ├── context.js      # 概念→结构化文本（AI 上下文/悬浮预览）
│   ├── search.js       # 即时搜索
│   ├── theme.js        # 主题切换
│   ├── perspective.js  # 年级视角切换器
│   ├── tip.js          # 悬浮预览
│   ├── util.js         # 工具函数（转义/Markdown/KaTeX/学期映射）
│   └── views/          # 页面视图
│       ├── home.js     # 首页
│       ├── concept.js  # 概念详情（核心页）
│       ├── chain.js    # 知识链组件
│       ├── timeline.js # 学习旅程
│       ├── path.js     # 学习路径
│       ├── map.js      # 学年时间线
│       ├── textbook.js # 教材目录
│       ├── skill.js    # 技能详情
│       └── mistakes.js # 错题本 + 复习
├── data/               # 预构建 JSON 数据
├── vendor/katex/       # KaTeX 本地化
└── favicon.svg
```
