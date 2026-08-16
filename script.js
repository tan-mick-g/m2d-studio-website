const config = window.MTD_SUPABASE || {};
const defaultContent = window.MTD_DEFAULT_CONTENT || {};
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");
let heroCarouselTimer;
let heroCarouselResetTimer;

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

const normalizeServicesPageContent = (content) => {
  if (!content?.servicesPage) return content;
  const servicesPage = content.servicesPage;
  const defaults = defaultContent.servicesPage || {};
  const legacyDefaults = {
    studioTitle: "Studio Services",
    studioBody:
      "From beginner-friendly social dance classes to private coaching and group sessions, our studio services are designed to help adults move with more ease, confidence, and joy. Come solo, come with a partner, or gather a small group and we will meet you where you are.",
    studioAlt: "Adult dancer practicing in studio"
  };

  if (servicesPage.studioTitle === legacyDefaults.studioTitle) servicesPage.studioTitle = defaults.studioTitle;
  if (servicesPage.studioBody === legacyDefaults.studioBody) servicesPage.studioBody = defaults.studioBody;
  if (servicesPage.studioAlt === legacyDefaults.studioAlt) servicesPage.studioAlt = "Celebration dance experience";
  return content;
};

const normalizeFooterContent = (content) => {
  if (content?.footer?.logoUrl === "assets/made-to-dance-logo.png") {
    content.footer.logoUrl = defaultContent.footer?.logoUrl || "assets/m2d-icon-cream.png";
  }
  return content;
};

