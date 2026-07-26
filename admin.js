const adminConfig = window.MTD_SUPABASE || {};
const defaultContentForAdmin = structuredClone(window.MTD_DEFAULT_CONTENT || {});
const loginForm = document.querySelector("[data-login-form]");
const passwordForm = document.querySelector("[data-password-form]");
const editorForm = document.querySelector("[data-editor-form]");
const loginMessage = document.querySelector("[data-login-message]");
const passwordMessage = document.querySelector("[data-password-message]");
const editorMessages = document.querySelectorAll("[data-editor-message]");
const signOutButton = document.querySelector("[data-sign-out]");
const resetPasswordButton = document.querySelector("[data-reset-password]");
const saveContentButton = document.querySelector("[data-save-content]");
const editorTabs = document.querySelectorAll("[data-editor-tab]");
const editorPanels = document.querySelectorAll("[data-editor-panel]");
const mediaFields = document.querySelector("[data-media-fields]");
const linkFields = document.querySelector("[data-link-fields]");
const cardFields = document.querySelector("[data-card-fields]");

let supabaseClient;
let currentContent = defaultContentForAdmin;
let isSavingContent = false;
const initialSearchParams = new URLSearchParams(window.location.search);
const initialHashParams = new URLSearchParams(window.location.hash.slice(1));

const isConfigured = () => Boolean(adminConfig.url && adminConfig.anonKey && window.supabase);

const setMessage = (element, message, type = "") => {
  element.textContent = message || "";
  element.classList.toggle("is-error", type === "error");
  element.classList.toggle("is-success", type === "success");
};

const setEditorMessage = (message, type = "") => {
  editorMessages.forEach((element) => setMessage(element, message, type));
};

const getStatusTime = () =>
  new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date());

const getAdminErrorMessage = (error, email = "") => {
  const message = error?.message || String(error);
  if (message.toLowerCase().includes("row-level security")) {
    const emailText = email ? ` Logged in as ${email}.` : "";
    return `Supabase blocked this action.${emailText} Add this exact email to public.admin_users and make sure the site_content and storage policies from supabase-setup.sql have been run.`;
  }

  return message;
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

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
      autoplay: "0",
      controls: "1",
      rel: "0",
      modestbranding: "1"
    });

    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  } catch (error) {
    return "";
  }
};

const setSavingState = (isSaving) => {
  editorForm.querySelectorAll("[data-save-content]").forEach((button) => {
    button.disabled = isSaving;
    button.textContent = isSaving ? "Saving..." : "Save Changes";
  });
};

const getPath = (object, path) =>
  path.split(".").reduce((value, key) => (value == null ? value : value[key]), object);

const setPath = (object, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key) => {
    current[key] = current[key] || {};
    return current[key];
  }, object);
  target[last] = value;
};

const fillForm = (content) => {
  renderMediaFields(content);
  renderLinkFields(content);
  renderCardFields(content);

  editorForm.querySelectorAll("[name]").forEach((field) => {
    const value = getPath(content, field.name);
    if (field.matches("[data-json]")) {
      field.value = JSON.stringify(value || [], null, 2);
    } else if (field.type === "checkbox") {
      field.checked = Boolean(value);
    } else {
      field.value = value ?? field.value ?? "";
    }
  });
};

const cardInput = ({ path, label, value = "", textarea = false, checkbox = false }) => `
  <label class="${textarea ? "wide-field" : ""}">
    ${escapeHtml(label)}
    ${
      checkbox
        ? `<input name="${escapeHtml(path)}" type="checkbox" ${value ? "checked" : ""} data-card-field />`
        : textarea
          ? `<textarea name="${escapeHtml(path)}" rows="3" data-card-field>${escapeHtml(value)}</textarea>`
          : `<input name="${escapeHtml(path)}" type="text" value="${escapeHtml(value)}" data-card-field />`
    }
  </label>
`;

