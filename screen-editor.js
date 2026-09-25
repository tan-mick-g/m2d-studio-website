window.MTD_SCREEN_EDITOR = ({ upload }) => {
  const core = window.MTD_SCREEN;
  const root = document.querySelector('[data-page-panel="studio-screen"]');
  const list = root.querySelector("[data-screen-list]");
  const controls = root.querySelector("[data-screen-controls]");
  const message = root.querySelector("[data-screen-message]");
  const previewWrap = root.querySelector("[data-screen-preview-wrap]");
  let settings = core.normalize();
  let uploading = false;
  let dragId = null;
  let previewSettings = null;
  const expanded = new Set();
  const id = () => window.crypto?.randomUUID?.() || `slide-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const notify = (text, error = false) => { message.textContent = text; message.classList.toggle("is-error", error); };
  const draftNotice = () => notify("Playlist updated. Preview it, then Save Changes to publish.");
  const createItem = (extra = {}) => ({ id: id(), name: "New slide", type: "image", src: "", landscapeSrc: "", enabled: true, duration: "", fit: "contain", background: "brand", x: 50, y: 50, ...extra });
  const option = (value, label, current) => `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`;
  const updateSummary = () => {
    const enabled = settings.items.filter((item) => item.enabled);
    const seconds = enabled.filter((item) => item.type === "image").reduce((sum, item) => sum + (Number(item.duration) || Number(settings.duration) || 10), 0);
    const videos = enabled.filter((item) => item.type === "video").length;
    root.querySelector("[data-screen-summary]").textContent = `${enabled.length} active / ${settings.items.length} slides · ${seconds}s of images${videos ? ` + ${videos} video${videos === 1 ? "" : "s"}` : ""}`;
  };
  const thumbnail = (item) => {
    const url = core.mediaUrl(item.src);
    if (!url) return '<span class="screen-thumbnail-empty">Add media</span>';
    return item.type === "video"
      ? `<video src="${escape(url)}" muted playsinline preload="metadata" aria-label="${escape(item.name)}"></video>`
      : `<img src="${escape(url)}" alt="${escape(item.name)}" loading="lazy" />`;
  };
  const itemSummary = (item) => `${item.type === "video" ? "Video · plays to end" : `Image · ${item.duration || settings.duration}s`} · ${item.fit === "cover" ? "Fill" : "Fit"}${item.landscapeSrc ? " · Landscape version" : ""}`;
  const render = () => {
    list.innerHTML = settings.items.length ? settings.items.map((item, index) => `
      <article class="screen-item${item.enabled ? "" : " is-disabled"}" data-screen-id="${escape(item.id)}">
        <div class="screen-item-top">
          <button type="button" class="screen-drag" draggable="true" data-screen-drag aria-label="Drag slide ${index + 1} to reorder" title="Drag to reorder">⠿</button>
          <span class="screen-slide-number">${String(index + 1).padStart(2, "0")}</span>
          <div class="screen-thumbnail">${thumbnail(item)}</div>
          <div class="screen-item-overview"><strong data-screen-title title="${escape(item.name)}">${escape(item.name)}</strong><span data-screen-item-summary>${escape(itemSummary(item))}</span></div>
          <label class="screen-enabled"><input type="checkbox" data-field="enabled"${item.enabled ? " checked" : ""} /> Enabled</label>
          <div class="screen-item-actions">
            <button type="button" class="text-button" data-screen-action="up" aria-label="Move slide ${index + 1} up"${index === 0 ? " disabled" : ""}>↑</button>
            <button type="button" class="text-button" data-screen-action="down" aria-label="Move slide ${index + 1} down"${index === settings.items.length - 1 ? " disabled" : ""}>↓</button>
            <button type="button" class="text-button screen-edit-toggle" data-screen-action="edit" aria-expanded="${expanded.has(item.id)}" aria-controls="screen-fields-${escape(item.id)}">${expanded.has(item.id) ? "Done" : "Edit"}</button>
          </div>
        </div>
        <div class="screen-item-body" id="screen-fields-${escape(item.id)}"${expanded.has(item.id) ? "" : " hidden"}>
          <div class="screen-item-fields">
            <div class="field-grid">
              <label>Slide Name<input data-field="name" value="${escape(item.name)}" placeholder="e.g. Class rates" /></label>
              <label>Media Type<select data-field="type">${option("image", "Image / rate card", item.type)}${option("video", "Video", item.type)}</select></label>
            </div>
            <label>Media URL<input data-field="src" type="url" value="${escape(item.src)}" placeholder="https://… (direct image or video file)" /></label>
            <label class="upload-field">Replace ${item.type === "video" ? "Video" : "Image"}<input type="file" accept="${item.type}/*" data-screen-file="src" /></label>
            <div class="field-grid">
              <label>Display Fit<select data-field="fit">${option("contain", "Fit entire image / video", item.fit)}${option("cover", "Fill screen (crop edges)", item.fit)}</select></label>
              ${item.type === "image" ? `<label>Duration (seconds)<input data-field="duration" type="number" min="3" max="300" value="${escape(item.duration)}" placeholder="Default: ${escape(settings.duration)}" /></label>` : '<p class="editor-help">Plays to the end, then advances.</p>'}
            </div>
            <details class="screen-item-options"><summary>Background, crop & landscape version</summary>
              <div class="field-grid">
                <label>Unused Space<select data-field="background">${option("brand", "Display background color", item.background)}${item.type === "image" ? option("blur", "Blurred copy of image", item.background) : ""}</select></label>
                <p class="editor-help">Fit keeps all text and movement visible. Fill crops around the position below.</p>
                <label>Crop Position — Left to Right (%)<input data-field="x" type="number" min="0" max="100" value="${escape(item.x)}" /></label>
                <label>Crop Position — Top to Bottom (%)<input data-field="y" type="number" min="0" max="100" value="${escape(item.y)}" /></label>
              </div>
              <label>Optional Landscape ${item.type === "video" ? "Video" : "Image"} URL<input data-field="landscapeSrc" type="url" value="${escape(item.landscapeSrc)}" placeholder="Leave empty to use the main media on every screen" /></label>
              <label class="upload-field">Upload Landscape Version<input type="file" accept="${item.type}/*" data-screen-file="landscapeSrc" /></label>
              <p class="editor-help">Used when the screen is wider than it is tall. Match the main media type. Text inside images scales with the image; it cannot rearrange.</p>
            </details>
            <div class="screen-secondary-actions">
              <button type="button" class="text-button" data-screen-action="duplicate">Duplicate slide</button>
              <button type="button" class="text-button" data-screen-action="remove">Remove slide</button>
            </div>
          </div>
        </div>
      </article>`).join("") : '<div class="screen-empty"><span class="screen-empty-icon" aria-hidden="true">▤</span><h4>Your screen starts here</h4><p>Upload rate cards, studio photos, or videos.<br />They will play in the order you choose.</p></div>';
    updateSummary();
  };
  const read = () => {
    if (uploading) throw new Error("Wait for Studio Screen uploads to finish.");
    for (const [index, item] of settings.items.entries()) {
      if (item.enabled && !core.mediaUrl(item.src)) throw new Error(`Studio Screen slide ${index + 1} needs a valid media URL, or disable it for now.`);
      if (item.landscapeSrc && !core.mediaUrl(item.landscapeSrc)) throw new Error(`Studio Screen slide ${index + 1} has an invalid landscape URL.`);
      if (item.duration !== "" && (Number(item.duration) < 3 || Number(item.duration) > 300)) throw new Error(`Studio Screen slide ${index + 1}: use an image duration from 3 to 300 seconds.`);
    }
    if (Number(settings.duration) < 3 || Number(settings.duration) > 300) throw new Error("Studio Screen: use a default image duration from 3 to 300 seconds.");
    return core.normalize(settings);
  };
  const fill = (value) => {
    settings = core.normalize(value);
    root.querySelectorAll("[data-screen-setting]").forEach((input) => { input.value = String(settings[input.dataset.screenSetting]); });
    render();
  };
  root.addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    const setting = event.target.dataset.screenSetting;
    if (setting) {
      settings[setting] = setting === "muted" ? event.target.value === "true" : event.target.value;
      updateSummary();
      list.querySelectorAll("[data-screen-id]").forEach((row) => {
        const item = settings.items.find((entry) => entry.id === row.dataset.screenId);
        row.querySelector("[data-screen-item-summary]").textContent = itemSummary(item);
      });
    }
    if (!field) return;
    const row = event.target.closest("[data-screen-id]");
    const item = settings.items.find((entry) => entry.id === row.dataset.screenId);
    item[field] = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    row.classList.toggle("is-disabled", !item.enabled);
    row.querySelector("[data-screen-title]").textContent = item.name;
    row.querySelector("[data-screen-title]").title = item.name;
    row.querySelector("[data-screen-item-summary]").textContent = itemSummary(item);
    updateSummary();
  });
  root.addEventListener("change", (event) => {
    if (["src", "type"].includes(event.target.dataset.field)) {
      const row = event.target.closest("[data-screen-id]");
      const item = settings.items.find((entry) => entry.id === row.dataset.screenId);
      if (event.target.dataset.field === "type") { item.background = "brand"; render(); }
      else row.querySelector(".screen-thumbnail").innerHTML = thumbnail(item);
    }
  });
  const stop = () => {
    previewWrap.querySelector("iframe")?.remove();
    previewWrap.querySelector("[data-screen-preview-placeholder]").hidden = false;
  };
  const playPreview = () => {
    const status = root.querySelector("[data-screen-preview-message]");
    try { previewSettings = read(); status.textContent = ""; } catch (error) { status.textContent = error.message; return; }
    stop();
    const frame = document.createElement("iframe");
    frame.title = "Studio Screen draft preview";
    frame.allow = "autoplay";
    frame.src = "screen.html?preview=1";
    previewWrap.querySelector("[data-screen-preview-placeholder]").hidden = true;
    previewWrap.append(frame);
  };
  window.addEventListener("message", (event) => {
    const frame = previewWrap.querySelector("iframe");
    if (event.origin === location.origin && event.source === frame?.contentWindow && event.data?.type === "mtd-screen-ready") {
      frame.contentWindow.postMessage({ type: "mtd-screen-preview", settings: previewSettings }, location.origin);
    }
  });
  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-screen-preview]")) playPreview();
    if (event.target.closest("[data-screen-stop]")) stop();
    const orientation = event.target.closest("[data-screen-orientation]")?.dataset.screenOrientation;
    if (orientation) {
      previewWrap.dataset.orientation = orientation;
      root.querySelectorAll("[data-screen-orientation]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.screenOrientation === orientation)));
    }
    if (uploading) return;
    if (event.target.closest("[data-screen-add]")) {
      const item = createItem(); settings.items.push(item); expanded.add(item.id); render(); draftNotice();
      list.lastElementChild.querySelector('[data-field="name"]').focus();
    }
    const button = event.target.closest("[data-screen-action]");
    if (!button) return;
    const row = button.closest("[data-screen-id]");
    const index = settings.items.findIndex((item) => item.id === row.dataset.screenId);
    const action = button.dataset.screenAction;
    if (action === "edit") {
      const open = !expanded.has(row.dataset.screenId);
      if (open) expanded.add(row.dataset.screenId); else expanded.delete(row.dataset.screenId);
      row.querySelector(".screen-item-body").hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      button.textContent = open ? "Done" : "Edit";
      return;
    }
    if (action === "remove") { expanded.delete(row.dataset.screenId); settings.items.splice(index, 1); }
    if (action === "duplicate") settings.items.splice(index + 1, 0, { ...settings.items[index], id: id(), name: `${settings.items[index].name} (copy)` });
    if (action === "up" || action === "down") {
      const target = index + (action === "up" ? -1 : 1);
      if (target >= 0 && target < settings.items.length) [settings.items[index], settings.items[target]] = [settings.items[target], settings.items[index]];
    }
    const movedId = row.dataset.screenId;
    render(); draftNotice();
    if (action === "up" || action === "down") {
      const movedRow = [...list.children].find((element) => element.dataset.screenId === movedId);
      const moveButton = movedRow.querySelector(`[data-screen-action="${action}"]`);
      (moveButton.disabled ? movedRow.querySelector('[data-screen-action="edit"]') : moveButton).focus({ preventScroll: true });
    }
  });
  list.addEventListener("dragstart", (event) => {
    if (uploading || !event.target.matches("[data-screen-drag]")) { event.preventDefault(); return; }
    dragId = event.target.closest("[data-screen-id]").dataset.screenId;
    event.dataTransfer.setData("text/plain", dragId);
    event.dataTransfer.effectAllowed = "move";
  });
  list.addEventListener("dragover", (event) => { if (dragId && !uploading) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } });
  list.addEventListener("drop", (event) => {
    event.preventDefault();
    const targetId = event.target.closest("[data-screen-id]")?.dataset.screenId;
    if (!dragId || !targetId || uploading) return;
    const from = settings.items.findIndex((item) => item.id === dragId);
    const to = settings.items.findIndex((item) => item.id === targetId);
    if (from >= 0 && to >= 0) settings.items.splice(to, 0, settings.items.splice(from, 1)[0]);
    dragId = null; render(); draftNotice();
  });
  list.addEventListener("dragend", () => { dragId = null; });
  root.addEventListener("change", async (event) => {
    const input = event.target;
    if (!input.matches("[data-screen-bulk], [data-screen-file]") || !input.files.length || uploading) return;
    const files = [...input.files];
    const rowId = input.closest("[data-screen-id]")?.dataset.screenId;
    const field = input.dataset.screenFile;
    uploading = true; controls.disabled = true;
    let succeeded = 0;
    const errors = [];
    try {
      for (const [index, file] of files.entries()) {
        try {
          const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : "";
          if (!type) throw new Error("Choose an image or video file.");
          const item = rowId ? settings.items.find((entry) => entry.id === rowId) : createItem({ name: file.name.replace(/\.[^.]+$/, ""), type });
          if (type !== item.type) throw new Error(`Choose a ${item.type} file for this slide.`);
          notify(`Uploading ${index + 1} of ${files.length}: ${file.name}…`);
          const result = await upload(file, `studioScreen.${item.id}.${field || "src"}`);
          item[field || "src"] = result.publicUrl;
          if (!rowId) settings.items.push(item);
          succeeded++;
        } catch (error) { errors.push(`${file.name}: ${error.message}`); }
      }
    } finally {
      uploading = false; controls.disabled = false; input.value = ""; render();
      notify(`${succeeded} file${succeeded === 1 ? "" : "s"} uploaded. ${errors.length ? errors.join(" ") : "Preview your playlist, then Save Changes to publish."}`, errors.length > 0);
    }
  });
  fill();
  return { fill, read, stop, isUploading: () => uploading };
};
