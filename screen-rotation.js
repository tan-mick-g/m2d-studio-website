/* Rotate the whole display inside a swapped viewport, including its controls. */
(() => {
  const viewport = document.getElementById("screen-viewport");
  const key = "mtd-studio-screen-rotation";
  const preview = new URLSearchParams(location.search).has("preview") && window.parent !== window;
  let degrees = 0;
  if (!preview) {
    try {
      const saved = Number(localStorage.getItem(key));
      if ([0, 90, 180, 270].includes(saved)) degrees = saved;
    } catch { /* Rotation still works when storage is unavailable. */ }
  }
  const dimensions = () => degrees % 180
    ? { width: innerHeight, height: innerWidth }
    : { width: innerWidth, height: innerHeight };
  const apply = () => {
    const { width, height } = dimensions();
    viewport.style.width = `${width}px`;
    viewport.style.height = `${height}px`;
    viewport.style.transform = `translate(-50%, -50%) rotate(${degrees}deg)`;
    viewport.style.setProperty("--screen-width", `${width}px`);
    viewport.style.setProperty("--screen-height", `${height}px`);
    viewport.classList.toggle("is-narrow", width <= 540);
  };
  window.MTD_SCREEN_ROTATION = {
    angle: () => degrees,
    landscape: () => dimensions().width > dimensions().height,
    rotate() {
      degrees = (degrees + 90) % 360;
      apply();
      if (!preview) {
        try { localStorage.setItem(key, String(degrees)); } catch { /* Optional per-device preference. */ }
      }
      window.dispatchEvent(new Event("screenrotation"));
    }
  };
  apply();
  window.addEventListener("resize", apply);
})();
