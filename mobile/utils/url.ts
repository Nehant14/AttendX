/**
 * Helpers for the user-editable backend URL.
 *
 * People type things like "192.168.1.23:8000", "http://192.168.1.23:8000/" or
 * " HTTP://pc.local:8000 ". Normalise all of them to "http://host:port" so the
 * API client never builds URLs like "http://host:8000//auth/login".
 */

/** Returns a clean base URL (no trailing slash, scheme present), or '' if input is blank. */
export function normalizeBaseUrl(input: string | null | undefined): string {
  let url = (input ?? '').trim();
  if (!url) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    url = `http://${url}`;
  }
  return url.replace(/\/+$/, '');
}

/** True when the string is a syntactically valid http(s) URL with a host. */
export function isValidBaseUrl(input: string | null | undefined): boolean {
  const url = normalizeBaseUrl(input);
  if (!url) return false;
  return /^https?:\/\/[^\s/:?#]+(:\d{1,5})?$/i.test(url);
}
