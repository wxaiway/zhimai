// 小工具：HTML 转义、学段配色映射、滚动渐入。

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// 学科（全站共享这一份：首页 / 时间线 / 路由都用它）。
export const SUBJECTS = [
  { id: "math", label: "数学" },
  { id: "physics", label: "物理" },
  { id: "chemistry", label: "化学" },
  { id: "biology", label: "生物" },
];
export const SUBJECT_LABEL = Object.fromEntries(SUBJECTS.map((s) => [s.id, s.label]));

export function stageClass(stage) {
  return { "小学": "xx", "初中": "cz", "高中·必修": "bx", "高中·选必修": "xzx" }[stage] || "bx";
}

// KaTeX 自动渲染（自托管于 vendor/katex）。数据里 $...$ 与 \(...\) 两种行内定界符都有，
// 故全部启用；throwOnError:false 使个别坏公式降级为原文而非整页报错。
export function renderMath(root) {
  if (typeof renderMathInElement !== "function") return;
  renderMathInElement(root, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
      { left: "\\[", right: "\\]", display: true },
    ],
    throwOnError: false,
  });
}

// ---------- 轻量 Markdown（全站统一文本渲染管线） ----------
// 例题题干/答案/解析、错题本、复习卡、AI 回答都走这一条：escapeHtml → mdToHtml → renderMath。
// 块级支持：$$...$$ 公式块（可跨行，如 \begin{cases}）、<details>/<summary> 折叠块、
// 标题、列表、段落。安全约定：扫描在原文上进行，只输出本函数自造的结构标签；外部内容
// 一律经 escapeHtml / mdLines 转义，绝不原样注入 HTML（保持 XSS 防护姿态）。

function mdInline(s) {
  return s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
}

