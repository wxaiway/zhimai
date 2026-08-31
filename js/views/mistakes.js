// 错题本页：列表模式（分组管理）+ 复习模式（Leitner 间隔主动回忆）。
// 复习流程：只看题干先自己做 → 显示答案核对 → 自评"做对/还是不会"，
// 由 store.judgeMistake 调度下次复习时间，连续答对达标即移出错题本。

import { allMistakes, clearMistakes, dueCount, dueMistakes, flatMistakes, judgeMistake, removeMistake } from "../store.js";
import { escapeHtml, mdToHtml, observeReveals, renderMath, stageClass } from "../util.js";

const DAY = 864e5;

// 切换页面时解绑上一页的 mistakes-change 监听，避免累积。
let unbindMistakes = null;

export async function renderMistakes(app) {
  if (unbindMistakes) unbindMistakes();
  drawList(app);
  window.scrollTo(0, 0);

  // 列表模式下数据变更（删除/清空）就地重绘；复习模式自成流程，不受干扰。
  const onChange = () => { if (!app.querySelector(".review")) drawList(app); };
  window.addEventListener("mistakes-change", onChange);
  unbindMistakes = () => window.removeEventListener("mistakes-change", onChange);
}

// ---------- 列表模式 ----------

function dueBadge(item, now) {
  const next = item.next || 0;
  if (next <= now) return `<span class="mistake-due">今日待复习</span>`;
  const d = Math.ceil((next - now) / DAY);
  return `<span class="mistake-next">${d} 天后复习</span>`;
}

function drawList(app) {
  const now = Date.now();
  const groups = Object.entries(allMistakes());
  const total = groups.reduce((n, [, g]) => n + (g.items ? g.items.length : 0), 0);
  const due = dueCount(now);

  app.innerHTML = `
    <article class="browse mistakes">
      <a class="crumb" href="#/">← 知脉</a>
      <header class="browse-head reveal">
        <h1 class="browse-title">错题本</h1>
        <p class="browse-sub">练习模式里自评"做错"的题会自动收进来${total ? `，共 <b>${total}</b> 道` : ""}。</p>
        ${total ? `
          <div class="review-cta">
            ${due
              ? `<button type="button" class="review-start" id="review-start">▶ 开始复习 · ${due} 道今日到期</button>`
              : `<p class="review-done">✓ 今日到期的都复习完了</p>`}
            <button type="button" class="review-all" id="review-all">${due ? `复习全部 ${total} 道` : `▶ 开始复习 · 全部 ${total} 道`}</button>
            <button type="button" class="mistakes-clear" id="mistakes-clear">清空全部</button>
          </div>` : ""}
      </header>
      ${total ? groups.map(([id, g]) => `
        <section class="mistake-group reveal">
          <h2 class="mistake-group-head sc-${stageClass(g.stage)}">
            <a class="mistake-concept" href="#/concept/${id}">${escapeHtml(g.name)} ↗</a>
            <span class="mistake-count">${g.items.length}</span>
          </h2>
          ${g.items.map((it) => `
            <div class="mistake-item">
              <div class="mistake-item-top">${dueBadge(it, now)}</div>
              <div class="ex-stem">${mdToHtml(it.stem || "（无题干）")}</div>
              ${it.answer ? `<div class="ex-answer"><span class="ex-tag">答案</span><div class="ex-body">${mdToHtml(it.answer)}</div></div>` : ""}
              ${it.analysis ? `<div class="ex-analysis"><span class="ex-tag">解析</span><div class="ex-analysis-body">${mdToHtml(it.analysis)}</div></div>` : ""}
              <button type="button" class="mistake-del" data-id="${id}" data-stem="${escapeHtml(it.stem || "")}">✓ 已会了，移出错题本</button>
            </div>`).join("")}
        </section>`).join("") : `<p class="no-practice reveal">还没有收录错题。去概念页的"例题与练习"点"练习模式"，先自己做再自评即可收录。</p>`}
    </article>`;

  app.querySelectorAll(".mistake-del").forEach((btn) => {
    btn.addEventListener("click", () => removeMistake(btn.dataset.id, btn.dataset.stem));
  });
  const clear = app.querySelector("#mistakes-clear");
  if (clear) clear.addEventListener("click", () => {
    if (confirm("确定清空错题本里的全部错题？")) clearMistakes();
  });
  const start = app.querySelector("#review-start");
  if (start) start.addEventListener("click", () => startReview(app, dueMistakes()));
  const all = app.querySelector("#review-all");
  if (all) all.addEventListener("click", () => startReview(app, flatMistakes()));

  renderMath(app);
  observeReveals(app);
}

