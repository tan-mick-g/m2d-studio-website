const adminConfig = window.MTD_SUPABASE || {};
const defaultContentForAdmin = structuredClone(window.MTD_DEFAULT_CONTENT || {});
const loginForm = document.querySelector("[data-login-form]");
const editorForm = document.querySelector("[data-editor-form]");
const loginMessage = document.querySelector("[data-login-message]");
const editorMessage = document.querySelector("[data-editor-message]");
const signOutButton = document.querySelector("[data-sign-out]");

let supabaseClient;
let currentContent = defaultContentForAdmin;

const isConfigured = () => Boolean(adminConfig.url && adminConfig.anonKey && window.supabase);

const setMessage = (element, message, type = "") => {
  element.textContent = message || "";
  element.classList.toggle("is-error", type === "error");
  element.classList.toggle("is-success", type === "success");
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
  editorForm.hidden = !show;
  signOutButton.hidden = !show;
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
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
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

editorForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(editorMessage, "Saving...");

  let nextContent;
  try {
    nextContent = readForm();
  } catch (error) {
    setMessage(editorMessage, error.message, "error");
    return;
  }

  const { error } = await supabaseClient.from("site_content").upsert({
    id: adminConfig.contentId || "homepage",
    content: nextContent,
    is_published: true
  });

  if (error) {
    setMessage(editorMessage, error.message, "error");
    return;
  }

  currentContent = nextContent;
  setMessage(editorMessage, "Saved. Refresh the public site to see the latest content.", "success");
});

signOutButton.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showEditor(false);
});

boot();
