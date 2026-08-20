const LANG_PARAMS = "&hl=en-US&gl=US&ceid=US:en";

const FEEDS = [
  { id: "settlers", short: "Settlers", label: "Israeli Settlers", url: "https://news.google.com/rss/search?q=Israeli-settlers" + LANG_PARAMS },
  { id: "crypto",   short: "Crypto",   label: "Digital Currencies", url: "https://news.google.com/rss/topics/CAAqJAgKIh5DQkFTRUFvS0wyMHZNSEk0YkhsM054SUNaVzRvQUFQAQ?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "tech",     short: "Tech",     label: "Technology", url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "world",    short: "World",    label: "World", url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "business", short: "Business", label: "Business", url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "economy",  short: "Economy",  label: "Economy", url: "https://news.google.com/rss/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNR2RtY0hNekVnSmxiaWdBUAE?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "science",  short: "Science",  label: "Science", url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "space",    short: "Space",    label: "Space", url: "https://news.google.com/rss/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNREU0TXpOM0VnSmxiaWdBUAE?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "health",   short: "Health",   label: "Health", url: "https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ?hl=en-US&gl=US&ceid=US%3Aen" }
];

const $ = id => document.getElementById(id);
const gridEl = $("grid"), pillsEl = $("pills"), topstoryEl = $("topstory"),
      briefEl = $("brief"), greetEl = $("greet"), subEl = $("sub"),
      latestTitle = $("latestTitle"), sheetEl = $("sheet"), scrimEl = $("scrim"),
      toastEl = $("toast"), input = $("q");

let currentPill = localStorage.getItem("pill") || "foryou";
let customFeed = null;
let saved = JSON.parse(localStorage.getItem("saved") || "[]");

/* ---------- pills ---------- */
function renderPills() {
  pillsEl.innerHTML = "";
  const mk = (id, label) => {
    const b = document.createElement("button");
    b.className = "pill" + (!customFeed && currentPill === id ? " active" : "");
    b.textContent = label;
    b.onclick = () => { customFeed = null; currentPill = id; localStorage.setItem("pill", id); renderPills(); loadFeed(); };
    pillsEl.appendChild(b);
  };
  mk("foryou", "For You");
  FEEDS.forEach(f => mk(f.id, f.short));
  if (customFeed) {
    const b = document.createElement("button");
    b.className = "pill active"; b.textContent = customFeed.label;
    pillsEl.appendChild(b);
  }
}

/* ---------- loading ---------- */
async function loadFeed() {
  setNav("home"); sheetHide();
  gridEl.innerHTML = ""; topstoryEl.style.display = "none";
  latestTitle.textContent = "LATEST STORIES";
  const feed = customFeed || (currentPill !== "foryou" ? FEEDS.find(f => f.id === currentPill) : null);
  try {
    let items;
    if (!feed) {
      subEl.textContent = "Building your briefing…";
      const results = await Promise.allSettled(FEEDS.map(f => fetch(f.url).then(r => r.text())));
      items = []; const seen = new Set();
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        for (const it of parseItems(r.value)) {
          const k = textOf(it, "title");
          if (!seen.has(k)) { seen.add(k); items.push(it); }
        }
      }
      items.sort((a, b) => b._t - a._t);
      const h = new Date().getHours();
      greetEl.textContent = h < 5 || h >= 18 ? "GOOD EVENING" : h < 12 ? "GOOD MORNING" : "GOOD AFTERNOON";
      subEl.textContent = "Your 5-minute briefing";
    } else {
      const res = await fetch(feed.url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      items = parseItems(await res.text());
      greetEl.textContent = feed.label.toUpperCase();
      subEl.textContent = items.length + " articles · newest first";
    }
    if (!items.length) { subEl.textContent = "No stories found"; return; }
    renderTop(items[0]);
    items.slice(1).forEach(it => gridEl.appendChild(row(it)));
  } catch (err) {
    subEl.textContent = "Couldn't load: " + err.message;
  }
}

function parseItems(text) {
  let xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.querySelector("parsererror"))
    xml = new DOMParser().parseFromString(text.replace(/&nbsp;/g, "&#160;"), "application/xml");
  return [...xml.querySelectorAll("item")].map(it => {
    it._t = new Date(textOf(it, "pubDate")).getTime() || 0;
    return it;
  });
}

