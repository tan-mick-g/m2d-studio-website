(() => {
  const core = window.MTD_SCREEN;
  const stage = document.getElementById("screen");
  const fallback = document.getElementById("fallback");
  const preview = new URLSearchParams(location.search).has("preview") && window.parent !== window;
  const storageKey = "mtd-studio-screen-position";
  let settings = core.normalize();
  let pending = null;
  let signature = "";
  let index = -1;
  let active = null;
  let generation = 0;
  let slideTimer;
  let watchTimer;
  let loading = null;
  let failures = new Map();
  let preloaded = null;
  let running = false;
  const playlist = () => settings.items.filter((item) => item.enabled && item.src);
  const source = (item) => core.source(item, innerWidth > innerHeight);
  const clearTimers = () => { clearTimeout(slideTimer); clearInterval(watchTimer); };
  const dispose = (node) => {
    if (!node) return;
    node.querySelectorAll("video").forEach((video) => {
      video.pause(); video.removeAttribute("src"); video.load();
    });
    node.remove();
  };
  const idle = () => {
    clearTimers();
    generation++;
    dispose(loading); loading = null;
    dispose(active); active = null;
    fallback.hidden = false;
    running = false;
    slideTimer = setTimeout(() => { failures.clear(); advance(); }, 60000);
  };
  const applyPending = () => {
    if (!pending) return;
    const previousId = playlist()[index]?.id;
    settings = pending; pending = null;
    index = playlist().findIndex((item) => item.id === previousId);
    failures.clear();
    stage.style.backgroundColor = settings.background;
  };
  const rememberNext = (items) => {
    if (preview || !items.length) return;
    try { localStorage.setItem(storageKey, items[(index + 1) % items.length].id); } catch { /* Storage can be disabled on TV browsers. */ }
  };
  const preloadNext = (items) => {
    preloaded = null;
    const next = items[(index + 1) % items.length];
    if (next?.type === "image") { preloaded = new Image(); preloaded.src = source(next); }
  };
  const show = (item, items) => {
    clearTimers();
    const token = ++generation;
    dispose(loading);
    const layer = document.createElement("div");
    loading = layer;
    layer.className = `screen-slide${settings.transition === "cut" ? " is-cut" : ""}`;
    layer.style.backgroundColor = settings.background;
    const url = source(item);
    const failureKey = `${item.id}:${url}`;
    const media = document.createElement(item.type === "video" ? "video" : "img");
    media.className = "screen-media";
    media.style.objectFit = item.fit;
    media.style.objectPosition = `${item.x}% ${item.y}%`;
    if (item.type === "image") {
      media.alt = item.name;
      if (item.background === "blur" && item.fit === "contain") {
        const backdrop = document.createElement("img");
        backdrop.src = url; backdrop.alt = ""; backdrop.className = "screen-backdrop";
        layer.append(backdrop);
      }
    }
    layer.append(media);
    stage.append(layer);
    let revealed = false;
    const fail = () => {
      if (token !== generation) return;
      failures.set(failureKey, Date.now() + 60000);
      clearTimers();
      generation++;
      if (loading === layer) loading = null;
      if (active === layer) active = null;
      dispose(layer);
      slideTimer = setTimeout(advance, 100);
    };
    const reveal = () => {
      if (token !== generation || revealed) return;
      revealed = true;
      clearTimeout(slideTimer);
      const previous = active;
      previous?.querySelector("video")?.pause();
      active = layer; loading = null;
      fallback.hidden = true;
      requestAnimationFrame(() => { if (token === generation) layer.classList.add("is-visible"); });
      setTimeout(() => dispose(previous), 500);
      rememberNext(items);
      preloadNext(items);
      if (item.type === "image") slideTimer = setTimeout(advance, (item.duration || settings.duration) * 1000);
    };
    media.addEventListener("error", fail, { once: true });
    slideTimer = setTimeout(fail, 20000);
    if (item.type === "video") {
      media.muted = settings.muted;
      media.defaultMuted = settings.muted;
      media.playsInline = true;
      media.setAttribute("playsinline", "");
      media.preload = "auto";
      media.addEventListener("playing", reveal);
      media.addEventListener("ended", () => { if (token === generation) advance(); }, { once: true });
      let lastTime = -1;
      let lastProgress = Date.now();
      watchTimer = setInterval(() => {
        if (token !== generation) return;
        if (media.currentTime !== lastTime) { lastTime = media.currentTime; lastProgress = Date.now(); }
        else if (Date.now() - lastProgress > 30000) fail();
      }, 5000);
      media.src = url;
      const play = async () => {
        try { await media.play(); }
        catch (error) {
          if (token !== generation) return;
          // Some TV webviews block automatic playback with sound. Keep the display moving.
          if (!media.muted && error.name === "NotAllowedError") {
            media.muted = true;
            try { await media.play(); } catch { fail(); }
          } else fail();
        }
      };
      play();
    } else {
      media.addEventListener("load", reveal, { once: true });
      media.src = url;
    }
  };
  function advance() {
    clearTimers();
    applyPending();
    const items = playlist();
    if (!items.length) { idle(); return; }
    running = true;
    for (let attempt = 0; attempt < items.length; attempt++) {
      index = (index + 1) % items.length;
      const item = items[index];
      if ((failures.get(`${item.id}:${source(item)}`) || 0) <= Date.now()) { show(item, items); return; }
    }
    idle();
  }
  const update = (value, restart = false) => {
    const normalized = core.normalize(value);
    const nextSignature = JSON.stringify(normalized);
    if (nextSignature === signature && !restart) return;
    signature = nextSignature;
    pending = normalized;
    if (!running || restart) {
      applyPending();
      index = -1;
      if (!preview) {
        try { index = playlist().findIndex((item) => item.id === localStorage.getItem(storageKey)) - 1; } catch { /* Optional resume only. */ }
        if (index < -1) index = -1;
      }
      advance();
    }
  };
  if (preview) {
    window.addEventListener("message", (event) => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== "mtd-screen-preview") return;
      update(event.data.settings, true);
    });
    window.parent.postMessage({ type: "mtd-screen-ready" }, location.origin);
  } else {
    let fetching = false;
    const refresh = async () => {
      const config = window.MTD_SUPABASE || {};
      if (fetching || !config.url || !config.anonKey) return;
      fetching = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const url = new URL(`${config.url}/rest/v1/site_content`);
        url.searchParams.set("select", "content");
        url.searchParams.set("id", `eq.${config.contentId || "homepage"}`);
        url.searchParams.set("is_published", "eq.true");
        const response = await fetch(url, {
          headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
          cache: "no-store", signal: controller.signal
        });
        if (!response.ok) throw new Error(`Display update failed: ${response.status}`);
        const rows = await response.json();
        update(rows[0]?.content?.studioScreen || {});
      } catch (error) { console.warn("Studio Screen will retry its next update.", error.message); }
      finally { clearTimeout(timeout); fetching = false; }
    };
    refresh();
    setInterval(refresh, 60000);
    window.addEventListener("online", refresh);
  }
  let landscape = innerWidth > innerHeight;
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const next = innerWidth > innerHeight;
      if (next === landscape) return;
      landscape = next;
      failures.clear();
      if (running) { index--; advance(); }
    }, 250);
  });
})();
