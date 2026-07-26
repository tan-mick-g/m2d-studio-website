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
const editorTabs = document.querySelectorAll("[data-editor-tab]");
const editorPanels = document.querySelectorAll("[data-editor-panel]");
const mediaFields = document.querySelector("[data-media-fields]");
const linkFields = document.querySelector("[data-link-fields]");

let supabaseClient;
let currentContent = defaultContentForAdmin;
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

const getAdminErrorMessage = (error) => {
  const message = error?.message || String(error);
  if (message.toLowerCase().includes("row-level security")) {
    return "Supabase blocked this action. Add this login email to public.admin_users and make sure the site_content and storage policies from supabase-setup.sql have been run.";
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

const setSavingState = (isSaving) => {
  editorForm.querySelectorAll("button[type='submit']").forEach((button) => {
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

  editorForm.querySelectorAll("[name]").forEach((field) => {
    const value = getPath(content, field.name);
    if (field.matches("[data-json]")) {
      field.value = JSON.stringify(value || [], null, 2);
    } else {
      field.value = value ?? field.value ?? "";
    }
  });
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

const mediaInput = ({ path, label, value = "", type = "image", altPath, alt = "" }) => `
  <article class="media-card" data-media-card>
    <div class="media-preview ${type === "video" ? "is-video" : ""}">
      ${
        type === "video"
          ? `<video src="${escapeHtml(value)}" muted controls playsinline></video>`
          : `<img src="${escapeHtml(value)}" alt="${escapeHtml(alt || label)}" />`
      }
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
  const match = path.match(/^(classes|events|teachers|gallery|packages)\.items\.(\d+)\.(image|alt|ctaUrl)$/);
  if (!match) return;

  const [, section, index, property] = match;
  const textarea = editorForm.querySelector(`[name="${section}.items"][data-json]`);
  if (!textarea) return;

  try {
    const items = JSON.parse(textarea.value || "[]");
    if (items[index]) {
      items[index][property] = value;
      textarea.value = JSON.stringify(items, null, 2);
    }
  } catch (error) {
    // Let the normal save validation show the JSON error.
  }
};

const updateMediaPreview = (input) => {
  const card = input.closest("[data-media-card]");
  const link = card.querySelector("[data-media-link]");
  const media = card.querySelector(input.dataset.mediaType === "video" ? "video" : "img");

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
      setPath(nextContent, field.name, field.value);
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

editorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setEditorMessage("Saving...");
  setSavingState(true);

  let nextContent;
  try {
    nextContent = readForm();
  } catch (error) {
    setEditorMessage(error.message, "error");
    setSavingState(false);
    return;
  }

  const { error } = await supabaseClient.from("site_content").upsert({
    id: adminConfig.contentId || "homepage",
    content: nextContent,
    is_published: true
  });

  if (error) {
    setEditorMessage(getAdminErrorMessage(error), "error");
    setSavingState(false);
    return;
  }

  currentContent = nextContent;
  setEditorMessage("Saved. Refresh the public site to see the latest content.", "success");
  setSavingState(false);
});

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

boot();
