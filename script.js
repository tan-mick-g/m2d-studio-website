const header = document.querySelector("[data-header]");
const mobileCta = document.querySelector("[data-mobile-cta]");
const hero = document.querySelector(".hero");

document.documentElement.classList.add("has-js");

const config = window.MTD_SUPABASE || {};
const defaultContent = window.MTD_DEFAULT_CONTENT || {};

const isSupabaseConfigured = () => Boolean(config.url && config.anonKey && window.supabase);

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const setText = (selector, value) => {
  const element = document.querySelector(selector);
  if (element && value !== undefined) element.textContent = value;
};

const setHref = (selector, value) => {
  document.querySelectorAll(selector).forEach((element) => {
    if (value) element.setAttribute("href", value);
  });
};

const setBackgroundImage = (selector, image, overlay = "") => {
  const element = document.querySelector(selector);
  if (element && image) {
    element.style.backgroundImage = `${overlay}url("${image}")`;
  }
};

const getYouTubeEmbedUrl = (value = "") => {
  if (!value) return "";

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
      if (url.pathname.startsWith("/shorts/")) videoId = url.pathname.split("/").filter(Boolean)[1] || "";
      if (url.pathname.startsWith("/embed/")) videoId = url.pathname.split("/").filter(Boolean)[1] || "";
    }

    if (!videoId) return "";

    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      controls: "0",
      loop: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
      playlist: videoId
    });

    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  } catch (error) {
    return "";
  }
};

const renderCards = (selector, items, template) => {
  const container = document.querySelector(selector);
  if (container && Array.isArray(items)) {
    container.innerHTML = items.map(template).join("");
  }
};