const renderContentCard = (title, fields) => `
  <article class="content-card">
    <h5>${escapeHtml(title)}</h5>
    <div class="field-grid">
      ${fields.join("")}
    </div>
  </article>
`;

const renderCardGroup = (title, description, cards) => `
  <div class="content-card-group">
    <div class="media-group-heading">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(description)}</p>
    </div>
    <div class="content-card-grid">
      ${cards.join("")}
    </div>
  </div>
`;

const renderCardFields = (content) => {
  if (!cardFields) return;

  const whyCards = (content.why?.features || []).map((item, index) =>
    renderContentCard(`Why Card ${index + 1}`, [
      cardInput({ path: `why.features.${index}.number`, label: "Number", value: item.number }),
      cardInput({ path: `why.features.${index}.title`, label: "Title", value: item.title }),
      cardInput({ path: `why.features.${index}.body`, label: "Copy", value: item.body, textarea: true })
    ])
  );

  const classCards = (content.classes?.items || []).map((item, index) =>
    renderContentCard(`Class Card ${index + 1}`, [
      cardInput({ path: `classes.items.${index}.title`, label: "Class Name", value: item.title }),
      cardInput({ path: `classes.items.${index}.difficulty`, label: "Level", value: item.difficulty }),
      cardInput({ path: `classes.items.${index}.cta`, label: "Button Text", value: item.cta }),
      cardInput({ path: `classes.items.${index}.body`, label: "Description", value: item.body, textarea: true })
    ])
  );

  const eventCards = (content.events?.items || []).map((item, index) =>
    renderContentCard(`Event Card ${index + 1}`, [
      cardInput({ path: `events.items.${index}.label`, label: "Label", value: item.label }),
      cardInput({ path: `events.items.${index}.title`, label: "Title", value: item.title }),
      cardInput({ path: `events.items.${index}.body`, label: "Description", value: item.body, textarea: true })
    ])
  );

  const teacherCards = (content.teachers?.items || []).map((item, index) =>
    renderContentCard(`Teacher Card ${index + 1}`, [
      cardInput({ path: `teachers.items.${index}.name`, label: "Name", value: item.name }),
      cardInput({ path: `teachers.items.${index}.bio`, label: "Bio", value: item.bio, textarea: true }),
      cardInput({ path: `teachers.items.${index}.favorite`, label: "Favorite Thing", value: item.favorite, textarea: true })
    ])
  );

  const packageCards = (content.packages?.items || []).map((item, index) =>
    renderContentCard(`Package ${index + 1}`, [
      cardInput({ path: `packages.items.${index}.label`, label: "Label", value: item.label }),
      cardInput({ path: `packages.items.${index}.title`, label: "Package Name", value: item.title }),
      cardInput({ path: `packages.items.${index}.price`, label: "Price", value: item.price }),
      cardInput({ path: `packages.items.${index}.badge`, label: "Badge", value: item.badge }),
      cardInput({ path: `packages.items.${index}.cta`, label: "Button Text", value: item.cta }),
      cardInput({ path: `packages.items.${index}.recommended`, label: "Recommended Style", value: item.recommended, checkbox: true }),
      cardInput({ path: `packages.items.${index}.body`, label: "Description", value: item.body, textarea: true })
    ])
  );

  const galleryCards = (content.gallery?.items || []).map((item, index) =>
    renderContentCard(`Gallery Image ${index + 1}`, [
      cardInput({ path: `gallery.items.${index}.alt`, label: "Alt Text", value: item.alt }),
      cardInput({ path: `gallery.items.${index}.size`, label: "Layout Size", value: item.size })
    ])
  );

  const testimonialCards = (content.testimonials || []).map((quote, index) =>
    renderContentCard(`Testimonial ${index + 1}`, [
      cardInput({ path: `testimonials.${index}`, label: "Quote", value: quote, textarea: true })
    ])
  );

  cardFields.innerHTML = [
    renderCardGroup("Why Cards", "Short feature cards below the opening section.", whyCards),
    renderCardGroup("Class Cards", "Class name, level, description, and button text.", classCards),
    renderCardGroup("Event Cards", "Community event labels, titles, and descriptions.", eventCards),
    renderCardGroup("Teacher Cards", "Teacher names and profile copy.", teacherCards),
    renderCardGroup("Package Cards", "Package names, prices, descriptions, badges, and button text.", packageCards),
    renderCardGroup("Gallery", "Image descriptions and layout sizes. Use tall, wide, or leave blank.", galleryCards),
    renderCardGroup("Testimonials", "Short pull quotes shown in the quote strip.", testimonialCards)
  ].join("");
};

