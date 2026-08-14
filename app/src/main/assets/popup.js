const GEO_CONFIG = {
  US: { hl: "en-US", gl: "US", ceid: "US:en" },
  IN: { hl: "en-IN", gl: "IN", ceid: "IN:en" }
};

let currentGeo = localStorage.getItem("newsGeo") || "US";
if (!GEO_CONFIG[currentGeo]) currentGeo = "US";

function geoParams() {
  const cfg = GEO_CONFIG[currentGeo];

  return "&hl=" + encodeURIComponent(cfg.hl) +
         "&gl=" + encodeURIComponent(cfg.gl) +
         "&ceid=" + encodeURIComponent(cfg.ceid);
}

// Set this to your deployed Cloudflare Worker URL.
// Example: https://news-image-proxy.yourname.workers.dev
const IMAGE_PROXY = "https://YOUR-WORKER.workers.dev";
const imageMetaCache = new Map();

const FEEDS = [
  { id: "settlers", label: "Israeli Settlers",
    icon: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="8" x2="13" y2="8"/><line x1="16" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/></svg>',
    url: "https://news.google.com/rss/search?q=Israeli-settlers" + geoParams() },
  { id: "crypto", label: "Digital Currencies",
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.1 0 2.6 6 1.6 6 4.2 0 1.2-1.3 2.1-3 2.1-1.3 0-2.4-.5-3-1.5"/><path d="M12 5.5v2M12 16.5v2"/></svg>',
    url: "https://news.google.com/rss/topics/CAAqJAgKIh5DQkFTRUFvS0wyMHZNSEk0YkhsM054SUNaVzRvQUFQAQ?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "tech", label: "Technology",
    icon: '<svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "world", label: "World",
    icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "business", label: "Business",
    icon: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
    url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "economy", label: "Economy",
    icon: '<svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
    url: "https://news.google.com/rss/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNR2RtY0hNekVnSmxiaWdBUAE?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "science", label: "Science",
    icon: '<svg viewBox="0 0 24 24"><path d="M10 2v7L4.7 19.2A2 2 0 0 0 6.5 22h11a2 2 0 0 0 1.8-2.8L14 9V2"/><line x1="8" y1="2" x2="16" y2="2"/><line x1="7" y1="15" x2="17" y2="15"/></svg>',
    url: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "space", label: "Space",
    icon: '<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    url: "https://news.google.com/rss/topics/CAAqIggKIhxDQkFTRHdvSkwyMHZNREU0TXpOM0VnSmxiaWdBUAE?hl=en-US&gl=US&ceid=US%3Aen" },
  { id: "health", label: "Health",
    icon: '<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    url: "https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ?hl=en-US&gl=US&ceid=US%3Aen" }
];

const grid = document.getElementById("grid");
const statusEl = document.getElementById("status");
const tabsEl = document.getElementById("tabs");
const input = document.getElementById("q");
const refreshBtn = document.getElementById("refresh");
const geoUSBtn = document.getElementById("geoUS");
const geoINBtn = document.getElementById("geoIN");
const storyModeBtn = document.getElementById("storyMode");

let currentFeedId = localStorage.getItem("activeTab") || FEEDS[0].id;
let customFeed = null;
let storyMode = localStorage.getItem("storyMode") === "1";

function activeFeed() {
  return customFeed || FEEDS.find(f => f.id === currentFeedId) || FEEDS[0];
}

function updateGeoSwitch() {
  geoUSBtn.classList.toggle("active", currentGeo === "US");
  geoINBtn.classList.toggle("active", currentGeo === "IN");

  geoUSBtn.setAttribute("aria-pressed", currentGeo === "US" ? "true" : "false");
  geoINBtn.setAttribute("aria-pressed", currentGeo === "IN" ? "true" : "false");
}

function setGeo(geo) {
  if (!GEO_CONFIG[geo] || geo === currentGeo) return;

  currentGeo = geo;
  localStorage.setItem("newsGeo", currentGeo);

  // Preserve the currently selected category.
  customFeed = null;

  updateGeoSwitch();
  renderTabs();
  loadFeed();
}

geoUSBtn.addEventListener("click", () => setGeo("US"));
geoINBtn.addEventListener("click", () => setGeo("IN"));

function regionalFeedUrl(url) {
  const u = new URL(url);
  const cfg = GEO_CONFIG[currentGeo];

  u.searchParams.set("hl", cfg.hl);
  u.searchParams.set("gl", cfg.gl);
  u.searchParams.set("ceid", cfg.ceid);

  return u.toString();
}


function setStatus(articleCount, feedLabel, extra = "newest first") {
  statusEl.innerHTML =
    esc(String(articleCount)) +
    ' articles · <span class="current-category">' +
    esc(String(feedLabel)) +
    '</span> · ' +
    esc(String(extra));
}


function renderTabs() {
  tabsEl.innerHTML = "";
  FEEDS.forEach(f => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.id = f.id;
    b.className = "tab" + (!customFeed && f.id === currentFeedId ? " active" : "");
    b.setAttribute("aria-label", f.label);
    b.innerHTML = f.icon + '<span class="tip">' + esc(f.label) + '</span>';
    b.addEventListener("click", () => {
      customFeed = null;
      currentFeedId = f.id;
      localStorage.setItem("activeTab", currentFeedId);
      renderTabs();
      loadFeed();
    });
    tabsEl.appendChild(b);
  });
}

function updateStoryMode() {
  storyModeBtn.classList.toggle("active", storyMode);
  storyModeBtn.setAttribute("aria-pressed", storyMode ? "true" : "false");
  storyModeBtn.textContent = storyMode ? "Stories ✓" : "Stories";
}

storyModeBtn.addEventListener("click", () => {
  storyMode = !storyMode;
  localStorage.setItem("storyMode", storyMode ? "1" : "0");
  updateStoryMode();
  loadFeed();
});


function getStorySource(item) {
  const sourceEl = item.querySelector("source");
  return sourceEl ? sourceEl.textContent.trim() : "";
}

function getStoryLink(item) {
  return textOf(item, "link") || "#";
}

function normalizeStoryTitle(title) {
  return title.toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STORY_STOPWORDS = new Set([
  "the","a","an","and","or","but","for","to","of","in","on","at","by","with",
  "from","after","before","as","is","are","was","were","be","been","this",
  "that","it","its","their","his","her","they","them","who","what","when",
  "where","why","how","new","says","say","said","latest","update","live",
  "news","report","reports","according","amid","over","into","than","more",
  "may","could","would","will","has","have","had"
]);

function storyTokens(title) {
  return new Set(
    normalizeStoryTitle(title).split(" ").filter(word =>
      word.length >= 3 &&
      !STORY_STOPWORDS.has(word) &&
      !/^\d+$/.test(word)
    )
  );
}

function storySimilarity(a, b) {
  const A = storyTokens(a);
  const B = storyTokens(b);
  if (!A.size || !B.size) return 0;

  let intersection = 0;
  for (const word of A) if (B.has(word)) intersection++;

  const smaller = Math.min(A.size, B.size);
  const union = new Set([...A, ...B]).size;

  const containment = intersection / smaller;
  const jaccard = intersection / union;

  return containment * 0.65 + jaccard * 0.35;
}

function extractStoryTopics(items) {
  const counts = new Map();

  for (const item of items) {
    for (const token of storyTokens(textOf(item, "title"))) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= Math.max(1, Math.ceil(items.length * 0.4)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);
}

function clusterStories(items) {
  const clusters = [];

  const sorted = [...items].sort((a, b) => {
    const ad = new Date(textOf(a, "pubDate")).getTime() || 0;
    const bd = new Date(textOf(b, "pubDate")).getTime() || 0;
    return bd - ad;
  });

  for (const item of sorted) {
    const title = textOf(item, "title");
    let bestCluster = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      for (const candidate of cluster.items.slice(0, 5)) {
        const score = storySimilarity(title, textOf(candidate, "title"));
        if (score > bestScore) {
          bestScore = score;
          bestCluster = cluster;
        }
      }
    }

    // Conservative threshold reduces false merges.
    if (bestCluster && bestScore >= 0.48) {
      bestCluster.items.push(item);
      bestCluster.score = Math.max(bestCluster.score, bestScore);
    } else {
      clusters.push({ items: [item], score: 0 });
    }
  }

  return clusters.map(cluster => {
    const sources = new Set(cluster.items.map(getStorySource).filter(Boolean));
    const dates = cluster.items
      .map(item => new Date(textOf(item, "pubDate")).getTime())
      .filter(Number.isFinite);

    return {
      ...cluster,
      sourceCount: sources.size,
      newest: dates.length ? Math.max(...dates) : 0,
      topics: extractStoryTopics(cluster.items)
    };
  }).sort((a, b) =>
    b.sourceCount - a.sourceCount || b.newest - a.newest
  );
}

function storyFreshnessLabel(timestamp) {
  if (!timestamp) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 5) return "Very recent";
  if (minutes < 60) return "Recent";
  if (minutes < 360) return "Developing";
  return "";
}

function renderStoryClusters(items, feed) {
  const clusters = clusterStories(items);
  const multiSource = clusters.filter(c => c.sourceCount > 1).length;

  setStatus(clusters.length, feed.label, items.length + " reports");

  grid.innerHTML = "";

  clusters.forEach(cluster => {
    const lead = cluster.items[0];
    const story = document.createElement("article");
    story.className = "story-card";

    const label = document.createElement("div");
    label.className = "story-label";

    const labelText = document.createElement("span");
    labelText.textContent =
      cluster.sourceCount >= 3 ? "Story" :
      cluster.sourceCount === 2 ? "Cross-source" :
      "Single source";

    const count = document.createElement("span");
    count.className = "count";
    count.textContent =
      cluster.sourceCount + (cluster.sourceCount === 1 ? " source" : " sources");

    label.append(labelText, count);

    const body = document.createElement("div");
    body.className = "story-body";

    const content = document.createElement("div");
    content.className = "story-content";

    const headline = document.createElement("h3");
    headline.className = "story-headline";

    const anchor = document.createElement("a");
    anchor.href = getStoryLink(lead);
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.textContent = textOf(lead, "title");
    headline.appendChild(anchor);

    const meta = document.createElement("div");
    meta.className = "story-meta";
    meta.textContent = getStorySource(lead) +
      (cluster.newest ? " · " + timeAgo(new Date(cluster.newest).toISOString()) : "");

    content.append(headline, meta);

    const signals = document.createElement("div");
    signals.className = "story-signals";

    if (cluster.sourceCount >= 3) {
      const s = document.createElement("span");
      s.className = "story-signal strong";
      s.textContent = "3+ sources";
      signals.appendChild(s);
    }

    const freshness = storyFreshnessLabel(cluster.newest);
    if (freshness) {
      const s = document.createElement("span");
      s.className = "story-signal";
      s.textContent = freshness;
      signals.appendChild(s);
    }

    if (cluster.items.length > 1) {
      const s = document.createElement("span");
      s.className = "story-signal";
      s.textContent = cluster.items.length + " reports";
      signals.appendChild(s);
    }

    if (signals.children.length) content.appendChild(signals);

    if (cluster.topics.length) {
      const topic = document.createElement("div");
      topic.className = "story-topic";
      topic.textContent = "Common terms: " + cluster.topics.join(" · ");
      content.appendChild(topic);
    }

    const sources = document.createElement("div");
    sources.className = "story-sources";
    const seen = new Set();

    cluster.items.forEach(item => {
      const source = getStorySource(item);
      if (!source || seen.has(source)) return;
      seen.add(source);

      const link = document.createElement("a");
      link.className = "story-source";
      link.href = getStoryLink(item);
      link.target = "_blank";
      link.rel = "noopener";

      const dot = document.createElement("span");
      dot.className = "source-dot";
      link.append(dot, document.createTextNode(source));
      sources.appendChild(link);
    });

    content.appendChild(sources);
    body.appendChild(content);
    story.appendChild(label);
    story.appendChild(body);
    grid.appendChild(story);

    if (isImageProxyConfigured()) addStoryImage(lead, story);
  });
}


async function addStoryImage(item, story) {
  const articleUrl = textOf(item, "link");
  if (!articleUrl) return;

  try {
    let meta = imageMetaCache.get(articleUrl);

    if (!meta) {
      const endpoint =
        IMAGE_PROXY.replace(/\/$/, "") +
        "/meta?url=" +
        encodeURIComponent(articleUrl);

      const response = await fetch(endpoint);
      if (!response.ok) return;

      meta = await response.json();
      imageMetaCache.set(articleUrl, meta);
    }

    if (!meta || !meta.image) return;

    const body = story.querySelector(".story-body");
    if (!body || body.querySelector(".story-image")) return;

    const image = document.createElement("img");
    image.className = "story-image";
    image.alt = "";
    image.loading = "lazy";

    image.src =
      IMAGE_PROXY.replace(/\/$/, "") +
      "/image?url=" +
      encodeURIComponent(meta.image);

    image.addEventListener("error", () => image.remove());

    body.appendChild(image);
  } catch (e) {
    // Story images are optional.
  }
}


document.getElementById("form").addEventListener("submit", e => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) {
    customFeed = null;
    currentFeedId = FEEDS[0].id;
    localStorage.setItem("activeTab", currentFeedId);
  } else {
    customFeed = { label: pretty(q), url: searchUrl(q) };
  }
  input.value = "";
  renderTabs();
  loadFeed();
});

