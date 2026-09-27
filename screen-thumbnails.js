/* Draw a paused frame directly to a canvas; no cross-origin pixel export is needed. */
(() => {
  const tasks = new WeakMap();
  const mount = (host, url) => {
    tasks.get(host)?.();
    host.replaceChildren();
    host.dataset.videoThumbnail = "";
    const canvas = document.createElement("canvas");
    canvas.hidden = true;
    canvas.setAttribute("aria-hidden", "true");
    const status = document.createElement("span");
    status.className = "video-thumbnail-status";
    status.textContent = "Loading preview…";
    host.append(canvas, status);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    let stopped = false, timer, observer;
    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      observer?.disconnect();
      video.removeAttribute("src");
      video.load();
    };
    tasks.set(host, stop);
    const fail = () => {
      if (stopped) return;
      status.textContent = "Preview unavailable";
      stop();
    };
    const capture = () => {
      if (stopped || video.readyState < 2 || !video.videoWidth) return;
      try {
        const scale = Math.min(1, 640 / video.videoWidth, 640 / video.videoHeight);
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.hidden = false;
        status.hidden = true;
        stop();
      } catch { fail(); }
    };
    video.addEventListener("loadedmetadata", () => {
      if (stopped) return;
      // Avoid a blank opening frame without seeking beyond a very short clip.
      const time = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(1, video.duration / 2) : 0;
      if (time > 0) video.currentTime = time;
      else capture();
    });
    video.addEventListener("seeked", capture);
    video.addEventListener("loadeddata", () => {
      if (!video.seeking && video.currentTime > 0) capture();
    });
    video.addEventListener("error", fail);
    const start = () => {
      if (stopped) return;
      observer?.disconnect();
      timer = setTimeout(fail, 20000);
      video.src = url;
      video.load();
    };
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) start();
      }, { rootMargin: "200px" });
      observer.observe(host);
    } else start();
  };
  const clear = root => root.querySelectorAll("[data-video-thumbnail]").forEach(host => {
    tasks.get(host)?.();
    tasks.delete(host);
  });
  window.MTD_SCREEN_THUMBNAILS = { mount, clear };
})();
