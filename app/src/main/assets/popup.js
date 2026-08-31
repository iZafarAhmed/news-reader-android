const LANG_PARAMS = "&hl=en-US&gl=US&ceid=US:en";
const T = id => "https://news.google.com/rss/topics/" + id + "?hl=en-US&gl=US&ceid=US%3Aen";
const S = q  => "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + LANG_PARAMS;
const AI_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
let AI_MODEL = localStorage.getItem("aiModel") || "nvidia/nemotron-3.5-lightning-30b-a3b";
let SUPA_URL = localStorage.getItem("supaUrl") || "";
let SUPA_KEY = localStorage.getItem("supaKey") || "";
const supaReady = () => SUPA_URL && SUPA_KEY;
const supaBase = () => SUPA_URL.replace(/\/$/, "") + "/rest/v1/";

const CATS = [
  { id: "settlers", ico: "🗞️", label: "Settlers", url: S("Israeli-settlers"), subs: [] },
  { id: "world", ico: "🌍", label: "World", url: T("CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB"), subs: [
    { label: "Politics", url: S("politics") }, { label: "Conflicts", url: S("war conflict") },
    { label: "Diplomacy", url: S("diplomacy") }, { label: "Society", url: S("society") } ] },
  { id: "business", ico: "💼", label: "Business", url: T("CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB"), subs: [
    { label: "Economy", url: T("CAAqIggKIhxDQkFTRHdvSkwyMHZNR2RtY0hNekVnSmxiaWdBUAE") },
    { label: "Companies", url: S("companies") }, { label: "Finance", url: S("finance banking") },
    { label: "Markets", url: S("stock market") } ] },
  { id: "tech", ico: "💻", label: "Technology", url: T("CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB"), subs: [
    { label: "AI", url: S("artificial intelligence") }, { label: "Software", url: S("software") },
    { label: "Hardware", url: S("hardware semiconductors") }, { label: "Cybersecurity", url: S("cybersecurity") },
    { label: "Startups", url: S("startups") } ] },
  { id: "crypto", ico: "💰", label: "Digital Assets", url: T("CAAqJAgKIh5DQkFTRUFvS0wyMHZNSEk0YkhsM054SUNaVzRvQUFQAQ"), subs: [
    { label: "Bitcoin", url: S("bitcoin") }, { label: "Ethereum", url: S("ethereum") },
    { label: "DeFi", url: S("DeFi") }, { label: "Regulation", url: S("crypto regulation") },
    { label: "Markets", url: S("crypto market trading") } ] },
  { id: "science", ico: "🔬", label: "Science", url: T("CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB"), subs: [
    { label: "Space", url: T("CAAqIggKIhxDQkFTRHdvSkwyMHZNREU0TXpOM0VnSmxiaWdBUAE") },
    { label: "Health", url: T("CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ") },
    { label: "Climate", url: S("climate change") }, { label: "Research", url: S("scientific research") } ] }
];

const $ = id => document.getElementById(id);
const gridEl = $("grid"), pillsEl = $("pills"), subsEl = $("subs"), topstoryEl = $("topstory"),
      briefEl = $("brief"), greetEl = $("greet"), subEl = $("sub"), latestTitle = $("latestTitle"),
      sheetEl = $("sheet"), scrimEl = $("scrim"), toastEl = $("toast"), input = $("q"),
      refreshBtn = $("refresh"), ptrEl = $("ptr"), readerEl = $("reader"), calEl = $("cal");

let currentCat = localStorage.getItem("pill") || "foryou";
let currentSub = null, customFeed = null, lastItems = [];
let saved = JSON.parse(localStorage.getItem("saved") || "[]");
const aiCache = {};

function renderPills() {
  pillsEl.innerHTML = "";
  const mk = (id, label, ico) => {
    const b = document.createElement("button");
    b.className = "pill" + (!customFeed && currentCat === id ? " active" : "");
    b.innerHTML = (ico ? '<span class="pico">' + ico + '</span>' : "") + label;
    b.onclick = () => { customFeed = null; currentCat = id; currentSub = null; localStorage.setItem("pill", id); renderPills(); renderSubs(); loadFeed(); };
    pillsEl.appendChild(b);
  };
  mk("foryou", "For You", "✨");
  CATS.forEach(c => mk(c.id, c.label, c.ico));
  if (customFeed) { const b = document.createElement("button"); b.className = "pill active"; b.textContent = customFeed.label; pillsEl.appendChild(b); }
}
function renderSubs() {
  subsEl.innerHTML = "";
  const cat = CATS.find(c => c.id === currentCat);
  if (customFeed || !cat || !cat.subs.length) { subsEl.classList.add("hidden"); return; }
  subsEl.classList.remove("hidden");
  const mk = (label, active, fn) => { const b = document.createElement("button"); b.className = "subchip" + (active ? " active" : ""); b.textContent = label; b.onclick = fn; subsEl.appendChild(b); };
  mk("All " + cat.label, currentSub === null, () => { currentSub = null; renderSubs(); loadFeed(); });
  cat.subs.forEach((s, i) => mk(s.label, currentSub === i, () => { currentSub = i; renderSubs(); loadFeed(); }));
}

