import { memo, useEffect, useState } from "react";
import { useCluster, useOnlineId } from "@/store/useCluster";
import { useShallow } from "zustand/react/shallow";
import { useVisibleSpots } from "@/lib/visibleSpots";
import { useSpotActions } from "@/lib/spotActions";
import { type SpotAction } from "@/lib/types";
import { SpotTable } from "@/components/SpotTable";
import { QuickFilters } from "@/components/QuickFilters";
import { QueryHelp } from "@/components/QueryHelp";
import { WsjtxToggle } from "@/components/WsjtxToggle";
import { useT } from "@/i18n";
import * as ipc from "@/lib/ipc";

export const SpotsPanel = memo(function SpotsPanel({
  onGoToFilters,
}: {
  onGoToFilters: () => void;
}) {
  const tr = useT();
  const {
    filtersEnabled,
    setFiltersEnabled,
    spotQuery,
    setSpotQuery,
    spotShowSkimmer,
    setSpotShowSkimmer,
  } = useCluster(
    useShallow((s) => ({
      filtersEnabled: s.filtersEnabled,
      setFiltersEnabled: s.setFiltersEnabled,
      spotQuery: s.spotQuery,
      setSpotQuery: s.setSpotQuery,
      spotShowSkimmer: s.spotShowSkimmer,
      setSpotShowSkimmer: s.setSpotShowSkimmer,
    })),
  );
  const pendingSpotSearch = useCluster((s) => s.pendingSpotSearch);

  // Which node "post a spot" targets — a real cluster node (never the
  // command-less RBN feed), the topbar picker's choice when more than one
  // is online.
  const onlineId = useOnlineId();

  const visible = useVisibleSpots();

  // Feed the tab-bar "new activity" dot: newest spot that passes the filter.
  useEffect(() => {
    useCluster.getState().setSpotsMatchTs((visible[0]?.received_at ?? 0) * 1000);
  }, [visible]);

  // Adopt a search requested from elsewhere (e.g. clicking an alert hit).
  useEffect(() => {
    if (pendingSpotSearch == null) return;
    setSpotQuery(pendingSpotSearch);
    useCluster.getState().setPendingSpotSearch(null);
  }, [pendingSpotSearch, setSpotQuery]);

  const [freq, setFreq] = useState("");
  const [call, setCall] = useState("");
  const [comment, setComment] = useState("");
  const [postMsg, setPostMsg] = useState("");

  async function postSpot() {
    if (!onlineId) return;
    try {
      const sent = await ipc.postSpot(onlineId, Number(freq), call, comment);
      setPostMsg(tr("spots.sent", { cmd: sent }));
      setCall("");
      setComment("");
    } catch (e) {
      setPostMsg(String(e));
    }
  }

  const commonActions = useSpotActions();
  const actions: SpotAction[] = [
    ...commonActions,
    {
      label: tr("spots.menu.prepPost"),
      run: (s) => {
        setFreq(String(s.freq_khz));
        setCall(s.dx_call);
      },
    },
  ];

  return (
    <div className="panel spots-panel">
      <div className="quickbar">
        <QuickFilters />
        <input
          className="search mono"
          placeholder={tr("spots.searchPlaceholder")}
          value={spotQuery}
          onChange={(e) => setSpotQuery(e.target.value)}
          spellCheck={false}
        />
        {spotQuery && (
          <button className="chip" onClick={() => setSpotQuery("")} title={tr("spots.clearSearch")}>
            ✕
          </button>
        )}
        <QueryHelp />
        <div className="qf-toggles">
          <label className="inline">
            <input
              type="checkbox"
              checked={spotShowSkimmer}
              onChange={(e) => setSpotShowSkimmer(e.target.checked)}
            />
            {tr("spots.skimmer")}
          </label>
          <WsjtxToggle />
          <label className="inline">
            <input
              type="checkbox"
              checked={filtersEnabled}
              onChange={(e) => setFiltersEnabled(e.target.checked)}
            />
            {tr("spots.savedFilters")}
          </label>
          <button onClick={onGoToFilters}>{tr("spots.editFilters")}</button>
        </div>
      </div>

      <div className="post-spot">
        <span>{tr("spots.post")}</span>
        <input
          className="mono"
          style={{ width: 90 }}
          placeholder={tr("spots.freq")}
          value={freq}
          onChange={(e) => setFreq(e.target.value)}
        />
        <input
          className="mono"
          style={{ width: 110 }}
          placeholder={tr("spots.call")}
          value={call}
          onChange={(e) => setCall(e.target.value)}
        />
        <input
          className="grow"
          placeholder={tr("spots.comment")}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button
          className="primary"
          disabled={!onlineId || !freq || !call}
          onClick={postSpot}
          title={onlineId ? "" : tr("common.noLiveConnection")}
        >
          {tr("common.send")}
        </button>
        {postMsg && <span className="muted">{postMsg}</span>}
      </div>

      <SpotTable spots={visible} actions={actions} />
    </div>
  );
});