refreshBtn.addEventListener("click", () => {
  refreshBtn.classList.remove("spin");
  void refreshBtn.offsetWidth;
  refreshBtn.classList.add("spin");
  loadFeed();
});

function searchUrl(q) {
  return "https://news.google.com/rss/search?q=" +
         encodeURIComponent(q) +
         geoParams();
}

function pretty(q) {
  return q.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

async function loadFeed() {
  const feed = activeFeed();
  statusEl.textContent = "Loading " + feed.label + "…";
  grid.innerHTML = "";
  try {
    const res = await fetch(regionalFeedUrl(feed.url));
    if (!res.ok) throw new Error("HTTP " + res.status);
    let text = await res.text();
    let xml = new DOMParser().parseFromString(text, "application/xml");
    if (xml.querySelector("parsererror")) {
      text = text.replace(/&nbsp;/g, "&#160;");
      xml = new DOMParser().parseFromString(text, "application/xml");
    }

    const items = [...xml.querySelectorAll("item")]
      .map(it => ({ it, t: new Date(textOf(it, "pubDate")).getTime() || 0 }))
      .sort((a, b) => b.t - a.t)
      .map(o => o.it);

    if (!items.length) {
      statusEl.textContent = 'No results for "' + feed.label + '"';
      return;
    }

    if (storyMode) {
      renderStoryClusters(items, feed);
    } else {
      setStatus(items.length, feed.label, "newest first");

      const cards = items.map(it => makeCard(it));
      cards.forEach(card => grid.appendChild(card));

      // Load article images after the text is already visible.
      if (isImageProxyConfigured()) {
        loadArticleImages(items, cards);
      }
    }
  } catch (err) {
    statusEl.textContent = "Couldn't load feed: " + err.message;
  }
}

function makeCard(item) {
  const title = textOf(item, "title");
  const link = textOf(item, "link") || "#";
  const pubDate = textOf(item, "pubDate");
  const sourceEl = item.querySelector("source");
  const source = sourceEl ? sourceEl.textContent.trim() : "";
  const sourceUrl = sourceEl ? sourceEl.getAttribute("url") : "";

  const headline = source && title.endsWith(source)
    ? title.slice(0, -source.length).replace(/[-–]\s*$/, "").trim()
    : title;

  let favicon = "";
  if (sourceUrl) {
    try {
      favicon =
        "https://www.google.com/s2/favicons?domain=" +
        new URL(sourceUrl).hostname +
        "&sz=64";
    } catch (e) {}
  }

  const card = document.createElement("a");
  card.className = "card";
  card.href = link;
  card.target = "_blank";
  card.rel = "noopener";
  card.dataset.articleUrl = link;

  const sourceRow = document.createElement("div");
  sourceRow.className = "source";

  if (favicon) {
    const faviconImg = document.createElement("img");
    faviconImg.src = favicon;
    faviconImg.alt = "";
    faviconImg.loading = "lazy";
    sourceRow.appendChild(faviconImg);
  }

  const sourceName = document.createElement("span");
  sourceName.textContent = source;
  sourceRow.appendChild(sourceName);

  const main = document.createElement("div");
  main.className = "card-main";

  const text = document.createElement("div");
  text.className = "card-text";

  const headlineEl = document.createElement("div");
  headlineEl.className = "headline";
  headlineEl.textContent = headline;

  const metaEl = document.createElement("div");
  metaEl.className = "meta";
  metaEl.textContent = timeAgo(pubDate);

  text.appendChild(headlineEl);
  text.appendChild(metaEl);
  main.appendChild(text);

  card.appendChild(sourceRow);
  card.appendChild(main);

  return card;
}

function isImageProxyConfigured() {
  return IMAGE_PROXY && !IMAGE_PROXY.includes("YOUR-WORKER");
}

async function loadArticleImages(items, cards) {
  // Keep the popup responsive instead of starting 70+ requests at once.
  const concurrency = 4;
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      const item = items[index];
      const card = cards[index];

      try {
        await addArticleImage(item, card);
      } catch (e) {
        // Images are optional. Never let an image failure break the feed.
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker()
    )
  );
}

