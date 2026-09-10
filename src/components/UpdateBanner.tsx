import { memo } from "react";
import { useT } from "@/i18n";
import { openExternal } from "@/lib/ipc";
import type { UpdateInfo } from "@/lib/types";

/**
 * Startup "a newer release is out" popup. Shown once per launch by `App.tsx`
 * when `ipc.checkUpdate()` reports `newer` and the user hasn't skipped that
 * exact version. No auto-download — "Download" just opens the release page.
 */
export const UpdateBanner = memo(function UpdateBanner({
  info,
  onClose,
  onSkip,
}: {
  info: UpdateInfo;
  onClose: () => void;
  onSkip: () => void;
}) {
  const tr = useT();

  return (
    <div className="update-backdrop" onClick={onClose}>
      <div
        className="update-popup"
        role="dialog"
        aria-modal="true"
        aria-label={tr("update.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="update-popup-head">
          <strong>{tr("update.title")}</strong>
          <button className="update-popup-x" onClick={onClose} aria-label={tr("update.later")}>
            ×
          </button>
        </div>

        <p className="update-popup-lead">
          {tr("update.lead", { latest: info.latest ?? "?", current: info.current })}
        </p>

        {info.notes && <pre className="update-popup-notes">{info.notes}</pre>}

        <div className="update-popup-actions">
          <button className="primary" onClick={() => void openExternal(info.url).catch(() => {})}>
            {tr("update.download")}
          </button>
          <span className="grow" />
          <button onClick={onSkip}>{tr("update.skip")}</button>
          <button onClick={onClose}>{tr("update.later")}</button>
        </div>
      </div>
    </div>
  );
});