const linkInput = ({ path, label, value = "", note = "" }) => `
  <article class="link-card">
    <label>
      ${escapeHtml(label)}
      <input name="${escapeHtml(path)}" type="text" value="${escapeHtml(value)}" data-link-url />
    </label>
    ${note ? `<p>${escapeHtml(note)}</p>` : ""}
  </article>
`;

const renderLinkGroup = (title, description, fields) => `
  <div class="link-group">
    <div class="media-group-heading">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(description)}</p>
    </div>
    <div class="link-card-grid">
      ${fields.join("")}
    </div>
  </div>
`;

const renderLinkFields = (content) => {
  if (!linkFields) return;

  const classLinks = (content.classes?.items || []).map((item, index) =>
    linkInput({
      path: `classes.items.${index}.ctaUrl`,
      label: `Class Card ${index + 1}: ${item.title || "Untitled"}`,
      value: item.ctaUrl || "#packages",
      note: item.cta || "Learn More"
    })
  );

  const packageLinks = (content.packages?.items || []).map((item, index) =>
    linkInput({
      path: `packages.items.${index}.ctaUrl`,
      label: `Package ${index + 1}: ${item.title || "Untitled"}`,
      value: item.ctaUrl || content.bookingUrl || "",
      note: item.cta || "Buy Class Package"
    })
  );

  linkFields.innerHTML = [
    renderLinkGroup("Navigation Menu", "Top navigation links. Use anchors for one-page scrolling or page paths for subpages.", [
      linkInput({
        path: "nav.links.why",
        label: "Why Nav URL",
        value: content.nav?.links?.why || "#why",
        note: "Why"
      }),
      linkInput({
        path: "nav.links.classes",
        label: "Classes Nav URL",
        value: content.nav?.links?.classes || "#classes",
        note: "Classes"
      }),
      linkInput({
        path: "nav.links.events",
        label: "Events Nav URL",
        value: content.nav?.links?.events || "#events",
        note: "Events"
      }),
      linkInput({
        path: "nav.links.packages",
        label: "Packages Nav URL",
        value: content.nav?.links?.packages || "#packages",
        note: "Packages"
      })
    ]),
    renderLinkGroup("Main Buttons", "Header, mobile sticky CTA, and hero buttons.", [
      linkInput({
        path: "nav.ctaUrl",
        label: "Header & Mobile CTA URL",
        value: content.nav?.ctaUrl || "#packages",
        note: content.nav?.cta || "Buy Package"
      }),
      linkInput({
        path: "hero.primaryCtaUrl",
        label: "Hero Primary CTA URL",
        value: content.hero?.primaryCtaUrl || "#packages",
        note: content.hero?.primaryCta || "Buy Class Package"
      }),
      linkInput({
        path: "hero.secondaryCtaUrl",
        label: "Hero Secondary CTA URL",
        value: content.hero?.secondaryCtaUrl || "#classes",
        note: content.hero?.secondaryCta || "Explore Classes"
      }),
      linkInput({
        path: "finalCta.ctaUrl",
        label: "Final CTA URL",
        value: content.finalCta?.ctaUrl || content.bookingUrl || "",
        note: content.finalCta?.cta || "Buy Your First Class Package"
      })
    ]),
    renderLinkGroup("Class Buttons", "Where each class card button should send visitors.", classLinks),
    renderLinkGroup("Package Buttons", "Where each package purchase button should send visitors.", packageLinks)
  ].join("");
};

