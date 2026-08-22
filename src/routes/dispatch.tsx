import { createFileRoute } from "@tanstack/react-router";
import { Clock, Recycle, Truck, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PriorityPill, ReportMeta } from "@/components/ReportBits";
import { Button } from "@/components/ui/button";
import { useReports } from "@/lib/store";
import { VOLUME_LABEL, WASTE_LABEL } from "@/lib/waste";

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Cleanup Dispatch Board — SwachhLens" },
      {
        name: "description",
        content:
          "AI-prioritised dispatch board: which crew, vehicle and recycling route to send for every open waste complaint.",
      },
      { property: "og:title", content: "Cleanup Dispatch Board — SwachhLens" },
      {
        property: "og:description",
        content: "Plan manpower, vehicles, cleanup time and recycling routes before reaching site.",
      },
    ],
  }),
  component: DispatchPage,
});

function DispatchPage() {
  const { reports, setStatus, reset } = useReports();
  const queue = reports
    .filter((r) => r.status !== "resolved" && !r.duplicateOf)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const crew = queue.reduce((s, r) => s + r.dispatch.crewSize, 0);
  const minutes = queue.reduce((s, r) => s + r.dispatch.estimatedMinutes, 0);

  return (
    <AppShell
      title="Dispatch board"
      subtitle={`${queue.length} jobs · ${crew} crew needed · ~${Math.round(minutes / 60)} h of work`}
    >
      <ol className="space-y-3">
        {queue.map((report, i) => (
          <li key={report.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-eyebrow text-muted-foreground">Queue position {i + 1}</p>
                <h2 className="text-base">{WASTE_LABEL[report.analysis.wasteType]}</h2>
                <p className="text-xs text-muted-foreground">{report.location.label}</p>
                <ReportMeta report={report} />
              </div>
              <PriorityPill priority={report.priority} score={report.priorityScore} />
            </div>

            <div className="mt-3 space-y-1.5 rounded-xl bg-gradient-ink p-3 text-xs text-primary-foreground">
              <p className="flex items-center gap-1.5 font-medium">
                <Truck className="size-3.5" /> {report.dispatch.team}
              </p>
              <p className="flex items-center gap-1.5 opacity-85">
                <Users className="size-3.5" /> {report.dispatch.vehicle} · crew of{" "}
                {report.dispatch.crewSize}
              </p>
              <p className="flex items-center gap-1.5 opacity-85">
                <Clock className="size-3.5" /> ~{report.dispatch.estimatedMinutes} min ·{" "}
                {VOLUME_LABEL[report.analysis.volumeClass]} load (
                {report.analysis.volumeCubicMetres} m³)
              </p>
              <p className="flex items-center gap-1.5 opacity-85">
                <Recycle className="size-3.5" /> {report.dispatch.recyclingRoute}
              </p>
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={() => setStatus(report.id, report.status === "new" ? "assigned" : "in_progress")}
              >
                {report.status === "new" ? "Assign crew" : "Start cleanup"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setStatus(report.id, "resolved")}
              >
                Mark cleared
              </Button>
            </div>
          </li>
        ))}
      </ol>

      {queue.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-muted-foreground">Queue is empty — all sites cleared.</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={reset}>
            Reload demo data
          </Button>
        </div>
      ) : null}
    </AppShell>
  );
}