const applyContent = (content) => {
  const bookingUrl = content.bookingUrl || defaultContent.bookingUrl;
  const resolveUrl = (value, fallback = bookingUrl) => value || fallback || "#";

  setText(".nav-cta", content.nav?.cta);
  setText("[data-mobile-cta]", content.nav?.cta);
  setHref(".nav-cta", resolveUrl(content.nav?.ctaUrl, "#packages"));
  setHref("[data-mobile-cta]", resolveUrl(content.nav?.ctaUrl, "#packages"));
  setHref("[data-nav-link='why']", resolveUrl(content.nav?.links?.why, "#why"));
  setHref("[data-nav-link='classes']", resolveUrl(content.nav?.links?.classes, "#classes"));
  setHref("[data-nav-link='events']", resolveUrl(content.nav?.links?.events, "#events"));
  setHref("[data-nav-link='packages']", resolveUrl(content.nav?.links?.packages, "#packages"));

  setText(".hero .eyebrow", content.hero?.eyebrow);
  setText(".hero h1", content.hero?.title);
  setText(".hero-content > p:not(.eyebrow)", content.hero?.body);
  setText(".hero-actions .button-gold", content.hero?.primaryCta);
  setText(".hero-actions .button-ghost", content.hero?.secondaryCta);
  setHref(".hero-actions .button-gold", resolveUrl(content.hero?.primaryCtaUrl, "#packages"));
  setHref(".hero-actions .button-ghost", resolveUrl(content.hero?.secondaryCtaUrl, "#classes"));

  const videoUrl = content.hero?.video || "";
  const youtubeUrl = getYouTubeEmbedUrl(videoUrl);
  const video = document.querySelector(".hero-video");
  const youtube = document.querySelector(".hero-youtube");
  const source = video?.querySelector("source");

  if (youtube) {
    if (youtubeUrl) {
      youtube.src = youtubeUrl;
      youtube.hidden = false;
    } else {
      youtube.removeAttribute("src");
      youtube.hidden = true;
    }
  }

  if (video) {
    video.hidden = Boolean(youtubeUrl);
    if (content.hero?.poster) video.setAttribute("poster", content.hero.poster);
  }

  if (video && source && videoUrl && !youtubeUrl) {
    source.setAttribute("src", videoUrl);
    video.load();
  }
  setBackgroundImage(
    ".hero-fallback",
    content.hero?.poster,
    "linear-gradient(rgba(7, 24, 39, 0.25), rgba(7, 24, 39, 0.35)), "
  );

  setText("#why .eyebrow", content.why?.eyebrow);
  setText("#why h2", content.why?.title);
  renderCards(".feature-grid", content.why?.features, (item) => `
    <article class="feature-card reveal">
      <span class="feature-number">${escapeHtml(item.number)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.body)}</p>
    </article>
  `);

  setText("#classes .eyebrow", content.classes?.eyebrow);
  setText("#classes h2", content.classes?.title);
  renderCards(".class-grid", content.classes?.items, (item) => `
    <article class="class-card reveal">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" />
      <div>
        <p class="difficulty">${escapeHtml(item.difficulty)}</p>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
        <a href="${escapeHtml(resolveUrl(item.ctaUrl, "#packages"))}">${escapeHtml(item.cta || "Learn More")}</a>
      </div>
    </article>
  `);

  setText(".life-copy .eyebrow", content.life?.eyebrow);
  setText(".life-copy h2", content.life?.title);
  setText(".life-copy p:not(.eyebrow)", content.life?.body);
  setBackgroundImage(
    ".life-image",
    content.life?.image,
    "linear-gradient(rgba(7, 24, 39, 0.05), rgba(7, 24, 39, 0.55)), "
  );

  setText("#events .eyebrow", content.events?.eyebrow);
  setText("#events h2", content.events?.title);
  renderCards(".event-grid", content.events?.items, (item) => `
    <article class="event-card reveal">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" />
      <div>
        <span>${escapeHtml(item.label)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
      </div>
    </article>
  `);

  setText(".teachers-section .eyebrow", content.teachers?.eyebrow);
  setText(".teachers-section h2", content.teachers?.title);
  renderCards(".teacher-grid", content.teachers?.items, (item) => `
    <article class="teacher-card reveal">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" />
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.bio)}</p>
      <span>${escapeHtml(item.favorite)}</span>
    </article>
  `);

  setText(".gallery-section .eyebrow", content.gallery?.eyebrow);
  setText(".gallery-section h2", content.gallery?.title);
  renderCards(".masonry-gallery", content.gallery?.items, (item) => `
    <img class="${escapeHtml(item.size)} reveal" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt)}" />
  `);

  renderCards(".quote-panel", content.testimonials, (quote) => `<p>“${escapeHtml(quote)}”</p>`);

  setText("#packages .eyebrow", content.packages?.eyebrow);
  setText("#packages h2", content.packages?.title);
  renderCards(".pricing-grid", content.packages?.items, (item) => `
    <article class="price-card ${item.recommended ? "recommended" : ""} reveal">
      ${item.badge ? `<span class="badge">${escapeHtml(item.badge)}</span>` : ""}
      <p class="package-name">${escapeHtml(item.label)}</p>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="price">${escapeHtml(item.price)}</p>
      <p>${escapeHtml(item.body)}</p>
      <a class="button ${item.recommended ? "button-gold" : "button-outline"}" href="${escapeHtml(resolveUrl(item.ctaUrl, bookingUrl))}">${escapeHtml(item.cta)}</a>
    </article>
  `);

  setText(".final-content .eyebrow", content.finalCta?.eyebrow);
  setText(".final-content h2", content.finalCta?.title);
  setText(".final-content p:not(.eyebrow)", content.finalCta?.body);
  setText(".final-content .button", content.finalCta?.cta);
  setHref(".final-content .button", resolveUrl(content.finalCta?.ctaUrl, bookingUrl));
  setBackgroundImage(
    ".final-media",
    content.finalCta?.image,
    "linear-gradient(90deg, rgba(7, 24, 39, 0.84), rgba(7, 24, 39, 0.18)), "
  );

  setText(".site-footer > div:first-child p", content.footer?.body);
  setText(".site-footer div:nth-child(2) p:first-of-type", content.footer?.address);
  const hours = document.querySelector(".site-footer div:nth-child(2) p:nth-of-type(2)");
  if (hours && content.footer?.hours) {
    hours.innerHTML = escapeHtml(content.footer.hours).replaceAll("\n", "<br />");
  }
  const email = document.querySelector(".site-footer a[href^='mailto:']");
  if (email && content.footer?.email) {
    email.textContent = content.footer.email;
    email.href = `mailto:${content.footer.email}`;
  }
  const phone = document.querySelector(".site-footer a[href^='tel:']");
  if (phone && content.footer?.phone) {
    phone.textContent = content.footer.phone;
    phone.href = `tel:${content.footer.phone.replaceAll(" ", "")}`;
  }
  const instagram = document.querySelector(".site-footer div:nth-child(3) a:last-child");
  if (instagram) {
    instagram.textContent = content.footer?.instagramLabel || "Instagram";
    instagram.href = content.footer?.instagramUrl || "#";
  }
  setText(".copyright", content.footer?.copyright);

  observeReveals();
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

  return { ...defaultContent, ...data.content };
};

const setScrolledState = () => {
  const beyondHero = window.scrollY > window.innerHeight * 0.55;
  header?.classList.toggle("is-scrolled", window.scrollY > 18);
  mobileCta?.classList.toggle("is-visible", beyondHero);
};

const observeReveals = () => {
  const revealItems = document.querySelectorAll(".reveal:not(.is-visible)");
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.04 }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
};

const parallaxHero = () => {
  if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const offset = Math.min(window.scrollY * 0.18, 120);
  const video = hero.querySelector(".hero-video");
  const youtube = hero.querySelector(".hero-youtube");
  const fallback = hero.querySelector(".hero-fallback");
  if (video) video.style.transform = `translateY(${offset}px) scale(1.03)`;
  if (youtube) youtube.style.transform = `translateY(${offset}px) scale(1.18)`;
  if (fallback) fallback.style.transform = `translateY(${offset}px) scale(1.05)`;
};

document.querySelector(".newsletter")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.textContent = "Joined";
  setTimeout(() => {
    button.textContent = "Join";
  }, 2200);
});

window.addEventListener("scroll", () => {
  setScrolledState();
  parallaxHero();
});

loadContent().then((content) => {
  applyContent(content);
  setScrolledState();
});