async function loadFeed() {
  setNav("home"); sheetHide(); calEl.classList.remove("show");
  gridEl.innerHTML = ""; topstoryEl.style.display = "none";
  latestTitle.textContent = "LATEST STORIES";
  const cat = CATS.find(c => c.id === currentCat);
  let url = null, label = "For You";
  if (customFeed) { url = customFeed.url; label = customFeed.label; }
  else if (cat && currentSub !== null) { url = cat.subs[currentSub].url; label = cat.label + " · " + cat.subs[currentSub].label; }
  else if (cat) { url = cat.url; label = cat.label; }
  try {
    let items;
    if (!url) {
      subEl.textContent = "Building your briefing…";
      const results = await Promise.allSettled(CATS.map(f => fetch(f.url).then(r => r.text())));
      items = []; const seen = new Set();
      for (const r of results) { if (r.status !== "fulfilled") continue;
        for (const it of parseItems(r.value)) { const k = textOf(it, "title"); if (!seen.has(k)) { seen.add(k); items.push(it); } } }
      items.sort((a, b) => b._t - a._t);
      const h = new Date().getHours();
      greetEl.textContent = h < 5 || h >= 18 ? "GOOD EVENING" : h < 12 ? "GOOD MORNING" : "GOOD AFTERNOON";
      subEl.textContent = "Your 5-minute briefing";
    } else {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      items = parseItems(await res.text());
      greetEl.textContent = label.toUpperCase();
      subEl.textContent = items.length + " articles · newest first";
    }
    lastItems = items;
    archiveItems(items, label); // → Supabase (deduped by link)
    if (!items.length) { subEl.textContent = "No stories found"; return; }
    renderTop(items[0]);
    warm(items[0]);
    const rest = items.slice(1);
    for (let i = 0; i < rest.length; i++) {
      gridEl.appendChild(row(rest[i]));
      if ((i + 1) % 5 === 0 && i + 1 < rest.length) {
        i++;
        const hc = document.createElement("a");
        hc.className = "topstory";
        fillHero(hc, rest[i]);
        gridEl.appendChild(hc);
      }
    }
  } catch (err) { subEl.textContent = "Couldn't load: " + err.message; }
}
function parseItems(text) {
  let xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.querySelector("parsererror")) xml = new DOMParser().parseFromString(text.replace(/&nbsp;/g, "&#160;"), "application/xml");
  return [...xml.querySelectorAll("item")].map(it => { it._t = new Date(textOf(it, "pubDate")).getTime() || 0; return it; });
}

/* ---------- Supabase archive ---------- */
function archiveItems(items, category) {
  if (!supaReady() || !items.length) return;
  const rows = items.map(it => {
    const m = meta(it);
    const ts = new Date(textOf(it, "pubDate"));
    return {
      link: m.link, title: m.title, headline: m.headline, source: m.source,
      source_url: m.sourceUrl, image_url: getImageUrl(it), category: category,
      pub_ts: isNaN(ts) ? null : ts.toISOString(),
      pub_date: isNaN(ts) ? null : ts.toISOString().slice(0, 10)
    };
  });
  fetch(supaBase() + "news?on_conflict=link", {
    method: "POST",
    headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows)
  }).catch(() => {});
}