/* ---------- top story ---------- */
function renderTop(item) {
  const m = meta(item), cluster = getCluster(item), img = getImageUrl(item);
  topstoryEl.href = m.link; topstoryEl.innerHTML = "";
  if (img) {
    const im = document.createElement("img");
    im.className = "hero"; im.src = img;
    im.addEventListener("error", () => im.remove());
    topstoryEl.appendChild(im);
  }
  const body = document.createElement("div"); body.className = "ts-body";
  const k = document.createElement("div"); k.className = "ts-kicker";
  if (m.sourceUrl) {
    const fv = document.createElement("img");
    fv.className = "fav"; fv.src = faviconFor(m.sourceUrl); fv.alt = "";
    fv.addEventListener("error", () => fv.remove());
    k.appendChild(fv);
  }
  const ks = document.createElement("span");
  ks.textContent = (m.source || "TOP STORY").toUpperCase();
  k.appendChild(ks);
  const h = document.createElement("div"); h.className = "ts-head"; h.textContent = m.headline;
  const mt = document.createElement("div"); mt.className = "ts-meta";
  const when = timeAgo(textOf(item, "pubDate"));
  if (cluster.length) {
    const chip = document.createElement("span");
    chip.className = "src-chip"; chip.textContent = cluster.length + " sources";
    chip.onclick = e => { e.preventDefault(); e.stopPropagation(); showSheet(cluster); };
    mt.appendChild(chip);
    mt.appendChild(document.createTextNode("· " + when));
  } else mt.textContent = (m.source ? m.source + " · " : "") + when;
  body.append(k, h, mt); topstoryEl.appendChild(body);
  topstoryEl.style.display = "block";
}

/* ---------- story rows ---------- */
function row(item) {
  const m = meta(item), img = getImageUrl(item);
  const a = document.createElement("a");
  a.className = "row"; a.href = m.link; a.target = "_blank"; a.rel = "noopener";
  const txt = document.createElement("div"); txt.className = "txt";
  const sr = document.createElement("div"); sr.className = "srcline";
  sr.innerHTML =
    (m.sourceUrl ? '<img class="fav" src="' + faviconFor(m.sourceUrl) + '" alt="">' : "") +
    "<span>" + esc(m.source) + "</span>" +
    "<span>•</span>" +
    '<svg class="clk" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' +
    "<span>" + timeAgo(textOf(item, "pubDate")) + "</span>";
  const hd = document.createElement("div"); hd.className = "head"; hd.textContent = m.headline;
  txt.append(sr, hd); a.appendChild(txt);
  if (img) {
    const im = document.createElement("img");
    im.className = "thumb"; im.src = img; im.loading = "lazy";
    im.addEventListener("error", () => im.remove());
    a.appendChild(im);
  }
  a.appendChild(saveBtn(m));
  return a;
}

function saveBtn(m) {
  const b = document.createElement("button");
  b.className = "save" + (saved.some(x => x.link === m.link) ? " on" : "");
  b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
  b.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    const i = saved.findIndex(x => x.link === m.link);
    if (i >= 0) saved.splice(i, 1); else saved.push(m);
    localStorage.setItem("saved", JSON.stringify(saved));
    b.classList.toggle("on");
    toast(i >= 0 ? "Removed from Saved" : "Saved for later");
  };
  return b;
}

/* ---------- saved view ---------- */
function renderSaved() {
  setNav("saved"); sheetHide();
  briefEl.style.display = "block";
  greetEl.textContent = "SAVED";
  subEl.textContent = saved.length + (saved.length === 1 ? " story" : " stories");
  topstoryEl.style.display = "none";
  latestTitle.textContent = "YOUR READING LIST";
  gridEl.innerHTML = "";
  if (!saved.length) {
    gridEl.innerHTML = '<div class="row"><div class="txt"><div class="head" style="color:#999">Nothing saved yet — tap the bookmark on any story.</div></div></div>';
    return;
  }
  saved.slice().reverse().forEach(s => {
    const a = document.createElement("a");
    a.className = "row"; a.href = s.link; a.target = "_blank"; a.rel = "noopener";
    const txt = document.createElement("div"); txt.className = "txt";
    const sr = document.createElement("div"); sr.className = "srcline";
    sr.innerHTML = (s.sourceUrl ? '<img class="fav" src="' + faviconFor(s.sourceUrl) + '" alt="">' : "") +
      "<span>" + esc(s.source) + "</span>";
    const hd = document.createElement("div"); hd.className = "head"; hd.textContent = s.headline;
    txt.append(sr, hd); a.appendChild(txt);
    const b = document.createElement("button");
    b.className = "save on";
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
    b.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      saved = saved.filter(x => x.link !== s.link);
      localStorage.setItem("saved", JSON.stringify(saved));
      renderSaved(); toast("Removed from Saved");
    };
    a.appendChild(b);
    gridEl.appendChild(a);
  });
}

