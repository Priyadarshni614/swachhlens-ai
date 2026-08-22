import { AlertTriangle, Recycle, Ruler, Waves } from "lucide-react";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  VOLUME_LABEL,
  WASTE_LABEL,
  timeAgo,
  type Priority,
  type WasteReport,
  type WasteType,
} from "@/lib/waste";

export function PriorityPill({ priority, score }: { priority: Priority; score?: number }) {
  const tone =
    priority === "critical"
      ? "bg-critical text-critical-foreground"
      : priority === "urgent"
        ? "bg-warn text-warn-foreground"
        : priority === "elevated"
          ? "bg-accent text-accent-foreground"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`text-eyebrow rounded-full px-2.5 py-1 ${tone}`}>
      {PRIORITY_LABEL[priority]}
      {score !== undefined ? ` ${score}` : ""}
    </span>
  );
}

export function Thumb({ report, className = "" }: { report: WasteReport; className?: string }) {
  if (report.imageDataUrl) {
    return (
      <img
        src={report.imageDataUrl}
        alt={`${WASTE_LABEL[report.analysis.wasteType]} reported at ${report.location.label}`}
        loading="lazy"
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <div className={`grid place-items-center bg-gradient-ink text-primary-foreground ${className}`}>
      <span className="text-eyebrow opacity-70">Field photo</span>
    </div>
  );
}

export function AnalysisFacts({ report }: { report: WasteReport }) {
  const a = report.analysis;
  return (
    <dl className="grid grid-cols-2 gap-2 text-xs">
      <Fact icon={<Ruler className="size-3.5" />} label="Volume">
        {VOLUME_LABEL[a.volumeClass]} · ~{a.volumeCubicMetres} m³
      </Fact>
      <Fact icon={<Recycle className="size-3.5" />} label="Recyclable">
        {Math.round(a.recyclableShare * 100)}% dry recovery
      </Fact>
      <Fact icon={<AlertTriangle className="size-3.5" />} label="Health risk">
        {a.healthRisk}
      </Fact>
      <Fact icon={<Waves className="size-3.5" />} label="Drainage">
        {a.blocksDrainage ? "Blocked" : "Clear"}
      </Fact>
    </dl>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-secondary/60 px-3 py-2">
      <dt className="flex items-center gap-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 font-medium first-letter:uppercase">{children}</dd>
    </div>
  );
}

export function TypeChips({ types }: { types: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {types.map((t) => (
        <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[11px]">
          {WASTE_LABEL[t as WasteType] ?? t.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}

export function ReportMeta({ report }: { report: WasteReport }) {
  return (
    <p className="text-xs text-muted-foreground">
      {report.id} · {timeAgo(report.createdAt)} · {STATUS_LABEL[report.status]}
    </p>
  );
}
