// 知识链竖向视图 ★核心
// 顺序：地基 → 上游 → 当前（高亮）→ 去向。节点可点击、可悬浮预览、逐节点渐入。

import { shortSummary } from "../context.js";
import { getMastery, getView } from "../store.js";
import { bindTooltips } from "../tip.js";
import { escapeHtml, gradeLabelOfTerm, stageClass, termLabel } from "../util.js";

const DEP_CAP = 5;

function node(n, role, current, order, view) {
  const el = document.createElement("a");
  const m = getMastery(n.id);
  const learned = view > 0 && !current && n.term != null && n.term <= view;
  el.className = `chain-node sc-${stageClass(n.stage)}` + (current ? " is-current" : "") + (learned ? " is-learned" : "") + (m === "ok" ? " is-ok" : m === "weak" ? " is-weak" : "");
  el.href = `#/concept/${n.id}`;
  el.style.setProperty("--i", order);
  el.dataset.tip = shortSummary(n);
  el.innerHTML = `
    <span class="chain-dot"></span>
    <span class="chain-name">${current ? "★ " : ""}${escapeHtml(n.name)}</span>
    <span class="chain-role">${role}</span>
    ${current ? '<span class="chain-here">你在这</span>' : ""}`;
  return el;
}

// 去向节点（最多 DEP_CAP 个，超出折叠为一行计数）。
function appendDeps(rail, deps, order, view) {
  deps.slice(0, DEP_CAP).forEach((n) => rail.appendChild(node(n, "去向", false, order++, view)));
  if (deps.length > DEP_CAP) {
    const more = document.createElement("div");
    more.className = "chain-more";
    more.textContent = `还有 ${deps.length - DEP_CAP} 个后续概念…`;
    rail.appendChild(more);
  }
}

// 视角提示：说明灰显含义（仅设了视角时出现）。
function viewNote(container, view) {
  if (view <= 0) return;
  const note = document.createElement("p");
  note.className = "chain-view-note";
  note.textContent = `灰显 = 你的视角（${gradeLabelOfTerm(view) || termLabel(view)}）及之前已学的内容`;
  container.appendChild(note);
}

export function renderChain(container, concept) {
  container.innerHTML = "";
  const deps = concept.dependents || [];
  const view = getView();

  // 降级：无前置链。有去向仍画"当前 → 去向"（起点概念）；
  // 无去向但有策展的所属(is_a)/相关(related)时，用它们撑起脉络；真正独立才一行带过。
  if (!concept.has_chain) {
    if (!deps.length) {
      const isa = concept.is_a || [];
      const related = concept.related || [];
      if (!isa.length && !related.length) {
        container.innerHTML = `<p class="chain-hint">独立知识点：图谱未标注前置关系，可直接学习。</p>`;
        return;
      }
      const rail = document.createElement("div");
      rail.className = "chain";
      let order = 0;
      isa.forEach((n) => rail.appendChild(node(n, "所属", false, order++, view)));
      rail.appendChild(node(concept, isa.length ? "当前" : "起点", true, order++, view));
      related.forEach((n) => rail.appendChild(node(n, "相关", false, order++, view)));
      container.appendChild(rail);
      const hint = document.createElement("p");
      hint.className = "chain-hint";
      hint.textContent = "图谱未标注前置顺序，暂按所属 / 相关概念呈现脉络。";
      container.appendChild(hint);
      viewNote(container, view);
      bindTooltips(rail);
      return;
    }
    const rail = document.createElement("div");
    rail.className = "chain";
    rail.appendChild(node(concept, "起点", true, 0, view));
    appendDeps(rail, deps, 1, view);
    container.appendChild(rail);
    viewNote(container, view);
    bindTooltips(rail);
    return;
  }

  const rail = document.createElement("div");
  rail.className = "chain";

  const upstream = concept.prereq_chain || [];
  let order = 0;
  upstream.forEach((n, i) => rail.appendChild(node(n, i === 0 ? "地基" : "上游", false, order++, view)));
  rail.appendChild(node(concept, "当前", true, order++, view));
  appendDeps(rail, deps, order, view);

  container.appendChild(rail);
  viewNote(container, view);
  bindTooltips(rail);
}
