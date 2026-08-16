const SUPABASE_URL = process.env.SUPABASE_URL || "https://icukvxoxvayjcupgcugz.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljdWt2eG94dmF5amN1cGdjdWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MTAyNzYsImV4cCI6MjEwMDM4NjI3Nn0.vHIrCnfKELK8USfA05ompK4_S5JQpIkqFKMiL_FkQAw";

const DEFAULT_TO_EMAIL = "marketing@madetodance.ph";
const DEFAULT_FROM_EMAIL = "Made To Dance Website <website@madetodance.ph>";

const sendJson = (response, statusCode, payload) => {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const parseBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getRecipientEmail = (value) => {
  const candidate = String(value || "").trim().toLowerCase();
  if (candidate.endsWith("@madetodance.ph") && isValidEmail(candidate)) return candidate;
  return process.env.CONTACT_TO_EMAIL || DEFAULT_TO_EMAIL;
};

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  let payload;
  try {
    payload = await parseBody(request);
  } catch (error) {
    sendJson(response, 400, { error: "Invalid request body" });
    return;
  }

  if (payload.website) {
    sendJson(response, 200, { ok: true });
    return;
  }

  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim();
  const phone = String(payload.phone || "").trim();
  const inquirySubject = String(payload.subject || "General Inquiry").trim();
  const message = String(payload.message || "").trim();
  const recipientEmail = getRecipientEmail(payload.recipientEmail);

  if (!name || !isValidEmail(email) || !message) {
    sendJson(response, 400, { error: "Please complete all required fields." });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    sendJson(response, 500, { error: "Email service is not configured." });
    return;
  }

  const submission = {
    name,
    email,
    message: [`Subject: ${inquirySubject}`, ...(phone ? [`Mobile: ${phone}`] : []), "", message].join("\n"),
    recipient_email: recipientEmail,
    source_path: String(payload.sourcePath || "/"),
    user_agent: request.headers["user-agent"] || ""
  };

  const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/contact_submissions`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(submission)
  });

  if (!supabaseResponse.ok) {
    sendJson(response, 502, { error: "Could not save the message." });
    return;
  }

  const subject = `New Made To Dance ${inquirySubject} inquiry from ${name}`;
  const text = [
    "New website inquiry",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    ...(phone ? [`Mobile: ${phone}`] : []),
    `Subject: ${inquirySubject}`,
    "",
    "Message:",
    message
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #143155;">
      <h2>New website inquiry</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      ${phone ? `<p><strong>Mobile:</strong> ${escapeHtml(phone)}</p>` : ""}
      <p><strong>Subject:</strong> ${escapeHtml(inquirySubject)}</p>
      <p><strong>Message:</strong></p>
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL || DEFAULT_FROM_EMAIL,
      to: recipientEmail,
      reply_to: email,
      subject,
      text,
      html
    })
  });

  if (!resendResponse.ok) {
    sendJson(response, 502, { error: "Could not send the email notification." });
    return;
  }

  sendJson(response, 200, { ok: true });
};
