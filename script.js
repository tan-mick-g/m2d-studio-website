const config = window.MTD_SUPABASE || {};
const defaultContent = window.MTD_DEFAULT_CONTENT || {};
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");
let heroCarouselTimer;

document.documentElement.classList.add("has-js");

const isSupabaseConfigured = () => Boolean(config.url && config.anonKey && window.supabase);

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const deepMerge = (base, override) => {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (!base || typeof base !== "object") return override ?? base;

  const next = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    next[key] = deepMerge(base[key], value);
  });
  return next;
};

const getPath = (object, path) =>
  path.split(".").reduce((value, key) => (value == null ? value : value[key]), object);

const setText = (selector, value) => {
  document.querySelectorAll(selector).forEach((element) => {
    if (value !== undefined) element.textContent = value;
  });
};

const setHref = (selector, value) => {
  document.querySelectorAll(selector).forEach((element) => {
    if (value) element.setAttribute("href", value);
  });
};

const setImage = (selector, value) => {
  document.querySelectorAll(selector).forEach((element) => {
    if (value) {
      element.style.backgroundImage = `url("${value}")`;
      element.classList.add("has-image");
    } else {
      element.style.removeProperty("background-image");
      element.classList.remove("has-image");
    }
  });
};

const renderCards = (selector, items, template) => {
  const container = document.querySelector(selector);
  if (container && Array.isArray(items)) container.innerHTML = items.map(template).join("");
};

const getContentImage = (content, path) => getPath(content, path) || getPath(defaultContent, path) || "";

const getItemImage = (content, section, index, item) =>
  item?.image || defaultContent[section]?.items?.[index]?.image || "";

const getHeroImages = (content) => {
  const savedImages = Array.isArray(content.hero?.images) ? content.hero.images.filter(Boolean) : [];
  const defaultImages = Array.isArray(defaultContent.hero?.images) ? defaultContent.hero.images.filter(Boolean) : [];
  return savedImages.length ? savedImages : defaultImages.length ? defaultImages : [getContentImage(content, "hero.image")].filter(Boolean);
};

const applyHeroMedia = (content) => {
  const heroFilm = document.querySelector("[data-hero-film]");
  const heroTrack = document.querySelector("[data-hero-film-track]");
  const heroVideo = document.querySelector("[data-hero-video]");
  const videoUrl = content.hero?.video || "";
  const images = getHeroImages(content);

  window.clearInterval(heroCarouselTimer);

  if (videoUrl && heroVideo) {
    heroVideo.src = videoUrl;
    heroVideo.hidden = false;
    heroVideo.load();
    heroVideo.play().catch(() => {});
    if (heroFilm) heroFilm.hidden = true;
    return;
  }

  if (heroVideo) {
    heroVideo.pause();
    heroVideo.removeAttribute("src");
    heroVideo.hidden = true;
  }

  if (!heroFilm || !heroTrack) return;
  heroFilm.hidden = false;
  heroTrack.style.transform = "translateX(0)";
  heroTrack.innerHTML = images
    .map(
      (image) => `
        <div class="image-fill hero-image has-image" style="background-image:url('${escapeHtml(image)}')"></div>
      `
    )
    .join("");

  if (images.length <= 1) return;

  let index = 0;
  heroCarouselTimer = window.setInterval(() => {
    index = (index + 1) % images.length;
    heroTrack.style.transform = `translateX(-${index * 100}%)`;
  }, 4000);
};

const renderCalendar = (schedule) => {
  const container = document.querySelector("[data-calendar]");
  if (!container) return;

  const highlighted = new Set((schedule?.highlightedDays || []).map(Number));
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const blanks = Array.from({ length: 6 }, (_, index) => `<span class="calendar-day is-empty">${index}</span>`);
  const days = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    return `<span class="calendar-day ${highlighted.has(day) ? "is-highlighted" : ""}">${day}</span>`;
  });

  container.innerHTML = [
    ...dayNames.map((name) => `<span class="calendar-day-name">${name}</span>`),
    ...blanks,
    ...days
  ].join("");
};

