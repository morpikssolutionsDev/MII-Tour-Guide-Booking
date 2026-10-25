import { describe, expect, it } from "vitest";
import { sanitizeRichText } from "./sanitize";

describe("sanitizeRichText (04 AC8)", () => {
  it("removes scripts and event handlers", () => {
    const out = sanitizeRichText('<p onclick="x()">Hi<script>alert(1)</script></p><img src=x onerror=alert(1)>');
    expect(out).toBe("<p>Hi</p>");
  });

  it("keeps allowed formatting and forces safe link attributes", () => {
    const out = sanitizeRichText('<b>Rute</b> <a href="https://tamanmini.com" target="_self">info</a><a href="javascript:alert(1)">x</a>');
    expect(out).toContain("<strong>Rute</strong>");
    const link = out.match(/<a href="https:\/\/tamanmini\.com"[^>]*>/)?.[0] ?? "";
    expect(link).toContain('rel="noopener noreferrer"');
    expect(link).toContain('target="_blank"');
    expect(link).not.toContain("_self");
    expect(out).not.toContain("javascript:");
  });
});