/* ---------- calendar / archive view ---------- */
let calY, calM, selDate = null;
const iso = (y, m, d) => y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
function renderArchive() {
  setNav("archive"); sheetHide(); readerEl.classList.remove("open");
  briefEl.style.display = "block";
  greetEl.textContent = "ARCHIVE";
  subEl.textContent = supaReady() ? "Pick a date to revisit that day's news" : "Add Supabase URL & key in ☰ More";
  topstoryEl.style.display = "none";
  gridEl.innerHTML = "";
  const now = new Date();
  if (calY === undefined) { calY = now.getFullYear(); calM = now.getMonth(); }
  drawCal();
  if (selDate) loadDay(selDate); else latestTitle.textContent = "STORIES ON THIS DATE";
}
async function drawCal() {
  calEl.innerHTML = ""; calEl.classList.add("show");
  const head = document.createElement("div"); head.className = "cal-head";
  const prev = document.createElement("button"); prev.textContent = "‹";
  prev.onclick = () => { calM--; if (calM < 0) { calM = 11; calY--; } drawCal(); };
  const next = document.createElement("button"); next.textContent = "›";
  next.onclick = () => { calM++; if (calM > 11) { calM = 0; calY++; } drawCal(); };
  const title = document.createElement("span"); title.id = "calTitle";
  title.textContent = new Date(calY, calM).toLocaleString("en", { month: "long", year: "numeric" });
  head.append(prev, title, next); calEl.appendChild(head);
  const g = document.createElement("div"); g.className = "cal-grid";
  ["S","M","T","W","T","F","S"].forEach(d => { const s = document.createElement("span"); s.className = "dow"; s.textContent = d; g.appendChild(s); });
  const first = new Date(calY, calM, 1).getDay();
  const dim = new Date(calY, calM + 1, 0).getDate();
  for (let i = 0; i < first; i++) { const e = document.createElement("span"); e.className = "day empty"; g.appendChild(e); }
  const today = new Date(); const todayStr = iso(today.getFullYear(), today.getMonth(), today.getDate());
  const hasSet = new Set();
  if (supaReady()) {
    try {
      const r = await fetch(supaBase() + "news?select=pub_date&pub_date=gte." + iso(calY, calM, 1) + "&pub_date=lte." + iso(calY, calM, dim) + "&limit=1000",
        { headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY } });
      if (r.ok) (await r.json()).forEach(x => hasSet.add(x.pub_date));
    } catch (e) {}
  }
  for (let d = 1; d <= dim; d++) {
    const ds = iso(calY, calM, d);
    const b = document.createElement("button");
    b.className = "day" + (ds === todayStr ? " today" : "") + (ds === selDate ? " sel" : "") + (hasSet.has(ds) ? " has" : "");
    b.textContent = d;
    b.onclick = () => { selDate = ds; drawCal(); loadDay(ds); };
    g.appendChild(b);
  }
  calEl.appendChild(g);
}
async function loadDay(dateStr) {
  latestTitle.textContent = "STORIES ON " + dateStr;
  gridEl.innerHTML = "";
  if (!supaReady()) return;
  try {
    const r = await fetch(supaBase() + "news?pub_date=eq." + dateStr + "&order=pub_ts.desc&limit=300",
      { headers: { apikey: SUPA_KEY, Authorization: "Bearer " + SUPA_KEY } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const rows = await r.json();
    if (!rows.length) { gridEl.innerHTML = '<div class="row"><div class="txt"><div class="head" style="color:#999">No archived stories for this date.</div></div></div>'; return; }
    rows.forEach(d => gridEl.appendChild(archiveRow(d)));
  } catch (e) {
    gridEl.innerHTML = '<div class="row"><div class="txt"><div class="head" style="color:#999">Archive error: ' + esc(e.message) + "</div></div></div>";
  }
}
function archiveRow(d) {
  const a = document.createElement("a"); a.className = "row"; a.href = d.link; a.target = "_blank"; a.rel = "noopener";
  const txt = document.createElement("div"); txt.className = "txt";
  const sr = document.createElement("div"); sr.className = "srcline";
  sr.innerHTML = (d.source_url ? '<img class="fav" src="' + faviconFor(d.source_url) + '" alt="">' : "") +
    '<span class="src">' + esc(d.source || "") + "</span><span>•</span>" +
    '<svg class="clk" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
    "<span>" + timeAgo(d.pub_ts) + "</span>" +
    (d.category ? "<span>• " + esc(d.category) + "</span>" : "");
  const hd = document.createElement("div"); hd.className = "head"; hd.textContent = d.headline || d.title;
  txt.append(sr, hd); a.appendChild(txt);
  if (d.image_url) { const im = document.createElement("img"); im.className = "thumb"; im.src = d.image_url; im.loading = "lazy"; im.addEventListener("error", () => im.remove()); a.appendChild(im); }
  a.appendChild(saveBtn({ link: d.link, source: d.source, sourceUrl: d.source_url, headline: d.headline || d.title }));
  return a;
}

/* ---------- hero cards ---------- */
function fillHero(el, item) {
  const m = meta(item), cluster = getCluster(item), img = getImageUrl(item);
  el.href = m.link; el.innerHTML = ""; el.style.display = "block";
  if (img) { const im = document.createElement("img"); im.className = "hero"; im.src = img; im.addEventListener("error", () => im.remove()); el.appendChild(im); }
  const body = document.createElement("div"); body.className = "ts-body";
  const k = document.createElement("div"); k.className = "ts-kicker";
  if (m.sourceUrl) { const fv = document.createElement("img"); fv.className = "fav"; fv.src = faviconFor(m.sourceUrl); fv.addEventListener("error", () => fv.remove()); k.appendChild(fv); }
  const ks = document.createElement("span"); ks.textContent = (m.source || "TOP STORY").toUpperCase(); k.appendChild(ks);
  const h = document.createElement("div"); h.className = "ts-head"; h.textContent = m.headline;
  const mt = document.createElement("div"); mt.className = "ts-meta";
  if (cluster.length) { const chip = document.createElement("span"); chip.className = "src-chip"; chip.textContent = cluster.length + " sources"; chip.onclick = e => { e.preventDefault(); e.stopPropagation(); showSheet(cluster); }; mt.appendChild(chip); }
  const ai = document.createElement("span"); ai.className = "src-chip"; ai.textContent = "✨ AI"; ai.onclick = e => { e.preventDefault(); e.stopPropagation(); openReader(item); }; mt.appendChild(ai);
  mt.appendChild(document.createTextNode("· " + timeAgo(textOf(item, "pubDate"))));
  body.append(k, h, mt); el.appendChild(body);
}
function renderTop(item) { fillHero(topstoryEl, item); }

function row(item) {
  const m = meta(item), img = getImageUrl(item);
  const a = document.createElement("a"); a.className = "row"; a.href = m.link; a.target = "_blank"; a.rel = "noopener";
  const txt = document.createElement("div"); txt.className = "txt";
  const sr = document.createElement("div"); sr.className = "srcline";
  sr.innerHTML = (m.sourceUrl ? '<img class="fav" src="' + faviconFor(m.sourceUrl) + '" alt="">' : "") +
    '<span class="src">' + esc(m.source) + "</span><span>•</span>" +
    '<svg class="clk" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
    "<span>" + timeAgo(textOf(item, "pubDate")) + "</span>";
  const hd = document.createElement("div"); hd.className = "head"; hd.textContent = m.headline;
  txt.append(sr, hd); a.appendChild(txt);
  if (img) { const im = document.createElement("img"); im.className = "thumb"; im.src = img; im.loading = "lazy"; im.addEventListener("error", () => im.remove()); a.appendChild(im); }
  const ai = document.createElement("button"); ai.className = "save ai"; ai.textContent = "✨";
  ai.onclick = e => { e.preventDefault(); e.stopPropagation(); openReader(item); };
  a.appendChild(ai);
  a.appendChild(saveBtn(m));
  return a;
}
function saveBtn(m) {
  const b = document.createElement("button");
  b.className = "save" + (saved.some(x => x.link === m.link) ? " on" : "");
  b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
  b.onclick = e => { e.preventDefault(); e.stopPropagation();
    const i = saved.findIndex(x => x.link === m.link);
    if (i >= 0) saved.splice(i, 1); else saved.push(m);
    localStorage.setItem("saved", JSON.stringify(saved));
    b.classList.toggle("on"); toast(i >= 0 ? "Removed from Saved" : "Saved for later"); };
  return b;
}

/* ---------- AI reader ---------- */
let rItem = null, rData = null, rCluster = [], rRelated = [], aiSeq = 0;
function openReader(item) {
  rItem = item; rCluster = getCluster(item); rRelated = relatedFor(item);
  rData = null;
  $("rSource").textContent = meta(item).source || "";
  $("rTitle").textContent = meta(item).headline;
  $("rFull").href = meta(item).link;
  readerEl.classList.add("open");
  ensureAnalysis();
}
$("rClose").onclick = () => readerEl.classList.remove("open");
async function ensureAnalysis() {
  const link = meta(rItem).link;
  if (aiCache[link]) { rData = aiCache[link]; renderAnalysis(); return; }
  $("rBody").innerHTML = '<div class="skel" style="width:45%"></div><div class="skel"></div><div class="skel"></div><div class="skel" style="width:70%"></div><p class="r-note">🤖 Analyzing story…</p>';
  const key = localStorage.getItem("nvidiaKey") || "";
  const ctx = { item: rItem, cluster: rCluster, related: rRelated };
  if (!key) { rData = fallbackFor(ctx); rData.ai = false; renderAnalysis(); toast("No AI key set — offline mode"); return; }
  try {
    rData = await aiAnalyze(key, ctx);
    mergeFallback(rData, ctx);
    rData.ai = true; aiCache[link] = rData; renderAnalysis();
  } catch (e) {
    console.error("AI Error:", e);
    rData = fallbackFor(ctx); rData.ai = false; renderAnalysis();
    $("rBody").insertAdjacentHTML("afterbegin", '<p class="r-note">⚠ ' + esc(e.message) + ' <button class="subchip active" id="retryAi">Retry</button></p>');
    $("retryAi").onclick = () => { delete aiCache[link]; ensureAnalysis(); };
  }
}
async function warm(item) {
  const link = meta(item).link;
  const key = localStorage.getItem("nvidiaKey") || "";
  if (!key || aiCache[link]) return;
  try {
    const ctx = { item, cluster: getCluster(item), related: relatedFor(item) };
    const d = await aiAnalyze(key, ctx);
    mergeFallback(d, ctx);
    d.ai = true; aiCache[link] = d;
  } catch (e) {}
}
function mergeFallback(d, ctx) {
  const fb = fallbackFor(ctx);
  if (!d.quick || !d.quick.length) d.quick = fb.quick;
  if (!d.summary.context) d.summary.context = fb.summary.context;
  if (!d.summary.facts || !d.summary.facts.length) d.summary.facts = fb.summary.facts;
  if (!d.deep.timeline || !d.deep.timeline.length) d.deep.timeline = fb.deep.timeline;
}
function fallbackFor(ctx) {
  const m = meta(ctx.item);
  return {
    quick: ctx.cluster.length ? ctx.cluster.slice(0, 3).map(c => c.source + ": " + c.title) : [m.headline],
    summary: { context: "Offline mode (no AI available). Latest coverage via " + (m.source || "one source") + ".", facts: ctx.cluster.slice(0, 4).map(c => c.source + " — " + c.title) },
    deep: { timeline: ctx.related.slice(0, 5).map(r => timeAgo(textOf(r, "pubDate")) + " — " + textOf(r, "title")), perspectives: [], confirmed: [], unclear: [] }
  };
}
function aiRequest(key, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timed out")), 200000);
    if (window.AndroidBridge) {
      const cbName = "__aiCb" + (++aiSeq);
      window[cbName] = str => { clearTimeout(timer); delete window[cbName];
        try { resolve(JSON.parse(str)); } catch (e) { reject(new Error("Bad bridge response")); } };
      AndroidBridge.postJson(AI_URL, key, JSON.stringify(payload), cbName);
    } else {
      fetch(AI_URL, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key }, body: JSON.stringify(payload) })
        .then(r => r.json().then(j => { clearTimeout(timer);
          if (!r.ok) throw new Error(r.status === 429 ? "Rate limit (429) — wait ~1 min, then Retry" : "API HTTP " + r.status);
          resolve(j); }))
        .catch(e => { clearTimeout(timer); reject(e); });
    }
  });
}
function aiAnalyze(key, ctx) {
  const m = meta(ctx.item);
  const others = ctx.cluster.slice(0, 6).map(c => "- " + c.title + " (" + c.source + ")").join("\n");
  const rel = ctx.related.slice(0, 5).map(r => "- " + textOf(r, "title")).join("\n");
  const payload = {
    model: AI_MODEL, temperature: 0.2, max_tokens: 1200, stream: false,
    chat_template_kwargs: { enable_thinking: false },
    messages: [
      { role: "system", content:
        "You are a news analyst. Reply in PLAIN TEXT only (no JSON, no markdown, no code fences) using EXACTLY this template, with each section word alone on its own line:\n" +
        "QUICK\n- bullet\n- bullet\n- bullet\n" +
        "CONTEXT\n2-3 sentences of context.\n" +
        "FACTS\n- fact\n- fact\n- fact\n- fact\n" +
        "TIMELINE\n- dated event\n- dated event\n" +
        "PERSPECTIVES\nSIDE: name | VIEW: one sentence\nSIDE: name | VIEW: one sentence\n" +
        "CONFIRMED\n- point\n- point\n" +
        "UNCLEAR\n- point\n- point\n" +
        "Keep every line under 25 words." },
      { role: "user", content: "Headline: " + m.headline + "\nSource: " + m.source + "\nPublished: " + textOf(ctx.item, "pubDate") + "\nOther coverage:\n" + (others || "none") + "\nRelated stories:\n" + (rel || "none") }
    ]
  };
  const parse = res => {
    if (res.http_status) throw new Error(res.http_status === 429 ? "Rate limit (429) — wait ~1 min, then Retry" : "API HTTP " + res.http_status);
    if (res.error) throw new Error(String(res.error));
    if (!res.choices || !res.choices[0]) throw new Error("Empty response from AI");
    const content = res.choices[0].message ? (res.choices[0].message.content || "") : "";
    const data = parseAnalysis(content);
    if (!data.quick.length && !data.summary.context) throw new Error("AI returned unreadable text");
    return data;
  };
  const call = p => aiRequest(key, p).then(parse);
  return call(payload).catch(e => {
    if (/400|unsupported|unknown/i.test(e.message)) { delete payload.chat_template_kwargs; return call(payload); }
    throw e;
  });
}
function parseAnalysis(t) {
  const keys = ["QUICK", "CONTEXT", "FACTS", "TIMELINE", "PERSPECTIVES", "CONFIRMED", "UNCLEAR"];
  const pos = k => { const m = new RegExp("(^|\\n)\\s*" + k + "\\s*:?\\s*(\\n|$)").exec(t); return m ? m.index + m[1].length : -1; };
  const marks = keys.map(k => ({ k, i: pos(k) })).filter(x => x.i !== -1).sort((a, b) => a.i - b.i);
  const out = { quick: [], summary: { context: "", facts: [] }, deep: { timeline: [], perspectives: [], confirmed: [], unclear: [] } };
  for (let n = 0; n < marks.length; n++) {
    let start = t.indexOf("\n", marks[n].i);
    start = start === -1 ? marks[n].i : start + 1;
    const end = n + 1 < marks.length ? marks[n + 1].i : t.length;
    const body = t.substring(start, end).trim();
    const lines = body.split("\n").map(l => l.trim()).filter(Boolean);
    const bullets = lines.map(l => l.replace(/^[-•*]\s*/, "")).filter(Boolean);
    if (marks[n].k === "QUICK") out.quick = bullets.slice(0, 3);
    else if (marks[n].k === "CONTEXT") out.summary.context = body.replace(/\s*\n\s*/g, " ");
    else if (marks[n].k === "FACTS") out.summary.facts = bullets.slice(0, 5);
    else if (marks[n].k === "TIMELINE") out.deep.timeline = bullets.slice(0, 6);
    else if (marks[n].k === "PERSPECTIVES") out.deep.perspectives = lines.filter(l => l.includes("|")).map(l => {
      const p = l.split("|");
      return { side: (p[0] || "").replace(/^SIDE:\s*/i, "").trim(), view: (p[1] || "").replace(/^VIEW:\s*/i, "").trim() };
    });
    else if (marks[n].k === "CONFIRMED") out.deep.confirmed = bullets.slice(0, 5);
    else if (marks[n].k === "UNCLEAR") out.deep.unclear = bullets.slice(0, 5);
  }
  return out;
}
function renderAnalysis() {
  const d = rData; if (!d) return;
  const b = $("rBody"); let h = "";
  h += '<h5>⚡ Key points · 30 sec' + (d.ai ? "" : " · offline") + '</h5><ul>' + d.quick.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
  h += '<h5>📖 Context</h5><div class="ctx">' + esc(d.summary.context) + "</div>";
  if (d.summary.facts.length) h += "<h5>Key facts</h5><ul>" + d.summary.facts.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
  if (d.deep.timeline.length) h += "<h5>🔎 Timeline</h5><ul>" + d.deep.timeline.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
  if (d.deep.perspectives.length) h += "<h5>Perspectives</h5>" + d.deep.perspectives.map(p => '<div class="persp"><b>' + esc(p.side) + "</b><br>" + esc(p.view) + "</div>").join("");
  if (d.deep.confirmed.length) h += "<h5>✓ Confirmed</h5><ul>" + d.deep.confirmed.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
  if (d.deep.unclear.length) h += "<h5>? Still unclear</h5><ul>" + d.deep.unclear.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
  if (rCluster.length) h += '<h5>Sources (' + rCluster.length + ')</h5><ul>' + rCluster.slice(0, 6).map(c => '<li><a target="_blank" rel="noopener" href="' + c.link + '">' + esc(c.source) + "</a></li>").join("") + "</ul>";
  if (rRelated.length) h += "<h5>Related</h5><ul>" + rRelated.slice(0, 5).map(r => "<li>" + esc(textOf(r, "title")) + "</li>").join("") + "</ul>";
  b.innerHTML = h;
}
function relatedFor(item) {
  const words = new Set((textOf(item, "title").toLowerCase().match(/[a-z]{4,}/g) || []));
  return lastItems.filter(o => o !== item)
    .map(o => ({ o, s: (textOf(o, "title").toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => words.has(w)).length }))
    .filter(x => x.s >= 2).sort((a, b) => b.s - a.s).slice(0, 5).map(x => x.o);
}

