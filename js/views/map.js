// 学年时间线（宏观）：把一个学科的概念按学期铺开，化解"知识地图太密"——
// 以时间为轴分块、默认折叠，点开任一学期才展开该学期的概念（细节按需呈现）。

import { allMastery, getView, loadSubject } from "../store.js";
import { escapeHtml, observeReveals, stageClass, stageOfTerm, SUBJECTS, SUBJECT_LABEL, termLabel } from "../util.js";

const CAP = 24; // 每学期最多直接展示的概念数，超出折叠为"还有 N 个"

export async function renderMap(app, subject = "math") {
  if (!SUBJECT_LABEL[subject]) subject = "math";
  app.innerHTML = `<div class="loading">正在加载…</div>`;
  const map = await loadSubject(subject);
  const concepts = Object.values(map);
  const mast = allMastery();
  const view = getView();

  // 按学期分组（仅含真实存在的学期），学期升序。
  const byTerm = {};
  for (const c of concepts) {
    if (c.term == null) continue;
    (byTerm[c.term] ||= []).push(c);
  }
  const terms = Object.keys(byTerm).map(Number).sort((a, b) => a - b);

  app.innerHTML = `
    <article class="browse">
      <a class="crumb" href="#/">← 知脉</a>
      <header class="browse-head reveal">
        <h1 class="browse-title">学年时间线</h1>
        <p class="browse-sub">把${SUBJECT_LABEL[subject]}的 <b>${concepts.length}</b> 个概念按学期铺开——看清知识在时间里的分布。点任一学期，展开该学期的概念；<span class="browse-chain-mark">⛓</span> 表示带有知识链。</p>
        ${view > 0 ? `<p class="browse-view-note">当前视角：已学到 <b>${termLabel(view)}</b>——灰显的学期是你已学过的内容。</p>` : ""}
      </header>
      <nav class="view-tabs browse-tabs">
        ${SUBJECTS.map((s) => `<a class="tab ${s.id === subject ? "is-active" : ""}" href="#/timeline/${s.id}">${s.label}</a>`).join("")}
        <a class="tb-switch" href="#/textbook/${subject}">⇄ 教材目录</a>
      </nav>
      <div class="browse-rail" id="rail"></div>
    </article>`;

  const rail = app.querySelector("#rail");
  for (const t of terms) {
    const list = byTerm[t];
    const isFirst = t === terms[0];
    const isHere = view > 0 && t === view;
    const learned = view > 0 && t <= view;
    const open = view > 0 ? isHere : isFirst;
    const stage = stageOfTerm(t);
    const sc = stageClass(stage);
    const chainedCount = list.filter((c) => (c.prereq_chain || []).length > 0).length;
    const okCount = list.filter((c) => mast[c.id] === "ok").length;

    // 教材若无上下册之分（如物理"九年级全一册"，grade 字段不带上/下），标签如实标注。
    const bookGrade = list[0].grade || "";
    const wholeYear = t >= 13 && t <= 18 && bookGrade && !/[上下]$/.test(bookGrade);
    const label = wholeYear ? bookGrade + "·全一册" : termLabel(t);

    // 概念按前置链长度降序（链长者更"枢纽"，排在前面）。
    // 默认只展示前 CAP 个，其余收入"还有 N 个"按钮，点开即展开。
    const sorted = [...list].sort((a, b) => (b.prereq_chain || []).length - (a.prereq_chain || []).length);
    const shown = sorted.slice(0, CAP);
    const rest = sorted.slice(CAP);
    const chip = (c) => {
      const chained = (c.prereq_chain || []).length > 0;
      return `<a class="bchip sc-${stageClass(c.stage)}" href="#/concept/${c.id}">${chained ? '<span class="bchip-chain">⛓</span>' : ""}${escapeHtml(c.name)}</a>`;
    };

    const term = document.createElement("section");
    term.className = "browse-term reveal" + (isHere ? " is-here" : learned ? " is-learned" : "");
    term.innerHTML = `
      <button class="term-head sc-${sc}${open ? " is-open" : ""}" aria-expanded="${open}">
        <span class="term-dot"></span>
        <span class="term-label">${escapeHtml(label)}</span>
        <span class="term-stage">${escapeHtml(stage)}</span>
        <span class="term-count">${list.length}</span>
        ${chainedCount ? `<span class="term-chained">⛓ ${chainedCount}</span>` : ""}
        ${okCount ? `<span class="term-ok">✓ ${okCount}/${list.length}</span>` : ""}
        ${isHere ? '<span class="term-here">你在这</span>' : ""}
        <span class="term-caret">▸</span>
      </button>
      <div class="term-chips"${open ? "" : " hidden"}>
        ${shown.map(chip).join("")}
        ${rest.length ? `<span class="term-chips-rest" hidden>${rest.map(chip).join("")}</span>
        <button class="bchip-more" aria-expanded="false">还有 ${rest.length} 个概念 ▾</button>` : ""}
      </div>`;

    const head = term.querySelector(".term-head");
    const chips = term.querySelector(".term-chips");
    head.addEventListener("click", () => {
      const open = chips.hidden;
      chips.hidden = !open;
      head.setAttribute("aria-expanded", String(open));
      head.classList.toggle("is-open", open);
    });

    const more = term.querySelector(".bchip-more");
    if (more) {
      const restBox = term.querySelector(".term-chips-rest");
      more.addEventListener("click", () => {
        const open = restBox.hidden;
        restBox.hidden = !open;
        more.setAttribute("aria-expanded", String(open));
        more.textContent = open ? "收起 ▴" : `还有 ${rest.length} 个概念 ▾`;
      });
    }

    rail.appendChild(term);
  }

  observeReveals(app);
  window.scrollTo(0, 0);
}
