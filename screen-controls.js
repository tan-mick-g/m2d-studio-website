/* Small public controls, kept separate from the unattended playback engine. */
window.MTD_SCREEN_CONTROLS = ({ suspend, play, resume }) => {
  const root = document.createElement("div");
  root.className = "screen-controls-ui";
  root.innerHTML = '<section class="screen-browser" aria-label="Media browser" hidden><header><h1 tabindex="-1"></h1><button type="button" data-gallery-back hidden>Back to gallery</button></header><div class="screen-gallery"></div><div class="screen-detail" hidden></div></section><nav class="screen-navigation" aria-label="Screen navigation"><button type="button" data-section="videos">Videos</button><button type="button" data-section="packages">Packages</button><button type="button" data-section="schedule">Schedule</button><button type="button" data-section="classes">Classes</button><button type="button" data-rotate>Rotate</button><button type="button" data-resume hidden>Back to Playlist</button></nav>';
  const icons = {
    Videos: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="m10 8 6 4-6 4Z"/>',
    Packages: '<path d="M3 7h18v14H3zM2 3h20v4H2zM12 3v18M8 11h8"/>',
    Schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M15 14h2M7 18h2"/>',
    Classes: '<path d="m2 8 10-5 10 5-10 5Z"/><path d="M6 10v7c4 3 8 3 12 0v-7M22 8v8"/>',
    Rotate: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
    "Back to Playlist": '<path d="m9 5-6 6 6 6M3 11h11a6 6 0 0 1 6 6"/><path d="M13 3h8M15 6h6"/>'
  };
  root.querySelectorAll(".screen-navigation button").forEach(button => {
    const label = button.textContent;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[label]}</svg>`;
  });
  document.getElementById("screen-viewport").append(root);
  const panel = root.querySelector(".screen-browser");
  const heading = root.querySelector("h1");
  const gallery = root.querySelector(".screen-gallery");
  const detail = root.querySelector(".screen-detail");
  const back = root.querySelector("[data-gallery-back]");
  const returnButton = root.querySelector("[data-resume]");
  let settings, section, timer, interacting = false;
  const source = item => window.MTD_SCREEN.source(item, window.MTD_SCREEN_ROTATION.landscape());
  const clearMedia = element => {
    window.MTD_SCREEN_THUMBNAILS.clear(element);
    element.querySelectorAll("video").forEach(video => { video.removeAttribute("src"); video.load(); });
    element.querySelectorAll("iframe").forEach(frame => { frame.src = "about:blank"; });
    element.replaceChildren();
  };
  const resetTimer = () => {
    clearTimeout(timer);
    if (!panel.hidden) timer = setTimeout(resume, settings.browseTimeout * 1000);
  };
  const close = () => {
    clearTimeout(timer);
    panel.hidden = true;
    returnButton.hidden = true;
    clearMedia(gallery); clearMedia(detail);
    root.querySelectorAll("[data-section]").forEach(button => button.setAttribute("aria-pressed", "false"));
    if (interacting) root.querySelector("[data-section]").focus();
    interacting = false;
  };
  const render = () => {
    panel.hidden = false; gallery.hidden = false; detail.hidden = true; back.hidden = true;
    clearMedia(gallery); clearMedia(detail);
    heading.textContent = { videos: "Videos", packages: "Packages", schedule: "Schedule", classes: "Classes" }[section];
    if (section === "classes") {
      gallery.hidden = true; detail.hidden = false;
      const url = settings.classesMode === "image" ? settings.classesImage : settings.classesUrl;
      if (!url) {
        detail.textContent = "Classes information coming soon.";
      } else if (settings.classesMode === "image") {
        const image = document.createElement("img");
        image.src = url; image.alt = "Classes";
        image.addEventListener("error", () => { detail.textContent = "The classes image could not load. Please try again later."; });
        detail.append(image);
      } else {
        const frame = document.createElement("iframe");
        frame.title = "Classes webpage";
        frame.className = "screen-classes-frame";
        frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.src = url;
        detail.append(frame);
        const help = document.createElement("p");
        help.className = "screen-embed-help";
        help.textContent = "Use the playlist icon below to return to the studio display.";
        detail.append(help);
      }
      heading.focus();
      resetTimer();
      return;
    }
    const items = (section === "videos" ? settings.items.filter(item => item.type === "video") : settings.navigationImages[section] || []).filter(item => item.enabled && item.src);
    if (!items.length) {
      const empty = document.createElement("p");
      empty.textContent = "Nothing has been added here yet.";
      gallery.append(empty);
    }
    items.forEach((item, index) => {
      const title = section === "videos" ? item.displayName.trim() || `Video ${index + 1}` : item.name;
      const button = document.createElement("button");
      button.type = "button"; button.className = "screen-gallery-card";
      const thumbnail = document.createElement(item.type === "video" ? "span" : "img");
      if (item.type === "video") { thumbnail.className = "video-thumbnail"; thumbnail.setAttribute("aria-hidden", "true"); window.MTD_SCREEN_THUMBNAILS.mount(thumbnail, source(item)); }
      else { thumbnail.alt = ""; thumbnail.loading = "lazy"; }
      if (item.type === "image") thumbnail.src = source(item);
      thumbnail.dataset.itemId = item.id;
      const label = document.createElement("span"); label.textContent = title;
      button.append(thumbnail, label);
      button.addEventListener("click", () => {
        clearTimeout(timer);
        clearMedia(gallery);
        if (item.type === "video") {
          panel.hidden = true;
          play(item);
          returnButton.focus();
        } else {
          gallery.hidden = true; detail.hidden = false; back.hidden = false;
          heading.textContent = title;
          const image = document.createElement("img");
          image.alt = title; image.src = source(item); image.dataset.itemId = item.id;
          image.addEventListener("error", () => {
            detail.textContent = "This image could not load. Return to the gallery to try again.";
          });
          detail.append(image);
          back.focus();
          resetTimer();
        }
      });
      gallery.append(button);
    });
    heading.focus();
    resetTimer();
  };
  root.querySelectorAll("[data-section]").forEach(button => {
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      settings = suspend();
      interacting = true; section = button.dataset.section; returnButton.hidden = false;
      root.querySelectorAll("[data-section]").forEach(tab => tab.setAttribute("aria-pressed", String(tab === button)));
      render();
    });
  });
  const rotateButton = root.querySelector("[data-rotate]");
  const rotationLabel = () => {
    rotateButton.title = `Rotate 90° clockwise (currently ${window.MTD_SCREEN_ROTATION.angle()}°)`;
  };
  rotateButton.addEventListener("click", () => { window.MTD_SCREEN_ROTATION.rotate(); rotationLabel(); });
  rotationLabel();
  back.addEventListener("click", render);
  returnButton.addEventListener("click", resume);
  ["pointerdown", "pointermove", "keydown", "wheel"].forEach(event => root.addEventListener(event, resetTimer, { passive: true }));
  window.addEventListener("keydown", event => { if (event.key === "Escape" && interacting) resume(); });
  const refreshSources = () => {
    const image = detail.querySelector("img");
    const candidates = settings ? [...settings.items, ...settings.navigationImages.packages, ...settings.navigationImages.schedule] : [];
    const item = candidates.find(item => item.id === image?.dataset.itemId);
    if (image && item) image.src = source(item);
    gallery.querySelectorAll("[data-item-id]").forEach(media => {
      const entry = candidates.find(item => item.id === media.dataset.itemId);
      if (entry?.type === "video") window.MTD_SCREEN_THUMBNAILS.mount(media, source(entry));
      else if (entry) media.src = source(entry);
    });
  };
  window.addEventListener("resize", refreshSources);
  window.addEventListener("screenrotation", refreshSources);
  return { close };
};
