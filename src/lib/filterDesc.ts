import { t } from "@/i18n";
import type { SpotFilter } from "./types";

/** One-line summary of a filter rule for the collapsed card head. */
export function describeFilter(f: SpotFilter): string {
  const parts: string[] = [];
  if (f.bands.length) parts.push(f.bands.join("/"));
  if (f.modes.length) parts.push(f.modes.join("/"));
  if (f.dx_continents.length) parts.push(`DX ${f.dx_continents.join("/")}`);
  if (f.spotter_continents?.length) parts.push(`by ${f.spotter_continents.join("/")}`);
  if (f.dx_call_prefixes.length) parts.push(`DX ${f.dx_call_prefixes.join(",")}`);
  if (f.spotter_call_prefixes.length) parts.push(`by ${f.spotter_call_prefixes.join(",")}`);
  if (f.dx_dxcc.length) parts.push(`DX ${f.dx_dxcc.join(",")}`);
  if (f.spotter_dxcc.length) parts.push(`by ${f.spotter_dxcc.join(",")}`);
  if (f.dx_cq_zones.length) parts.push(`DX z${f.dx_cq_zones.join(",")}`);
  if (f.spotter_cq_zones.length) parts.push(`by z${f.spotter_cq_zones.join(",")}`);
  if (f.skimmer === "exclude") parts.push(t("filters.skimmerNone"));
  if (f.skimmer === "only") parts.push(t("filters.skimmerOnly"));

  const conds = parts.length ? parts.join(" · ") : t("filters.descNoCond");
  const action = f.action === "reject" ? t("filters.reject") : t("filters.accept");
  const scope = f.pushToNode ? t("filters.scopeNode") : t("filters.scopeLocal");
  return `${action} · ${conds} · ${scope}`;
}
