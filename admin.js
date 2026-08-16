const adminConfig = window.MTD_SUPABASE || {};
const defaultContentForAdmin = structuredClone(window.MTD_DEFAULT_CONTENT || {});
const loginForm = document.querySelector("[data-login-form]");
const passwordForm = document.querySelector("[data-password-form]");
const accountForm = document.querySelector("[data-account-form]");
const editorForm = document.querySelector("[data-editor-form]");
const loginMessage = document.querySelector("[data-login-message]");
const passwordMessage = document.querySelector("[data-password-message]");
const accountMessage = document.querySelector("[data-account-message]");
const editorMessages = document.querySelectorAll("[data-editor-message]");
const signOutButton = document.querySelector("[data-sign-out]");
const resetPasswordButton = document.querySelector("[data-reset-password]");
const saveContentButton = document.querySelector("[data-save-content]");
const changePasswordButton = document.querySelector("[data-change-password-button]");
const accountToggleButton = document.querySelector("[data-account-toggle]");
const accountCloseButton = document.querySelector("[data-account-close]");
const pageTabs = document.querySelectorAll("[data-page-tab]");
const pagePanels = document.querySelectorAll("[data-page-panel]");
const pageTabGroups = document.querySelectorAll("[data-page-tabs]");
const editorPageLabel = document.querySelector("[data-editor-page-label]");
const previewCurrentPageLink = document.querySelector("[data-preview-current-page]");
const editorTabs = document.querySelectorAll("[data-editor-tab]");
const editorPanels = document.querySelectorAll("[data-editor-panel]");
const mediaSections = document.querySelectorAll("[data-section-media]");
const cardSections = document.querySelectorAll("[data-section-cards]");
const subjectTemplatesContainer = document.querySelector("[data-subject-templates]");
const addSubjectTemplateButton = document.querySelector("[data-add-subject-template]");
const teacherProfilesContainer = document.querySelector("[data-teacher-profiles]");
const addTeacherProfileButton = document.querySelector("[data-add-teacher-profile]");

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

const normalizeServicesPageContent = (content) => {
  if (!content?.servicesPage) return content;
  const servicesPage = content.servicesPage;
  const defaults = defaultContentForAdmin.servicesPage || {};
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
    content.footer.logoUrl = defaultContentForAdmin.footer?.logoUrl || "assets/m2d-icon-cream.png";
  }
  return content;
};

const normalizeFacultyContent = (content) => {
  if (content?.faculty) {
    content.faculty.ctaUrl = "/teachers";
  }
  return content;
};

