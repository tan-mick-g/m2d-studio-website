const config = window.MTD_SUPABASE || {};
const defaultContent = window.MTD_DEFAULT_CONTENT || {};
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");
let heroCarouselTimer;
let heroCarouselResetTimer;
let teacherGifObserver;
let lazyBackgroundObserver;
const preloadedImages = new Set();

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
  if (content?.footer) {
    if (!content.footer.termsUrl || content.footer.termsUrl === "#") {
      content.footer.termsUrl = defaultContent.footer?.termsUrl || "/terms";
    }
    if (!content.footer.privacyUrl || content.footer.privacyUrl === "#") {
      content.footer.privacyUrl = defaultContent.footer?.privacyUrl || "/privacy";
    }
  }
  return content;
};

const normalizeFacultyContent = (content) => {
  if (content?.faculty) {
    content.faculty.ctaUrl = "/teachers";
    if (content.faculty.title === "Our Faculty") content.faculty.title = "Our Teachers";
  }
  return content;
};

const normalizeNavContent = (content) => {
  if (content?.nav?.links?.faq === "/#contact") content.nav.links.faq = "/faq";
  return content;
};

const isAnimatedImageMedia = (value = "") => /\.(gif|webp)(\?.*)?$/i.test(String(value));

const slugify = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getTeacherSlug = (teacher, index) => slugify(teacher?.name) || `teacher-${index + 1}`;

const getRequestedTeacherIndex = (teachers = []) => {
  const requestedTeacher = new URLSearchParams(window.location.search).get("teacher");
  if (!requestedTeacher) return 0;

  const normalizedRequest = slugify(requestedTeacher);
  const numericRequest = Number(requestedTeacher);
  const matchedIndex = teachers.findIndex((teacher, index) => {
    if (Number.isInteger(numericRequest) && numericRequest === index + 1) return true;
    return getTeacherSlug(teacher, index) === normalizedRequest;
  });

  return matchedIndex >= 0 ? matchedIndex : 0;
};

