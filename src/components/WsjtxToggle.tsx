import { useCluster } from "@/store/useCluster";
import { useT } from "@/i18n";

/** "WSJT-X" show/hide checkbox for the spot quickbars — only rendered while the
 *  WSJT-X feed is enabled. Sits next to the "skimmer" checkbox. */
export function WsjtxToggle() {
  const tr = useT();
  const enabled = useCluster((s) => s.wsjtxEnabled);
  const show = useCluster((s) => s.spotShowWsjtx);
  const setShow = useCluster((s) => s.setSpotShowWsjtx);
  if (!enabled) return null;
  return (
    <label className="inline">
      <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
      {tr("spots.wsjtx")}
    </label>
  );
}