const normalizeFacultyContent = (content) => {
  if (content?.faculty?.ctaUrl === "/contact") content.faculty.ctaUrl = "/teachers";
  return content;
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

const normalizePhoneHref = (value = "") => {
  const phone = String(value || "").trim().replace(/[^\d+]/g, "");
  return phone ? `tel:${phone}` : "#";
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

const formatCopyright = (value = "") =>
  String(value).replace(/\.\s*All\s+rights\s+reserved\.?/i, ".\nAll Rights Reserved");

const renderCards = (selector, items, template) => {
  const container = document.querySelector(selector);
  if (container && Array.isArray(items)) container.innerHTML = items.map(template).join("");
};

const setFormMessage = (element, message, type = "") => {
  if (!element) return;
  element.textContent = message || "";
  element.classList.toggle("is-success", type === "success");
  element.classList.toggle("is-error", type === "error");
};

const getContactSubjects = (contact = {}) =>
  Array.isArray(contact.subjects) && contact.subjects.length
    ? contact.subjects
    : defaultContent.contact?.subjects || [];

const getSubjectTemplate = (contact = {}, label = "") => {
  const subject = getContactSubjects(contact).find((item) => item.label === label);
  return subject?.template || "";
};

const applySubjectTemplate = (select, force = false) => {
  const form = select?.closest("form");
  const textarea = form?.querySelector("[data-contact-message]");
  if (!textarea) return;

  const contact = window.MTD_SITE_CONTENT?.contact || defaultContent.contact || {};
  const template = getSubjectTemplate(contact, select.value);
  const canReplace = force || !textarea.value.trim() || textarea.dataset.templateOwned === "true";
  textarea.placeholder = template || "Tell us a little more about what you need.";

  if (canReplace && template) {
    textarea.value = template;
    textarea.dataset.templateOwned = "true";
  }
};

const renderContactSubjects = (contact = {}) => {
  document.querySelectorAll("[data-contact-subject]").forEach((select) => {
    const currentValue = select.value;
    const subjects = getContactSubjects(contact);
    select.innerHTML = subjects
      .map((subject) => `<option value="${escapeHtml(subject.label)}">${escapeHtml(subject.label)}</option>`)
      .join("");
    select.value = subjects.some((subject) => subject.label === currentValue) ? currentValue : subjects[0]?.label || "";
    applySubjectTemplate(select, true);
  });
};

const normalizeNavLink = (value, fallback) => {
  const legacyLinks = {
    "#home": "/",
    "#about": "/about",
    "#classes": "/#classes",
    "#schedule": "/#schedule",
    "#packages": "/services",
    "#contact": "/contact"
  };
  return legacyLinks[value] || value || fallback;
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
  window.clearTimeout(heroCarouselResetTimer);

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
  heroTrack.classList.remove("is-resetting");
  heroTrack.innerHTML = [...images, images[0]]
    .map(
      (image) => `
        <div class="image-fill hero-image has-image" style="background-image:url('${escapeHtml(image)}')"></div>
      `
    )
    .join("");

  if (images.length <= 1) return;

  let index = 0;
  heroCarouselTimer = window.setInterval(() => {
    heroTrack.classList.remove("is-resetting");
    index += 1;
    heroTrack.style.transform = `translateX(-${index * 100}%)`;

    if (index === images.length) {
      window.clearTimeout(heroCarouselResetTimer);
      heroCarouselResetTimer = window.setTimeout(() => {
        heroTrack.classList.add("is-resetting");
        heroTrack.style.transform = "translateX(0)";
        index = 0;
        window.requestAnimationFrame(() => {
          heroTrack.classList.remove("is-resetting");
        });
      }, 1200);
    }
  }, 5000);
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

const sendRezervUtms = (iframe) => {
  const widgetOrigin = "https://widgets.rezerv.co";
  const keys = ["utm_source", "utm_campaign", "utm_medium", "utm_term", "utm_content"];
  const params = new URLSearchParams(window.location.search);
  const utms = {};

  keys.forEach((key) => {
    const value = params.get(key);
    if (value) utms[key] = value;
  });

  if (!iframe?.contentWindow || Object.keys(utms).length === 0) return;
  iframe.contentWindow.postMessage({ type: "UTM_PARAMS", utms }, widgetOrigin);
};

const renderScheduleWidget = (schedule) => {
  const widget = document.querySelector("[data-schedule-widget]");
  const placeholder = document.querySelector("[data-schedule-placeholder]");
  const widgetUrl = schedule?.widgetUrl || "";
  if (!widget || !placeholder) return;

  if (!widgetUrl) {
    widget.hidden = true;
    widget.removeAttribute("src");
    placeholder.hidden = false;
    return;
  }

  widget.src = widgetUrl;
  widget.height = Number(schedule?.widgetHeight) || 1080;
  widget.hidden = false;
  placeholder.hidden = true;
  widget.addEventListener("load", () => {
    sendRezervUtms(widget);
    window.setTimeout(() => sendRezervUtms(widget), 500);
    window.setTimeout(() => sendRezervUtms(widget), 1500);
  });
};

const applySelectedTeacher = (teacher, index, teachersPage = {}, bookingUrl = "") => {
  const feature = document.querySelector("[data-teacher-feature]");
  if (!feature || !teacher) return;

  const image = teacher.image || defaultContent.teachersPage?.items?.[index]?.image || "";
  const ctaLabel = teachersPage.ctaLabel || "Book A Class";
  const bookingHref = teacher.bookingUrl || bookingUrl || "#";
  const imageElement = feature.querySelector("[data-teacher-feature-image]");
  const bookingElement = feature.querySelector("[data-teacher-booking]");

  setText("[data-teacher-role]", teacher.role || "Dance Teacher");
  setText("[data-teacher-name]", teacher.name || `Teacher ${index + 1}`);
  setText("[data-teacher-styles]", teacher.styles || "");
  setText("[data-teacher-bio]", teacher.bio || "");

  if (imageElement) {
    imageElement.style.backgroundImage = image ? `url("${image}")` : "";
    imageElement.classList.toggle("has-image", Boolean(image));
    imageElement.setAttribute("aria-label", teacher.alt || teacher.name || "Dance teacher");
  }

  if (bookingElement) {
    bookingElement.href = bookingHref;
    bookingElement.textContent = ctaLabel;
  }

  document.querySelectorAll("[data-teacher-avatar]").forEach((button) => {
    const isSelected = Number(button.dataset.teacherAvatar) === index;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
};

const renderTeacherSelector = (teachersPage = {}, bookingUrl = "") => {
  const avatars = document.querySelector("[data-teacher-avatars]");
  const teachers = Array.isArray(teachersPage.items) ? teachersPage.items : [];
  if (!avatars || !teachers.length) return;

  avatars.innerHTML = teachers
    .map((teacher, index) => {
      const image = teacher.image || defaultContent.teachersPage?.items?.[index]?.image || "";
      return `
        <button class="teacher-avatar" type="button" data-teacher-avatar="${index}" aria-pressed="${index === 0 ? "true" : "false"}">
          <span class="teacher-avatar-image image-fill ${image ? "has-image" : ""}" style="${image ? `background-image:url('${escapeHtml(image)}')` : ""}" aria-hidden="true"></span>
          <span>${escapeHtml(teacher.name || `Teacher ${index + 1}`)}</span>
        </button>
      `;
    })
    .join("");

  avatars.querySelectorAll("[data-teacher-avatar]").forEach((button) => {
    button.addEventListener("click", () => applySelectedTeacher(teachers[Number(button.dataset.teacherAvatar)], Number(button.dataset.teacherAvatar), teachersPage, bookingUrl));
  });

  applySelectedTeacher(teachers[0], 0, teachersPage, bookingUrl);
};

const applyContent = (content) => {
  window.MTD_SITE_CONTENT = content;
  const bookingUrl = content.bookingUrl || defaultContent.bookingUrl;
  const resolveUrl = (value, fallback = bookingUrl) => value || fallback || "#";

  setHref("[data-booking]", resolveUrl(content.bookingUrl));
  setHref("[data-nav-link='home']", normalizeNavLink(content.nav?.links?.home, "/"));
  setHref("[data-nav-link='about']", normalizeNavLink(content.nav?.links?.about, "/about"));
  setHref("[data-nav-link='classes']", normalizeNavLink(content.nav?.links?.classes, "/#classes"));
  setHref("[data-nav-link='schedule']", normalizeNavLink(content.nav?.links?.schedule, "/#schedule"));
  setHref("[data-nav-link='services']", normalizeNavLink(content.nav?.links?.services, "/services"));
  setHref("[data-nav-link='contact']", normalizeNavLink(content.nav?.links?.contact, "/contact"));
  setHref("[data-nav-link='faq']", normalizeNavLink(content.nav?.links?.faq, "/#contact"));
  setHref("[data-nav-link='login']", content.nav?.links?.login || bookingUrl);
  setText("[data-booking]", content.nav?.cta || "Book Here");

  document.querySelectorAll("[data-text]").forEach((element) => {
    const value = getPath(content, element.dataset.text);
    if (value !== undefined) element.textContent = value;
  });
  setText('[data-text="footer.copyright"]', formatCopyright(content.footer?.copyright || defaultContent.footer?.copyright || ""));

  document.querySelectorAll("[data-image]").forEach((element) => {
    setImage(`[data-image="${element.dataset.image}"]`, getContentImage(content, element.dataset.image));
  });
  document.querySelectorAll("[data-aria]").forEach((element) => {
    const value = getPath(content, element.dataset.aria);
    if (value) element.setAttribute("aria-label", value);
  });
  renderContactSubjects(content.contact);
  setHref("[data-contact-email]", `mailto:${content.contact?.businessEmail || content.contact?.recipientEmail || "marketing@madetodance.ph"}`);
  setHref("[data-contact-phone]", normalizePhoneHref(content.contact?.businessPhone || ""));
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
  renderScheduleWidget(content.schedule);

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

  renderTeacherSelector(content.teachersPage, bookingUrl);

  setHref("[data-footer-booking]", resolveUrl(content.footer?.bookUrl, bookingUrl));
  setText("[data-footer-booking]", content.footer?.bookLabel || "Book Now");
  setText("[data-footer-address]", content.footer?.address || "");
  const footerLogo = document.querySelector("[data-footer-logo]");
  if (footerLogo && content.footer?.logoUrl) footerLogo.setAttribute("src", content.footer.logoUrl);
  setHref("[data-social='instagram']", content.footer?.instagramUrl || "#");
  setHref("[data-social='facebook']", content.footer?.facebookUrl || "#");
  setHref("[data-terms]", content.footer?.termsUrl || "#");
  setHref("[data-about-page-cta]", resolveUrl(content.aboutPage?.ctaUrl, bookingUrl));
  setHref("[data-services-page-cta]", resolveUrl(content.servicesPage?.ctaUrl, bookingUrl));
  document.body.classList.remove("content-loading");
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

  return normalizeFacultyContent(normalizeFooterContent(normalizeServicesPageContent(deepMerge(defaultContent, data.content))));
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
  const link = event.target.closest("a[href*='#']");
  if (!link) return;

  const href = link.getAttribute("href");
  const url = new URL(href, window.location.href);
  const isSamePage = url.origin === window.location.origin && url.pathname === window.location.pathname;
  const isHomeSection = url.origin === window.location.origin && url.pathname === "/" && window.location.pathname === "/";
  if (!isSamePage && !isHomeSection) return;

  const hash = url.hash;
  if (!hash || hash === "#") return;
  if (!scrollToHash(hash)) return;

  event.preventDefault();
  mobileNav?.classList.remove("is-open");
});

mobileNav?.addEventListener("click", (event) => {
  if (event.target.closest("a")) mobileNav.classList.remove("is-open");
});

window.addEventListener("message", (event) => {
  if (event.origin !== "https://widgets.rezerv.co") return;
  if (event.data?.type !== "REQUEST_UTM_PARAMS") return;
  sendRezervUtms(document.querySelector("[data-schedule-widget]"));
});

const revealElements = () => {
  const elements = document.querySelectorAll(
    ".section-pad, .package-band, .contact-section, .package-card, .class-pick, .faculty-photo, .teacher-selector, .about-copy, .about-photo, .package-band-panel, .contact-copy, .contact-form, .site-footer, .page-hero-copy, .page-hero-image, .about-story-image, .about-story-copy, .about-beliefs article, .service-feature-copy, .service-feature-image"
  );
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
    element.style.setProperty("--reveal-delay", `${Math.min(index % 8, 5) * 55}ms`);
    observer.observe(element);
  });
};

document.querySelector("[data-contact-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("[data-form-message]");
  const content = await loadContent();
  const formData = new FormData(form);
  const submitButton = form.querySelector("button[type='submit']");
  const successMessage = content.contact?.successMessage || defaultContent.contact?.successMessage || "Thank you. Your message has been sent.";
  const errorMessage = content.contact?.errorMessage || defaultContent.contact?.errorMessage || "Sorry, something went wrong. Please try again.";

  if (formData.get("website")) {
    form.reset();
    setFormMessage(message, successMessage, "success");
    return;
  }

  submitButton.disabled = true;
  setFormMessage(message, "Sending...");

  let contactResponse;
  try {
    contactResponse = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(formData.get("name") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        phone: String(formData.get("phone") || "").trim(),
        subject: String(formData.get("subject") || "General Inquiry").trim(),
        message: String(formData.get("message") || "").trim(),
        website: String(formData.get("website") || ""),
        recipientEmail: content.contact?.recipientEmail || "marketing@madetodance.ph",
        sourcePath: window.location.pathname
      })
    });
  } catch (error) {
    console.warn("Contact submission failed.", error);
    submitButton.disabled = false;
    setFormMessage(message, errorMessage, "error");
    return;
  }

  submitButton.disabled = false;

  if (!contactResponse.ok) {
    console.warn("Contact submission failed.", await contactResponse.text());
    setFormMessage(message, errorMessage, "error");
    return;
  }

  form.reset();
  form.querySelectorAll("[data-contact-subject]").forEach((select) => applySubjectTemplate(select, true));
  setFormMessage(message, successMessage, "success");
});

document.querySelectorAll("[data-contact-subject]").forEach((select) => {
  select.addEventListener("change", () => applySubjectTemplate(select));
});

document.querySelectorAll("[data-contact-message]").forEach((textarea) => {
  textarea.addEventListener("input", () => {
    const select = textarea.closest("form")?.querySelector("[data-contact-subject]");
    const template = getSubjectTemplate(window.MTD_SITE_CONTENT?.contact || defaultContent.contact || {}, select?.value || "");
    textarea.dataset.templateOwned = textarea.value === template ? "true" : "false";
  });
});

loadContent().then((content) => {
  applyContent(content);
  revealElements();
});
