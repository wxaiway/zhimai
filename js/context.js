// 上下文构建（AI 地基）：把概念全景转成结构化文本。
// 镜像 learn.py 的 build_context——本期供悬浮预览/搜索摘要，后期 ai.js 直接复用。

function names(arr) {
  return arr && arr.length ? arr.map((n) => n.name).join("、") : "（无）";
}

export function buildContext(c) {
  const lines = [
    `概念：${c.name}`,
    `学段：${c.stage}${c.grade ? " · " + c.grade : ""}`,
    `定义：${c.definition || "（无）"}`,
  ];
  if (c.formula) lines.push(`公式：${c.formula}`);
  if (c.importance) lines.push(`课标要求：${c.importance}`);
  const chain = c.prereq_chain && c.prereq_chain.length ? c.prereq_chain : [];
  lines.push(`前置知识：${names(chain.length ? chain : c.prerequisites)}`);
  // 链深度：prereq_chain 不含本概念（见 chain.js），故本概念在第 length+1 层。
  if (chain.length > 1) lines.push(`知识链深度：第 ${chain.length + 1} 层（从「${chain[0].name}」一路搭到本概念）`);
  lines.push(`后续概念：${names(c.dependents)}`);
  lines.push(`关联概念：${names(c.related)}`);
  const loc = c.location || {};
  const locStr = [loc.book, loc.chapter, loc.section].filter(Boolean).join(" · ");
  if (locStr) lines.push(`教材位置：${locStr}`);
  // 已有例题题干（examples 为字符串，exercises/afterclass 为对象取 .stem）：
  // 喂给模型做"出题去重锚"，避免 AI 原题照搬；各截 40 字、最多 3 条，控制上下文体积。
  const stems = [];
  for (const e of c.examples || []) stems.push(String(e));
  for (const e of [...(c.exercises || []), ...(c.afterclass || [])]) if (e && e.stem) stems.push(String(e.stem));
  if (stems.length) {
    const shown = stems.slice(0, 3).map((s) => (s.length > 40 ? s.slice(0, 40) + "…" : s));
    lines.push(`教材已有例题（出题请避开，勿重复）：${shown.join(" / ")}`);
  }
  return lines.join("\n");
}

// 悬浮预览用的短摘要：公式包成 $…$ 交给 KaTeX 渲染，定义按纯文本截断。
export function shortSummary(c) {
  if (c.formula) {
    const f = c.formula.trim();
    const inner = f.length > 88 ? f.slice(0, 88) + "…" : f;
    return "$" + inner + "$";
  }
  const d = (c.definition || "").trim();
  if (!d) return "";
  return d.length > 92 ? d.slice(0, 92) + "…" : d;
}
