import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/i18n";

/** A "?" chip that opens a popover documenting the spot query mini-language.
 *  Dropped next to every input that feeds `compileQuery`. */
export function QueryHelp() {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const row = (syntax: string, gloss: string) => (
    <div className="qh-row" key={syntax}>
      <code>{syntax}</code>
      <span>{gloss}</span>
    </div>
  );

  return (
    <span className="qh" ref={wrap}>
      <button
        type="button"
        className={open ? "chip active" : "chip"}
        title={tr("spots.syntaxHelp")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <div className="qh-pop" role="dialog" aria-labelledby={titleId}>
          <div className="qh-head">
            <strong id={titleId}>{tr("qh.title")}</strong>
            <button type="button" className="chip" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>

          <h4>{tr("qh.hFields")}</h4>
          {row("dx:  call:", tr("qh.dx"))}
          {row("by:  de:  spotter:", tr("qh.by"))}
          {row("dxcc:", tr("qh.dxcc"))}
          {row("bydxcc:", tr("qh.bydxcc"))}
          {row("cq:  itu:", tr("qh.zone"))}
          {row("cont:  continent:", tr("qh.cont"))}
          {row("band:", tr("qh.band"))}
          {row("mode:", tr("qh.mode"))}
          {row("grid:", tr("qh.grid"))}
          {row("c:  comment:", tr("qh.comment"))}
          {row("freq:  f:", tr("qh.freq"))}
          {row("age:", tr("qh.age"))}
          {row("re:  regex:", tr("qh.re"))}
          <p className="qh-note">{tr("qh.byNote")}</p>

          <h4>{tr("qh.hAnywhere")}</h4>
          {row(tr("qh.bareWord"), tr("qh.bare"))}
          {row("skimmer", tr("qh.skimmer"))}
          {row("grey", tr("qh.grey"))}

          <h4>{tr("qh.hCombine")}</h4>
          {row(tr("qh.spaceWord"), tr("qh.and"))}
          {row("OR   |", tr("qh.or"))}
          {row("-x   !x", tr("qh.not"))}
          {row("band:20m,40m", tr("qh.comma"))}
          {row('"two words"', tr("qh.quote"))}

          <h4>{tr("qh.hExamples")}</h4>
          {row("re:/MM$", tr("qh.exMm"))}
          {row("dx:HA -mode:cw", tr("qh.exHa"))}
          {row("band:20m,40m age<15", tr("qh.exBands"))}
          {row("dx:EA OR dx:F -skimmer", tr("qh.exEaf"))}
        </div>
      )}
    </span>
  );
}
