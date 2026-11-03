// The release URL is configuration, not a second backend or an auth proxy.
export function validateAppUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Oldtime needs a secure, credential-free app URL.");
  }
  return url.href;
}

export function navigationAction(value, appUrl) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.origin === new URL(appUrl).origin) return "internal";
    if (["https:", "mailto:", "tel:"].includes(url.protocol)) return "external";
  } catch {}
  return "blocked";
}
