import sanitizeHtml from "sanitize-html";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "a"],
  allowedAttributes: { a: ["href", "rel", "target"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    b: "strong",
    i: "em",
    div: "p",
    // Forced values: authors cannot override rel/target.
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
  exclusiveFilter: (frame) => frame.tag === "p" && !frame.text.trim() && !frame.mediaChildren.length,
};

/** Briefing rich text allowlist (04 §4, BR-04-10): p, br, strong, em, ul, ol, li, a[href]. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

/** Plain-text length of rich text, for the 20 000-character limit. */
export function richTextLength(html: string): number {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).length;
}