const normalizeTeachersContent = (content) => {
  if (!Array.isArray(content?.teachersPage?.items)) return content;
  content.teachersPage.items = content.teachersPage.items.map((teacher) => ({
    ...teacher,
    profileImage: teacher.profileImage || teacher.image || teacher.bodyImage || "",
    bodyStillImage:
      teacher.bodyStillImage ||
      (!isAnimatedImageMedia(teacher.bodyImage) ? teacher.bodyImage : "") ||
      (!isAnimatedImageMedia(teacher.image) ? teacher.image : "") ||
      teacher.profileImage ||
      "",
    bodyImage: teacher.bodyImage || teacher.image || teacher.profileImage || ""
  }));
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

const getCurrentSeoPageKey = () => {
  const path = window.location.pathname.replace(/\/$/, "");
  if (!path || path === "/index.html") return "home";
  if (path.endsWith("/about") || path.endsWith("/about.html")) return "about";
  if (path.endsWith("/services") || path.endsWith("/services.html")) return "services";
  if (path.endsWith("/teachers") || path.endsWith("/teachers.html")) return "teachers";
  if (path.endsWith("/contact") || path.endsWith("/contact.html")) return "contact";
  if (path.endsWith("/faq") || path.endsWith("/faq.html")) return "faq";
  if (path.endsWith("/terms") || path.endsWith("/terms.html")) return "terms";
  if (path.endsWith("/waiver") || path.endsWith("/waiver.html")) return "waiver";
  if (path.endsWith("/privacy") || path.endsWith("/privacy.html")) return "privacy";
  return "home";
};

const ensureMeta = (attribute, name) => {
  let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  return element;
};

const setMetaContent = (attribute, name, value) => {
  if (!value) return;
  ensureMeta(attribute, name).setAttribute("content", value);
};

const preloadImage = (url = "", fetchPriority = "auto") => {
  if (!url || preloadedImages.has(url)) return;
  preloadedImages.add(url);
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  if (fetchPriority !== "auto") link.fetchPriority = fetchPriority;
  document.head.appendChild(link);
};

const setCanonical = () => {
  const href = window.location.href.split("#")[0].split("?")[0];
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
};

const applySeo = (content = {}) => {
  const pageKey = getCurrentSeoPageKey();
  const pageSeo = content.seo?.pages?.[pageKey] || {};
  const title = pageSeo.title || content.seo?.siteName || document.title;
  const description = pageSeo.description || document.querySelector('meta[name="description"]')?.content || "";
  const image = content.seo?.defaultImage || "assets/m2d-icon.png";
  const currentUrl = window.location.href.split("#")[0].split("?")[0];

  document.title = title;
  setMetaContent("name", "description", description);
  setMetaContent("property", "og:title", title);
  setMetaContent("property", "og:description", description);
  setMetaContent("property", "og:image", image);
  setMetaContent("property", "og:type", "website");
  setMetaContent("property", "og:site_name", content.seo?.siteName || "Made To Dance Studio");
  setMetaContent("property", "og:url", currentUrl);
  setMetaContent("name", "twitter:card", "summary_large_image");
  setMetaContent("name", "twitter:title", title);
  setMetaContent("name", "twitter:description", description);
  setMetaContent("name", "twitter:image", image);
  setCanonical();
};

const normalizePhoneHref = (value = "") => {
  const phone = String(value || "").trim().replace(/[^\d+]/g, "");
  return phone ? `tel:${phone}` : "#";
};

const loadLazyBackground = (element) => {
  const url = element?.dataset.lazyBg;
  if (!element || !url) return;
  element.style.backgroundImage = `url("${url}")`;
  element.classList.add("has-image");
  delete element.dataset.lazyBg;
  lazyBackgroundObserver?.unobserve(element);
};

const queueLazyBackground = (element) => {
  if (!element?.dataset.lazyBg) return;
  if (!("IntersectionObserver" in window)) {
    loadLazyBackground(element);
    return;
  }

  if (!lazyBackgroundObserver) {
    lazyBackgroundObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) loadLazyBackground(entry.target);
        });
      },
      { rootMargin: "650px 0px", threshold: 0.01 }
    );
  }
  lazyBackgroundObserver.observe(element);
};

const setImageElement = (element, value, { eager = false } = {}) => {
  if (!element) return;
  lazyBackgroundObserver?.unobserve(element);
  element.style.removeProperty("background-image");
  delete element.dataset.lazyBg;

  if (!value) {
    element.classList.remove("has-image");
    return;
  }

  element.classList.add("has-image");
  if (eager) {
    element.style.backgroundImage = `url("${value}")`;
    return;
  }
  element.dataset.lazyBg = value;
  queueLazyBackground(element);
};

const setImage = (selector, value) => {
  document.querySelectorAll(selector).forEach((element) => {
    setImageElement(element, value, { eager: Boolean(element.closest(".hero, .page-hero")) });
  });
};

