import { describe, expect, it } from "vitest";
import { filterAnnouncements, fingerprint, looksLikeNodeAd } from "./announceFilter";
import type { StoredAnnounce } from "./types";

let nextId = 1;
const ann = (sender: string, text: string, at: number, is_wx = false): StoredAnnounce => ({
  id: nextId++,
  node_id: "n",
  received_at: at,
  sender,
  target: "ALL",
  text,
  is_wx,
});

const cfg = { hideNodeAds: true, collapseRepeats: true, muted: [] };

describe("fingerprint", () => {
  it("ignores the changing date / time stamp", () => {
    expect(fingerprint("DXCLUSTER IK4ICZ-6 (1830Z): telnet://ik4icz.dyndns.org:8000")).toBe(
      fingerprint("DXCLUSTER IK4ICZ-6 (2230Z): telnet://ik4icz.dyndns.org:8000"),
    );
    expect(fingerprint("Dxspider telnet on0dxc.no-ip.org 730025-Oct-2026 2200Z")).toBe(
      fingerprint("Dxspider telnet on0dxc.no-ip.org 730026-Oct-2026 1700Z"),
    );
  });
  it("keeps genuinely different text apart", () => {
    expect(fingerprint("telnet a.example.org 7300")).not.toBe(
      fingerprint("telnet b.example.org 7300"),
    );
  });
});

describe("looksLikeNodeAd", () => {
  it.each([
    "Dxspider telnet iz5ilu.ns0.it 730026-Oct-2026 2100Z",
    "CLUSTER: 81.174.245.245 7300 or 9000 at 26-Oct-2026 2100Z",
    "DxSpiderWeb IK4ICZ-6 (1831Z): http://dxweb.dyndns.org:5500",
    "RAAG Cluster dxspider telnet 194.37.80.40:7300",
    "CLUSTER: cluster.hrdlog.net on port 7300",
    "Test experimental dxspider web interface at https://webcluster.ea2cw.eus",
    "Web Ham Radio Clock at https://clock.hamradio.my/live.html and Web DX Cluster at https://dx.hamradio.my",
    "CW/SSB-Only DX Cluster - Pure HF --> gw.ham.to:7000 <--",
  ])("flags %s", (t) => expect(looksLikeNodeAd(t)).toBe(true));

  it.each([
    "Bafara stations wake up !!!",
    "QRZ.com is down ?",
    "CO1CB ft8 28.074",
    "Who (mil !) is sapamming 7172 Khz ??",
    "locator of 7P8GE KG30 or KG40 ?",
    "EA2CW-2 stopped 5 min for OS updates. Now working again. Sorry 4 Inconv.",
    "14/21/28 always the best bands",
  ])("passes %s", (t) => expect(looksLikeNodeAd(t)).toBe(false));
});

describe("filterAnnouncements", () => {
  const list = [
    ann("I6GFX", "QRZ.com is down ?", 500),
    ann("IK4ICZ-6", "DXCLUSTER IK4ICZ-6 (2230Z): telnet://ik4icz.dyndns.org:8000", 400),
    ann("ON4WIY", "Bafara stations wake up !!!", 300),
    ann("IK4ICZ-6", "DXCLUSTER IK4ICZ-6 (1830Z): telnet://ik4icz.dyndns.org:8000", 200),
  ];

  it("hides node ads and keeps real chatter", () => {
    const r = filterAnnouncements(list, cfg);
    expect(r.rows.map((x) => x.a.sender)).toEqual(["I6GFX", "ON4WIY"]);
    expect(r.hidden).toBe(2);
    expect(r.activityTs).toBe(500);
  });

  it("lists spam on demand without counting it as activity", () => {
    const r = filterAnnouncements(list, { ...cfg, collapseRepeats: false }, true);
    expect(r.rows).toHaveLength(4);
    expect(r.rows.filter((x) => x.spam)).toHaveLength(2);
    expect(r.activityTs).toBe(500);
  });

  it("collapses repeats into one ×N row and doesn't re-light the dot", () => {
    const noAd = { ...cfg, hideNodeAds: false };
    const r = filterAnnouncements(list, noAd);
    expect(r.rows).toHaveLength(3);
    const ik = r.rows.find((x) => x.a.sender === "IK4ICZ-6")!;
    expect(ik.count).toBe(2);
    expect(ik.times).toEqual([400, 200]);
    // newest first-seen message is QRZ at 500; the repeat at 400 is not "new"
    expect(r.activityTs).toBe(500);
  });

  it("a repeat of an old text does not move the activity time", () => {
    const l = [ann("X1A", "hello world", 900), ann("X1A", "hello world", 100)];
    expect(filterAnnouncements(l, cfg).activityTs).toBe(100);
  });

  it("applies text and sender mutes", () => {
    const r1 = filterAnnouncements(list, {
      ...cfg,
      hideNodeAds: false,
      muted: [{ kind: "text", key: fingerprint("QRZ.com is down ?") }],
    });
    expect(r1.rows.some((x) => x.a.sender === "I6GFX")).toBe(false);
    const r2 = filterAnnouncements(list, {
      ...cfg,
      hideNodeAds: false,
      muted: [{ kind: "sender", key: "ON4WIY" }],
    });
    expect(r2.rows.some((x) => x.a.sender === "ON4WIY")).toBe(false);
  });

  it("never hides WX bulletins", () => {
    const wx = [ann("WX1", "telnet cluster.example.org:7300 overcast", 10, true)];
    expect(filterAnnouncements(wx, cfg).rows).toHaveLength(1);
  });
});
