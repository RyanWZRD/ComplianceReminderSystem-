export function getTodayAtMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function dateToISOString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeExpiryDate(dateString) {
  if (!dateString) {
    return "";
  }

  const text = String(dateString).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (text.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  return text;
}

export function parseDateAtMidnight(dateString) {
  const normalized = normalizeExpiryDate(dateString);
  const parts = normalized.split("-").map(Number);

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return new Date(NaN);
  }

  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

export function isValidExpiryDate(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return false;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
