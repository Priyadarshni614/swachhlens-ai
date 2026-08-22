import { createFileRoute } from "@tanstack/react-router";
import { Flame, MapPin } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PriorityPill } from "@/components/ReportBits";
import { useReports } from "@/lib/store";
import { VOLUME_LABEL, WASTE_LABEL } from "@/lib/waste";

export const Route = createFileRoute("/hotspots")({
  head: () => ({
    meta: [
      { title: "Waste Hotspots Map — SwachhLens" },
      {
        name: "description",
        content:
          "See where waste hotspots are forming across the city, clustered from citizen reports and ranked by AI priority score.",
      },
      { property: "og:title", content: "Waste Hotspots Map — SwachhLens" },
      {
        property: "og:description",
        content: "City-wide hotspot clustering with volume load and repeat-complaint escalation.",
      },
    ],
  }),
  component: HotspotsPage,
});

function HotspotsPage() {
  const { reports, hotspots } = useReports();

  const bounds = reports.length
    ? {
        minLat: Math.min(...reports.map((r) => r.location.lat)) - 0.004,
        maxLat: Math.max(...reports.map((r) => r.location.lat)) + 0.004,
        minLng: Math.min(...reports.map((r) => r.location.lng)) - 0.004,
        maxLng: Math.max(...reports.map((r) => r.location.lng)) + 0.004,
      }
    : null;

  const totalVolume = hotspots
    .flatMap((h) => h.reports)
    .reduce((s, r) => s + r.analysis.volumeCubicMetres, 0);

  return (
    <AppShell
      title="City hotspots"
      subtitle={`${hotspots.length} active clusters · ~${totalVolume.toFixed(1)} m³ pending clearance`}
    >
      <div className="relative mb-4 aspect-square overflow-hidden rounded-2xl bg-gradient-ink">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1 0 0 / 0.25) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.25) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
        {bounds
          ? hotspots.map((h) => {
              const left =
                ((h.centre.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
              const top =
                ((bounds.maxLat - h.centre.lat) / (bounds.maxLat - bounds.minLat)) * 100;
              const size = 28 + Math.min(h.score, 100) * 0.5;
              return (
                <div
                  key={h.key}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  <div
                    className="grid place-items-center rounded-full"
                    style={{
                      width: size,
                      height: size,
                      background:
                        h.score >= 80
                          ? "oklch(0.6 0.22 25 / 0.55)"
                          : h.score >= 62
                            ? "oklch(0.79 0.16 72 / 0.5)"
                            : "oklch(0.83 0.19 128 / 0.45)",
                    }}
                  >
                    <span className="text-[11px] font-semibold text-primary-foreground">
                      {h.reports.length}
                    </span>
                  </div>
                </div>
              );
            })
          : null}
        <p className="text-eyebrow absolute bottom-3 left-4 text-primary-foreground opacity-70">
          Live cluster view · 250 m grid
        </p>
      </div>

      <ul className="space-y-3">
        {hotspots.map((h, i) => (
          <li key={h.key} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-eyebrow text-muted-foreground">Rank #{i + 1}</p>
                <h2 className="flex items-center gap-1.5 text-base">
                  <MapPin className="size-4" /> {h.label}
                </h2>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                <Flame className="size-3.5" /> {h.score}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {h.reports.length} open complaint(s) ·{" "}
              {h.reports.reduce((s, r) => s + r.analysis.volumeCubicMetres, 0).toFixed(1)} m³
            </p>
            <ul className="mt-3 space-y-1.5">
              {h.reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">
                    {WASTE_LABEL[r.analysis.wasteType]} ·{" "}
                    {VOLUME_LABEL[r.analysis.volumeClass].toLowerCase()}
                  </span>
                  <PriorityPill priority={r.priority} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {hotspots.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No active hotspots — every complaint is resolved.
        </p>
      ) : null}
    </AppShell>
  );
}
