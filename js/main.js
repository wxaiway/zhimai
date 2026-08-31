// 入口：hash 路由 + 搜索初始化。

import { initSearch } from "./search.js";
import { initTheme } from "./theme.js";
import { initPerspective } from "./perspective.js";
import { renderConcept } from "./views/concept.js";
import { bindHomeViewRefresh, renderHome } from "./views/home.js";
import { renderMap } from "./views/map.js";
import { renderMistakes } from "./views/mistakes.js";
import { renderSkill } from "./views/skill.js";
import { renderTextbook } from "./views/textbook.js";

const app = document.getElementById("app");

function route() {
  const hash = location.hash || "#/";
  const m = hash.match(/^#\/concept\/(.+)$/);
  if (m) { renderConcept(app, decodeURIComponent(m[1])); return; }
  const sk = hash.match(/^#\/skill\/(.+)$/);
  if (sk) { renderSkill(app, decodeURIComponent(sk[1])); return; }
  const tb = hash.match(/^#\/textbook\/([a-z]+)(?:\/(.+))?$/);
  if (tb) { renderTextbook(app, tb[1], tb[2] ? decodeURIComponent(tb[2]) : null); return; }
  const t = hash.match(/^#\/timeline(?:\/([a-z]+))?$/);
  if (t) { renderMap(app, t[1] || "math"); return; }
  if (hash === "#/mistakes") { renderMistakes(app); return; }
  renderHome(app);
}

window.addEventListener("hashchange", route);
initSearch();
initTheme();
initPerspective(document.getElementById("view-picker"));
bindHomeViewRefresh(route);
route();
