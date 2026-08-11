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
const cardFields = document.querySelector("[data-card-fields]");

let supabaseClient;
let currentContent = defaultContentForAdmin;
let isSavingContent = false;
const initialSearchParams = new URLSearchParams(window.location.search);
const initialHashParams = new URLSearchParams(window.location.hash.slice(1));

const isConfigured = () => Boolean(adminConfig.url && adminConfig.anonKey && window.supabase);

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

const setMessage = (element, message, type = "") => {
  if (!element) return;
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
    return `Supabase blocked this action.${emailText} Add this exact email to public.admin_users and make sure the policies from supabase-setup.sql have been run.`;
  }

  return message;
};

const getPath = (object, path) =>
  path.split(".").reduce((value, key) => (value == null ? value : value[key]), object);

const setPath = (object, path, value) => {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((current, key, index) => {
    const nextKey = keys[index + 1];
    current[key] = current[key] || (/^\d+$/.test(nextKey) ? [] : {});
    return current[key];
  }, object);
  target[last] = value;
};

const setSavingState = (isSaving) => {
  editorForm.querySelectorAll("[data-save-content]").forEach((button) => {
    button.disabled = isSaving;
    button.textContent = isSaving ? "Saving..." : "Save Changes";
  });
};

const textField = ({ path, label, value = "", textarea = false, type = "text" }) => `
  <label class="${textarea ? "wide-field" : ""}">
    ${escapeHtml(label)}
    ${
      textarea
        ? `<textarea name="${escapeHtml(path)}" rows="3" data-card-field>${escapeHtml(value)}</textarea>`
        : `<input name="${escapeHtml(path)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" data-card-field />`
    }
  </label>
`;

const renderContentCard = (title, fields) => `
  <article class="content-card">
    <h5>${escapeHtml(title)}</h5>
    <div class="field-grid">${fields.join("")}</div>
  </article>
`;

const renderCardGroup = (title, description, cards) => `
  <div class="content-card-group">
    <div class="media-group-heading">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(description)}</p>
    </div>
    <div class="content-card-grid">${cards.join("")}</div>
  </div>
`;

const renderCardFields = (content) => {
  if (!cardFields) return;

  const classCards = (content.classes?.items || []).map((item, index) =>
    renderContentCard(`Class ${index + 1}`, [
      textField({ path: `classes.items.${index}.title`, label: "Button / Class Name", value: item.title }),
      textField({ path: `classes.items.${index}.ctaUrl`, label: "Class Link", value: item.ctaUrl })
    ])
  );

  const packageCards = (content.packages?.items || []).map((item, index) =>
    renderContentCard(`Package ${index + 1}`, [
      textField({ path: `packages.items.${index}.label`, label: "Label", value: item.label }),
      textField({ path: `packages.items.${index}.title`, label: "Package Name", value: item.title }),
      textField({ path: `packages.items.${index}.price`, label: "Price", value: item.price }),
      textField({ path: `packages.items.${index}.cta`, label: "Button Text", value: item.cta }),
      textField({ path: `packages.items.${index}.ctaUrl`, label: "Button Link", value: item.ctaUrl }),
      textField({ path: `packages.items.${index}.body`, label: "Description", value: item.body, textarea: true })
    ])
  );

  const facultyCards = (content.faculty?.items || []).map((item, index) =>
    renderContentCard(`Faculty ${index + 1}`, [
      textField({ path: `faculty.items.${index}.name`, label: "Name", value: item.name }),
      textField({ path: `faculty.items.${index}.alt`, label: "Image Alt Text", value: item.alt })
    ])
  );

  cardFields.innerHTML = [
    renderCardGroup("Class Cards", "Three class cards shown above the calendar.", classCards),
    renderCardGroup("Package Cards", "Temporary package cards until Rezerv is connected.", packageCards),
    renderCardGroup("Faculty Placeholders", "Names and image descriptions for the faculty image grid.", facultyCards)
  ].join("");
};