/* ---------- saved ---------- */
function renderSaved() {
  setNav("saved"); sheetHide(); readerEl.classList.remove("open"); calEl.classList.remove("show");
  briefEl.style.display = "block"; greetEl.textContent = "SAVED";
  subEl.textContent = saved.length + (saved.length === 1 ? " story" : " stories");
  topstoryEl.style.display = "none"; latestTitle.textContent = "YOUR READING LIST";
  gridEl.innerHTML = "";
  if (!saved.length) { gridEl.innerHTML = '<div class="row"><div class="txt"><div class="head" style="color:#999">Nothing saved yet — tap the bookmark on any story.</div></div></div>'; return; }
  saved.slice().reverse().forEach(s => {
    const a = document.createElement("a"); a.className = "row"; a.href = s.link; a.target = "_blank"; a.rel = "noopener";
    const txt = document.createElement("div"); txt.className = "txt";
    const sr = document.createElement("div"); sr.className = "srcline";
    sr.innerHTML = (s.sourceUrl ? '<img class="fav" src="' + faviconFor(s.sourceUrl) + '" alt="">' : "") + '<span class="src">' + esc(s.source) + "</span>";
    const hd = document.createElement("div"); hd.className = "head"; hd.textContent = s.headline;
    txt.append(sr, hd); a.appendChild(txt);
    const b = document.createElement("button"); b.className = "save on";
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
    b.onclick = e => { e.preventDefault(); e.stopPropagation(); saved = saved.filter(x => x.link !== s.link); localStorage.setItem("saved", JSON.stringify(saved)); renderSaved(); toast("Removed from Saved"); };
    a.appendChild(b); gridEl.appendChild(a);
  });
}