const mediaPreviewMarkup = ({ value = "", type = "image", alt = "", label = "" }) => {
  if (type === "video") {
    const youtubeUrl = getYouTubeEmbedUrl(value);
    if (youtubeUrl) {
      return `<iframe src="${escapeHtml(youtubeUrl)}" title="${escapeHtml(label)} preview" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    }

    return `<video src="${escapeHtml(value)}" muted controls playsinline></video>`;
  }

  return `<img src="${escapeHtml(value)}" alt="${escapeHtml(alt || label)}" />`;
};

const mediaInput = ({ path, label, value = "", type = "image", altPath, alt = "" }) => `
  <article class="media-card" data-media-card>
    <div class="media-preview ${type === "video" ? "is-video" : ""}">
      ${mediaPreviewMarkup({ value, type, alt, label })}
    </div>
    <div class="media-fields">
      <label>
        ${escapeHtml(label)}
        <input name="${escapeHtml(path)}" type="url" value="${escapeHtml(value)}" data-media-url data-media-type="${escapeHtml(type)}" />
      </label>
      <label class="upload-field">
        Upload ${type === "video" ? "Video" : "Image"}
        <input type="file" accept="${type === "video" ? "video/*" : "image/*"}" data-media-upload data-target-path="${escapeHtml(path)}" />
      </label>
      ${
        altPath
          ? `<label>
              Alt Text
              <input name="${escapeHtml(altPath)}" type="text" value="${escapeHtml(alt)}" data-media-alt />
            </label>`
          : ""
      }
      <a href="${escapeHtml(value || "#")}" target="_blank" rel="noreferrer" data-media-link>Open media</a>
    </div>
  </article>
`;

const renderMediaGroup = (title, description, fields) => `
  <div class="media-group">
    <div class="media-group-heading">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(description)}</p>
    </div>
    <div class="media-card-grid">
      ${fields.join("")}
    </div>
  </div>
`;

const renderMediaFields = (content) => {
  if (!mediaFields) return;

  const classFields = (content.classes?.items || []).map((item, index) =>
    mediaInput({
      path: `classes.items.${index}.image`,
      label: `Class Card ${index + 1}: ${item.title || "Untitled"}`,
      value: item.image,
      altPath: `classes.items.${index}.alt`,
      alt: item.alt
    })
  );

  const eventFields = (content.events?.items || []).map((item, index) =>
    mediaInput({
      path: `events.items.${index}.image`,
      label: `Event Card ${index + 1}: ${item.title || "Untitled"}`,
      value: item.image,
      altPath: `events.items.${index}.alt`,
      alt: item.alt
    })
  );

  const teacherFields = (content.teachers?.items || []).map((item, index) =>
    mediaInput({
      path: `teachers.items.${index}.image`,
      label: `Teacher ${index + 1}: ${item.name || "Untitled"}`,
      value: item.image,
      altPath: `teachers.items.${index}.alt`,
      alt: item.alt
    })
  );

  const galleryFields = (content.gallery?.items || []).map((item, index) =>
    mediaInput({
      path: `gallery.items.${index}.image`,
      label: `Gallery Image ${index + 1}`,
      value: item.image,
      altPath: `gallery.items.${index}.alt`,
      alt: item.alt
    })
  );

  mediaFields.innerHTML = [
    renderMediaGroup("Hero", "Video and fallback image shown at the top of the homepage.", [
      mediaInput({
        path: "hero.video",
        label: "Hero Video URL",
        value: content.hero?.video,
        type: "video"
      }),
      mediaInput({
        path: "hero.poster",
        label: "Hero Poster Image URL",
        value: content.hero?.poster
      })
    ]),
    renderMediaGroup("Feature Backgrounds", "Large emotional images used in the lifestyle and final CTA sections.", [
      mediaInput({
        path: "life.image",
        label: "Life Beyond Class Image",
        value: content.life?.image
      }),
      mediaInput({
        path: "finalCta.image",
        label: "Final CTA Image",
        value: content.finalCta?.image
      })
    ]),
    renderMediaGroup("Classes", "Images shown on class category cards.", classFields),
    renderMediaGroup("Events", "Images shown on community and event cards.", eventFields),
    renderMediaGroup("Teachers", "Portrait images shown in the teacher section.", teacherFields),
    renderMediaGroup("Gallery", "Images shown in the masonry studio gallery.", galleryFields)
  ].join("");
};

const syncJsonTextareaFromPath = (path, value) => {
  const itemMatch = path.match(/^(why)\.features\.(\d+)\.(.+)$/)
    || path.match(/^(classes|events|teachers|gallery|packages)\.items\.(\d+)\.(.+)$/);
  const testimonialMatch = path.match(/^testimonials\.(\d+)$/);
  const jsonPath = itemMatch
    ? `${itemMatch[1]}.${itemMatch[1] === "why" ? "features" : "items"}`
    : testimonialMatch
      ? "testimonials"
      : "";

  if (!jsonPath) return;

  const textarea = editorForm.querySelector(`[name="${jsonPath}"][data-json]`);
  if (!textarea) return;

  try {
    const items = JSON.parse(textarea.value || "[]");
    if (itemMatch) {
      const [, , index, property] = itemMatch;
      if (items[index]) items[index][property] = value;
    }

    if (testimonialMatch) {
      const [, index] = testimonialMatch;
      if (items[index] !== undefined) items[index] = value;
    }

    textarea.value = JSON.stringify(items, null, 2);
  } catch (error) {
    // Let the normal save validation show the JSON error.
  }
};

const updateMediaPreview = (input) => {
  const card = input.closest("[data-media-card]");
  const link = card.querySelector("[data-media-link]");
  const preview = card.querySelector(".media-preview");
  const youtubeUrl = input.dataset.mediaType === "video" ? getYouTubeEmbedUrl(input.value) : "";
  const media = card.querySelector(input.dataset.mediaType === "video" ? "video, iframe" : "img");

  if (preview && input.dataset.mediaType === "video" && youtubeUrl) {
    preview.innerHTML = `<iframe src="${escapeHtml(youtubeUrl)}" title="Hero video preview" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  } else if (preview && input.dataset.mediaType === "video" && media?.tagName === "IFRAME") {
    preview.innerHTML = `<video src="${escapeHtml(input.value)}" muted controls playsinline></video>`;
  } else if (media) {
    media.setAttribute("src", input.value);
    if (media.tagName === "VIDEO") media.load();
  }

  if (link) link.setAttribute("href", input.value || "#");
};

const uploadMediaFile = async (file, targetPath) => {
  const bucketName = "site-media";
  const extension = file.name.split(".").pop() || "media";
  const safeName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const storagePath = `homepage/${targetPath.replaceAll(".", "-")}-${Date.now()}-${safeName}.${extension}`;

  const { error } = await supabaseClient.storage
    .from(bucketName)
    .upload(storagePath, file, {
      cacheControl: "31536000",
      upsert: true
    });

  if (error) {
    if (error.message?.toLowerCase().includes("bucket not found")) {
      throw new Error(`Supabase Storage bucket "${bucketName}" was not found. Create it as a public bucket, or rerun the Storage section of supabase-setup.sql.`);
    }

    throw error;
  }

  const { data } = supabaseClient.storage.from(bucketName).getPublicUrl(storagePath);
  return data.publicUrl;
};

const readForm = () => {
  const nextContent = structuredClone(currentContent);
  const fields = [...editorForm.querySelectorAll("[name]")];

  fields
    .filter((field) => field.matches("[data-json]"))
    .forEach((field) => {
      if (field.matches("[data-json]")) {
        try {
          setPath(nextContent, field.name, JSON.parse(field.value || "[]"));
        } catch (error) {
          throw new Error(`${field.name} has invalid JSON.`);
        }
      }
    });

  fields
    .filter((field) => !field.matches("[data-json]"))
    .forEach((field) => {
      setPath(nextContent, field.name, field.type === "checkbox" ? field.checked : field.value);
    });

  return nextContent;
};

const showEditor = (show) => {
  loginForm.hidden = show;
  passwordForm.hidden = true;
  editorForm.hidden = !show;
  signOutButton.hidden = !show;
};

const showPasswordSetup = () => {
  loginForm.hidden = true;
  passwordForm.hidden = false;
  editorForm.hidden = true;
  signOutButton.hidden = false;
};

const showLogin = () => {
  loginForm.hidden = false;
  passwordForm.hidden = true;
  editorForm.hidden = true;
  signOutButton.hidden = true;
};

const activateEditorTab = (tabName) => {
  editorTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.editorTab === tabName);
  });

  editorPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.editorPanel === tabName);
  });
};

const loadContent = async () => {
  const { data, error } = await supabaseClient
    .from("site_content")
    .select("content")
    .eq("id", adminConfig.contentId || "homepage")
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  currentContent = data?.content
    ? { ...defaultContentForAdmin, ...data.content }
    : defaultContentForAdmin;
  fillForm(currentContent);
};

const getAuthLinkType = () => initialSearchParams.get("type") || initialHashParams.get("type");

const clearAuthParams = () => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

const handleAuthLink = async () => {
  const errorDescription = initialHashParams.get("error_description");
  if (errorDescription) {
    setMessage(loginMessage, decodeURIComponent(errorDescription).replaceAll("+", " "), "error");
    clearAuthParams();
    return null;
  }

  const tokenHash = initialSearchParams.get("token_hash");
  const type = getAuthLinkType();

  if (tokenHash && type) {
    const { error } = await supabaseClient.auth.verifyOtp({
      token_hash: tokenHash,
      type
    });

    if (error) {
      setMessage(loginMessage, error.message, "error");
      clearAuthParams();
      return null;
    }
  }

  const { data } = await supabaseClient.auth.getSession();
  return data.session;
};

const boot = async () => {
  if (!isConfigured()) {
    setMessage(
      loginMessage,
      "Add your Supabase Project URL and anon key in supabase-config.js first.",
      "error"
    );
    loginForm.querySelector("button").disabled = true;
    return;
  }

  supabaseClient = window.supabase.createClient(adminConfig.url, adminConfig.anonKey);
  const session = await handleAuthLink();
  const type = getAuthLinkType();

  if (session && ["invite", "recovery"].includes(type)) {
    showPasswordSetup();
    setMessage(passwordMessage, "Choose a password to finish setting up this admin account.");
    return;
  }

  if (session) {
    showEditor(true);
    await loadContent();
  }
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(loginMessage, "Signing in...");

  const formData = new FormData(loginForm);
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (error) {
    setMessage(loginMessage, error.message, "error");
    return;
  }

  showEditor(true);
  setMessage(loginMessage, "");
  await loadContent();
});

resetPasswordButton.addEventListener("click", async () => {
  const email = loginForm.elements.email.value;

  if (!email) {
    setMessage(loginMessage, "Enter your email first, then request a reset link.", "error");
    loginForm.elements.email.focus();
    return;
  }

  setMessage(loginMessage, "Sending reset link...");
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${window.location.pathname}`
  });

  if (error) {
    setMessage(loginMessage, error.message, "error");
    return;
  }

  setMessage(loginMessage, "Password reset link sent. Check your inbox.", "success");
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(passwordMessage, "Saving password...");

  const formData = new FormData(passwordForm);
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (password !== confirmPassword) {
    setMessage(passwordMessage, "Passwords do not match.", "error");
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({ password });

  if (error) {
    setMessage(passwordMessage, error.message, "error");
    return;
  }

  clearAuthParams();
  setMessage(passwordMessage, "");
  showEditor(true);
  await loadContent();
});

const saveContent = async () => {
  if (isSavingContent) return;

  isSavingContent = true;
  setEditorMessage(`Saving started at ${getStatusTime()}...`);
  setSavingState(true);

  let nextContent;
  try {
    nextContent = readForm();
  } catch (error) {
    setEditorMessage(error.message, "error");
    setSavingState(false);
    isSavingContent = false;
    return;
  }

  let sessionData;
  let saveResult;

  try {
    const sessionResponse = await supabaseClient.auth.getSession();
    sessionData = sessionResponse.data;
    saveResult = await supabaseClient
      .from("site_content")
      .upsert(
        {
          id: adminConfig.contentId || "homepage",
          content: nextContent,
          is_published: true
        },
        { onConflict: "id" }
      )
      .select("content")
      .single();
  } catch (error) {
    setEditorMessage(`Save failed at ${getStatusTime()}: ${getAdminErrorMessage(error)}`, "error");
    setSavingState(false);
    isSavingContent = false;
    return;
  }

  const email = sessionData?.session?.user?.email || "";
  const { data, error } = saveResult;

  if (error) {
    setEditorMessage(`Save failed at ${getStatusTime()}: ${getAdminErrorMessage(error, email)}`, "error");
    setSavingState(false);
    isSavingContent = false;
    return;
  }

  if (!data?.content) {
    setEditorMessage(`Save failed at ${getStatusTime()}: Supabase did not return the saved homepage row. Check that public.site_content policies from supabase-setup.sql have been run.`, "error");
    setSavingState(false);
    isSavingContent = false;
    return;
  }

  currentContent = { ...defaultContentForAdmin, ...data.content };
  fillForm(currentContent);
  setEditorMessage(`Saved and published at ${getStatusTime()}. Refresh the public site to see the latest content.`, "success");
  setSavingState(false);
  isSavingContent = false;
};

editorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveContent();
});

saveContentButton?.addEventListener("click", saveContent);

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showLogin();
});

editorTabs.forEach((tab) => {
  tab.addEventListener("click", () => activateEditorTab(tab.dataset.editorTab));
});

mediaFields?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-media-url], [data-media-alt]");
  if (!input) return;

  const card = input.closest("[data-media-card]");
  syncJsonTextareaFromPath(input.name, input.value);

  if (input.matches("[data-media-url]")) {
    updateMediaPreview(input);
  }
});

mediaFields?.addEventListener("change", async (event) => {
  const upload = event.target.closest("[data-media-upload]");
  if (!upload?.files?.length) return;

  const file = upload.files[0];
  const targetInput = mediaFields.querySelector(`[name="${upload.dataset.targetPath}"][data-media-url]`);
  if (!targetInput) return;

  try {
    upload.disabled = true;
    setEditorMessage(`Uploading ${file.name}...`);
    const publicUrl = await uploadMediaFile(file, upload.dataset.targetPath);
    targetInput.value = publicUrl;
    syncJsonTextareaFromPath(targetInput.name, targetInput.value);
    updateMediaPreview(targetInput);
    setEditorMessage("Upload complete. Save changes to publish this media update.", "success");
  } catch (error) {
    setEditorMessage(getAdminErrorMessage(error), "error");
  } finally {
    upload.disabled = false;
    upload.value = "";
  }
});

linkFields?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-link-url]");
  if (!input) return;
  syncJsonTextareaFromPath(input.name, input.value);
});

cardFields?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-card-field]");
  if (!input) return;
  syncJsonTextareaFromPath(input.name, input.type === "checkbox" ? input.checked : input.value);
});

cardFields?.addEventListener("change", (event) => {
  const input = event.target.closest("[data-card-field]");
  if (!input || input.type !== "checkbox") return;
  syncJsonTextareaFromPath(input.name, input.checked);
});

boot();
