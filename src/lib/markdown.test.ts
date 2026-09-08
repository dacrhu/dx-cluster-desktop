import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headings and paragraphs", () => {
    expect(renderMarkdown("# Title\n\nHello world")).toBe("<h1>Title</h1>\n<p>Hello world</p>");
  });

  it("escapes HTML in text", () => {
    expect(renderMarkdown("a < b & c")).toBe("<p>a &lt; b &amp; c</p>");
  });

  it("keeps code spans literal", () => {
    expect(renderMarkdown("use `dx:VP8` here")).toBe("<p>use <code>dx:VP8</code> here</p>");
  });

  it("does not treat asterisks inside code as emphasis", () => {
    expect(renderMarkdown("`a*b*c`")).toBe("<p><code>a*b*c</code></p>");
  });

  it("renders bold, italic and links", () => {
    expect(renderMarkdown("**b** and *i* and [x](y.md)")).toBe(
      '<p><strong>b</strong> and <em>i</em> and <a href="y.md" data-external>x</a></p>',
    );
  });

  it("renders fenced code blocks without inline processing", () => {
    expect(renderMarkdown("```\na **b** c\n```")).toBe("<pre><code>a **b** c</code></pre>");
  });

  it("renders unordered lists", () => {
    expect(renderMarkdown("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
  });

  it("renders a pipe table", () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    expect(renderMarkdown(md)).toBe(
      "<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>",
    );
  });

  it("renders blockquotes", () => {
    expect(renderMarkdown("> note here")).toBe("<blockquote>note here</blockquote>");
  });
});