/* ---------- sheets / settings ---------- */
function getCluster(item) {
  const d = item.querySelector("description"); if (!d) return [];
  let html = ""; try { html = d.innerHTML || ""; } catch (e) {}
  if (!html) html = new XMLSerializer().serializeToString(d);
  if (html.indexOf("<a") === -1) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("li a")].map(a => ({ title: a.textContent, link: a.getAttribute("href") || "", source: a.parentElement && a.parentElement.querySelector("font") ? a.parentElement.querySelector("font").textContent : "" }));
}
function showSheet(cluster) {
  sheetEl.innerHTML = "<h4>" + cluster.length + " SOURCES COVERING THIS</h4>";
  cluster.forEach(c => { const a = document.createElement("a"); a.href = c.link; a.target = "_blank"; a.rel = "noopener"; a.innerHTML = esc(c.title) + "<span>" + esc(c.source) + "</span>"; sheetEl.appendChild(a); });
  sheetEl.style.display = "block"; scrimEl.style.display = "block";
}
function openSettings() {
  sheetEl.innerHTML = "<h4>⚙ SETTINGS · AI + ARCHIVE</h4>" +
    '<div class="setrow"><input id="keyIn" type="password" placeholder="NVIDIA API key (nvapi-…)" value="' + (localStorage.getItem("nvidiaKey") || "") + '"></div>' +
    '<div class="setrow"><input id="modelIn" type="text" placeholder="Model ID" value="' + AI_MODEL + '"></div>' +
    '<div class="setrow"><input id="supaUrlIn" type="text" placeholder="Supabase URL (https://xxx.supabase.co)" value="' + SUPA_URL + '"></div>' +
    '<div class="setrow"><input id="supaKeyIn" type="password" placeholder="Supabase anon key" value="' + SUPA_KEY + '"></div>' +
    '<div class="setrow"><button class="subchip active" id="aiSave">Save</button></div>';
  sheetEl.style.display = "block"; scrimEl.style.display = "block";
  $("aiSave").onclick = () => {
    localStorage.setItem("nvidiaKey", $("keyIn").value.trim());
    AI_MODEL = $("modelIn").value.trim() || AI_MODEL;
    localStorage.setItem("aiModel", AI_MODEL);
    SUPA_URL = $("supaUrlIn").value.trim(); localStorage.setItem("supaUrl", SUPA_URL);
    SUPA_KEY = $("supaKeyIn").value.trim(); localStorage.setItem("supaKey", SUPA_KEY);
    sheetHide(); toast("Settings saved");
  };
}
function sheetHide() { sheetEl.style.display = "none"; scrimEl.style.display = "none"; }
scrimEl.onclick = sheetHide;

