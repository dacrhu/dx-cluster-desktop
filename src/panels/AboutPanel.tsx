import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { resolveLang, useT } from "@/i18n";
import { useCluster } from "@/store/useCluster";
import { getDoc, openExternal, type DocPage } from "@/lib/ipc";
import { renderMarkdown } from "@/lib/markdown";

const REPO = "https://github.com/dacrhu/dx-cluster-desktop";
const LINKS: { key: string; url: string }[] = [
  { key: "about.openGithub", url: REPO },
  { key: "about.releases", url: `${REPO}/releases` },
  { key: "about.reportIssue", url: `${REPO}/issues` },
  { key: "about.translating", url: `${REPO}/blob/main/TRANSLATING.md` },
];

const INDEX_SLUG = "README";

/** Parse `- [Label](slug.md)` links out of the manual's index page. */
function parseNav(markdown: string): { slug: string; label: string }[] {
  const nav: { slug: string; label: string }[] = [];
  const re = /\[([^\]]+)\]\(([A-Za-z0-9-]+)\.md\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    if (m[2] === INDEX_SLUG) continue;
    if (!nav.some((n) => n.slug === m![2])) nav.push({ slug: m[2], label: m[1] });
  }
  return nav;
}

export const AboutPanel = memo(function AboutPanel() {
  const tr = useT();
  const langPref = useCluster((s) => s.lang);
  // Subscribe to the OS locale too: `resolveLang` reads it (module state) when
  // `langPref` is `system`, so a live update must re-render and re-fetch.
  useCluster((s) => s.sysLocale);
  const docLang = resolveLang(langPref);
  const [version, setVersion] = useState("");
  const [slug, setSlug] = useState(INDEX_SLUG);
  const [page, setPage] = useState<DocPage | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [nav, setNav] = useState<{ slug: string; label: string }[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  useEffect(() => {
    void getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const id = ++reqId.current;
    setState("loading");
    setPage(null);
    void getDoc(slug, docLang)
      .then((p) => {
        if (id !== reqId.current) return;
        setPage(p);
        setState("ready");
        if (slug === INDEX_SLUG) setNav(parseNav(p.markdown));
      })
      .catch(() => {
        if (id !== reqId.current) return;
        setState("error");
      });
  }, [slug, docLang]);

  // Scroll the reader back to the top on every page change.
  useEffect(() => {
    if (state === "ready") bodyRef.current?.scrollTo(0, 0);
  }, [state, slug]);

  const html = useMemo(() => (page ? renderMarkdown(page.markdown) : ""), [page]);

  // Links inside the rendered manual: `*.md` → navigate the in-app reader,
  // anything else → the OS browser.
  const onBodyClick = useCallback((e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href") ?? "";
    const internal = href.match(/^([A-Za-z0-9-]+)\.md(#.*)?$/);
    if (internal) {
      setSlug(internal[1]);
      return;
    }
    if (/^https?:\/\//.test(href)) void openExternal(href).catch(() => {});
  }, []);

  return (
    <div className="panel about-panel">
      <header className="about-header">
        <div className="about-title-row">
          <h2>DX Cluster Desktop</h2>
          {version && <span className="about-version">{tr("about.version", { v: version })}</span>}
        </div>
        <p className="about-tagline">{tr("about.tagline")}</p>

        <div className="about-links">
          <h3>{tr("about.linksHeading")}</h3>
          <div className="about-link-row">
            {LINKS.map((l) => (
              <button key={l.key} onClick={() => void openExternal(l.url).catch(() => {})}>
                {tr(l.key)}
              </button>
            ))}
          </div>
          <p className="field-hint">{tr("about.license")}</p>
        </div>
      </header>

      <section className="about-docs">
        <div className="about-docs-head">
          <div>
            <h3>{tr("about.docsHeading")}</h3>
            <p className="field-hint">{tr("about.docsIntro")}</p>
          </div>
          {page && (
            <button
              className="about-gh-link"
              onClick={() => void openExternal(page.url).catch(() => {})}
            >
              {tr("about.openOnGithub")}
            </button>
          )}
        </div>

        <div className="about-doc-layout">
          <nav className="about-doc-nav">
            <button
              className={slug === INDEX_SLUG ? "active" : ""}
              onClick={() => setSlug(INDEX_SLUG)}
            >
              {tr("about.backToIndex")}
            </button>
            {nav.map((n) => (
              <button
                key={n.slug}
                className={slug === n.slug ? "active" : ""}
                onClick={() => setSlug(n.slug)}
              >
                {n.label}
              </button>
            ))}
          </nav>

          <div className="about-doc-body" ref={bodyRef}>
            {state === "loading" && <p className="field-hint">{tr("about.loading")}</p>}
            {state === "error" && (
              <p className="field-hint">
                {tr("about.loadError")}{" "}
                <button
                  className="about-gh-link"
                  onClick={() =>
                    void openExternal(`${REPO}/blob/main/user-manual/${docLang}/${slug}.md`).catch(
                      () => {},
                    )
                  }
                >
                  {tr("about.openOnGithub")}
                </button>
              </p>
            )}
            {state === "ready" && page && (
              <>
                {page.lang !== docLang && docLang !== "en" && (
                  <p className="field-hint about-doc-fallback">{tr("about.langFallback")}</p>
                )}
                <div
                  className="about-doc-content"
                  onClick={onBodyClick}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
                <p className="field-hint about-doc-source">
                  {page.source === "github" ? tr("about.sourceGithub") : tr("about.sourceBundled")}
                </p>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
});
