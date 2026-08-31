// AI 讲解：用户自带密钥（仅存本机 localStorage），走 OpenAI 兼容端点直连
// （百炼 DashScope / DeepSeek / OpenAI / 自定义代理），流式输出，多轮对话。

import { buildContext } from "./context.js";
import { escapeHtml, mdToHtml, renderMath } from "./util.js";

const KEY = "zhimai-ai";

export const PROVIDERS = {
  dashscope: { label: "百炼（阿里 DashScope）", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen3.7-max" },
  deepseek: { label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  openai: { label: "OpenAI", baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  custom: { label: "自定义（OpenAI 兼容）", baseURL: "", model: "" },
};

// 快捷问题：按当前概念的图谱结构动态生成，让提问用上知识链/去向/关联，而非套话。
function quickQuestions(c) {
  const qs = [`用大白话讲讲「${c.name}」`];
  const chain = c.prereq_chain || [];
  if (chain.length >= 2) qs.push(`从「${chain[0].name}」到「${c.name}」，这条线怎么一步步搭起来的？`);
  else if (!chain.length) qs.push(`为什么「${c.name}」是起点概念？不学它后面会卡在哪？`);
  else qs.push(`它和前置知识「${chain[0].name}」怎么衔接？`);
  if (c.dependents && c.dependents.length) qs.push(`学好它能解锁什么？「${c.dependents[0].name}」为什么需要它？`);
  else if (c.related && c.related.length) qs.push(`「${c.name}」和「${c.related[0].name}」容易混，怎么区分？`);
  qs.push(`针对这个概念出 3 道题：1 基础 1 变式 1 综合`);
  return qs;
}

function getSettings() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
}
function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
}
function clearSettings() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}

// ---------- 请求：OpenAI 兼容 chat/completions，SSE 流式 ----------

async function chatStream(settings, messages, onToken, onThink, signal) {
  const body = { model: settings.model, messages, stream: true };
  // Qwen3 系默认开启思考；百炼端点显式传开关（其他平台不认此参数，不发送）。
  if (settings.provider === "dashscope") body.enable_thinking = !!settings.thinking;
  const res = await fetch(settings.baseURL.replace(/\/+$/, "") + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + settings.key },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(httpHint(res.status, await safeDetail(res)));

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta;
        const think = delta?.reasoning_content || delta?.reasoning;
        if (think) onThink(think);
        if (delta?.content) onToken(delta.content);
      } catch (e) { /* 半行/心跳，忽略 */ }
    }
  }
}

async function safeDetail(res) {
  try { return (await res.json()).error?.message || ""; } catch (e) { return ""; }
}

function httpHint(status, detail) {
  if (status === 401) return "密钥无效或已过期（401）。";
  if (status === 403) return "密钥无权限访问该平台（403）。";
  if (status === 429) return "请求过频或额度用尽（429）。";
  if (status === 404) return "接口或模型名不存在（404），请检查 Base URL 与模型。";
  return `请求失败（${status}）${detail ? "：" + detail : ""}`;
}

function friendly(err) {
  if (err instanceof TypeError) {
    return "无法连接：网络错误，或该平台不允许浏览器直连（CORS）。可换平台，或在“自定义”里填自建代理地址。";
  }
  return err.message || String(err);
}

// ---------- UI ----------

export function mountAI(mount, concept, pending) {
  if (!mount) return;
  const settings = getSettings();
  if (settings) renderChat(mount, concept, settings, pending);
  else renderSetup(mount, concept, pending);
}

