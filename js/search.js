// 搜索：加载 index.json 到内存，子串匹配，即时出结果，支持键盘导航。

import { loadIndex } from "./store.js";
import { escapeHtml, stageClass } from "./util.js";

export function initSearch() {
  const input = document.getElementById("search-input");
  const box = document.getElementById("search-results");
  let idx = null, results = [], active = -1;
  loadIndex().then((d) => { idx = d; });

  function run(q) {
    q = q.trim();
    if (!idx || !q) { box.hidden = true; results = []; return; }
    // 多词 AND：空格分词，每个词都需命中 名称/册名/别名（单词时等同原逻辑）。
    const tokens = q.split(/\s+/);
    const hit = (c, t) => c.name.includes(t) || (c.book && c.book.includes(t)) || (c.def && c.def.includes(t)) || (c.aliases && c.aliases.some((a) => a.includes(t)));
    results = idx.filter((c) => tokens.every((t) => hit(c, t))).slice(0, 12);
    active = -1;
    if (!results.length) {
      box.innerHTML = `<div class="sr-empty">无匹配结果</div>`;
      box.hidden = false;
      return;
    }
    box.innerHTML = results.map((c, i) => `
      <a class="sr-item" data-i="${i}" href="${c.kind === "skill" ? "#/skill/" : "#/concept/"}${c.id}">
        <span class="sr-dot sc-${stageClass(c.stage)}"></span>
        <span class="sr-name">${escapeHtml(c.name)}</span>
        ${c.book ? `<span class="sr-book">${escapeHtml(c.book)}</span>` : ""}
        <span class="sr-stage">${escapeHtml(c.stage)}</span>
        ${c.chain_depth ? `<span class="sr-chain">⛓${c.chain_depth}</span>` : ""}
      </a>`).join("");
    box.hidden = false;
  }

  input.addEventListener("input", (e) => run(e.target.value));
  input.addEventListener("focus", (e) => { if (e.target.value.trim()) run(e.target.value); });
  input.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    const items = [...box.querySelectorAll(".sr-item")];
    if (e.key === "ArrowDown") { active = Math.min(active + 1, items.length - 1); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); e.preventDefault(); }
    else if (e.key === "Enter") { if (active >= 0) items[active].click(); else if (items.length) items[0].click(); return; }
    else if (e.key === "Escape") { box.hidden = true; input.blur(); return; }
    else return;
    items.forEach((it, i) => it.classList.toggle("active", i === active));
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#search")) box.hidden = true;
  });
  box.addEventListener("click", (e) => {
    if (e.target.closest(".sr-item")) { box.hidden = true; input.value = ""; }
  });
}
