// 顶栏导航：宽屏内联展示；窄屏（≤1200px）折叠为汉堡菜单，点开下拉。
// 交互与视角切换器一致：点击切换、外部点击 / Esc / 选中链接 / 路由变化即关闭。

export function initNav(wrap) {
  if (!wrap) return;
  const btn = wrap.querySelector(".nav-toggle");
  const nav = wrap.querySelector(".topnav");
  if (!btn || !nav) return;

  const open = (v) => {
    wrap.classList.toggle("is-open", v);
    btn.setAttribute("aria-expanded", String(v));
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    open(!wrap.classList.contains("is-open"));
  });
  // 点菜单内的链接后收起（外链在新标签打开，当前页仍需关闭浮层）。
  nav.addEventListener("click", (e) => { if (e.target.closest(".topnav-link")) open(false); });
  document.addEventListener("click", () => open(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") open(false); });
  window.addEventListener("hashchange", () => open(false));
}