const backgroundAttributes = (url = "", { eager = false } = {}) => {
  if (!url) return "";
  return eager
    ? `style="background-image:url('${escapeHtml(url)}')"`
    : `data-lazy-bg="${escapeHtml(url)}"`;
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

const renderFaqAnswer = (answer = "") =>
  String(answer)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length > 1 && lines.every((line) => /^(\*|\d+\.)\s+/.test(line))) {
        const tag = lines[0].startsWith("*") ? "ul" : "ol";
        const items = lines.map((line) => line.replace(/^(\*|\d+\.)\s+/, ""));
        return `<${tag}>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
      }
      return `<p>${escapeHtml(block).replaceAll("\n", "<br />")}</p>`;
    })
    .join("");

const renderFaqPage = (faqPage = {}) => {
  const list = document.querySelector("[data-faq-list]");
  if (!list) return;

  const categoryNav = document.querySelector("[data-faq-categories]");
  const search = document.querySelector("[data-faq-search]");
  const empty = document.querySelector("[data-faq-empty]");
  const categories = Array.isArray(faqPage.categories) ? faqPage.categories : [];
  let activeCategory = "all";

  if (search && faqPage.searchPlaceholder) search.placeholder = faqPage.searchPlaceholder;
  if (empty) empty.textContent = faqPage.emptyMessage || "No questions matched your search.";

  const getVisibleCategories = () => {
    const query = (search?.value || "").trim().toLowerCase();
    return categories
      .map((category, categoryIndex) => {
        const items = (category.items || []).filter((item) => {
          const matchesCategory = activeCategory === "all" || activeCategory === String(categoryIndex);
          const haystack = `${category.title || ""} ${item.question || ""} ${item.answer || ""}`.toLowerCase();
          return matchesCategory && (!query || haystack.includes(query));
        });
        return { ...category, categoryIndex, items };
      })
      .filter((category) => category.items.length);
  };

  const render = () => {
    const visibleCategories = getVisibleCategories();
    list.innerHTML = visibleCategories
      .map(
        (category) => `
          <section class="faq-category">
            <div class="faq-category-heading">
              <h2>${escapeHtml(category.title || "FAQ")}</h2>
              <span>${category.items.length} ${category.items.length === 1 ? "answer" : "answers"}</span>
            </div>
            <div class="faq-accordion">
              ${category.items
                .map(
                  (item, itemIndex) => `
                    <details class="faq-item" ${category.categoryIndex === 0 && itemIndex === 0 && !search?.value ? "open" : ""}>
                      <summary>
                        <span>${escapeHtml(item.question || "")}</span>
                        <span aria-hidden="true"></span>
                      </summary>
                      <div class="faq-answer">${renderFaqAnswer(item.answer || "")}</div>
                    </details>
                  `
                )
                .join("")}
            </div>
          </section>
        `
      )
      .join("");
    if (empty) empty.hidden = visibleCategories.length > 0;
  };

  if (categoryNav) {
    categoryNav.innerHTML = [
      `<button class="is-active" type="button" data-faq-filter="all">All</button>`,
      ...categories.map((category, index) => `<button type="button" data-faq-filter="${index}">${escapeHtml(category.title || `Topic ${index + 1}`)}</button>`)
    ].join("");
    categoryNav.addEventListener("click", (event) => {
      const button = event.target.closest("[data-faq-filter]");
      if (!button) return;
      activeCategory = button.dataset.faqFilter || "all";
      categoryNav.querySelectorAll("[data-faq-filter]").forEach((tab) => {
        tab.classList.toggle("is-active", tab === button);
      });
      render();
    });
  }

  search?.addEventListener("input", render);
  render();
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
  preloadImage(images[0], "high");
  heroTrack.style.transform = "translateX(0)";
  heroTrack.classList.remove("is-resetting");
  heroTrack.innerHTML = [...images, images[0]]
    .map(
      (image, slideIndex) => `
        <div class="image-fill hero-image has-image" data-hero-slide="${slideIndex}" ${backgroundAttributes(image, { eager: slideIndex === 0 })}></div>
      `
    )
    .join("");
  heroTrack.querySelectorAll("[data-lazy-bg]").forEach(queueLazyBackground);

  if (images.length <= 1) return;

  let index = 0;
  heroCarouselTimer = window.setInterval(() => {
    heroTrack.classList.remove("is-resetting");
    index += 1;
    loadLazyBackground(heroTrack.querySelector(`[data-hero-slide="${index}"]`));
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

const isVideoMedia = (value = "") => /\.(webm|mp4|mov)(\?.*)?$/i.test(String(value));

const isValidCssColor = (value = "") => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value).trim());

const usesTouchMotionTrigger = () => window.matchMedia("(hover: none)").matches;

const renderTeacherMotionMedia = (src = "", isVideo = false) => {
  if (!src) return "";
  return isVideo
    ? `<video src="${escapeHtml(src)}" autoplay muted loop playsinline aria-hidden="true"></video>`
    : `<img src="${escapeHtml(src)}" alt="" aria-hidden="true" />`;
};

const setTeacherGifMotion = (container, shouldPlay) => {
  if (!container?.dataset.animatedSrc || !container.dataset.pausedSrc) return;
  const nextSrc = shouldPlay ? container.dataset.animatedSrc : container.dataset.pausedSrc;
  const nextIsVideo = shouldPlay && container.dataset.animatedType === "video";
  container.classList.toggle("is-video", nextIsVideo);
  container.innerHTML = renderTeacherMotionMedia(nextSrc, nextIsVideo);
};

const observeTeacherGifMotion = (container) => {
  teacherGifObserver?.disconnect();
  if (!container?.dataset.animatedSrc || !usesTouchMotionTrigger() || !("IntersectionObserver" in window)) return;

  teacherGifObserver = new IntersectionObserver(
    ([entry]) => setTeacherGifMotion(container, entry.isIntersecting && entry.intersectionRatio > 0.45),
    { threshold: [0, 0.45, 1] }
  );
  teacherGifObserver.observe(container);
};

const applySelectedTeacher = (teacher, index, teachersPage = {}, bookingUrl = "") => {
  const feature = document.querySelector("[data-teacher-feature]");
  if (!feature || !teacher) return;

  const defaultTeacher = defaultContent.teachersPage?.items?.[index] || {};
  const activeImage = teacher.bodyImage || teacher.image || defaultTeacher.bodyImage || defaultTeacher.image || "";
  const stillImage =
    teacher.bodyStillImage ||
    defaultTeacher.bodyStillImage ||
    (!isAnimatedImageMedia(teacher.image) ? teacher.image : "") ||
    (!isAnimatedImageMedia(defaultTeacher.image) ? defaultTeacher.image : "");
  const pausedImage = stillImage || activeImage;
  const shouldSwapBodyShot = Boolean(activeImage && pausedImage && activeImage !== pausedImage);
  const panelColor = isValidCssColor(teacher.panelColor) ? teacher.panelColor : "#2098c2";
  const ctaLabel = teachersPage.ctaLabel || "Book A Class";
  const bookingHref = teacher.bookingUrl || bookingUrl || "#";
  const imageElement = feature.querySelector("[data-teacher-feature-image]");
  const bookingElement = feature.querySelector("[data-teacher-booking]");

  setText("[data-teacher-role]", teacher.role || "Dance Teacher");
  setText("[data-teacher-name]", teacher.name || `Teacher ${index + 1}`);
  setText("[data-teacher-styles]", teacher.styles || "");
  setText("[data-teacher-bio]", teacher.bio || "");
  feature.style.setProperty("--teacher-panel", panelColor);

  if (imageElement) {
    imageElement.classList.toggle("has-image", Boolean(pausedImage));
    imageElement.classList.toggle("is-video", false);
    imageElement.classList.toggle("is-cutout", shouldSwapBodyShot);
    imageElement.setAttribute("aria-label", teacher.name || "Dance teacher");
    if (imageElement.tagName === "A") imageElement.href = bookingHref;
    delete imageElement.dataset.animatedSrc;
    delete imageElement.dataset.pausedSrc;
    delete imageElement.dataset.animatedType;
    imageElement.innerHTML = renderTeacherMotionMedia(pausedImage);
    if (shouldSwapBodyShot) {
      imageElement.dataset.animatedSrc = activeImage;
      imageElement.dataset.pausedSrc = pausedImage;
      imageElement.dataset.animatedType = isVideoMedia(activeImage) ? "video" : "image";
      observeTeacherGifMotion(imageElement);
    } else {
      teacherGifObserver?.disconnect();
    }
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

  const initialIndex = getRequestedTeacherIndex(teachers);

  avatars.innerHTML = teachers
    .map((teacher, index) => {
      const defaultTeacher = defaultContent.teachersPage?.items?.[index] || {};
      const avatarImage = teacher.profileImage || teacher.image || teacher.bodyImage || defaultTeacher.profileImage || defaultTeacher.image || "";
      return `
        <button class="teacher-avatar" type="button" data-teacher-avatar="${index}" aria-label="Select ${escapeHtml(teacher.name || `Teacher ${index + 1}`)}" aria-pressed="${index === initialIndex ? "true" : "false"}">
          <span class="teacher-avatar-image image-fill ${avatarImage ? "has-image" : ""}" ${backgroundAttributes(avatarImage)} aria-hidden="true"></span>
          <span class="teacher-avatar-label">${escapeHtml(teacher.name || `Teacher ${index + 1}`)}</span>
        </button>
      `;
    })
    .join("");

  avatars.querySelectorAll("[data-teacher-avatar]").forEach((button) => {
    button.addEventListener("click", () => {
      const teacherIndex = Number(button.dataset.teacherAvatar);
      applySelectedTeacher(teachers[teacherIndex], teacherIndex, teachersPage, bookingUrl);
      button.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      const teacherSlug = getTeacherSlug(teachers[teacherIndex], teacherIndex);
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("teacher", teacherSlug);
      window.history.replaceState({}, "", nextUrl);
    });
  });

  applySelectedTeacher(teachers[initialIndex], initialIndex, teachersPage, bookingUrl);
  avatars.querySelector(`[data-teacher-avatar="${initialIndex}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
};

const applyContent = (content) => {
  window.MTD_SITE_CONTENT = content;
  applySeo(content);
  const bookingUrl = content.bookingUrl || defaultContent.bookingUrl;
  const resolveUrl = (value, fallback = bookingUrl) => value || fallback || "#";

  setHref("[data-booking]", resolveUrl(content.bookingUrl));
  setHref("[data-nav-link='home']", normalizeNavLink(content.nav?.links?.home, "/"));
  setHref("[data-nav-link='about']", normalizeNavLink(content.nav?.links?.about, "/about"));
  setHref("[data-nav-link='classes']", normalizeNavLink(content.nav?.links?.classes, "/#classes"));
  setHref("[data-nav-link='packages']", normalizeNavLink(content.nav?.links?.packages, "/#packages"));
  setHref("[data-nav-link='schedule']", normalizeNavLink(content.nav?.links?.schedule, "/#schedule"));
  setHref("[data-nav-link='teachers']", normalizeNavLink(content.nav?.links?.teachers, "/teachers"));
  setHref("[data-nav-link='services']", normalizeNavLink(content.nav?.links?.services, "/services"));
  setHref("[data-nav-link='contact']", normalizeNavLink(content.nav?.links?.contact, "/contact"));
  setHref("[data-nav-link='faq']", normalizeNavLink(content.nav?.links?.faq, "/faq"));
  setHref("[data-account-link]", content.nav?.links?.account || "https://madetodance.rezerv.co/account/bookings?tab=0");
  setText("[data-booking]", content.nav?.cta || "Buy Package");

  document.querySelectorAll("[data-text]").forEach((element) => {
    const value = getPath(content, element.dataset.text);
    if (value !== undefined) element.textContent = value;
  });
  document.querySelectorAll("[data-visible]").forEach((element) => {
    element.hidden = getPath(content, element.dataset.visible) === false;
  });
  document.querySelectorAll(".about-beliefs").forEach((section) => {
    const visibleArticles = [...section.querySelectorAll("article")].filter((article) => !article.hidden);
    section.hidden = visibleArticles.length === 0;
    section.classList.toggle("is-single", visibleArticles.length === 1);
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
    const classUrl = resolveUrl(item.ctaUrl, "#schedule");
    return `
    <article class="class-pick">
      <a class="class-image class-image-link image-fill ${image ? "has-image" : ""}" href="${escapeHtml(classUrl)}" ${backgroundAttributes(image)} aria-label="${escapeHtml(item.alt || `View ${item.title}`)}"></a>
      <a class="button navy-button" href="${escapeHtml(classUrl)}">${escapeHtml(item.title)}</a>
    </article>
  `;
  });

  renderCalendar(content.schedule);
  renderScheduleWidget(content.schedule);

  setHref("[data-packages-band-cta]", resolveUrl(content.packagesBand?.ctaUrl, "#packages"));
  setText("[data-packages-band-cta]", content.packagesBand?.cta || "Get Started");

  renderCards("[data-teachers-preview-grid]", content.teachersPage?.items, (teacher, index) => {
    const defaultTeacher = defaultContent.teachersPage?.items?.[index] || {};
    const image = teacher.profileImage || teacher.image || teacher.bodyImage || defaultTeacher.profileImage || defaultTeacher.image || "";
    const teacherUrl = `/teachers?teacher=${encodeURIComponent(getTeacherSlug(teacher, index))}`;
    return `
      <a class="teacher-preview-photo image-fill ${image ? "has-image" : ""}" href="${escapeHtml(teacherUrl)}" ${backgroundAttributes(image)} aria-label="${escapeHtml(`Meet ${teacher.name || "this teacher"}`)}"></a>
    `;
  });
  setHref("[data-faculty-cta]", "/teachers");
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
  renderFaqPage(content.faqPage);

  setHref("[data-footer-booking]", resolveUrl(content.footer?.bookUrl, bookingUrl));
  setText("[data-footer-booking]", content.footer?.bookLabel || "Book Now");
  setText("[data-footer-address]", content.footer?.address || "");
  const footerLogo = document.querySelector("[data-footer-logo]");
  if (footerLogo && content.footer?.logoUrl) footerLogo.setAttribute("src", content.footer.logoUrl);
  setHref("[data-social='instagram']", content.footer?.instagramUrl || "#");
  setHref("[data-social='facebook']", content.footer?.facebookUrl || "#");
  setHref("[data-social='tiktok']", content.footer?.tiktokUrl || "#");
  setHref("[data-terms]", content.footer?.termsUrl || "#");
  setHref("[data-privacy]", content.footer?.privacyUrl || "/privacy");
  setHref("[data-about-page-cta]", resolveUrl(content.aboutPage?.ctaUrl, bookingUrl));
  setHref("[data-services-page-cta]", resolveUrl(content.servicesPage?.ctaUrl, bookingUrl));
  setHref("[data-faq-contact]", resolveUrl(content.faqPage?.contactUrl, "/contact"));
  setHref("[data-faq-booking]", resolveUrl(content.faqPage?.bookingUrl, bookingUrl));
  document.querySelectorAll("[data-lazy-bg]").forEach(queueLazyBackground);
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

  return normalizeNavContent(normalizeTeachersContent(normalizeFacultyContent(normalizeFooterContent(normalizeServicesPageContent(deepMerge(defaultContent, data.content))))));
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

document.addEventListener("mouseover", (event) => {
  if (usesTouchMotionTrigger()) return;
  const target = event.target.closest(".teacher-feature-media.is-cutout");
  if (!target || target.contains(event.relatedTarget)) return;
  setTeacherGifMotion(target, true);
});

document.addEventListener("mouseout", (event) => {
  if (usesTouchMotionTrigger()) return;
  const target = event.target.closest(".teacher-feature-media.is-cutout");
  if (!target || target.contains(event.relatedTarget)) return;
  setTeacherGifMotion(target, false);
});

const revealElements = () => {
  const elements = document.querySelectorAll(
    ".section-pad, .package-band, .contact-section, .package-card, .class-pick, .teacher-selector, .about-copy, .about-photo, .package-band-panel, .contact-copy, .contact-form, .site-footer, .page-hero-copy, .page-hero-image, .about-story-image, .about-story-copy, .about-beliefs article, .service-feature-copy, .service-feature-image"
  );
  const revealTargets = [...elements].filter((element) => !element.classList.contains("faq-browser"));
  if (!("IntersectionObserver" in window)) {
    revealTargets.forEach((element) => element.classList.add("is-visible"));
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

  revealTargets.forEach((element, index) => {
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