/* ---------- cluster sources ---------- */
function getCluster(item) {
  const d = item.querySelector("description");
  if (!d) return [];
  let html = "";
  try { html = d.innerHTML || ""; } catch (e) {}
  if (!html) html = new XMLSerializer().serializeToString(d);
  if (html.indexOf("<a") === -1) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("li a")].map(a => ({
    title: a.textContent,
    link: a.getAttribute("href") || "",
    source: a.parentElement && a.parentElement.querySelector("font") ? a.parentElement.querySelector("font").textContent : ""
  }));
}

function showSheet(cluster) {
  sheetEl.innerHTML = "<h4>" + cluster.length + " SOURCES COVERING THIS</h4>";
  cluster.forEach(c => {
    const a = document.createElement("a");
    a.href = c.link; a.target = "_blank"; a.rel = "noopener";
    a.innerHTML = esc(c.title) + "<span>" + esc(c.source) + "</span>";
    sheetEl.appendChild(a);
  });
  sheetEl.style.display = "block"; scrimEl.style.display = "block";
}
function sheetHide() { sheetEl.style.display = "none"; scrimEl.style.display = "none"; }
scrimEl.onclick = sheetHide;

/* ---------- nav / misc ---------- */
function setNav(v) {
  $("navHome").classList.toggle("active", v === "home");
  $("navSaved").classList.toggle("active", v === "saved");
}
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg; toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

$("form").addEventListener("submit", e => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) { customFeed = null; currentPill = "foryou"; localStorage.setItem("pill", currentPill); }
  else customFeed = { label: pretty(q), url: searchUrl(q) };
  input.value = ""; input.blur();
  renderPills(); loadFeed();
});
$("navHome").onclick = () => { renderPills(); loadFeed(); };
$("navSearch").onclick = () => { window.scrollTo({ top: 0 }); input.focus(); };
$("navSaved").onclick = renderSaved;
$("navMenu").onclick = () => toast("Summaries, timelines & personalization — next phases");
$("bell").onclick = () => toast("Notifications — coming soon");

/* ---------- helpers ---------- */
function meta(item) {
  const title = textOf(item, "title");
  const link = textOf(item, "link") || "#";
  const sourceEl = item.querySelector("source");
  const source = sourceEl ? sourceEl.textContent.trim() : "";
  const sourceUrl = sourceEl ? (sourceEl.getAttribute("url") || "") : "";
  const headline = source && title.endsWith(source)
    ? title.slice(0, -source.length).replace(/[-–]\s*$/, "").trim() : title;
  return { title, link, source, sourceUrl, headline };
}
function faviconFor(url) {
  try { return "https://www.google.com/s2/favicons?domain=" + new URL(url).hostname + "&sz=64"; }
  catch (e) { return ""; }
}
function searchUrl(q) { return "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + LANG_PARAMS; }
function pretty(q) { return q.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
function textOf(node, tag) { const el = node.querySelector(tag); return el ? el.textContent.trim() : ""; }
function esc(s) { return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function timeAgo(rfc822) {
  const then = new Date(rfc822);
  if (isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return mins + " minute" + (mins > 1 ? "s" : "") + " ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + " hour" + (hours > 1 ? "s" : "") + " ago";
  const days = Math.floor(hours / 24);
  if (days < 7)  return days + " day" + (days > 1 ? "s" : "") + " ago";
  return then.toLocaleDateString();
}

/* ---------- image extraction ---------- */
function getImageUrl(item) {
  const enclosure = item.querySelector("enclosure");
  if (enclosure) {
    const url = enclosure.getAttribute("url") || "", type = enclosure.getAttribute("type") || "";
    if (url && (!type || type.startsWith("image/"))) return url;
  }
  const mediaNodes = [
    ...item.getElementsByTagNameNS("*", "content"),
    ...item.getElementsByTagNameNS("*", "thumbnail")
  ];
  for (const node of mediaNodes) {
    const url = node.getAttribute("url") || node.getAttribute("href") || "";
    const type = node.getAttribute("type") || "", medium = node.getAttribute("medium") || "";
    if (url && (!type || type.startsWith("image/")) && (!medium || medium === "image")) return url;
  }
  const descriptionEl = item.querySelector("description");
  if (descriptionEl) {
    const fromDesc = extractImageFromHtml(descriptionEl.textContent || "");
    if (fromDesc) return fromDesc;
  }
  const encodedEl = item.getElementsByTagNameNS("http://purl.org/rss/1.0/modules/content/", "encoded")[0];
  if (encodedEl) {
    const fromEnc = extractImageFromHtml(encodedEl.textContent || "");
    if (fromEnc) return fromEnc;
  }
  return "";
}
function extractImageFromHtml(html) {
  if (!html) return "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const img = doc.querySelector("img");
    if (!img) return "";
    return img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-original") || img.getAttribute("data-lazy-src") || "";
  } catch (e) { return ""; }
}

renderPills();
loadFeed();
