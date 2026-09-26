/* Shared by the display and its admin editor. No site navigation is added. */
(() => {
  const defaults = { muted: true, duration: 10, transition: "fade", background: "#143155", items: [] };
  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return value === "" || !Number.isFinite(number) ? fallback : Math.min(max, Math.max(min, number));
  };
  const mediaUrl = (value) => {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const url = new URL(value.trim(), window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  };
  const normalize = (value = {}) => {
    value = value && typeof value === "object" ? value : {};
    return {
      muted: value.muted !== false,
      duration: clamp(value.duration, 3, 300, 10),
      transition: value.transition === "cut" ? "cut" : "fade",
      background: /^#[\da-f]{6}$/i.test(value.background || "") ? value.background : defaults.background,
      backgroundImage: mediaUrl(value.backgroundImage),
      loadingImage: mediaUrl(value.loadingImage === undefined ? "/assets/m2d-horizontal-cream.png" : value.loadingImage),
      loadingText: String(value.loadingText === undefined ? "Made to move. Made to connect." : value.loadingText),
      loadingTextColor: /^#[\da-f]{6}$/i.test(value.loadingTextColor || "") ? value.loadingTextColor : "#feffe9",
      loadingEnabled: value.loadingEnabled !== false,
      loadingBetween: value.loadingBetween === true,
      loadingDuration: clamp(value.loadingDuration, 1, 60, 3),
      loadingLayout: value.loadingLayout === "full" ? "full" : "logo",
      items: (Array.isArray(value.items) ? value.items : []).filter(Boolean).map((item, index) => ({
        id: String(item.id || `slide-${index}`),
        name: String(item.name || "Untitled slide"),
        type: item.type === "video" ? "video" : "image",
        src: mediaUrl(item.src),
        landscapeSrc: mediaUrl(item.landscapeSrc),
        enabled: item.enabled !== false,
        duration: item.duration === "" || item.duration == null ? "" : clamp(item.duration, 3, 300, 10),
        fit: item.fit === "cover" ? "cover" : "contain",
        background: item.background === "blur" ? "blur" : "brand",
        x: clamp(item.x, 0, 100, 50),
        y: clamp(item.y, 0, 100, 50)
      }))
    };
  };
  const source = (item, landscape) => landscape && item.landscapeSrc ? item.landscapeSrc : item.src;
  const moveItem = (items, from, to) => {
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= items.length || to < 0 || to >= items.length) return;
    items.splice(to, 0, items.splice(from, 1)[0]);
  };
  window.MTD_SCREEN = { defaults, normalize, source, mediaUrl, moveItem };
})();