const applyContent = (content) => {
  const bookingUrl = content.bookingUrl || defaultContent.bookingUrl;
  const resolveUrl = (value, fallback = bookingUrl) => value || fallback || "#";

  setHref("[data-booking]", resolveUrl(content.bookingUrl));
  setHref("[data-nav-link='home']", content.nav?.links?.home || "#home");
  setHref("[data-nav-link='about']", content.nav?.links?.about || "#about");
  setHref("[data-nav-link='classes']", content.nav?.links?.classes || "#classes");
  setHref("[data-nav-link='schedule']", content.nav?.links?.schedule || "#schedule");
  setHref("[data-nav-link='services']", content.nav?.links?.services || "#packages");
  setHref("[data-nav-link='faq']", content.nav?.links?.faq || "#contact");
  setHref("[data-nav-link='login']", content.nav?.links?.login || bookingUrl);
  setText("[data-booking]", content.nav?.cta || "Book Here");

  document.querySelectorAll("[data-text]").forEach((element) => {
    const value = getPath(content, element.dataset.text);
    if (value !== undefined) element.textContent = value;
  });

  document.querySelectorAll("[data-image]").forEach((element) => {
    setImage(`[data-image="${element.dataset.image}"]`, getContentImage(content, element.dataset.image));
  });
  applyHeroMedia(content);

  renderCards("[data-class-cards]", content.classes?.items, (item, index) => {
    const image = getItemImage(content, "classes", index, item);
    return `
    <article class="class-pick">
      <div class="class-image image-fill ${image ? "has-image" : ""}" style="${image ? `background-image:url('${escapeHtml(image)}')` : ""}" role="img" aria-label="${escapeHtml(item.alt || item.title)}"></div>
      <a class="button navy-button" href="${escapeHtml(resolveUrl(item.ctaUrl, "#schedule"))}">${escapeHtml(item.title)}</a>
    </article>
  `;
  });

  renderCalendar(content.schedule);

  setHref("[data-packages-band-cta]", resolveUrl(content.packagesBand?.ctaUrl, "#packages"));
  setText("[data-packages-band-cta]", content.packagesBand?.cta || "Get Started");

  renderCards("[data-faculty-grid]", content.faculty?.items, (item, index) => {
    const image = getItemImage(content, "faculty", index, item);
    return `
      <div class="faculty-photo image-fill ${image ? "has-image" : ""}" style="${image ? `background-image:url('${escapeHtml(image)}')` : ""}" role="img" aria-label="${escapeHtml(item.alt || item.name)}"></div>
    `;
  });
  setHref("[data-faculty-cta]", resolveUrl(content.faculty?.ctaUrl, "#contact"));
  setText("[data-faculty-cta]", content.faculty?.cta || "Meet Our Teachers");

  renderCards("[data-package-cards]", content.packages?.items, (item) => `
    <article class="package-card">
      <p>${escapeHtml(item.label || "")}</p>
      <h3>${escapeHtml(item.title || "")}</h3>
      <p class="price">${escapeHtml(item.price || "")}</p>
      <p>${escapeHtml(item.body || "")}</p>
      <a class="button navy-button" href="${escapeHtml(resolveUrl(item.ctaUrl, bookingUrl))}">${escapeHtml(item.cta || "Book Now")}</a>
    </article>
  `);

  setHref("[data-footer-booking]", resolveUrl(content.footer?.bookUrl, bookingUrl));
  setText("[data-footer-booking]", content.footer?.bookLabel || "Book Now");
  setText("[data-footer-address]", content.footer?.address || "");
  setHref("[data-social='instagram']", content.footer?.instagramUrl || "#");
  setHref("[data-social='facebook']", content.footer?.facebookUrl || "#");
  setHref("[data-terms]", content.footer?.termsUrl || "#");
};

const loadContent = async () => {
  if (!isSupabaseConfigured()) return defaultContent;

  const client = window.supabase.createClient(config.url, config.anonKey);
  const { data, error } = await client
    .from("site_content")
    .select("content")
    .eq("id", config.contentId || "homepage")
    .eq("is_published", true)
    .single();

  if (error || !data?.content) {
    console.warn("Using default content because Supabase content was unavailable.", error);
    return defaultContent;
  }

  return deepMerge(defaultContent, data.content);
};

menuToggle?.addEventListener("click", () => {
  mobileNav?.classList.toggle("is-open");
});

const scrollToHash = (hash) => {
  const target = document.querySelector(hash);
  if (!target) return false;

  const headerOffset = document.querySelector(".site-header")?.offsetHeight || 0;
  const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top, behavior: "smooth" });
  return true;
};

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='#']");
  if (!link) return;

  const hash = link.getAttribute("href");
  if (!hash || hash === "#") return;
  if (!scrollToHash(hash)) return;

  event.preventDefault();
  mobileNav?.classList.remove("is-open");
});

mobileNav?.addEventListener("click", (event) => {
  if (event.target.closest("a")) mobileNav.classList.remove("is-open");
});

const revealElements = () => {
  const elements = document.querySelectorAll(".section-pad, .package-band, .contact-section, .package-card, .class-pick, .faculty-photo");
  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
  );

  elements.forEach((element, index) => {
    element.style.setProperty("--reveal-delay", `${Math.min(index % 8, 5) * 70}ms`);
    observer.observe(element);
  });
};

document.querySelector("[data-contact-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("[data-form-message]");
  const content = await loadContent();
  const formData = new FormData(form);
  const recipient = content.contact?.recipientEmail || "marketing@madetodance.ph";
  const subject = encodeURIComponent("Made To Dance Website Inquiry");
  const body = encodeURIComponent(
    `Name: ${formData.get("name")}\nEmail: ${formData.get("email")}\n\nMessage:\n${formData.get("message")}`
  );

  window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  if (message) message.textContent = "Opening your email app...";
});

loadContent().then((content) => {
  applyContent(content);
  revealElements();
});