// ---------- 复习模式 ----------

function startReview(app, queue) {
  const totalQ = queue.length;
  if (!totalQ) { drawList(app); return; }
  let i = 0;
  const stats = { graduated: 0, again: 0 };

  const showCard = () => {
    if (i >= totalQ) { showDone(); return; }
    const { conceptId, name, stage, item } = queue[i];

    const judge = (correct) => {
      const r = judgeMistake(conceptId, item.stem, correct);
      if (r.graduated) stats.graduated++; else stats.again++;
      i++;
      showCard();
    };

    app.innerHTML = `
      <article class="review">
        <div class="review-bar">
          <button type="button" class="review-exit" id="review-exit">← 退出复习</button>
          <span class="review-progress">${i + 1} / ${totalQ}</span>
        </div>
        <div class="review-track"><i style="width:${(i / totalQ) * 100}%"></i></div>
        <div class="review-card sc-${stageClass(stage)}">
          <a class="review-concept" href="#/concept/${conceptId}">${escapeHtml(name)} ↗</a>
          <div class="ex-stem">${mdToHtml(item.stem || "（无题干）")}</div>
          <div class="review-solution" hidden>
            ${item.answer ? `<div class="ex-answer"><span class="ex-tag">答案</span><div class="ex-body">${mdToHtml(item.answer)}</div></div>` : ""}
            ${item.analysis ? `<div class="ex-analysis"><span class="ex-tag">解析</span><div class="ex-analysis-body">${mdToHtml(item.analysis)}</div></div>` : ""}
          </div>
          <div class="review-actions">
            <button type="button" class="review-reveal" id="review-reveal">显示答案</button>
            <div class="review-judge" hidden>
              <button type="button" class="ex-judge j-no" id="judge-no">✗ 还是不会</button>
              <button type="button" class="ex-judge j-ok" id="judge-ok">✓ 做对了</button>
            </div>
          </div>
        </div>
        <p class="review-tip">先在心里或纸上做出来，再显示答案核对。</p>
      </article>`;

    const reveal = app.querySelector("#review-reveal");
    reveal.addEventListener("click", () => {
      app.querySelector(".review-solution").hidden = false;
      reveal.hidden = true;
      app.querySelector(".review-judge").hidden = false;
    });
    app.querySelector("#review-exit").addEventListener("click", () => drawList(app));
    app.querySelector("#judge-ok").addEventListener("click", () => judge(true));
    app.querySelector("#judge-no").addEventListener("click", () => judge(false));

    renderMath(app);
    window.scrollTo(0, 0);
  };

  const showDone = () => {
    const parts = [];
    if (stats.graduated) parts.push(`<b class="g-ok">${stats.graduated}</b> 道连续答对达标，已移出错题本`);
    if (stats.again) parts.push(`<b class="g-no">${stats.again}</b> 道明天再来巩固`);
    app.innerHTML = `
      <article class="review review-done-screen">
        <div class="review-done-card">
          <h2 class="review-done-title">本轮复习完成</h2>
          <p class="review-done-sum">共复习 <b>${totalQ}</b> 道${parts.length ? "：" + parts.join("，") : ""}。</p>
          <button type="button" class="review-start" id="back-list">返回错题本</button>
        </div>
      </article>`;
    app.querySelector("#back-list").addEventListener("click", () => drawList(app));
    window.scrollTo(0, 0);
  };

  showCard();
}
