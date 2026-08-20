const LANG_PARAMS = "&hl=en-US&gl=US&ceid=US:en";
const T = id => "https://news.google.com/rss/topics/" + id + "?hl=en-US&gl=US&ceid=US%3Aen";
const S = q  => "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + LANG_PARAMS;
const AI_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
let AI_MODEL = localStorage.getItem("aiModel") || "nvidia/nemotron-3.5-lightning-30b-a3b";

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
      refreshBtn = $("refresh"), ptrEl = $("ptr"), readerEl = $("reader");

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
  setNav("home"); sheetHide();
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
    if (!items.length) { subEl.textContent = "No stories found"; return; }
    renderTop(items[0]);
    items.slice(1).forEach(it => gridEl.appendChild(row(it)));
  } catch (err) { subEl.textContent = "Couldn't load: " + err.message; }
}
function parseItems(text) {
  let xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.querySelector("parsererror")) xml = new DOMParser().parseFromString(text.replace(/&nbsp;/g, "&#160;"), "application/xml");
  return [...xml.querySelectorAll("item")].map(it => { it._t = new Date(textOf(it, "pubDate")).getTime() || 0; return it; });
}

function renderTop(item) {
  const m = meta(item), cluster = getCluster(item), img = getImageUrl(item);
  topstoryEl.href = m.link; topstoryEl.innerHTML = "";
  if (img) { const im = document.createElement("img"); im.className = "hero"; im.src = img; im.addEventListener("error", () => im.remove()); topstoryEl.appendChild(im); }
  const body = document.createElement("div"); body.className = "ts-body";
  const k = document.createElement("div"); k.className = "ts-kicker";
  if (m.sourceUrl) { const fv = document.createElement("img"); fv.className = "fav"; fv.src = faviconFor(m.sourceUrl); fv.addEventListener("error", () => fv.remove()); k.appendChild(fv); }
  const ks = document.createElement("span"); ks.textContent = (m.source || "TOP STORY").toUpperCase(); k.appendChild(ks);
  const h = document.createElement("div"); h.className = "ts-head"; h.textContent = m.headline;
  const mt = document.createElement("div"); mt.className = "ts-meta";
  if (cluster.length) { const chip = document.createElement("span"); chip.className = "src-chip"; chip.textContent = cluster.length + " sources"; chip.onclick = e => { e.preventDefault(); e.stopPropagation(); showSheet(cluster); }; mt.appendChild(chip); }
  const ai = document.createElement("span"); ai.className = "src-chip"; ai.textContent = "✨ AI"; ai.onclick = e => { e.preventDefault(); e.stopPropagation(); openReader(item); }; mt.appendChild(ai);
  mt.appendChild(document.createTextNode("· " + timeAgo(textOf(item, "pubDate"))));
  body.append(k, h, mt); topstoryEl.appendChild(body);
  topstoryEl.style.display = "block";
}
function row(item) {
  const m = meta(item), img = getImageUrl(item);
  const a = document.createElement("a"); a.className = "row"; a.href = m.link; a.target = "_blank"; a.rel = "noopener";
  const txt = document.createElement("div"); txt.className = "txt";
  const sr = document.createElement("div"); sr.className = "srcline";
  sr.innerHTML = (m.sourceUrl ? '<img class="fav" src="' + faviconFor(m.sourceUrl) + '" alt="">' : "") +
    "<span>" + esc(m.source) + "</span><span>•</span>" +
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
let rItem = null, rData = null, rLevel = "quick", rCluster = [], rRelated = [], aiSeq = 0;
function openReader(item) {
  rItem = item; rCluster = getCluster(item); rRelated = relatedFor(item);
  rData = null; rLevel = "quick";
  $("rSource").textContent = meta(item).source || "";
  $("rTitle").textContent = meta(item).headline;
  $("rFull").href = meta(item).link;
  document.querySelectorAll(".lvl").forEach(b => b.classList.toggle("active", b.dataset.l === "quick"));
  readerEl.classList.add("open");
  ensureAnalysis();
}
$("rClose").onclick = () => readerEl.classList.remove("open");
document.querySelectorAll(".lvl").forEach(b => b.onclick = () => {
  rLevel = b.dataset.l;
  document.querySelectorAll(".lvl").forEach(x => x.classList.toggle("active", x === b));
  renderLevel();
});
async function ensureAnalysis() {
  const link = meta(rItem).link;
  if (aiCache[link]) { rData = aiCache[link]; renderLevel(); return; }
  $("rBody").innerHTML = '<p class="r-note">🤖 Analyzing story…</p>';
  const key = localStorage.getItem("nvidiaKey") || "";
  if (!key) { rData = fallbackAnalysis(); rData.ai = false; renderLevel(); toast("No AI key set — offline mode"); return; }
  try {
    rData = await aiAnalyze(key);
    rData.ai = true; aiCache[link] = rData; renderLevel();
  } catch (e) {
    console.error("AI Error:", e);
    rData = fallbackAnalysis(); rData.ai = false; renderLevel();
    $("rBody").insertAdjacentHTML("afterbegin", '<p class="r-note">⚠ ' + esc(e.message) + ' <button class="subchip active" id="retryAi">Retry</button></p>');
    $("retryAi").onclick = () => { delete aiCache[link]; ensureAnalysis(); };
  }
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
          if (!r.ok) throw new Error(r.status === 429 ? "Rate limit (429) — wait ~1 min and retry" : "API HTTP " + r.status);
          resolve(j); }))
        .catch(e => { clearTimeout(timer); reject(e); });
    }
  });
}
function aiAnalyze(key) {
  const m = meta(rItem);
  const others = rCluster.slice(0, 6).map(c => "- " + c.title + " (" + c.source + ")").join("\n");
  const rel = rRelated.slice(0, 5).map(r => "- " + textOf(r, "title")).join("\n");
  const payload = {
    model: AI_MODEL, temperature: 0.1, max_tokens: 2048, stream: false,
    chat_template_kwargs: { enable_thinking: false },
    messages: [
      { role: "system", content: 'You are a news analyst. Reply with ONLY valid JSON (no markdown, no ```json blocks, no explanations). CRITICAL RULES: 1. Do not use double quotes inside string values (use single quotes instead). 2. Do not use trailing commas. 3. Keep strings concise. Shape: {"quick":[3 short strings],"summary":{"context":"2-3 sentence context","facts":[4 short strings]},"deep":{"timeline":[4-6 dated strings],"perspectives":[{"side":string,"view":string}],"confirmed":[strings],"unclear":[strings]}}' },
      { role: "user", content: "Headline: " + m.headline + "\nSource: " + m.source + "\nPublished: " + textOf(rItem, "pubDate") + "\nOther coverage:\n" + (others || "none") + "\nRelated stories:\n" + (rel || "none") }
    ]
  };
  const parse = res => {
    if (res.http_status) throw new Error(res.http_status === 429 ? "Rate limit (429) — wait ~1 min and retry" : "API HTTP " + res.http_status);
    if (res.error) throw new Error(String(res.error));
    if (!res.choices || !res.choices[0]) throw new Error("Empty response from AI");
    const content = res.choices[0].message ? (res.choices[0].message.content || "") : "";
    const start = content.indexOf("{"), end = content.lastIndexOf("}");
    if (start !== -1 && end > start) {
      let jsonStr = content.substring(start, end + 1).replace(/,\s*([\]}])/g, "$1");
      try { return JSON.parse(jsonStr); }
      catch (e2) { console.error("Bad JSON:", jsonStr); throw new Error("AI JSON syntax error"); }
    }
    throw new Error("AI returned no JSON");
  };
  const call = p => aiRequest(key, p).then(parse);
  return call(payload).catch(e => {
    if (/400|unsupported|unknown/i.test(e.message)) { delete payload.chat_template_kwargs; return call(payload); }
    throw e;
  });
}
function fallbackAnalysis() {
  const m = meta(rItem);
  return {
    quick: rCluster.length ? rCluster.slice(0, 3).map(c => c.source + ": " + c.title) : [m.headline],
    summary: { context: "Offline mode (no AI available). Latest coverage via " + (m.source || "one source") + ".", facts: rCluster.slice(0, 4).map(c => c.source + " — " + c.title) },
    deep: { timeline: rRelated.slice(0, 5).map(r => timeAgo(textOf(r, "pubDate")) + " — " + textOf(r, "title")), perspectives: [], confirmed: [], unclear: [] }
  };
}
function renderLevel() {
  const d = rData; if (!d) return;
  const b = $("rBody"); let h = "";
  if (rLevel === "quick") {
    h = '<h5>⚡ Quick · 30 sec' + (d.ai ? "" : " · offline") + '</h5><ul>' + d.quick.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
  } else if (rLevel === "summary") {
    h = '<h5>📖 Summary · 2 min' + (d.ai ? "" : " · offline") + '</h5><div class="ctx">' + esc(d.summary.context) + '</div><h5>Key facts</h5><ul>' + d.summary.facts.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
  } else {
    h = '<h5>🔎 Deep Dive · 10 min' + (d.ai ? "" : " · offline") + '</h5>';
    if (d.deep.timeline && d.deep.timeline.length) h += "<h5>Timeline</h5><ul>" + d.deep.timeline.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
    if (d.deep.perspectives && d.deep.perspectives.length) h += "<h5>Perspectives</h5>" + d.deep.perspectives.map(p => '<div class="persp"><b>' + esc(p.side) + "</b><br>" + esc(p.view) + "</div>").join("");
    if (d.deep.confirmed && d.deep.confirmed.length) h += "<h5>✓ Confirmed</h5><ul>" + d.deep.confirmed.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
    if (d.deep.unclear && d.deep.unclear.length) h += "<h5>? Still unclear</h5><ul>" + d.deep.unclear.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>";
    if (rCluster.length) h += '<h5>Sources (' + rCluster.length + ')</h5><ul>' + rCluster.slice(0, 6).map(c => '<li><a target="_blank" rel="noopener" href="' + c.link + '">' + esc(c.source) + "</a></li>").join("") + "</ul>";
    if (rRelated.length) h += "<h5>Related</h5><ul>" + rRelated.slice(0, 5).map(r => "<li>" + esc(textOf(r, "title")) + "</li>").join("") + "</ul>";
  }
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
  setNav("saved"); sheetHide(); readerEl.classList.remove("open");
  briefEl.style.display = "block"; greetEl.textContent = "SAVED";
  subEl.textContent = saved.length + (saved.length === 1 ? " story" : " stories");
  topstoryEl.style.display = "none"; latestTitle.textContent = "YOUR READING LIST";
  gridEl.innerHTML = "";
  if (!saved.length) { gridEl.innerHTML = '<div class="row"><div class="txt"><div class="head" style="color:#999">Nothing saved yet — tap the bookmark on any story.</div></div></div>'; return; }
  saved.slice().reverse().forEach(s => {
    const a = document.createElement("a"); a.className = "row"; a.href = s.link; a.target = "_blank"; a.rel = "noopener";
    const txt = document.createElement("div"); txt.className = "txt";
    const sr = document.createElement("div"); sr.className = "srcline";
    sr.innerHTML = (s.sourceUrl ? '<img class="fav" src="' + faviconFor(s.sourceUrl) + '" alt="">' : "") + "<span>" + esc(s.source) + "</span>";
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
  sheetEl.innerHTML = "<h4>⚙ SETTINGS · AI</h4>" +
    '<div class="setrow"><input id="keyIn" type="password" placeholder="NVIDIA API key (nvapi-…)" value="' + (localStorage.getItem("nvidiaKey") || "") + '"></div>' +
    '<div class="setrow"><input id="modelIn" type="text" placeholder="Model ID" value="' + AI_MODEL + '"></div>' +
    '<div class="setrow"><button class="subchip active" id="aiSave">Save</button></div>';
  sheetEl.style.display = "block"; scrimEl.style.display = "block";
  $("aiSave").onclick = () => {
    localStorage.setItem("nvidiaKey", $("keyIn").value.trim());
    AI_MODEL = $("modelIn").value.trim() || AI_MODEL;
    localStorage.setItem("aiModel", AI_MODEL);
    sheetHide(); toast("AI settings saved");
  };
}
function sheetHide() { sheetEl.style.display = "none"; scrimEl.style.display = "none"; }
scrimEl.onclick = sheetHide;

/* ---------- nav / refresh / pull ---------- */
function setNav(v) { $("navHome").classList.toggle("active", v === "home"); $("navSaved").classList.toggle("active", v === "saved"); }
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
  if (mins < 1) return "just now";
  if (mins < 60) return mins + " minute" + (mins > 1 ? "s" : "") + " ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + " hour" + (hours > 1 ? "s" : "") + " ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + " day" + (days > 1 ? "s" : "") + " ago";
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
