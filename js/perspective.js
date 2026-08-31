// 视角切换器：顶栏常驻控件。"我是几年级"一键设定（或"全貌"不限），
// 选中写入 localStorage 并派发 view-change，首页/知识链/时间线随之聚焦。

import { getView, setView } from "./store.js";
import { GRADES, gradeLabelOfTerm } from "./util.js";

function labelOf(term) {
  return term ? gradeLabelOfTerm(term) : "全貌";
}

export function initPerspective(mount) {
  if (!mount) return;

  mount.className = "view-picker";
  mount.innerHTML = `
    <button type="button" class="vp-btn" id="vp-btn" aria-haspopup="true" aria-expanded="false">
      <span class="vp-ico" aria-hidden="true">🧭</span>
      <span class="vp-label">${labelOf(getView())}</span>
      <span class="vp-caret" aria-hidden="true">▾</span>
    </button>
    <div class="vp-pop" role="menu" hidden>
      <p class="vp-pop-title">你现在是？<span>随时可切换</span></p>
      <button type="button" class="vp-opt vp-all" data-term="0">全貌 · 不限年级</button>
      ${GRADES.map((g) => `
        <p class="vp-stage">${g.stage}</p>
        <div class="vp-grid">
          ${g.items.map((it) => `<button type="button" class="vp-opt" data-term="${it.term}">${it.label}</button>`).join("")}
        </div>`).join("")}
    </div>`;

  const btn = mount.querySelector("#vp-btn");
  const pop = mount.querySelector(".vp-pop");
  const label = mount.querySelector(".vp-label");

  const sync = () => {
    const term = getView();
    label.textContent = labelOf(term);
    mount.classList.toggle("has-view", !!term);
    pop.querySelectorAll(".vp-opt").forEach((o) =>
      o.classList.toggle("is-active", Number(o.dataset.term) === term));
  };

  const open = (v) => {
    pop.hidden = !v;
    btn.setAttribute("aria-expanded", String(v));
    mount.classList.toggle("is-open", v);
  };

  btn.addEventListener("click", (e) => { e.stopPropagation(); open(pop.hidden); });
  pop.addEventListener("click", (e) => {
    const opt = e.target.closest(".vp-opt");
    if (!opt) return;
    setView(Number(opt.dataset.term));
    open(false);
    btn.focus();
  });
  document.addEventListener("click", () => open(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") open(false); });

  window.addEventListener("view-change", sync);
  sync();
}
