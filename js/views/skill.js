// 技能页：头部 → 技能说明 → 相关练习 / 相关实验。
// 与概念页共用 .concept/.block/.mini 词汇；技能没有知识链，故不渲染来龙去脉。

import { getSkill, getMastery, setMastery, pushRecent } from "../store.js";
import { escapeHtml, exCard, expCard, bindExToggles, observeReveals, renderMath, stageClass } from "../util.js";

// 切换技能页时解绑上一页的 mastery-change 监听，避免累积。
let unbindMastery = null;

export async function renderSkill(app, id) {
  app.innerHTML = `<div class="loading">正在加载…</div>`;
  const s = await getSkill(id);
  if (!s) {
    app.innerHTML = `<div class="loading">未找到该技能。<a href="#/">返回首页</a></div>`;
    return;
  }

  const sc = stageClass(s.stage);
  const loc = s.location || {};
  const locStr = [loc.book, loc.chapter, loc.section].filter(Boolean).join(" · ") || "（暂无教材位置）";
  const exercises = Array.isArray(s.exercises) ? s.exercises : [];
  const experiments = Array.isArray(s.experiments) ? s.experiments : [];
  const afterclass = Array.isArray(s.afterclass) ? s.afterclass : [];
  const myMastery = getMastery(s.id);

  app.innerHTML = `
    <article class="concept">
      <a class="crumb" href="#/">← 知脉</a>
      <header class="concept-head reveal">
        <span class="stage-tag sc-${sc}">${escapeHtml(s.stage)}${s.grade ? " · " + escapeHtml(s.grade) : ""}</span>
        <h1 class="concept-name">${escapeHtml(s.name)}</h1>
        <p class="concept-loc">📍 ${escapeHtml(locStr)}</p>
        <div class="mastery">
          <span class="mastery-label">我的标记</span>
          <button class="m-btn m-ok${myMastery === "ok" ? " is-active" : ""}" data-m="ok">✓ 已掌握</button>
          <button class="m-btn m-weak${myMastery === "weak" ? " is-active" : ""}" data-m="weak">⚑ 薄弱</button>
        </div>
      </header>

      <section class="block block-what reveal">
        <h2 class="block-title"><span class="tick"></span>技能说明</h2>
        ${s.description ? `<p class="def">${escapeHtml(s.description)}</p>` : `<p class="muted">（暂无说明）</p>`}
      </section>

      ${(afterclass.length || exercises.length) ? `<section class="block reveal">
        <h2 class="block-title"><span class="tick"></span>相关练习</h2>
        ${afterclass.length ? `
          <p class="ex-label">课后练习</p>
          ${afterclass.slice(0, 6).map(exCard).join("")}
          ${afterclass.length > 6 ? `<p class="muted skill-note">还有 ${afterclass.length - 6} 道课后练习未展示。</p>` : ""}` : ""}
        ${exercises.length ? `
          ${afterclass.length ? `<p class="ex-label">图谱例题</p>` : ""}
          ${exercises.slice(0, 6).map(exCard).join("")}` : ""}
      </section>` : ""}

      ${experiments.length ? `<section class="block reveal">
        <h2 class="block-title"><span class="tick"></span>相关实验</h2>
        ${experiments.map(expCard).join("")}
      </section>` : ""}
    </article>`;

  pushRecent({ id: s.id, name: s.name, stage: s.stage });

  // 掌握度标记：再点同一按钮即取消；变更后就地刷新头部按钮（技能无知识链，无需刷新链上节点）。
  app.querySelectorAll(".mastery .m-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setMastery(s.id, getMastery(s.id) === btn.dataset.m ? "" : btn.dataset.m);
    });
  });
  if (unbindMastery) unbindMastery();
  const onMastery = (e) => {
    if (e.detail.id === s.id) {
      app.querySelectorAll(".mastery .m-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.m === e.detail.state));
    }
  };
  window.addEventListener("mastery-change", onMastery);
  unbindMastery = () => window.removeEventListener("mastery-change", onMastery);

  renderMath(app);
  bindExToggles(app);
  observeReveals(app);
  window.scrollTo(0, 0);
}
