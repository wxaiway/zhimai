// 概念页（灵魂页面）：头部 → 知识链 → 是什么 → 验证/例题/相关（空则不渲染）→ AI 讲解。

import { mountAI } from "../ai.js";
import { addMistake, getConcept, getMastery, pushRecent, setMastery } from "../store.js";
import { escapeHtml, exCard, expCard, bindExToggles, observeReveals, renderMath, stageClass } from "../util.js";
import { renderChain } from "./chain.js";
import { renderPath } from "./path.js";
import { renderTimeline } from "./timeline.js";

// 切换概念页时解绑上一页的 mastery-change 监听，避免累积。
let unbindMastery = null;
// 学习路径页也注册了 window mastery-change 监听（path.js 存于容器 _unbindPath），
// 同样需在切换概念时解绑，否则随浏览累积。
let unbindPath = null;

export async function renderConcept(app, id) {
  app.innerHTML = `<div class="loading">正在加载…</div>`;
  const c = await getConcept(id);
  if (!c) {
    app.innerHTML = `<div class="loading">未找到该概念。<a href="#/">返回首页</a></div>`;
    return;
  }

  const sc = stageClass(c.stage);
  const loc = c.location || {};
  const locStr = [loc.book, loc.chapter, loc.section].filter(Boolean).join(" · ") || "（暂无教材位置）";
  const examples = Array.isArray(c.examples) ? c.examples : [];
  const hasPractice = c.afterclass.length || c.exercises.length;
  const myMastery = getMastery(c.id);
  // 无前置链且无去向时，知识链会退而展示 所属(is_a)/相关(related)；
  // 此时下方独立的"属于/相关"块与链路重复，予以隐藏。
  const relsInChain = !c.has_chain && !(c.dependents || []).length && ((c.is_a || []).length || c.related.length);

  app.innerHTML = `
    <article class="concept">
      <a class="crumb" href="#/">← 知脉</a>
      <header class="concept-head reveal">
        <span class="stage-tag sc-${sc}">${escapeHtml(c.stage)}${c.grade ? " · " + escapeHtml(c.grade) : ""}</span>
        <h1 class="concept-name">${escapeHtml(c.name)}</h1>
        ${c.aliases && c.aliases.length ? `<p class="concept-aliases">又名：${c.aliases.map((a) => escapeHtml(a)).join("、")}</p>` : ""}
        <p class="concept-loc">📍 ${loc.book ? `<a class="loc-link" href="#/textbook/${c.id.split("_")[0]}/${encodeURIComponent(loc.book)}">${escapeHtml(locStr)}</a>` : escapeHtml(locStr)}${c.pages ? " · p." + escapeHtml(c.pages) : ""}</p>
        <div class="mastery">
          <span class="mastery-label">我的标记</span>
          <button class="m-btn m-ok${myMastery === "ok" ? " is-active" : ""}" data-m="ok">✓ 已掌握</button>
          <button class="m-btn m-weak${myMastery === "weak" ? " is-active" : ""}" data-m="weak">⚑ 薄弱</button>
        </div>
      </header>

      <section class="block block-chain reveal">
        <h2 class="block-title"><span class="tick"></span>来龙去脉</h2>
        <div class="view-tabs">
          <button class="tab is-active" data-view="chain">知识链</button>
          <button class="tab" data-view="timeline">学习旅程</button>
          <button class="tab" data-view="path">学习路径</button>
        </div>
        <div class="chain-wrap" id="chain"></div>
        <div class="chain-wrap" id="timeline" hidden></div>
        <div class="chain-wrap" id="path" hidden></div>
        <p class="chain-note">依据课程前置关系生成，供学习顺序参考。</p>
      </section>

      <section class="block block-what reveal">
        <h2 class="block-title"><span class="tick"></span>是什么</h2>
        ${c.definition ? `<p class="def">${escapeHtml(c.definition)}</p>` : `<p class="muted">（暂无定义）</p>`}
        ${c.formula ? `<div class="formula">${escapeHtml("$$" + c.formula + "$$")}</div>` : ""}
        ${c.importance ? `<p class="imp">课标要求：${escapeHtml(c.importance)}</p>` : ""}
        ${c.unit ? `<p class="imp">单位：${escapeHtml(c.unit)}</p>` : ""}
        ${examples.length ? `<div class="examples"><span class="ex-label">教材例题</span>${examples.map((e) => `<p class="ex">${escapeHtml(String(e))}</p>`).join("")}</div>` : ""}
      </section>

      ${c.experiments.length ? `<section class="block reveal">
        <h2 class="block-title"><span class="tick"></span>怎么验证</h2>
        ${c.experiments.map(expCard).join("")}
      </section>` : ""}

      ${hasPractice ? `<section class="block block-practice reveal">
        <h2 class="block-title"><span class="tick"></span>例题与练习
          <button type="button" class="practice-toggle" id="practice-toggle" title="隐藏答案，先自己做再自评">练习模式</button></h2>
        ${c.afterclass.length ? `
          <p class="ex-label">课后练习</p>
          ${c.afterclass.slice(0, 4).map(exCard).join("")}
          ${c.afterclass.length > 4 ? `<p class="muted skill-note">还有 ${c.afterclass.length - 4} 道课后练习未展示。</p>` : ""}` : ""}
        ${c.exercises.length ? `
          <p class="ex-label">教材例题</p>
          ${c.exercises.slice(0, 3).map(exCard).join("")}` : ""}
      </section>` : `<section class="block block-no-practice reveal">
        <h2 class="block-title"><span class="tick"></span>例题与练习</h2>
        <p class="no-practice">这个概念暂无内置例题。<button type="button" class="linkish" id="ask-ai">让 AI 为你出题 →</button></p>
      </section>`}

      ${c.is_a && c.is_a.length && !relsInChain ? `<section class="block reveal">
        <h2 class="block-title"><span class="tick"></span>属于</h2>
        <div class="chips">${c.is_a.map((r) => `<a class="chip sc-${stageClass(r.stage)}" href="#/concept/${r.id}">${escapeHtml(r.name)}</a>`).join("")}</div>
      </section>` : ""}

      ${c.related.length && !relsInChain ? `<section class="block reveal">
        <h2 class="block-title"><span class="tick"></span>相关</h2>
        <div class="chips">${c.related.map((r) => `<a class="chip sc-${stageClass(r.stage)}" href="#/concept/${r.id}">${escapeHtml(r.name)}</a>`).join("")}</div>
      </section>` : ""}

      ${c.skills && c.skills.length ? `<section class="block block-skills reveal">
        <h2 class="block-title"><span class="tick"></span>相关技能</h2>
        <div class="chips">${c.skills.map((sk) => `<a class="chip" href="#/skill/${sk.id}">${escapeHtml(sk.name)}</a>`).join("")}</div>
        <p class="muted skill-note">常配合使用的技能（与本课同节出现）${c.skill_count > c.skills.length ? `，共 ${c.skill_count} 个，这里展示 ${c.skills.length} 个` : ""}。</p>
      </section>` : ""}

      <section class="block block-ai reveal">
        <h2 class="block-title"><span class="tick"></span>AI 讲解</h2>
        <div id="ai-mount"></div>
      </section>
    </article>`;

  renderChain(app.querySelector("#chain"), c);

  // 知识链 ⇄ 学习旅程 ⇄ 学习路径 切换；时间线与路径首次激活才渲染（保留渐入动画、避免无谓计算）。
  const chainWrap = app.querySelector("#chain");
  const tlWrap = app.querySelector("#timeline");
  const pathWrap = app.querySelector("#path");
  let tlRendered = false;
  let pathRendered = false;
  app.querySelectorAll(".view-tabs .tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      app.querySelectorAll(".view-tabs .tab").forEach((b) => b.classList.toggle("is-active", b === btn));
      chainWrap.hidden = view !== "chain";
      tlWrap.hidden = view !== "timeline";
      pathWrap.hidden = view !== "path";
      if (view === "timeline" && !tlRendered) {
        renderTimeline(tlWrap, c);
        tlRendered = true;
      }
      if (view === "path" && !pathRendered) {
        renderPath(pathWrap, c);
        unbindPath = pathWrap._unbindPath || null;
        pathRendered = true;
      }
    });
  });

  mountAI(app.querySelector("#ai-mount"), c);
  pushRecent({ id: c.id, name: c.name, stage: c.stage });

  // 无内置例题时，引导到 AI 讲解块出题：滚动定位。已配 key → 预填输入框；
  // 未配 key → 把问题作为 pending 传入，密钥保存后自动问出第一问（不再停在空表单）。
  const askAi = app.querySelector("#ask-ai");
  if (askAi) askAi.addEventListener("click", () => {
    app.querySelector(".block-ai").scrollIntoView({ behavior: "smooth" });
    const inp = app.querySelector(".ai-input input");
    if (inp) {
      inp.value = "针对这个概念出 3 道题：1 基础 1 变式 1 综合";
      inp.focus();
    } else {
      mountAI(app.querySelector("#ai-mount"), c, "针对这个概念出 3 道题：1 基础 1 变式 1 综合");
    }
  });

  // 练习模式：隐藏答案/解析，逐题自评；"做错"收录进错题本（按题干去重）。
  const practiceBlock = app.querySelector(".block-practice");
  const practiceToggle = app.querySelector("#practice-toggle");
  if (practiceToggle && practiceBlock) {
    // 收录原始数据（含 $...$ 公式原文）而非刮取 KaTeX 渲染后的 DOM 文本——
    // 渲染后 textContent 会把公式的隐藏注释与可见字形重复拼接，存进错题本就无法再渲染。
    // 顺序与模板一致：课后练习前 4 道 + 教材例题前 3 道。
    const shownEx = [...c.afterclass.slice(0, 4), ...c.exercises.slice(0, 3)];
    practiceToggle.addEventListener("click", () => {
      const on = practiceBlock.classList.toggle("practice-on");
      practiceToggle.textContent = on ? "退出练习" : "练习模式";
      practiceToggle.classList.toggle("is-active", on);
    });
    // 每张题卡注入自评操作条（仅练习模式可见）。
    practiceBlock.querySelectorAll(".ex-card").forEach((card, idx) => {
      const actions = document.createElement("div");
      actions.className = "ex-actions";
      actions.innerHTML = `
        <button type="button" class="ex-reveal">查看答案</button>
        <button type="button" class="ex-judge j-ok">✓ 做对</button>
        <button type="button" class="ex-judge j-no">✗ 做错</button>`;
      card.appendChild(actions);
      actions.querySelector(".ex-reveal").addEventListener("click", () => card.classList.add("revealed"));
      actions.querySelectorAll(".ex-judge").forEach((btn) => {
        btn.addEventListener("click", () => {
          const ok = btn.classList.contains("j-ok");
          card.classList.toggle("judged-ok", ok);
          card.classList.toggle("judged-no", !ok);
          if (!ok) {
            const raw = shownEx[idx];
            if (raw) addMistake(c, { stem: raw.stem, answer: raw.answer, analysis: raw.analysis });
          }
        });
      });
    });
  }

  // 掌握度标记：再点同一按钮即取消；变更后就地刷新头部按钮与链上节点着色。
  app.querySelectorAll(".mastery .m-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setMastery(c.id, getMastery(c.id) === btn.dataset.m ? "" : btn.dataset.m);
    });
  });
  if (unbindMastery) unbindMastery();
  if (unbindPath) { unbindPath(); unbindPath = null; }
  const onMastery = (e) => {
    const { id, state } = e.detail;
    app.querySelectorAll(`.chain-node[href="#/concept/${id}"], .tl-node[href="#/concept/${id}"]`).forEach((el) => {
      el.classList.toggle("is-ok", state === "ok");
      el.classList.toggle("is-weak", state === "weak");
    });
    if (id === c.id) {
      app.querySelectorAll(".mastery .m-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.m === state));
    }
  };
  window.addEventListener("mastery-change", onMastery);
  unbindMastery = () => window.removeEventListener("mastery-change", onMastery);

  renderMath(app);
  bindExToggles(app);
  observeReveals(app);
  window.scrollTo(0, 0);
}
