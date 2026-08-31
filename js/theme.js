// 主题切换：深色（默认）⇄ 护眼。选择持久化到 localStorage；
// 切换时短暂挂 .theme-fade 让全站颜色平滑过渡（见 style.css）。

const KEY = "zhimai-theme";
const root = document.documentElement;

function current() {
  return root.dataset.theme === "eye" ? "eye" : "dark";
}

function syncToggle(theme) {
  const tg = document.getElementById("theme-toggle");
  if (!tg) return;
  tg.dataset.active = theme;
  tg.querySelectorAll(".tt-opt").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.themeSet === theme));
}

function apply(theme) {
  if (theme === "eye") root.dataset.theme = "eye";
  else delete root.dataset.theme;
  try { localStorage.setItem(KEY, theme); } catch (e) {}
  syncToggle(theme);
}

export function initTheme() {
  syncToggle(current()); // head 内联脚本可能已设好护眼，这里同步按钮态
  const tg = document.getElementById("theme-toggle");
  if (!tg) return;
  tg.addEventListener("click", (e) => {
    const btn = e.target.closest(".tt-opt");
    if (!btn) return;
    const next = btn.dataset.themeSet === "eye" ? "eye" : "dark";
    if (next === current()) return;
    root.classList.add("theme-fade");
    apply(next);
    setTimeout(() => root.classList.remove("theme-fade"), 450);
  });
}
