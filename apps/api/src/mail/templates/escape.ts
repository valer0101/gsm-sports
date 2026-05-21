/**
 * Minimal HTML escape for values interpolated into email-template HTML.
 *
 * Tokens like `firstName` originate from the user-controlled `User` row
 * (or a Google `given_name`, also user-controlled at the Google end).
 * Without escaping, a `firstName` of `<script>...</script>` renders in
 * recipient mail clients. Threat surface is small (self-injection only)
 * but the fix costs nothing.
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
