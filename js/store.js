// 数据加载与缓存：启动加载 index.json，按学科+学段懒加载数据。
// 文件命名：data/{subject}_{stageCode}.json（stageCode: xx/cz/bx/xzx）。

const cache = {};   // key: "math_cz" → { [id]: concept }
let index = null;

const STAGE_CODES = ["xx", "cz", "bx", "xzx"];

export async function loadIndex() {
  if (index) return index;
  try {
    const r = await fetch("data/index.json");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    index = await r.json();
  } catch (e) {
    document.getElementById("app").innerHTML =
      `<div class="loading">数据加载失败（${e.message}）。请通过 HTTP 服务打开，如：<code>python3 -m http.server</code></div>`;
    throw e;
  }
  return index;
}

export function subjectOf(id) {
  return id.split("_")[0];
}

// 从概念 id 推断学段代码：xzxbx→xzx, bx→bx, 7-9→cz, 1-6→xx。
export function stageCodeOf(id) {
  const tail = id.slice(id.indexOf("_") + 1);
  if (tail.startsWith("xzxbx")) return "xzx";
  if (tail.startsWith("bx")) return "bx";
  const g = parseInt(tail, 10);
  return g >= 7 ? "cz" : "xx";
}

// 加载单个学段文件。
async function loadStage(subject, code) {
  const key = `${subject}_${code}`;
  if (cache[key]) return cache[key];
  const r = await fetch(`data/${key}.json`);
  if (!r.ok) return null; // 该学科无此学段（如物理无小学）
  const data = await r.json();
  const map = {};
  for (const c of data) map[c.id] = c;
  cache[key] = map;
  return map;
}

// 加载整个学科（并行拉所有学段分片，合并为一张 map）。
export async function loadSubject(subject) {
  if (cache[subject]) return cache[subject];
  const parts = await Promise.all(STAGE_CODES.map((code) => loadStage(subject, code)));
  const map = {};
  for (const p of parts) { if (p) Object.assign(map, p); }
  cache[subject] = map;
  return map;
}

// 获取单个概念：只加载对应学段分片（最小网络开销）。
export async function getConcept(id) {
  const subject = subjectOf(id);
  const code = stageCodeOf(id);
  const map = await loadStage(subject, code);
  return (map && map[id]) || null;
}

let skills = null;
export async function loadSkills() {
  if (!skills) {
    const list = await (await fetch("data/skills.json")).json();
    skills = {};
    for (const s of list) skills[s.id] = s;
  }
  return skills;
}

export async function getSkill(id) {
  const map = await loadSkills();
  return map[id] || null;
}

// 最近看过（localStorage，供首页"接着学"）。
const RECENT_KEY = "zhimai-recent";

export function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; }
}

export function pushRecent(item) {
  try {
    const list = getRecent().filter((x) => x.id !== item.id);
    list.unshift({ id: item.id, name: item.name, stage: item.stage });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
  } catch (e) {}
}

// 掌握度（localStorage 三态："" 未标记 / "ok" 已掌握 / "weak" 薄弱）。
// 变更后派发 mastery-change 事件，供各视图就地刷新着色。
const MASTERY_KEY = "zhimai-mastery";

export function allMastery() {
  try { return JSON.parse(localStorage.getItem(MASTERY_KEY)) || {}; } catch (e) { return {}; }
}

export function getMastery(id) {
  return allMastery()[id] || "";
}

export function setMastery(id, state) {
  const m = allMastery();
  if (state) m[id] = state;
  else delete m[id];
  try { localStorage.setItem(MASTERY_KEY, JSON.stringify(m)); } catch (e) {}
  window.dispatchEvent(new CustomEvent("mastery-change", { detail: { id, state: state || "" } }));
}

// 视角（localStorage）：用户当前的"我是几年级"，存学期序号 term（1~24），0 = 全貌（不限）。
// 全站据此聚焦默认呈现：首页给"下一步"推荐，知识链区分"已学/将学"。变更后派发 view-change。
const VIEW_KEY = "zhimai-view";

export function getView() {
  try { return JSON.parse(localStorage.getItem(VIEW_KEY)) || 0; } catch (e) { return 0; }
}

export function setView(term) {
  const t = Number(term) || 0;
  try {
    if (t) localStorage.setItem(VIEW_KEY, JSON.stringify(t));
    else localStorage.removeItem(VIEW_KEY);
  } catch (e) {}
  window.dispatchEvent(new CustomEvent("view-change", { detail: { term: t } }));
}

