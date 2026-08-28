export function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8;
}

export function sanitizeString(str, maxLen = 2000) {
  if (typeof str !== "string") return "";
  return str.slice(0, maxLen);
}