function renderSetup(mount, concept, pending) {
  mount.innerHTML = `
    <p class="ai-intro">接入你自己的大模型，基于这个概念的全景（定义 · 知识链 · 教材位置）即时讲解、答疑、出题。密钥只保存在本机浏览器。</p>
    ${pending ? `<p class="ai-pending">💡 填好密钥保存后，会自动为你「${escapeHtml(pending)}」。</p>` : ""}
    <form class="ai-form">
      <label>平台
        <select class="ai-provider">
          ${Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}">${p.label}</option>`).join("")}
        </select>
      </label>
      <label>API Key
        <input class="ai-key" type="password" placeholder="sk-…" autocomplete="off" required>
      </label>
      <label>Base URL
        <input class="ai-base" type="text" placeholder="https://…/v1" autocomplete="off" spellcheck="false">
      </label>
      <label>模型
        <input class="ai-model" type="text" placeholder="qwen3.7-max" autocomplete="off" spellcheck="false">
      </label>
      <div class="ai-form-actions">
        <button type="submit" class="ai-send">保存并开始</button>
        <label class="ai-opt"><input type="checkbox" class="ai-thinking"> 启用 thinking（深度思考，更慢但更深入；仅百炼 Qwen3 系生效）</label>
      </div>
      <p class="ai-note">浏览器直连平台，需平台允许跨域（CORS）；若被拦截，可在“自定义”里填代理地址。</p>
    </form>`;

  const sel = mount.querySelector(".ai-provider");
  const base = mount.querySelector(".ai-base");
  const model = mount.querySelector(".ai-model");
  const thinkOpt = mount.querySelector(".ai-thinking");
  const sync = () => {
    const p = PROVIDERS[sel.value];
    base.value = p.baseURL;
    model.value = p.model;
    base.disabled = sel.value !== "custom";
    thinkOpt.disabled = sel.value !== "dashscope";
  };
  sel.addEventListener("change", sync);
  sync();

  mount.querySelector(".ai-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const key = mount.querySelector(".ai-key").value.trim();
    if (!key) return;
    saveSettings({ provider: sel.value, key, baseURL: base.value.trim(),
                   model: model.value.trim(), thinking: thinkOpt.checked });
    mount.innerHTML = "";
    renderChat(mount, concept, getSettings(), pending);
  });
}

function renderChat(mount, concept, settings, pending) {
  const messages = [{
    role: "system",
    content: `你是"知脉"网站里的 K12 学习助手。下面是当前概念的图谱上下文，请基于它作答：\n\n${buildContext(concept)}\n\n要求：用中文；面向学生，先讲直觉再讲严谨；公式用 $LaTeX$；不要编造上下文里没有的内容；出题时避开上下文里已有的例题，难度对标课标要求。`,
  }];
  let controller = null;

  mount.innerHTML = `
    <div class="ai-quick">${quickQuestions(concept).map((q) => `<button type="button" class="chip ai-q">${escapeHtml(q)}</button>`).join("")}</div>
    <div class="ai-log" hidden></div>
    <form class="ai-input">
      <input type="text" placeholder="问点什么，比如：为什么需要先学它？" autocomplete="off" spellcheck="false">
      <button type="submit" class="ai-send">发送</button>
    </form>
    <p class="ai-foot">
      <span class="ai-model-tag">${escapeHtml((PROVIDERS[settings.provider]?.label || settings.provider) + " · " + settings.model + (settings.thinking ? " · thinking" : ""))}</span>
      <button type="button" class="ai-reset">重设密钥</button>
    </p>`;

  const log = mount.querySelector(".ai-log");
  const form = mount.querySelector(".ai-input");
  const input = form.querySelector("input");
  const sendBtn = form.querySelector(".ai-send");

  mount.querySelector(".ai-reset").addEventListener("click", () => {
    clearSettings();
    mount.innerHTML = "";
    renderSetup(mount, concept);
  });

  mount.querySelectorAll(".ai-q").forEach((b) => b.addEventListener("click", () => ask(b.textContent)));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (q) ask(q);
  });

  function addTurn(q) {
    log.hidden = false;
    const u = document.createElement("div");
    u.className = "ai-msg ai-msg-user";
    u.textContent = q;
    log.appendChild(u);
    const body = document.createElement("div");
    body.className = "ai-msg ai-msg-bot";
    const stream = document.createElement("div");
    stream.className = "ai-stream";
    body.appendChild(stream);
    log.appendChild(body);
    return stream;
  }

  async function ask(q) {
    if (controller) return; // 上一条还在回复
    input.value = "";
    messages.push({ role: "user", content: q });
    const stream = addTurn(q);
    stream.classList.add("is-live");
    controller = new AbortController();
    const onStop = () => controller.abort();
    sendBtn.textContent = "停止";
    sendBtn.addEventListener("click", onStop, { once: true });

    let acc = "";
    let thinkAcc = "", thinkBox = null, thinkBody = null;
    const ensureThink = () => {
      if (thinkBox) return;
      thinkBox = document.createElement("details");
      thinkBox.className = "ai-think";
      thinkBox.open = true;
      const sum = document.createElement("summary");
      sum.textContent = "思考中…";
      thinkBody = document.createElement("div");
      thinkBody.className = "ai-think-body";
      thinkBox.append(sum, thinkBody);
      stream.parentNode.insertBefore(thinkBox, stream);
    };
    try {
      await chatStream(settings, messages, (t) => {
        acc += t;
        stream.textContent = acc;
        log.scrollTop = log.scrollHeight;
      }, (t) => {
        ensureThink();
        thinkAcc += t;
        thinkBody.textContent = thinkAcc;
        log.scrollTop = log.scrollHeight;
      }, controller.signal);
      messages.push({ role: "assistant", content: acc });
      stream.classList.remove("is-live");
      stream.innerHTML = mdToHtml(acc);
      renderMath(stream);
      if (thinkBox) {
        thinkBox.querySelector("summary").textContent = `思考过程（${thinkAcc.length} 字）`;
        thinkBox.open = false; // 答完自动收起，可再点开回看
      }
    } catch (err) {
      stream.classList.remove("is-live");
      if (err.name === "AbortError") {
        stream.textContent = acc ? acc + "\n（已停止）" : "（已停止）";
        if (acc) messages.push({ role: "assistant", content: acc });
        if (thinkBox) thinkBox.querySelector("summary").textContent = `思考过程（已停止，${thinkAcc.length} 字）`;
      } else {
        messages.pop(); // 撤掉失败的一问，便于重试
        stream.innerHTML = "";
        const em = document.createElement("p");
        em.className = "ai-error";
        em.textContent = friendly(err);
        stream.appendChild(em);
      }
    } finally {
      controller = null;
      sendBtn.removeEventListener("click", onStop);
      sendBtn.textContent = "发送";
    }
  }

  if (pending) ask(pending); // 从"让 AI 出题"进来：存好密钥后自动问出第一问
}
