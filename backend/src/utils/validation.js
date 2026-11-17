export function validPositiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function cleanDisplayName(value, maxLength = 255) {
  const name = String(value ?? '').trim();
  if (!name || name.length > maxLength || /[\u0000-\u001f]/.test(name)) return null;
  return name;
}

export function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizeSharePermission(value) {
  const permission = String(value ?? 'VIEW').trim().toUpperCase();
  return ['VIEW', 'DOWNLOAD', 'EDIT'].includes(permission) ? permission : null;
}

export function escapeLike(value) {
  return String(value ?? '').replace(/[\\%_]/g, '\\$&');
}