const mediaInput = ({ path, label, value = "", note = "", kind = "image" }) => `
  <article class="media-card" data-media-card>
    <div class="media-preview ${kind === "video" ? "is-video" : ""}">
      ${
        kind === "video"
          ? `<video src="${escapeHtml(value)}" muted controls playsinline></video>`
          : `<img src="${escapeHtml(value)}" alt="${escapeHtml(label)}" />`
      }
    </div>
    <div class="media-fields">
      <label>
        ${escapeHtml(label)}
        <input name="${escapeHtml(path)}" type="url" value="${escapeHtml(value)}" data-media-url />
      </label>
      <label class="upload-field">
        Upload ${kind === "video" ? "Video" : "Image"}
        <input type="file" accept="${kind === "video" ? "video/*" : "image/*"}" data-media-upload data-target-path="${escapeHtml(path)}" />
      </label>
      ${note ? `<p>${escapeHtml(note)}</p>` : ""}
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
    <div class="media-card-grid">${fields.join("")}</div>
  </div>
`;

const renderMediaFields = (content) => {
  if (!mediaFields) return;

  const heroImages = (content.hero?.images?.length ? content.hero.images : [content.hero?.image, "", ""]).slice(0, 5);
  while (heroImages.length < 5) heroImages.push("");
  const heroImageFields = heroImages.map((image, index) =>
    mediaInput({
      path: `hero.images.${index}`,
      label: `Hero Rotating Photo ${index + 1}`,
      value: image,
      note: index === 0 ? "The hero rotates through these photos every few seconds when no hero video is set." : ""
    })
  );

  const classImages = (content.classes?.items || []).map((item, index) =>
    mediaInput({ path: `classes.items.${index}.image`, label: `Class ${index + 1} Image`, value: item.image })
  );
  const facultyImages = (content.faculty?.items || []).map((item, index) =>
    mediaInput({ path: `faculty.items.${index}.image`, label: `Faculty ${index + 1} Image`, value: item.image })
  );

  mediaFields.innerHTML = [
    renderMediaGroup("Hero Media", "Add a video background, or use up to five rotating hero photos. If video is set, it appears instead of the photo rotation.", [
      mediaInput({ path: "hero.video", label: "Hero Video URL", value: content.hero?.video, kind: "video" }),
      ...heroImageFields
    ]),
    renderMediaGroup("Main Images", "Large images used in the hero and feature sections.", [
      mediaInput({ path: "about.image", label: "About Image", value: content.about?.image }),
      mediaInput({ path: "packagesBand.image", label: "Packages Band Image", value: content.packagesBand?.image }),
      mediaInput({ path: "contact.image", label: "Contact Background Image", value: content.contact?.image })
    ]),
    renderMediaGroup("Class Images", "Three class card placeholders.", classImages),
    renderMediaGroup("Faculty Images", "Eight oval faculty placeholders.", facultyImages)
  ].join("");
};

const syncJsonTextareaFromPath = (path, value) => {
  const itemMatch = path.match(/^(classes|packages|faculty)\.items\.(\d+)\.(.+)$/);
  const highlightedMatch = path.match(/^schedule\.highlightedDays$/);
  const jsonPath = itemMatch ? `${itemMatch[1]}.items` : highlightedMatch ? "schedule.highlightedDays" : "";
  if (!jsonPath) return;

  const textarea = editorForm.querySelector(`[name="${jsonPath}"][data-json]`);
  if (!textarea) return;

  try {
    if (itemMatch) {
      const items = JSON.parse(textarea.value || "[]");
      const [, , index, property] = itemMatch;
      if (items[index]) items[index][property] = value;
      textarea.value = JSON.stringify(items, null, 2);
    }
  } catch (error) {
    // Save validation will surface JSON errors.
  }
};

