const adminConfig = window.MTD_SUPABASE || {};
const defaultContentForAdmin = structuredClone(window.MTD_DEFAULT_CONTENT || {});
const loginForm = document.querySelector("[data-login-form]");
const passwordForm = document.querySelector("[data-password-form]");
const editorForm = document.querySelector("[data-editor-form]");
const loginMessage = document.querySelector("[data-login-message]");
const passwordMessage = document.querySelector("[data-password-message]");
const editorMessage = document.querySelector("[data-editor-message]");
const signOutButton = document.querySelector("[data-sign-out]");
const resetPasswordButton = document.querySelector("[data-reset-password]");
const editorTabs = document.querySelectorAll("[data-editor-tab]");
const editorPanels = document.querySelectorAll("[data-editor-panel]");

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

  editorForm.querySelectorAll("[name]").forEach((field) => {
    if (field.matches("[data-json]")) {
      try {
        setPath(nextContent, field.name, JSON.parse(field.value || "[]"));
      } catch (error) {
        throw new Error(`${field.name} has invalid JSON.`);
      }
    } else {
      setPath(nextContent, field.name, field.value);
    }
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
  setMessage(editorMessage, "Saving...");
  setSavingState(true);

  let nextContent;
  try {
    nextContent = readForm();
  } catch (error) {
    setMessage(editorMessage, error.message, "error");
    setSavingState(false);
    return;
  }

  const { error } = await supabaseClient.from("site_content").upsert({
    id: adminConfig.contentId || "homepage",
    content: nextContent,
    is_published: true
  });

  if (error) {
    setMessage(editorMessage, error.message, "error");
    setSavingState(false);
    return;
  }

  currentContent = nextContent;
  setMessage(editorMessage, "Saved. Refresh the public site to see the latest content.", "success");
  setSavingState(false);
});

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showLogin();
});

editorTabs.forEach((tab) => {
  tab.addEventListener("click", () => activateEditorTab(tab.dataset.editorTab));
});

boot();
