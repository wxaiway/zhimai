// 首页：开场即一条真实可交互的知识链（不做通用 hero）。

import { allMastery, dueCount, getConcept, getRecent, getView, loadIndex, mistakeCount } from "../store.js";
import { escapeHtml, stageClass, SUBJECTS, termLabel, termOfBook } from "../util.js";
import { renderChain } from "./chain.js";

const EXAMPLE = "两角差的余弦公式";

export async function renderHome(app) {
  app.innerHTML = `<div class="loading">正在加载…</div>`;
  const index = await loadIndex();
  const conceptTotal = index.filter((c) => c.kind === "concept").length;
  const skillTotal = index.filter((c) => c.kind === "skill").length;
  const chained = index.filter((c) => c.chain_depth > 0).length;
  const subjectCount = new Set(index.map((c) => c.subject)).size;
  const kindOf = {};
  for (const c of index) kindOf[c.id] = c.kind;
  const example = index.find((c) => c.name === EXAMPLE) || index[0];
  const recent = getRecent();
  const mistakes = mistakeCount();
  const due = mistakes ? dueCount() : 0;

  // 学习进度：按学科统计"已掌握"占比；薄弱概念单独列出，方便回头补。
  const mast = allMastery();
  const mastEntries = Object.entries(mast);
  let progressHtml = "";
  if (mastEntries.length) {
    const concepts = index.filter((c) => c.kind === "concept");
    const nameOf = {};
    for (const c of concepts) nameOf[c.id] = c.name;
    const totals = {}, oks = {};
    for (const c of concepts) {
      const s = c.id.split("_")[0];
      totals[s] = (totals[s] || 0) + 1;
      if (mast[c.id] === "ok") oks[s] = (oks[s] || 0) + 1;
    }
    const rows = SUBJECTS.filter((s) => totals[s.id]).map((s) => {
      const ok = oks[s.id] || 0;
      const pct = Math.round((ok / totals[s.id]) * 100);
      return `<div class="prog-row">
        <span class="prog-label">${s.label}</span>
        <span class="prog-bar"><i style="width:${pct}%"></i></span>
        <span class="prog-num">${ok}/${totals[s.id]}</span>
      </div>`;
    }).join("");
    const weak = mastEntries.filter(([, v]) => v === "weak").map(([id]) => id);
    progressHtml = `
      <div class="home-progress">
        <span class="home-recent-label">我的进度</span>
        ${rows}
        ${weak.length ? `<div class="home-weak">
          <span class="home-weak-label">⚑ 待补</span>
          ${weak.map((id) => `<a class="chip" href="#/concept/${id}">${escapeHtml(nameOf[id] || id)}</a>`).join("")}
        </div>` : ""}
      </div>`;
  }

  // 视角锚点：设定了年级视角后，"我的学习"区顶部给出下一步推荐（当前学期 → 下一学期）；
  // 视角状态本身由顶栏切换器常驻表达，首页不再重复横幅。全貌视角下隐藏本节。
  const view = getView();
  let nextHtml = "";
  if (view > 0) {
    const nextTerm = view + 1;
    let nextBody = "";
    if (nextTerm > 24) {
      nextBody = `<p class="home-next-end">已经走到高中终点 🎓 前面的都可以回头巩固。</p>`;
    } else {
      const groups = SUBJECTS.map((s) => {
        const list = index
          .filter((c) => c.kind === "concept" && c.subject === s.id && termOfBook(c.book) === nextTerm)
          .sort((a, b) => b.chain_depth - a.chain_depth);
        if (!list.length) return "";
        const shown = list.slice(0, 6);
        const extra = list.length - shown.length;
        return `<div class="home-next-subj">
          <span class="home-next-subj-label">${s.label}</span>
          ${shown.map((c) => `<a class="chip sc-${stageClass(c.stage)}" href="#/concept/${c.id}">${escapeHtml(c.name)}</a>`).join("")}
          ${extra > 0 ? `<span class="home-next-more">+${extra}</span>` : ""}
        </div>`;
      }).join("");
      nextBody = groups || `<p class="home-next-end">这一学期暂无收录内容。</p>`;
    }
    nextHtml = `<div class="home-next">
      <span class="home-recent-label">你的下一步 · ${escapeHtml(termLabel(view))} → ${nextTerm > 24 ? "回顾巩固" : escapeHtml(termLabel(nextTerm))}</span>
      ${nextBody}
    </div>`;
  }

  const recentHtml = recent.length ? `<div class="home-recent">
    <span class="home-recent-label">最近看过</span>
    ${recent.map((r) => `<a class="chip sc-${stageClass(r.stage)}" href="#/${kindOf[r.id] === "skill" ? "skill" : "concept"}/${r.id}">${escapeHtml(r.name)}</a>`).join("")}
  </div>` : "";

  app.innerHTML = `
    <section class="home">
      <div class="home-pitch">
        <p class="eyebrow">K12 教材知识库</p>
        <h1 class="home-title">看清每个知识的<br><em>来龙去脉</em></h1>
        <p class="home-sub">不只告诉你一个概念"是什么"，更告诉你它<em>从哪来</em>、<em>到哪去</em>——把教材里隐性的学习顺序显性化。</p>
        <div class="home-stats">
          <div><b>${conceptTotal}</b><span>概念</span></div>
          <div><b>${skillTotal}</b><span>技能</span></div>
          <div><b>${chained}</b><span>有知识链</span></div>
          <div><b>${subjectCount}</b><span>学科</span></div>
        </div>
        <div class="home-subjects">
          ${SUBJECTS.map((s) => `<a class="subj" href="#/timeline/${s.id}">${s.label}</a>`).join("")}
        </div>
        <a class="home-tl-link" href="#/timeline">按学年时间线浏览 →</a>
        <a class="home-tl-link" href="#/textbook/math">按教材目录梳理 →</a>
      </div>
      <div class="home-demo">
        <div class="demo-head">
          <span class="demo-label">示例 · 一条知识链</span>
          <a class="demo-name" href="#/concept/${example.id}">${escapeHtml(example.name)} ↗</a>
        </div>
        <div id="home-chain"></div>
        <p class="demo-hint">点任意节点，顺着链走下去 →</p>
      </div>
      <div class="home-mine">
        <span class="home-mine-label">我的学习</span>
        <div class="home-mine-grid">
          ${nextHtml}
          ${recentHtml}
          ${progressHtml}
          <a class="home-mistakes-link${due ? "" : mistakes ? " is-done" : " is-empty"}" href="#/mistakes">📕 错题本 · ${
            due ? `${due} 道今日待复习` : mistakes ? `${mistakes} 道收录中，今日已复习 ✓` : "去收录第一道错题"
          } →</a>
        </div>
      </div>
    </section>`;

  const ex = await getConcept(example.id);
  if (ex) renderChain(app.querySelector("#home-chain"), ex);
}

// 视角切换后，仅当停留在首页时重绘一次（模块级标志，避免重复挂监听）。
let boundViewRefresh = false;
export function bindHomeViewRefresh(render) {
  if (boundViewRefresh) return;
  boundViewRefresh = true;
  window.addEventListener("view-change", () => {
    if ((location.hash || "#/") === "#/") render();
  });
}
