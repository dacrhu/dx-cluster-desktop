/** DK0WCY "WCY de …" broadcast shorthand. The `SA` (solar activity), `GMF`
 *  (geomagnetic field) and `Au` (aurora) fields all draw from this small
 *  vocabulary of three-letter codes; `Au` is usually `no` / `yes` but can also
 *  be a bare number (auroral activity level) at high latitudes.
 *
 *  Maps a code to an i18n key suffix under `prop.wcyCode.`. Unknown or numeric
 *  values pass straight through unchanged. */
const WCY_CODE: Record<string, string> = {
  qui: "quiet",
  uns: "unsettled",
  act: "active",
  min: "minorStorm",
  maj: "majorStorm",
  sev: "severeStorm",
  eru: "eruptive",
  ere: "eruptive",
  no: "none",
  yes: "present",
};

/** Human-readable text for a WCY `SA` / `GMF` / `Au` code, or the raw value when
 *  it isn't a code we recognise. */
export function describeWcyCode(raw: string, tr: (key: string) => string): string {
  const key = WCY_CODE[raw.trim().toLowerCase()];
  return key ? tr(`prop.wcyCode.${key}`) : raw;
}
