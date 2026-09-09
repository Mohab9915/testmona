// Small, dependency-free helpers for dealing with values that may be either
// plain text or HTML markup (e.g. a defect description: hand-typed defects are
// plain text, bugs imported from Azure DevOps keep their tracker HTML).
//
// Kept separate from `@/components/requirements/richText`, which pulls in the
// full rich-text editor stack — these are safe to import from anywhere.

export const isHtmlMarkup = (value: string): boolean => /<[a-z][\s\S]*>/i.test(value);

// Stricter than `isHtmlMarkup`: the value must *begin* with a block/media tag,
// the way a tracker (Azure DevOps, Jira) emits a rich field. Prose that merely
// mentions a tag ("the <div> breaks when…") is not treated as markup — it
// matters for fields like a defect description that are otherwise plain text
// typed by hand.
export const looksLikeRichHtml = (value?: string | null): boolean =>
  !!value && /^\s*<(?:div|p|br|ul|ol|h[1-6]|blockquote|pre|table|img|span|font)[\s/>]/i.test(value);

/**
 * A readable plain-text rendering of `value` for previews and single-line
 * contexts. Returns the value unchanged when it isn't HTML; otherwise strips
 * tags (via the DOM parser, which never executes scripts or loads resources)
 * and collapses runs of blank lines.
 */
export const htmlToReadableText = (value?: string | null): string => {
  if (!value || !value.trim()) return '';
  if (typeof window === 'undefined' || !isHtmlMarkup(value)) return value;
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  return parsed.body.textContent?.replace(/\n{3,}/g, '\n\n').trim() || value;
};