// 错题本（localStorage）：练习模式自评"做错"时收录，按概念聚合。
// 结构：{ [conceptId]: { name, stage, items: [{ stem, answer, analysis, at, box, next }] } }
// 间隔复习（Leitner）：box=连续答对次数，next=下次复习时间戳。
// 旧数据无 box/next 字段时按 box=0、next=0 处理（即已到期，随时可复习）。
// 变更后派发 mistakes-change 事件，供首页入口与错题页刷新。
const MISTAKES_KEY = "zhimai-mistakes";
const DAY = 864e5;
// 连续答对第 1/2/3/4 次后，分别隔 1/3/7/16 天再复习；第 5 次答对即"毕业"移出错题本。
const REVIEW_INTERVALS = [1, 3, 7, 16];

export function allMistakes() {
  try { return JSON.parse(localStorage.getItem(MISTAKES_KEY)) || {}; } catch (e) { return {}; }
}

export function mistakeCount() {
  return Object.values(allMistakes()).reduce((n, g) => n + (g.items ? g.items.length : 0), 0);
}

export function addMistake(concept, ex) {
  const m = allMistakes();
  const g = (m[concept.id] ||= { name: concept.name, stage: concept.stage, items: [] });
  const stem = String(ex.stem || "").trim();
  if (!g.items.some((it) => it.stem === stem)) {
    const now = Date.now();
    g.items.push({ stem, answer: ex.answer || "", analysis: ex.analysis || "", at: now, box: 0, next: now });
    try { localStorage.setItem(MISTAKES_KEY, JSON.stringify(m)); } catch (e) {}
    window.dispatchEvent(new CustomEvent("mistakes-change", { detail: { id: concept.id } }));
  }
}

// 全部错题摊平为 [{ conceptId, name, stage, item }]，按到期时间升序（最久未复习的排前）。
export function flatMistakes() {
  const m = allMistakes();
  const out = [];
  for (const [id, g] of Object.entries(m)) {
    for (const it of (g.items || [])) out.push({ conceptId: id, name: g.name, stage: g.stage, item: it });
  }
  out.sort((a, b) => (a.item.next || 0) - (b.item.next || 0));
  return out;
}

// 当前到期（next <= now）待复习的错题。
export function dueMistakes(now = Date.now()) {
  return flatMistakes().filter((x) => (x.item.next || 0) <= now);
}

export function dueCount(now = Date.now()) {
  return dueMistakes(now).length;
}

// 复习自评：答对 → box+1 并按间隔推后 next，超过最高间隔则毕业（移出错题本）；
// 答错 → box 归零、1 天后再来。返回 { graduated, next }，落盘后派发 mistakes-change。
export function judgeMistake(conceptId, stem, correct, now = Date.now()) {
  const m = allMistakes();
  const g = m[conceptId];
  const it = g && (g.items || []).find((x) => x.stem === stem);
  if (!it) return { graduated: false, next: 0 };
  let graduated = false;
  if (correct) {
    it.box = (it.box || 0) + 1;
    if (it.box > REVIEW_INTERVALS.length) {
      g.items = g.items.filter((x) => x.stem !== stem);
      if (!g.items.length) delete m[conceptId];
      graduated = true;
    } else {
      it.next = now + REVIEW_INTERVALS[it.box - 1] * DAY;
    }
  } else {
    it.box = 0;
    it.next = now + REVIEW_INTERVALS[0] * DAY;
  }
  try { localStorage.setItem(MISTAKES_KEY, JSON.stringify(m)); } catch (e) {}
  window.dispatchEvent(new CustomEvent("mistakes-change", { detail: { id: conceptId } }));
  return { graduated, next: graduated ? 0 : it.next };
}

export function removeMistake(conceptId, stem) {
  const m = allMistakes();
  const g = m[conceptId];
  if (!g) return;
  g.items = g.items.filter((it) => it.stem !== stem);
  if (!g.items.length) delete m[conceptId];
  try { localStorage.setItem(MISTAKES_KEY, JSON.stringify(m)); } catch (e) {}
  window.dispatchEvent(new CustomEvent("mistakes-change", { detail: { id: conceptId } }));
}

export function clearMistakes() {
  try { localStorage.removeItem(MISTAKES_KEY); } catch (e) {}
  window.dispatchEvent(new CustomEvent("mistakes-change", { detail: { id: null } }));
}