async function addArticleImage(item, card) {
  const articleUrl = textOf(item, "link");
  if (!articleUrl || articleUrl === "#") return;

  let meta = imageMetaCache.get(articleUrl);

  if (!meta) {
    const endpoint =
      IMAGE_PROXY.replace(/\/$/, "") +
      "/meta?url=" +
      encodeURIComponent(articleUrl);

    const response = await fetch(endpoint);
    if (!response.ok) return;

    meta = await response.json();
    imageMetaCache.set(articleUrl, meta);
  }

  if (!meta || !meta.image) return;

  const main = card.querySelector(".card-main");
  if (!main || main.querySelector(".thumb")) return;

  const image = document.createElement("img");
  image.className = "thumb";
  image.alt = "";
  image.loading = "lazy";

  // Proxy the actual image too. This avoids publisher hotlink/CORS issues
  // when an image URL cannot be loaded directly by the extension.
  image.src =
    IMAGE_PROXY.replace(/\/$/, "") +
    "/image?url=" +
    encodeURIComponent(meta.image);

  image.addEventListener("error", () => image.remove());

  main.appendChild(image);
}

function textOf(node, tag) {
  const el = node.querySelector(tag);
  return el ? el.textContent.trim() : "";
}

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

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

updateGeoSwitch();
updateStoryMode();
renderTabs();
loadFeed();
