// 学习路径：把当前概念的全部前置（传递闭包）铺成一张可勾选清单，
// 让学生按"地基 → 上游 → 当前"逐个攻克——勾选即记掌握度，攻克完清单即抵达当前概念。

import { allMastery, loadSubject, setMastery, subjectOf } from "../store.js";
import { escapeHtml, stageClass, termLabel } from "../util.js";

export async function renderPath(container, concept) {
  container.innerHTML = `<p class="muted">正在生成学习路径…</p>`;
  const map = await loadSubject(subjectOf(concept.id));

  // 传递闭包：从直接前置出发 BFS 收齐所有上游（不含当前概念自身）。
  const closure = new Set();
  const queue = (concept.prerequisites || []).map((p) => p.id);
  while (queue.length) {
    const id = queue.shift();
    if (closure.has(id) || id === concept.id) continue;
    closure.add(id);
    const node = map[id];
    if (node) for (const p of node.prerequisites || []) queue.push(p.id);
  }

  if (!closure.size) {
    container.innerHTML = `<p class="chain-hint">这个概念没有标注前置知识——它本身就是一处地基，可以直接学习。</p>`;
    return;
  }

  // 最长路径深度松弛：depth = 1 + max(闭包内前置的 depth)，地基为 0。
  // 数据为有向无环图；占位 0 仅作环路兜底。
  const depth = {};
  const getDepth = (id) => {
    if (depth[id] != null) return depth[id];
    depth[id] = 0;
    const node = map[id];
    let d = 0;
    if (node) for (const p of node.prerequisites || []) {
      if (closure.has(p.id)) d = Math.max(d, getDepth(p.id) + 1);
    }
    return (depth[id] = d);
  };
  for (const id of closure) getDepth(id);

  // 排序：学期升序（先学的排前），同学期按深度降序（更枢纽的排前）。末位为当前概念。
  const list = [...closure].map((id) => map[id]).filter(Boolean)
    .sort((a, b) => (a.term || 99) - (b.term || 99) || depth[b.id] - depth[a.id]);

  const row = (c, current) => {
    const m = allMastery()[c.id] || "";
    return `<label class="path-row sc-${stageClass(c.stage)}${current ? " is-current" : ""}${m === "ok" ? " is-ok" : ""}" data-id="${c.id}">
      <input type="checkbox" class="path-check" ${m === "ok" ? "checked" : ""} ${current ? "disabled" : ""}>
      <span class="path-dot"></span>
      <a class="path-name" href="#/concept/${c.id}">${current ? "★ " : ""}${escapeHtml(c.name)}</a>
      <span class="path-term">${c.term ? termLabel(c.term) : ""}</span>
    </label>`;
  };

  container.innerHTML = `
    <div class="path-bar">
      <span class="path-summary"></span>
      <label class="path-hide"><input type="checkbox" class="path-hide-check"> 隐藏已掌握</label>
    </div>
    <div class="path-list">
      ${list.map((c) => row(c, false)).join("")}
      ${row(concept, true)}
    </div>
    <p class="chain-note">按学期与依赖深度排序，自上而下即推荐学习顺序；勾选"已掌握"会同步记入你的进度。</p>`;

  const rows = [...container.querySelectorAll(".path-row")];
  const summary = container.querySelector(".path-summary");
  const hideCheck = container.querySelector(".path-hide-check");

  const refresh = () => {
    const m = allMastery();
    let ok = 0;
    for (const r of rows) {
      const id = r.dataset.id;
      const mastered = m[id] === "ok";
      if (!r.classList.contains("is-current") && mastered) ok++;
      r.classList.toggle("is-ok", mastered);
      r.querySelector(".path-check").checked = mastered;
      r.hidden = hideCheck.checked && mastered && !r.classList.contains("is-current");
    }
    summary.textContent = `共 ${list.length} 个前置 · 已掌握 ${ok}`;
  };

  container.querySelectorAll(".path-row").forEach((r) => {
    const check = r.querySelector(".path-check");
    check.addEventListener("change", () => setMastery(r.dataset.id, check.checked ? "ok" : ""));
  });
  hideCheck.addEventListener("change", refresh);

  const onMastery = (e) => { if (closure.has(e.detail.id) || e.detail.id === concept.id) refresh(); };
  window.addEventListener("mastery-change", onMastery);
  container._unbindPath = () => window.removeEventListener("mastery-change", onMastery);

  refresh();
}