const normalizeTeachersContent = (content) => {
  if (!Array.isArray(content?.teachersPage?.items)) return content;
  content.teachersPage.items = content.teachersPage.items.map((teacher) => ({
    ...teacher,
    profileImage: teacher.profileImage || teacher.image || teacher.bodyImage || "",
    bodyImage: teacher.bodyImage || teacher.image || teacher.profileImage || ""
  }));
  return content;
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

const isVideoMedia = (value = "") => /\.(webm|mp4|mov)(\?.*)?$/i.test(String(value));

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

const getSubjectTemplatesFromForm = () => {
  if (!subjectTemplatesContainer) return [];
  return [...subjectTemplatesContainer.querySelectorAll("[data-subject-template-card]")].map((card) => ({
    label: card.querySelector('[data-subject-field="label"]')?.value || "",
    template: card.querySelector('[data-subject-field="template"]')?.value || ""
  }));
};

const renderSubjectTemplates = (subjects = []) => {
  if (!subjectTemplatesContainer) return;

  const templates = Array.isArray(subjects) && subjects.length ? subjects : [{ label: "", template: "" }];
  subjectTemplatesContainer.innerHTML = templates
    .map(
      (subject, index) => `
        <article class="subject-template-card" data-subject-template-card>
          <div class="subject-template-card-heading">
            <h4>Subject ${index + 1}</h4>
            <button class="text-button subject-delete-button" type="button" data-delete-subject-template="${index}" ${templates.length <= 1 ? "disabled" : ""}>Delete</button>
          </div>
          <label>
            Subject Label
            <input name="contact.subjects.${index}.label" type="text" value="${escapeHtml(subject.label || "")}" data-subject-field="label" />
          </label>
          <label>
            Description Template
            <textarea name="contact.subjects.${index}.template" rows="5" data-subject-field="template">${escapeHtml(subject.template || "")}</textarea>
          </label>
        </article>
      `
    )
    .join("");
};

const getTeacherProfilesFromForm = () => {
  if (!teacherProfilesContainer) return [];
  return [...teacherProfilesContainer.querySelectorAll("[data-teacher-profile-card]")].map((card) => ({
    name: card.querySelector('[data-teacher-field="name"]')?.value || "",
    role: card.querySelector('[data-teacher-field="role"]')?.value || "",
    styles: card.querySelector('[data-teacher-field="styles"]')?.value || "",
    bio: card.querySelector('[data-teacher-field="bio"]')?.value || "",
    bookingUrl: card.querySelector('[data-teacher-field="bookingUrl"]')?.value || "",
    panelColor: card.querySelector('[data-teacher-field="panelColor"]')?.value || "",
    profileImage: card.querySelector('[data-teacher-field="profileImage"]')?.value || "",
    bodyImage: card.querySelector('[data-teacher-field="bodyImage"]')?.value || "",
    alt: card.querySelector('[data-teacher-field="alt"]')?.value || ""
  }));
};

const renderTeacherMediaInput = ({ index, field, label, value, note, alt }) => `
  <article class="media-card" data-media-card>
    <div class="media-preview ${isVideoMedia(value) ? "is-video" : ""}">
      ${
        isVideoMedia(value)
          ? `<video src="${escapeHtml(value)}" muted controls playsinline></video>`
          : `<img src="${escapeHtml(value)}" alt="${escapeHtml(alt || label)}" />`
      }
    </div>
    <div class="media-fields">
      <label>
        ${escapeHtml(label)}
        <input name="teachersPage.items.${index}.${field}" type="url" value="${escapeHtml(value || "")}" data-media-url data-teacher-field="${escapeHtml(field)}" />
      </label>
      <label class="upload-field">
        Upload ${escapeHtml(label)}
        <input type="file" accept="image/*,video/*" data-media-upload data-target-path="teachersPage.items.${index}.${field}" />
      </label>
      ${note ? `<p>${escapeHtml(note)}</p>` : ""}
      <a href="${escapeHtml(value || "#")}" target="_blank" rel="noreferrer" data-media-link>Open media</a>
    </div>
  </article>
`;

const renderTeacherProfiles = (teachers = []) => {
  if (!teacherProfilesContainer) return;

  const profiles = Array.isArray(teachers) && teachers.length ? teachers : [{ name: "", role: "", styles: "", bio: "", bookingUrl: "", panelColor: "#2098c2", profileImage: "", bodyImage: "", alt: "" }];
  teacherProfilesContainer.innerHTML = profiles
    .map((teacher, index) => {
      const profileImage = teacher.profileImage || teacher.image || teacher.bodyImage || "";
      const bodyImage = teacher.bodyImage || teacher.image || teacher.profileImage || "";
      return `
        <article class="teacher-profile-card" data-teacher-profile-card>
          <div class="subject-template-card-heading">
            <h4>Teacher ${index + 1}</h4>
            <button class="text-button subject-delete-button" type="button" data-delete-teacher-profile="${index}" ${profiles.length <= 1 ? "disabled" : ""}>Delete</button>
          </div>
          <div class="field-grid">
            <label>
              Name
              <input name="teachersPage.items.${index}.name" type="text" value="${escapeHtml(teacher.name || "")}" data-teacher-field="name" />
            </label>
            <label>
              Role / Title
              <input name="teachersPage.items.${index}.role" type="text" value="${escapeHtml(teacher.role || "")}" data-teacher-field="role" />
            </label>
            <label>
              Dance Styles
              <input name="teachersPage.items.${index}.styles" type="text" value="${escapeHtml(teacher.styles || "")}" data-teacher-field="styles" />
            </label>
            <label>
              Booking Link
              <input name="teachersPage.items.${index}.bookingUrl" type="url" value="${escapeHtml(teacher.bookingUrl || "")}" data-teacher-field="bookingUrl" />
            </label>
            <label>
              Panel Color
              <input name="teachersPage.items.${index}.panelColor" type="color" value="${escapeHtml(teacher.panelColor || "#2098c2")}" data-teacher-field="panelColor" />
            </label>
            <label class="wide-field">
              Short Bio
              <textarea name="teachersPage.items.${index}.bio" rows="4" data-teacher-field="bio">${escapeHtml(teacher.bio || "")}</textarea>
            </label>
            <label>
              Image Alt Text
              <input name="teachersPage.items.${index}.alt" type="text" value="${escapeHtml(teacher.alt || "")}" data-teacher-field="alt" />
            </label>
          </div>
          <div class="teacher-media-grid">
            ${renderTeacherMediaInput({
              index,
              field: "profileImage",
              label: "Profile Photo",
              value: profileImage,
              note: "Small photo used in the teacher selector circles.",
              alt: teacher.alt || teacher.name || "Teacher profile photo"
            })}
            ${renderTeacherMediaInput({
              index,
              field: "bodyImage",
              label: "Body Shot / GIF",
              value: bodyImage,
              note: "Large image, transparent GIF, or video shown in the spotlight.",
              alt: teacher.alt || teacher.name || "Teacher body shot"
            })}
          </div>
        </article>
      `;
    })
    .join("");
};

const getSectionContainer = (containers, attribute, name) =>
  [...containers].find((container) => container.dataset[attribute] === name);

const renderCardFields = (content) => {
  const classesContainer = getSectionContainer(cardSections, "sectionCards", "classes");
  const packagesContainer = getSectionContainer(cardSections, "sectionCards", "packages");

  const classCards = (content.classes?.items || []).map((item, index) =>
    renderContentCard(`Class ${index + 1}`, [
      textField({ path: `classes.items.${index}.title`, label: "Button / Class Name", value: item.title }),
      textField({ path: `classes.items.${index}.ctaUrl`, label: "Class Link", value: item.ctaUrl }),
      textField({ path: `classes.items.${index}.alt`, label: "Image Alt Text", value: item.alt }),
      mediaInput({ path: `classes.items.${index}.image`, label: "Class Image", value: item.image })
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

  if (classesContainer) {
    classesContainer.innerHTML = renderCardGroup("Class Cards", "Three class cards shown above the calendar.", classCards);
  }
  if (packagesContainer) {
    packagesContainer.innerHTML = renderCardGroup("Package Cards", "Temporary package cards until Rezerv is connected.", packageCards);
  }
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
  const heroContainer = getSectionContainer(mediaSections, "sectionMedia", "hero");
  const aboutContainer = getSectionContainer(mediaSections, "sectionMedia", "about");
  const packagesContainer = getSectionContainer(mediaSections, "sectionMedia", "packages");
  const contactContainer = getSectionContainer(mediaSections, "sectionMedia", "contact");
  const contactPageContainer = getSectionContainer(mediaSections, "sectionMedia", "contactPage");
  const footerContainer = getSectionContainer(mediaSections, "sectionMedia", "footer");
  const aboutPageHeroContainer = getSectionContainer(mediaSections, "sectionMedia", "aboutPageHero");
  const aboutPageStoryContainer = getSectionContainer(mediaSections, "sectionMedia", "aboutPageStory");
  const servicesPageHeroContainer = getSectionContainer(mediaSections, "sectionMedia", "servicesPageHero");
  const servicesPageStudioContainer = getSectionContainer(mediaSections, "sectionMedia", "servicesPageStudio");
  const servicesPageWeddingContainer = getSectionContainer(mediaSections, "sectionMedia", "servicesPageWedding");
  const servicesPageCorporateContainer = getSectionContainer(mediaSections, "sectionMedia", "servicesPageCorporate");
  const servicesPageOtherContainer = getSectionContainer(mediaSections, "sectionMedia", "servicesPageOther");
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

  if (heroContainer) {
    heroContainer.innerHTML = renderMediaGroup("Hero Media", "Add a video background, or use up to five rotating hero photos. If video is set, it appears instead of the photo rotation.", [
      mediaInput({ path: "hero.video", label: "Hero Video URL", value: content.hero?.video, kind: "video" }),
      ...heroImageFields
    ]);
  }
  if (aboutContainer) {
    aboutContainer.innerHTML = renderMediaGroup("About Image", "Main image beside the about copy.", [
      mediaInput({ path: "about.image", label: "About Image", value: content.about?.image })
    ]);
  }
  if (packagesContainer) {
    packagesContainer.innerHTML = renderMediaGroup("Packages Band Image", "Wide image behind the packages callout band.", [
      mediaInput({ path: "packagesBand.image", label: "Packages Band Image", value: content.packagesBand?.image })
    ]);
  }
  if (contactContainer) {
    contactContainer.innerHTML = renderMediaGroup("Contact Background", "Large image behind the contact section.", [
      mediaInput({ path: "contact.image", label: "Contact Background Image", value: content.contact?.image })
    ]);
  }
  if (contactPageContainer) {
    contactPageContainer.innerHTML = renderMediaGroup("Contact Image", "Image used on the Contact page and homepage contact section.", [
      mediaInput({ path: "contact.image", label: "Contact Image", value: content.contact?.image })
    ]);
  }
  if (footerContainer) {
    footerContainer.innerHTML = renderMediaGroup("Footer Logo", "Logo shown in the footer.", [
      mediaInput({ path: "footer.logoUrl", label: "Footer Logo URL", value: content.footer?.logoUrl })
    ]);
  }
  if (aboutPageHeroContainer) {
    aboutPageHeroContainer.innerHTML = renderMediaGroup("Hero Image", "Main image shown at the top of the About Us page.", [
      mediaInput({ path: "aboutPage.heroImage", label: "About Page Hero Image", value: content.aboutPage?.heroImage })
    ]);
  }
  if (aboutPageStoryContainer) {
    aboutPageStoryContainer.innerHTML = renderMediaGroup("Story Image", "Image shown beside the About Us story.", [
      mediaInput({ path: "aboutPage.storyImage", label: "About Page Story Image", value: content.aboutPage?.storyImage })
    ]);
  }
  if (servicesPageHeroContainer) {
    servicesPageHeroContainer.innerHTML = renderMediaGroup("Hero Image", "Main image shown at the top of the Services page.", [
      mediaInput({ path: "servicesPage.heroImage", label: "Services Page Hero Image", value: content.servicesPage?.heroImage })
    ]);
  }
  if (servicesPageStudioContainer) {
    servicesPageStudioContainer.innerHTML = renderMediaGroup("Service 2 Image", "Image shown with the second service section.", [
      mediaInput({ path: "servicesPage.studioImage", label: "Service 2 Image", value: content.servicesPage?.studioImage })
    ]);
  }
  if (servicesPageWeddingContainer) {
    servicesPageWeddingContainer.innerHTML = renderMediaGroup("Service 1 Image", "Image shown with the first service section.", [
      mediaInput({ path: "servicesPage.weddingImage", label: "Service 1 Image", value: content.servicesPage?.weddingImage })
    ]);
  }
  if (servicesPageCorporateContainer) {
    servicesPageCorporateContainer.innerHTML = renderMediaGroup("Service 3 Image", "Image shown with the third service section.", [
      mediaInput({ path: "servicesPage.corporateImage", label: "Service 3 Image", value: content.servicesPage?.corporateImage })
    ]);
  }
  if (servicesPageOtherContainer) {
    servicesPageOtherContainer.innerHTML = renderMediaGroup("Other Services Image", "Image shown with the other services section.", [
      mediaInput({ path: "servicesPage.otherImage", label: "Other Services Image", value: content.servicesPage?.otherImage })
    ]);
  }
};

const syncJsonTextareaFromPath = (path, value) => {
  const itemMatch = path.match(/^(classes|packages)\.items\.(\d+)\.(.+)$/);
  const heroImageMatch = path.match(/^hero\.images\.(\d+)$/);
  const highlightedMatch = path.match(/^schedule\.highlightedDays$/);
  const jsonPath = itemMatch ? `${itemMatch[1]}.items` : heroImageMatch ? "hero.images" : highlightedMatch ? "schedule.highlightedDays" : "";
  if (!jsonPath) return;

  const textarea = editorForm.querySelector(`[name="${jsonPath}"][data-json]`);
  if (!textarea) return;

  try {
    if (itemMatch) {
      const items = JSON.parse(textarea.value || "[]");
      const [, , index, property] = itemMatch;
      if (items[index]) items[index][property] = value;
      textarea.value = JSON.stringify(items, null, 2);
    } else if (heroImageMatch) {
      const images = JSON.parse(textarea.value || "[]");
      const [, index] = heroImageMatch;
      images[index] = value;
      textarea.value = JSON.stringify(images, null, 2);
    }
  } catch (error) {
    // Save validation will surface JSON errors.
  }
};

const updateMediaPreview = (input) => {
  const card = input.closest("[data-media-card]");
  const preview = card?.querySelector(".media-preview");
  const link = card?.querySelector("[data-media-link]");
  const shouldUseVideo = isVideoMedia(input.value);
  let media = card?.querySelector("img, video");
  if (preview) {
    preview.classList.toggle("is-video", shouldUseVideo);
    if (shouldUseVideo && media?.tagName !== "VIDEO") {
      preview.innerHTML = `<video src="${escapeHtml(input.value)}" muted controls playsinline></video>`;
      media = preview.querySelector("video");
    } else if (!shouldUseVideo && media?.tagName !== "IMG") {
      preview.innerHTML = `<img src="${escapeHtml(input.value)}" alt="" />`;
      media = preview.querySelector("img");
    }
  }
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

const buildRezervEmbedCode = (schedule = {}) => {
  if (!schedule.widgetUrl) return "";
  return `<iframe
  src="${schedule.widgetUrl}"
  frameborder="0"
  style="border: none; width: 100%; height: ${schedule.widgetHeight || 1080}px;"
></iframe>`;
};

const parseRezervEmbedCode = (embedCode = "") => {
  const trimmed = embedCode.trim();
  if (!trimmed) return { widgetUrl: "", widgetHeight: "" };

  const srcMatch = trimmed.match(/\ssrc=(["'])(.*?)\1/i);
  const heightMatch = trimmed.match(/height\s*:\s*(\d+)px/i) || trimmed.match(/\sheight=(["'])(\d+)\1/i);
  const widgetUrl = srcMatch?.[2] || (/^https?:\/\//i.test(trimmed) ? trimmed : "");
  if (!widgetUrl) throw new Error("Schedule embed code needs a Rezerv iframe src URL.");

  let parsedUrl;
  try {
    parsedUrl = new URL(widgetUrl);
  } catch (error) {
    throw new Error("Schedule embed code has an invalid iframe URL.");
  }

  if (parsedUrl.hostname !== "widgets.rezerv.co") {
    throw new Error("Schedule embed code must use a widgets.rezerv.co iframe URL.");
  }

  const widgetHeight = heightMatch?.[2] || heightMatch?.[1] || "1080";
  return { widgetUrl, widgetHeight };
};

const fillForm = (content) => {
  renderCardFields(content);
  renderMediaFields(content);
  renderSubjectTemplates(content.contact?.subjects);
  renderTeacherProfiles(content.teachersPage?.items);

  editorForm.querySelectorAll("[name]").forEach((field) => {
    const value = getPath(content, field.name);
    if (field.name === "schedule.widgetEmbed") {
      field.value = value || buildRezervEmbedCode(content.schedule);
    } else if (field.matches("[data-json]")) {
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

  const embedField = editorForm.querySelector('[name="schedule.widgetEmbed"]');
  if (embedField) {
    const parsedWidget = parseRezervEmbedCode(embedField.value);
    nextContent.schedule.widgetEmbed = embedField.value.trim();
    nextContent.schedule.widgetUrl = parsedWidget.widgetUrl;
    nextContent.schedule.widgetHeight = parsedWidget.widgetHeight;
  }

  if (Array.isArray(nextContent.hero?.images)) {
    nextContent.hero.image = nextContent.hero.images.find(Boolean) || nextContent.hero.image || "";
  }
  if (nextContent.faculty) nextContent.faculty.ctaUrl = "/teachers";

  nextContent.contact.subjects = getSubjectTemplatesFromForm().filter((subject) => subject.label.trim() || subject.template.trim());
  nextContent.teachersPage.items = getTeacherProfilesFromForm().filter(
    (teacher) => teacher.name.trim() || teacher.bio.trim() || teacher.profileImage.trim() || teacher.bodyImage.trim()
  );

  return nextContent;
};

const showEditor = (show) => {
  loginForm.hidden = show;
  passwordForm.hidden = true;
  accountForm.hidden = true;
  editorForm.hidden = !show;
  if (accountToggleButton) accountToggleButton.hidden = !show;
  signOutButton.hidden = !show;
};

const showPasswordSetup = () => {
  loginForm.hidden = true;
  passwordForm.hidden = false;
  accountForm.hidden = true;
  editorForm.hidden = true;
  if (accountToggleButton) accountToggleButton.hidden = true;
  signOutButton.hidden = false;
};

const showLogin = () => {
  loginForm.hidden = false;
  passwordForm.hidden = true;
  accountForm.hidden = true;
  editorForm.hidden = true;
  if (accountToggleButton) accountToggleButton.hidden = true;
  signOutButton.hidden = true;
};

const activateEditorTab = (tabName) => {
  const activePage = [...pagePanels].find((panel) => panel.classList.contains("is-active"));
  const tabScope = activePage || editorForm;
  const activeTabGroup = [...pageTabGroups].find((group) => group.classList.contains("is-active"));

  (activeTabGroup ? activeTabGroup.querySelectorAll("[data-editor-tab]") : editorTabs).forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.editorTab === tabName);
  });

  tabScope.querySelectorAll("[data-editor-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.editorPanel === tabName);
  });
};

const activatePage = (pageName) => {
  pageTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.pageTab === pageName);
  });

  pagePanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.pagePanel === pageName);
  });

  pageTabGroups.forEach((group) => {
    group.classList.toggle("is-active", group.dataset.pageTabs === pageName);
  });

  const pageLabels = {
    homepage: "Homepage",
    "about-page": "About Page",
    "services-page": "Services Page",
    "teachers-page": "Teachers Page",
    "contact-page": "Contact Page"
  };
  const previewUrls = {
    homepage: "index.html",
    "about-page": "about.html",
    "services-page": "services.html",
    "teachers-page": "teachers.html",
    "contact-page": "contact.html"
  };
  if (editorPageLabel) editorPageLabel.textContent = pageLabels[pageName] || "Homepage";
  if (previewCurrentPageLink) {
    previewCurrentPageLink.href = previewUrls[pageName] || "index.html";
    previewCurrentPageLink.textContent = `Preview ${pageLabels[pageName] || "Homepage"}`;
  }
  const activeGroup = [...pageTabGroups].find((group) => group.dataset.pageTabs === pageName);
  const firstTab = activeGroup?.querySelector("[data-editor-tab]");
  if (firstTab) activateEditorTab(firstTab.dataset.editorTab);
};

const loadContent = async () => {
  const { data, error } = await supabaseClient
    .from("site_content")
    .select("content")
    .eq("id", adminConfig.contentId || "homepage")
    .single();

  if (error && error.code !== "PGRST116") throw error;

  currentContent = normalizeTeachersContent(
    normalizeFacultyContent(
      normalizeFooterContent(
        normalizeServicesPageContent(data?.content ? deepMerge(defaultContentForAdmin, data.content) : structuredClone(defaultContentForAdmin))
      )
    )
  );
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

  currentContent = normalizeTeachersContent(normalizeFacultyContent(normalizeFooterContent(normalizeServicesPageContent(deepMerge(defaultContentForAdmin, data.content)))));
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

accountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(accountMessage, "Updating password...");
  changePasswordButton.disabled = true;

  const formData = new FormData(accountForm);
  if (formData.get("password") !== formData.get("confirmPassword")) {
    setMessage(accountMessage, "Passwords do not match.", "error");
    changePasswordButton.disabled = false;
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({ password: formData.get("password") });
  if (error) {
    setMessage(accountMessage, error.message, "error");
    changePasswordButton.disabled = false;
    return;
  }

  accountForm.reset();
  setMessage(accountMessage, "Password updated successfully.", "success");
  changePasswordButton.disabled = false;
});

accountToggleButton?.addEventListener("click", () => {
  accountForm.hidden = !accountForm.hidden;
  if (!accountForm.hidden) accountForm.querySelector("input")?.focus();
});

accountCloseButton?.addEventListener("click", () => {
  accountForm.hidden = true;
  accountForm.reset();
  setMessage(accountMessage, "");
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

pageTabs.forEach((tab) => {
  tab.addEventListener("click", () => activatePage(tab.dataset.pageTab));
});

editorTabs.forEach((tab) => {
  tab.addEventListener("click", () => activateEditorTab(tab.dataset.editorTab));
});

addSubjectTemplateButton?.addEventListener("click", () => {
  const subjects = getSubjectTemplatesFromForm();
  subjects.push({
    label: `Subject ${subjects.length + 1}`,
    template: "Hi Made To Dance,\n\nI would like to ask about...\n\nThank you!"
  });
  renderSubjectTemplates(subjects);
  subjectTemplatesContainer?.querySelector(`[name="contact.subjects.${subjects.length - 1}.label"]`)?.focus();
  setEditorMessage("New subject template added. Save changes to publish it.");
});

subjectTemplatesContainer?.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-subject-template]");
  if (!deleteButton) return;

  const subjects = getSubjectTemplatesFromForm();
  if (subjects.length <= 1) return;

  subjects.splice(Number(deleteButton.dataset.deleteSubjectTemplate), 1);
  renderSubjectTemplates(subjects);
  setEditorMessage("Subject template removed. Save changes to publish this update.");
});

addTeacherProfileButton?.addEventListener("click", () => {
  const teachers = getTeacherProfilesFromForm();
  teachers.push({
    name: `Teacher ${teachers.length + 1}`,
    role: "Dance Teacher",
    styles: "Social Dance",
    bio: "Add a short teacher bio here.",
    bookingUrl: currentContent.bookingUrl || defaultContentForAdmin.bookingUrl || "",
    panelColor: "#2098c2",
    profileImage: "",
    bodyImage: "",
    alt: "Dance teacher"
  });
  renderTeacherProfiles(teachers);
  teacherProfilesContainer?.querySelector(`[name="teachersPage.items.${teachers.length - 1}.name"]`)?.focus();
  setEditorMessage("New teacher profile added. Save changes to publish it.");
});

teacherProfilesContainer?.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-teacher-profile]");
  if (!deleteButton) return;

  const teachers = getTeacherProfilesFromForm();
  if (teachers.length <= 1) return;

  teachers.splice(Number(deleteButton.dataset.deleteTeacherProfile), 1);
  renderTeacherProfiles(teachers);
  setEditorMessage("Teacher profile removed. Save changes to publish this update.");
});

editorForm.addEventListener("input", (event) => {
  const input = event.target.closest("[data-media-url]");
  if (!input) return;
  if (input.name === "hero.images.0") {
    const fallbackInput = editorForm.querySelector('[name="hero.image"][data-media-url]');
    if (fallbackInput) fallbackInput.value = input.value;
  }
  syncJsonTextareaFromPath(input.name, input.value);
  updateMediaPreview(input);
});

editorForm.addEventListener("change", async (event) => {
  const upload = event.target.closest("[data-media-upload]");
  if (!upload?.files?.length) return;

  const targetInput = editorForm.querySelector(`[name="${upload.dataset.targetPath}"][data-media-url]`);
  if (!targetInput) return;

  try {
    upload.disabled = true;
    setEditorMessage(`Uploading ${upload.files[0].name}...`);
    const publicUrl = await uploadMediaFile(upload.files[0], upload.dataset.targetPath);
    targetInput.value = publicUrl;
    if (targetInput.name === "hero.images.0") {
      const fallbackInput = editorForm.querySelector('[name="hero.image"][data-media-url]');
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

editorForm.addEventListener("input", (event) => {
  const input = event.target.closest("[data-card-field]");
  if (!input) return;
  syncJsonTextareaFromPath(input.name, input.value);
});

boot();
