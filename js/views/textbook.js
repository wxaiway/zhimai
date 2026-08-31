// 教材视图：按"书 → 章 → 节 → 概念"梳理，贴合学生沿教材整理的日常。
// 数据全部来自概念的 location 字段；章/节按中文数字序号排序。

import { allMastery, loadSubject } from "../store.js";
import { escapeHtml, observeReveals, stageClass, stageOfTerm, SUBJECTS, SUBJECT_LABEL, termLabel } from "../util.js";

const CN_DIGIT = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

// 解析"十二""二十一"式中文数字（覆盖一至九十九）。
function cnNum(s) {
  const m = String(s).match(/^([一二三四五六七八九]?)十([一二三四五六七八九]?)$/) ||
            String(s).match(/^([一二三四五六七八九])$/);
  if (!m) return 999;
  if (m[0].includes("十")) {
    const tens = m[1] ? CN_DIGIT[m[1]] : 1;
    const ones = m[2] ? CN_DIGIT[m[2]] : 0;
    return tens * 10 + ones;
  }
  return CN_DIGIT[m[1]] || 999;
}
function nthOrder(name, unit) {
  const m = String(name || "").match(new RegExp("第([一二三四五六七八九十]+)" + unit));
  return m ? cnNum(m[1]) : 999;
}

const chip = (c) => {
  const chained = (c.prereq_chain || []).length > 0;
  return `<a class="bchip sc-${stageClass(c.stage)}" href="#/concept/${c.id}">${chained ? '<span class="bchip-chain">⛓</span>' : ""}${escapeHtml(c.name)}</a>`;
};

function subjectTabs(subject) {
  return `<nav class="view-tabs browse-tabs">
    ${SUBJECTS.map((s) => `<a class="tab ${s.id === subject ? "is-active" : ""}" href="#/textbook/${s.id}">${s.label}</a>`).join("")}
    <a class="tb-switch" href="#/timeline/${subject}">⇄ 学年时间线</a>
  </nav>`;
}

export async function renderTextbook(app, subject, book) {
  if (!SUBJECT_LABEL[subject]) subject = "math";
  app.innerHTML = `<div class="loading">正在加载…</div>`;
  const map = await loadSubject(subject);
  const concepts = Object.values(map).filter((c) => (c.location || {}).book);
  const mast = allMastery();

  // 按书分组，书序取所含概念的最小学期号。
  const byBook = {};
  for (const c of concepts) {
    const b = c.location.book;
    (byBook[b] ||= { list: [], term: Infinity }).list.push(c);
    byBook[b].term = Math.min(byBook[b].term, c.term || 99);
  }
  const books = Object.keys(byBook).sort((a, b) => byBook[a].term - byBook[b].term);

  if (book && byBook[book]) return renderBook(app, subject, book, byBook[book].list);

  app.innerHTML = `
    <article class="browse">
      <a class="crumb" href="#/">← 知脉</a>
      <header class="browse-head reveal">
        <h1 class="browse-title">教材目录</h1>
        <p class="browse-sub">把${SUBJECT_LABEL[subject]}的 <b>${concepts.length}</b> 个概念按教材的<b>章 · 节</b>铺开——沿书梳理，逐节展开。<span class="browse-chain-mark">⛓</span> 表示带有知识链。</p>
      </header>
      ${subjectTabs(subject)}
      <div class="browse-rail" id="rail">
        ${books.map((b) => {
          const g = byBook[b];
          const stage = stageOfTerm(g.term) || g.list[0].stage;
          const chained = g.list.filter((c) => (c.prereq_chain || []).length > 0).length;
          const ok = g.list.filter((c) => mast[c.id] === "ok").length;
          return `<a class="term-head sc-${stageClass(stage)} reveal" href="#/textbook/${subject}/${encodeURIComponent(b)}">
            <span class="term-dot"></span>
            <span class="term-label">${escapeHtml(b)}</span>
            <span class="term-stage">${escapeHtml(stage)}</span>
            <span class="term-count">${g.list.length}</span>
            ${chained ? `<span class="term-chained">⛓ ${chained}</span>` : ""}
            ${ok ? `<span class="term-ok">✓ ${ok}/${g.list.length}</span>` : ""}
            <span class="term-caret">▸</span>
          </a>`;
        }).join("")}
      </div>
    </article>`;

  observeReveals(app);
  window.scrollTo(0, 0);
}

async function renderBook(app, subject, book, list) {
  // 章 → 节 → 概念。
  const byChapter = {};
  for (const c of list) {
    const ch = c.location.chapter || "（未分章）";
    const sec = c.location.section || "（未分节）";
    ((byChapter[ch] ||= {})[sec] ||= []).push(c);
  }
  const chapters = Object.keys(byChapter).sort((a, b) => nthOrder(a, "章") - nthOrder(b, "章"));

  const stage = list[0].stage;
  app.innerHTML = `
    <article class="browse">
      <a class="crumb" href="#/textbook/${subject}">← ${escapeHtml(SUBJECT_LABEL[subject])}教材目录</a>
      <header class="browse-head reveal">
        <h1 class="browse-title">${escapeHtml(book)}</h1>
        <p class="browse-sub">共 <b>${list.length}</b> 个概念，按章 · 节铺开。点任一章展开；<span class="browse-chain-mark">⛓</span> 表示带有知识链。</p>
      </header>
      ${subjectTabs(subject)}
      <div class="browse-rail" id="rail"></div>
    </article>`;

  const rail = app.querySelector("#rail");
  for (const ch of chapters) {
    const secs = byChapter[ch];
    const isFirst = ch === chapters[0];
    const secNames = Object.keys(secs).sort((a, b) => nthOrder(a, "节") - nthOrder(b, "节"));
    const all = secNames.flatMap((s) => secs[s]);
    const chained = all.filter((c) => (c.prereq_chain || []).length > 0).length;

    const wrap = document.createElement("section");
    wrap.className = "browse-term reveal";
    wrap.innerHTML = `
      <button class="term-head sc-${stageClass(stage)}${isFirst ? " is-open" : ""}" aria-expanded="${isFirst}">
        <span class="term-dot"></span>
        <span class="term-label">${escapeHtml(ch)}</span>
        <span class="term-count">${all.length}</span>
        ${chained ? `<span class="term-chained">⛓ ${chained}</span>` : ""}
        <span class="term-caret">▸</span>
      </button>
      <div class="term-chips"${isFirst ? "" : " hidden"}>
        ${secNames.map((s) => `
          <div class="tb-section">
            <p class="tb-sec-name">${escapeHtml(s)}<span class="tb-sec-count">${secs[s].length}</span></p>
            <div class="tb-sec-chips">${secs[s].map(chip).join("")}</div>
          </div>`).join("")}
      </div>`;

    const head = wrap.querySelector(".term-head");
    const body = wrap.querySelector(".term-chips");
    head.addEventListener("click", () => {
      const open = body.hidden;
      body.hidden = !open;
      head.setAttribute("aria-expanded", String(open));
      head.classList.toggle("is-open", open);
    });
    rail.appendChild(wrap);
  }

  observeReveals(app);
  window.scrollTo(0, 0);
}
