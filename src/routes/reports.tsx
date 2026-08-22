import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AnalysisFacts, PriorityPill, ReportMeta, Thumb, TypeChips } from "@/components/ReportBits";
import { Button } from "@/components/ui/button";
import { useReports } from "@/lib/store";
import { STATUS_LABEL, WASTE_LABEL, type ReportStatus } from "@/lib/waste";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Complaint Feed — SwachhLens" },
      {
        name: "description",
        content:
          "Live feed of citizen waste complaints with AI waste type, volume estimate, duplicate merges and cleanup status.",
      },
      { property: "og:title", content: "Complaint Feed — SwachhLens" },
      {
        property: "og:description",
        content: "Track every waste complaint from report to resolution with AI-assisted triage.",
      },
    ],
  }),
  component: FeedPage,
});

const FILTERS: { key: "all" | ReportStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "On-site" },
  { key: "resolved", label: "Resolved" },
];

function FeedPage() {
  const { reports, setStatus } = useReports();
  const [filter, setFilter] = useState<"all" | ReportStatus>("all");

  const visible = reports.filter((r) => filter === "all" || r.status === filter);

  return (
    <AppShell
      title="Complaint feed"
      subtitle={`${reports.filter((r) => r.status !== "resolved").length} open · ${reports.length} total`}
    >
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {visible.map((report) => (
          <li key={report.id} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex gap-3 p-3">
              <Thumb report={report} className="size-20 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate text-sm font-semibold">
                    {WASTE_LABEL[report.analysis.wasteType]}
                  </h2>
                  <PriorityPill priority={report.priority} score={report.priorityScore} />
                </div>
                <p className="truncate text-xs text-muted-foreground">{report.location.label}</p>
                <ReportMeta report={report} />
                {report.duplicateOf ? (
                  <p className="mt-1 text-[11px] text-warn-foreground">
                    Duplicate merged into {report.duplicateOf}
                  </p>
                ) : null}
                {report.duplicateCount > 0 ? (
                  <p className="mt-1 text-[11px] font-medium">
                    +{report.duplicateCount} repeat report(s) — escalated
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 border-t border-border px-3 py-3">
              <p className="text-sm">{report.analysis.summary}</p>
              {report.analysis.secondaryTypes.length ? (
                <TypeChips types={report.analysis.secondaryTypes} />
              ) : null}
              <AnalysisFacts report={report} />
              <div className="flex flex-wrap gap-1.5">
                {(["assigned", "in_progress", "resolved"] as ReportStatus[]).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={report.status === s ? "default" : "outline"}
                    onClick={() => setStatus(report.id, s)}
                  >
                    {STATUS_LABEL[s]}
                  </Button>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No complaints in this bucket yet.
        </p>
      ) : null}
    </AppShell>
  );
}
