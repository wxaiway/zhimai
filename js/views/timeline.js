// 学习旅程（微观时间线）：把一条知识链按学期铺开，让人"看见"走了多远。
// 节点 = 地基 → 上游 → 当前（最右，金色 ★）；每列 = 名称 / 学段色圆点 / 学期标签。

import { shortSummary } from "../context.js";
import { getMastery, getView } from "../store.js";
import { bindTooltips } from "../tip.js";
import { escapeHtml, stageClass, stageOfTerm, termLabel } from "../util.js";

function col(n, current, order, view) {
  const el = document.createElement("a");
  const m = getMastery(n.id);
  const learned = view > 0 && !current && n.term != null && n.term <= view;
  el.className = `tl-node sc-${stageClass(n.stage)}` + (current ? " is-current" : "") + (learned ? " is-learned" : "") + (m === "ok" ? " is-ok" : m === "weak" ? " is-weak" : "");
  el.href = `#/concept/${n.id}`;
  el.style.setProperty("--i", order);
  el.dataset.tip = shortSummary(n);
  el.innerHTML = `
    <span class="tl-name">${current ? "★ " : ""}${escapeHtml(n.name)}</span>
    <span class="tl-dot"></span>
    <span class="tl-term">${termLabel(n.term)}</span>`;
  return el;
}

export function renderTimeline(container, concept) {
  container.innerHTML = "";

  if (!concept.has_chain) {
    container.innerHTML = `<p class="chain-hint">没有标注前置知识，也就没有"走了多远"的旅程——这个概念可以直接学习。</p>`;
    return;
  }

  const chain = concept.prereq_chain || [];
  const nodes = [...chain, { ...concept, term: concept.term }];
  const view = getView();

  const track = document.createElement("div");
  track.className = "tl";
  nodes.forEach((n, i) => track.appendChild(col(n, i === nodes.length - 1, i, view)));

  // 旅程概要：从地基到当前，跨多少学期 / 约多少年。
  const t0 = nodes[0].term;
  const t1 = concept.term;
  const span = document.createElement("p");
  span.className = "tl-span";
  if (t0 && t1 && t1 > t0) {
    const nTerms = t1 - t0;
    const years = Math.round((nTerms / 2) * 10) / 10;
    span.innerHTML = `从「${escapeHtml(nodes[0].name)}」（${termLabel(t0)}）出发，走过 <b>${nTerms}</b> 个学期 · 约 <b>${years}</b> 年，抵达这里。`;
  } else {
    span.innerHTML = `这条链集中在同一学期（${stageOfTerm(t1) || "—"}）内完成铺垫。`;
  }

  container.appendChild(track);
  container.appendChild(span);
  bindTooltips(track);
}
