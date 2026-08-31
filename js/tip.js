// 悬浮预览：给任意带 data-tip 的元素绑定浮动提示（知识链 / 时间线共用）。

import { renderMath } from "./util.js";

let tip = null;
function ensureTip() {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "tip";
    tip.hidden = true;
    document.body.appendChild(tip);
  }
  return tip;
}

function place(el) {
  const t = ensureTip();
  const r = el.getBoundingClientRect();
  t.style.left = r.right + 12 + "px";
  t.style.top = r.top + r.height / 2 + "px";
  t.style.transform = "translateY(-50%)";
  const tr = t.getBoundingClientRect();
  if (tr.right > window.innerWidth - 8) {
    t.style.left = r.left + r.width / 2 + "px";
    t.style.top = r.top - 8 + "px";
    t.style.transform = "translate(-50%,-100%)";
  }
}

export function bindTooltips(root) {
  const t = ensureTip();
  root.querySelectorAll("[data-tip]").forEach((el) => {
    if (!el.dataset.tip) return;
    el.addEventListener("mouseenter", () => {
      t.textContent = el.dataset.tip;
      renderMath(t);
      t.hidden = false;
      place(el);
    });
    el.addEventListener("mouseleave", () => { t.hidden = true; });
  });
}