/* ---------- nav / refresh / pull ---------- */
function setNav(v) {
  $("navHome").classList.toggle("active", v === "home");
  $("navSaved").classList.toggle("active", v === "saved");
  $("navArchive").classList.toggle("active", v === "archive");
}
let toastTimer;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800); }
function doRefresh() { refreshBtn.classList.remove("spin"); void refreshBtn.offsetWidth; refreshBtn.classList.add("spin"); loadFeed(); }
refreshBtn.onclick = doRefresh;
let ptrStart = null, ptrGo = false;
document.addEventListener("touchstart", e => { if (window.scrollY === 0 && !readerEl.classList.contains("open")) ptrStart = e.touches[0].clientY; }, { passive: true });
document.addEventListener("touchmove", e => {
  if (ptrStart === null) return;
  const dy = e.touches[0].clientY - ptrStart;
  if (dy > 0 && window.scrollY === 0) { ptrGo = dy > 70; ptrEl.textContent = ptrGo ? "Release to refresh" : "⬇ Pull to refresh"; ptrEl.classList.add("show"); }
}, { passive: true });
document.addEventListener("touchend", () => { if (ptrGo) doRefresh(); ptrStart = null; ptrGo = false; ptrEl.classList.remove("show"); });

$("form").addEventListener("submit", e => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) { customFeed = null; currentCat = "foryou"; currentSub = null; localStorage.setItem("pill", currentCat); }
  else customFeed = { label: pretty(q), url: S(q) };
  input.value = ""; input.blur();
  renderPills(); renderSubs(); loadFeed();
});
$("navHome").onclick = () => { customFeed = null; renderPills(); renderSubs(); loadFeed(); };
$("navSearch").onclick = () => { window.scrollTo({ top: 0 }); input.focus(); };
$("navSaved").onclick = renderSaved;
$("navArchive").onclick = renderArchive;
$("navMenu").onclick = openSettings;
$("bell").onclick = () => toast("Notifications — coming soon");