const updateMediaPreview = (input) => {
  const card = input.closest("[data-media-card]");
  const media = card?.querySelector("img, video");
  const link = card?.querySelector("[data-media-link]");
  if (media) {
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

  const { error } = await supabaseClient.storage.from(bucketName).upload(storagePath, file, {
    cacheControl: "31536000",
    upsert: true
  });

  if (error) {
    if (error.message?.toLowerCase().includes("bucket not found")) {
      throw new Error(`Supabase Storage bucket "${bucketName}" was not found. Create it as a public bucket, or rerun supabase-setup.sql.`);
    }
    throw error;
  }

  const { data } = supabaseClient.storage.from(bucketName).getPublicUrl(storagePath);
  return data.publicUrl;
};

const fillForm = (content) => {
  renderCardFields(content);
  renderMediaFields(content);

  editorForm.querySelectorAll("[name]").forEach((field) => {
    const value = getPath(content, field.name);
    if (field.matches("[data-json]")) {
      field.value = JSON.stringify(value || [], null, 2);
    } else {
      field.value = value ?? "";
    }
  });
};

const readForm = () => {
  const nextContent = structuredClone(currentContent);
  const fields = [...editorForm.querySelectorAll("[name]")];

  fields
    .filter((field) => field.matches("[data-json]"))
    .forEach((field) => {
      try {
        setPath(nextContent, field.name, JSON.parse(field.value || "[]"));
      } catch (error) {
        throw new Error(`${field.name} has invalid JSON.`);
      }
    });

  fields
    .filter((field) => !field.matches("[data-json]"))
    .forEach((field) => {
      setPath(nextContent, field.name, field.value);
    });

  if (Array.isArray(nextContent.hero?.images)) {
    nextContent.hero.image = nextContent.hero.images.find(Boolean) || nextContent.hero.image || "";
  }

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

  if (error && error.code !== "PGRST116") throw error;

  currentContent = data?.content ? deepMerge(defaultContentForAdmin, data.content) : defaultContentForAdmin;
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
    const { error } = await supabaseClient.auth.verifyOtp({ token_hash: tokenHash, type });
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
    setMessage(loginMessage, "Add your Supabase Project URL and anon key in supabase-config.js first.", "error");
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

  currentContent = deepMerge(defaultContentForAdmin, data.content);
  fillForm(currentContent);
  setEditorMessage(`Saved and published at ${getStatusTime()}. Refresh the public site to see the latest content.`, "success");
  setSavingState(false);
  isSavingContent = false;
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
  if (formData.get("password") !== formData.get("confirmPassword")) {
    setMessage(passwordMessage, "Passwords do not match.", "error");
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({ password: formData.get("password") });
  if (error) {
    setMessage(passwordMessage, error.message, "error");
    return;
  }

  clearAuthParams();
  setMessage(passwordMessage, "");
  showEditor(true);
  await loadContent();
});

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
  const input = event.target.closest("[data-media-url]");
  if (!input) return;
  if (input.name === "hero.images.0") {
    const fallbackInput = mediaFields.querySelector('[name="hero.image"][data-media-url]');
    if (fallbackInput) fallbackInput.value = input.value;
  }
  syncJsonTextareaFromPath(input.name, input.value);
  updateMediaPreview(input);
});

mediaFields?.addEventListener("change", async (event) => {
  const upload = event.target.closest("[data-media-upload]");
  if (!upload?.files?.length) return;

  const targetInput = mediaFields.querySelector(`[name="${upload.dataset.targetPath}"][data-media-url]`);
  if (!targetInput) return;

  try {
    upload.disabled = true;
    setEditorMessage(`Uploading ${upload.files[0].name}...`);
    const publicUrl = await uploadMediaFile(upload.files[0], upload.dataset.targetPath);
    targetInput.value = publicUrl;
    if (targetInput.name === "hero.images.0") {
      const fallbackInput = mediaFields.querySelector('[name="hero.image"][data-media-url]');
      if (fallbackInput) fallbackInput.value = publicUrl;
    }
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

cardFields?.addEventListener("input", (event) => {
  const input = event.target.closest("[data-card-field]");
  if (!input) return;
  syncJsonTextareaFromPath(input.name, input.value);
});

boot();
