// Theme ids that have a generated thumbnail at public/theme-previews/<id>.webp.
// Rewritten by `npm run previews` (scripts/gen-theme-previews.mjs). Themes not
// listed here render the CSS gradient preview, so an empty set is valid and
// causes no failed image requests.
export const PREVIEW_IDS: ReadonlySet<string> = new Set<string>([]);
