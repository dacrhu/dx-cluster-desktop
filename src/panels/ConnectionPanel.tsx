import { useState } from "react";
import { useCluster } from "@/store/useCluster";
import { saveProfiles } from "@/lib/persist";
import * as ipc from "@/lib/ipc";
import type { ConnState, NodeProfile } from "@/lib/types";

const BLANK: NodeProfile = {
  id: "",
  host: "",
  port: 7300,
  callsign: "",
  password: null,
  on_login: [],
};

const STATE_LABEL: Record<ConnState, string> = {
  connecting: "kapcsolódás…",
  logging_in: "bejelentkezés…",
  online: "él",
  disconnected: "bontva",
};

export function ConnectionPanel() {
  const { connections, upsertProfile, removeProfile } = useCluster();
  const [draft, setDraft] = useState<NodeProfile | null>(null);

  const profiles = Object.values(connections).map((c) => c.profile);

  async function persist(next: NodeProfile[]) {
    await saveProfiles(next);
  }

  function startAdd() {
    setDraft({ ...BLANK });
  }
  function startEdit(p: NodeProfile) {
    setDraft({ ...p, on_login: [...p.on_login] });
  }

  async function save() {
    if (!draft) return;
    const id = (draft.id || `${draft.host}:${draft.port}`).trim();
    const profile: NodeProfile = { ...draft, id, callsign: draft.callsign.toUpperCase().trim() };
    upsertProfile(profile);
    setDraft(null);
    await persist(Object.values(useCluster.getState().connections).map((c) => c.profile));
  }

  async function del(id: string) {
    removeProfile(id);
    setDraft(null);
    await persist(Object.values(useCluster.getState().connections).map((c) => c.profile));
  }

  async function connect(p: NodeProfile) {
    // Optimistically flip state so the button can't be clicked twice (a second
    // socket would be a same-callsign clash the node kicks).
    useCluster.getState().setConnState(p.id, "connecting");
    try {
      await ipc.connectNode(p);
    } catch (e) {
      useCluster.getState().setConnState(p.id, "disconnected");
      useCluster.getState().setConnError(p.id, String(e));
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Cluster profilok</h2>
        <button className="primary" onClick={startAdd}>
          + Új profil
        </button>
      </div>

      {profiles.length === 0 && !draft && (
        <p className="muted">
          Nincs még profil. Adj hozzá egy Telnet cluster node-ot (pl. host{" "}
          <code>hrd.wa9pie.net</code>, port <code>8000</code>).
        </p>
      )}

      <ul className="profile-list">
        {profiles.map((p) => {
          const st = connections[p.id]?.state ?? "disconnected";
          const err = connections[p.id]?.lastError;
          const live = st === "online" || st === "connecting" || st === "logging_in";
          return (
            <li key={p.id} className="profile-row">
              <span className={`dot ${st}`} />
              <div className="profile-main">
                <strong>{p.id}</strong>
                <span className="muted">
                  {p.host}:{p.port} · {p.callsign || "nincs hívójel"}
                </span>
                {err && <span className="err">{err}</span>}
              </div>
              <span className="state">{STATE_LABEL[st]}</span>
              {live ? (
                <button onClick={() => ipc.disconnectNode(p.id)}>Bontás</button>
              ) : (
                <button
                  className="primary"
                  disabled={!p.callsign || !p.host}
                  onClick={() => connect(p)}
                >
                  Csatlakozás
                </button>
              )}
              <button onClick={() => startEdit(p)}>Szerkeszt</button>
            </li>
          );
        })}
      </ul>

      {draft && (
        <div className="editor">
          <h3>{draft.id ? "Profil szerkesztése" : "Új profil"}</h3>
          <label>
            Név / azonosító
            <input
              value={draft.id}
              placeholder="pl. GB7DJK"
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
            />
          </label>
          <div className="row">
            <label className="grow">
              Host
              <input
                value={draft.host}
                placeholder="hrd.wa9pie.net"
                onChange={(e) => setDraft({ ...draft, host: e.target.value })}
              />
            </label>
            <label>
              Port
              <input
                type="number"
                value={draft.port}
                onChange={(e) => setDraft({ ...draft, port: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <div className="row">
            <label className="grow">
              Hívójel
              <input
                value={draft.callsign}
                placeholder="HA5XYZ"
                onChange={(e) => setDraft({ ...draft, callsign: e.target.value })}
              />
            </label>
            <label className="grow">
              Jelszó (ha kell)
              <input
                type="password"
                value={draft.password ?? ""}
                onChange={(e) => setDraft({ ...draft, password: e.target.value || null })}
              />
            </label>
          </div>
          <label>
            Belépés utáni parancsok (soronként egy)
            <textarea
              rows={3}
              value={draft.on_login.join("\n")}
              placeholder={"set/name Bela\nset/qth Budapest\nsh/dx 20"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  on_login: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <div className="row end">
            {draft.id && (
              <button className="danger" onClick={() => del(draft.id)}>
                Törlés
              </button>
            )}
            <button onClick={() => setDraft(null)}>Mégse</button>
            <button className="primary" onClick={save} disabled={!draft.host || !draft.callsign}>
              Mentés
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