// 逐行渲染普通文本（标题/列表/段落）。整段先转义，行内 $...$ 公式以原文留给 KaTeX。
function mdLines(text) {
  const lines = escapeHtml(text).split(/\r?\n/);
  let html = "", inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const li = line.match(/^\s*[-*]\s+(.*)/);
    if (li) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${mdInline(li[1])}</li>`;
      continue;
    }
    closeList();
    const h = line.match(/^#{1,4}\s+(.*)/);
    if (h) { html += `<p class="ai-h">${mdInline(h[1])}</p>`; continue; }
    if (!line.trim()) continue;
    html += `<p>${mdInline(line)}</p>`;
  }
  closeList();
  return html;
}

export function mdToHtml(text) {
  let html = "", s = String(text);
  while (s.length) {
    // 找最近的块级结构：$$ 公式块 或 <details> 折叠块
    const mathIdx = s.indexOf("$$");
    const detIdx = s.search(/<details\b/i);
    let kind = null, next = -1;
    if (mathIdx >= 0 && (detIdx < 0 || mathIdx <= detIdx)) { kind = "math"; next = mathIdx; }
    else if (detIdx >= 0) { kind = "details"; next = detIdx; }
    if (next < 0) { html += mdLines(s); break; }

    html += mdLines(s.slice(0, next)); // 结构之前的普通文本
    s = s.slice(next);

    if (kind === "math") {
      const end = s.indexOf("$$", 2);
      if (end < 0) { html += mdLines(s); break; } // 无配对：降级为普通文本
      // 整块放进单个元素，KaTeX 才能在一个文本节点内配对 $$...$$（跨行公式不再被拆散）
      html += `<div class="ai-math">$$${escapeHtml(s.slice(2, end))}$$</div>`;
      s = s.slice(end + 2);
    } else {
      const close = s.match(/<\/details>/i);
      const closeIdx = close ? s.indexOf(close[0]) : -1;
      if (closeIdx < 0) { html += mdLines(s); break; } // 无配对：降级为普通文本
      const open = s.match(/^<details\b[^>]*>/i);
      const openLen = open ? open[0].length : "<details>".length;
      let inner = s.slice(openLen, closeIdx);
      let summary = "详情";
      const sm = inner.match(/^\s*<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
      if (sm) { summary = sm[1].trim(); inner = inner.slice(sm[0].length); }
      // 折叠块默认收起；内部递归渲染，公式/列表同样生效
      html += `<details class="ai-details"><summary>${escapeHtml(summary)}</summary>` +
              `<div class="ai-details-body">${mdToHtml(inner)}</div></details>`;
      s = s.slice(closeIdx + close[0].length);
    }
  }
  return html;
}

// 练习/例题卡片：stem + answer + analysis + type/difficulty 结构化展示。
// 文本统一经 mdToHtml（转义 + 轻量 Markdown），公式原文保留给页面级 renderMath。
export function exCard(ex) {
  const type = ex.type ? `<span class="ex-type">${escapeHtml(ex.type)}</span>` : "";
  const diff = ex.difficulty
    ? `<span class="ex-diff">${"●".repeat(ex.difficulty)}${"○".repeat(Math.max(0, 5 - ex.difficulty))}</span>`
    : "";
  const meta = (type || diff) ? `<div class="ex-card-meta">${type}${diff}</div>` : "";
  const stem = `<div class="ex-stem">${mdToHtml(ex.stem || "（略）")}</div>`;
  const answer = ex.answer
    ? `<div class="ex-answer"><span class="ex-tag">答案</span><div class="ex-body">${mdToHtml(ex.answer)}</div></div>` : "";
  let analysis = "";
  if (ex.analysis) {
    const long = ex.analysis.length > 100;
    analysis = `<div class="ex-analysis${long ? " is-collapsible" : ""}">` +
      `<span class="ex-tag">解析</span>` +
      `<div class="ex-analysis-body">${mdToHtml(ex.analysis)}</div>` +
      (long ? `<button class="ex-toggle" type="button">展开全部</button>` : "") +
      `</div>`;
  }
  return `<div class="ex-card">${meta}${stem}${answer}${analysis}</div>`;
}

// 绑定解析折叠/展开（事件委托）。app 跨路由复用，需按元素做一次性绑定守卫，
// 否则每次进入概念/技能页都会叠加一层监听，偶数层时点击相互抵消、表现为"没反应"。
export function bindExToggles(root) {
  if (root._exTogglesBound) return;
  root._exTogglesBound = true;
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".ex-toggle");
    if (!btn) return;
    const body = btn.parentElement.querySelector(".ex-analysis-body");
    if (!body) return;
    const open = body.classList.toggle("is-open");
    btn.textContent = open ? "收起" : "展开全部";
  });
}

// 实验卡片：name + instrument + process + phenomena + conclusion + is_student。
export function expCard(e) {
  const badge = e.is_student === 0 || e.is_student === "0"
    ? `<span class="exp-badge">演示实验</span>` : "";
  const fmt = (v) => Array.isArray(v) ? v.join("、") : (v || "");
  const rows = [
    e.instrument ? `<p class="exp-row"><span class="exp-tag">器材</span>${escapeHtml(fmt(e.instrument))}</p>` : "",
    e.process ? `<p class="exp-row"><span class="exp-tag">步骤</span>${escapeHtml(fmt(e.process))}</p>` : "",
    e.phenomena ? `<p class="exp-row"><span class="exp-tag">现象</span>${escapeHtml(fmt(e.phenomena))}</p>` : "",
    e.conclusion ? `<p class="exp-row exp-conclusion"><span class="exp-tag">结论</span>${escapeHtml(fmt(e.conclusion))}</p>` : "",
  ].filter(Boolean).join("");
  return `<div class="exp-card">${badge}<b class="exp-name">${escapeHtml(e.name)}</b>${rows}</div>`;
}

export function observeReveals(root) {
  const els = root.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    els.forEach((e) => e.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    }
  }, { threshold: 0.1 });
  els.forEach((e) => io.observe(e));
}

// 学期序号 → 可读标签（1=一年级上 … 21=必修三，22=选必修一 … 24=选必修三），与构建期 term_index 对应。
const CN = ["一", "二", "三", "四", "五", "六"];
export function termLabel(t) {
  if (t >= 1 && t <= 12) {
    return CN[Math.ceil(t / 2) - 1] + "年级" + (t % 2 === 1 ? "上" : "下");
  }
  if (t >= 13 && t <= 18) {
    return { 7: "初一", 8: "初二", 9: "初三" }[7 + Math.floor((t - 13) / 2)] + (t % 2 === 1 ? "上" : "下");
  }
  if (t >= 19 && t <= 21) return "必修" + ["一", "二", "三"][t - 19];
  if (t >= 22 && t <= 24) return "选必修" + ["一", "二", "三"][t - 22];
  return "—";
}

export function stageOfTerm(t) {
  if (t >= 1 && t <= 12) return "小学";
  if (t >= 13 && t <= 18) return "初中";
  if (t >= 19 && t <= 21) return "高中·必修";
  if (t >= 22 && t <= 24) return "高中·选必修";
  return "";
}

// ---------- 视角（"我是几年级"）----------
// 视角以学期序号 term（1~24）为锚点；年级选项映射到该年级的最后一个学期。
// GRADES 按学段分组，供顶栏切换器渲染。
export const GRADES = [
  { stage: "小学", items: [
    { label: "一年级", term: 2 }, { label: "二年级", term: 4 }, { label: "三年级", term: 6 },
    { label: "四年级", term: 8 }, { label: "五年级", term: 10 }, { label: "六年级", term: 12 },
  ]},
  { stage: "初中", items: [
    { label: "初一", term: 14 }, { label: "初二", term: 16 }, { label: "初三", term: 18 },
  ]},
  { stage: "高中", items: [
    { label: "高一", term: 20 }, { label: "高二", term: 22 }, { label: "高三", term: 24 },
  ]},
];

// 教材册别 → 学期序号（九全按九上处理）。
const BOOK_TERM = {
  一上: 1, 一下: 2, 二上: 3, 二下: 4, 三上: 5, 三下: 6, 四上: 7, 四下: 8,
  五上: 9, 五下: 10, 六上: 11, 六下: 12, 七上: 13, 七下: 14, 八上: 15, 八下: 16,
  九上: 17, 九下: 18, 九全: 17, 必一: 19, 必二: 20, 必三: 21,
  选必一: 22, 选必二: 23, 选必三: 24,
};

export function termOfBook(book) {
  return BOOK_TERM[book] || 0;
}

// 学期序号 → 年级名（"三年级"），供视角回显。
export function gradeLabelOfTerm(t) {
  for (const g of GRADES) {
    for (const it of g.items) if (t <= it.term) return it.label;
  }
  return "";
}
