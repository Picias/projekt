/**
 * E-mail administratora z .env.local (ADMIN_EMAIL).
 * Można podać kilka adresów po przecinku.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  const allowed = process.env.ADMIN_EMAIL;

  if (!allowed || !email) {
    return false;
  }

  const normalized = email.trim().toLowerCase();

  return allowed
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