/* ---------- helpers ---------- */
function meta(item) {
  const title = textOf(item, "title"), link = textOf(item, "link") || "#";
  const sourceEl = item.querySelector("source");
  const source = sourceEl ? sourceEl.textContent.trim() : "";
  const sourceUrl = sourceEl ? (sourceEl.getAttribute("url") || "") : "";
  const headline = source && title.endsWith(source) ? title.slice(0, -source.length).replace(/[-–]\s*$/, "").trim() : title;
  return { title, link, source, sourceUrl, headline };
}
function faviconFor(url) { try { return "https://www.google.com/s2/favicons?domain=" + new URL(url).hostname + "&sz=64"; } catch (e) { return ""; } }
function pretty(q) { return q.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
function textOf(node, tag) { const el = node.querySelector(tag); return el ? el.textContent.trim() : ""; }
function esc(s) { return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function timeAgo(rfc822) {
  const then = new Date(rfc822); if (isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h";
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return days + "d";
  return then.toLocaleDateString();
}
function getImageUrl(item) {
  const enclosure = item.querySelector("enclosure");
  if (enclosure) { const url = enclosure.getAttribute("url") || "", type = enclosure.getAttribute("type") || ""; if (url && (!type || type.startsWith("image/"))) return url; }
  const mediaNodes = [...item.getElementsByTagNameNS("*", "content"), ...item.getElementsByTagNameNS("*", "thumbnail")];
  for (const node of mediaNodes) {
    const url = node.getAttribute("url") || node.getAttribute("href") || "";
    const type = node.getAttribute("type") || "", medium = node.getAttribute("medium") || "";
    if (url && (!type || type.startsWith("image/")) && (!medium || medium === "image")) return url;
  }
  const descriptionEl = item.querySelector("description");
  if (descriptionEl) { const f = extractImageFromHtml(descriptionEl.textContent || ""); if (f) return f; }
  const encodedEl = item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded")[0];
  if (encodedEl) { const f = extractImageFromHtml(encodedEl.textContent || ""); if (f) return f; }
  return "";
}
function extractImageFromHtml(html) {
  if (!html) return "";
  try { const doc = new DOMParser().parseFromString(html, "text/html"); const img = doc.querySelector("img"); if (!img) return ""; return img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-original") || img.getAttribute("data-lazy-src") || ""; }
  catch (e) { return ""; }
}

renderPills(); renderSubs(); loadFeed();
