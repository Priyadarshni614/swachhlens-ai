import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { Camera, Loader2, MapPin, ScanLine, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AnalysisFacts, PriorityPill, TypeChips } from "@/components/ReportBits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { analyzeWaste } from "@/lib/analyze.functions";
import { useReports } from "@/lib/store";
import { WASTE_LABEL, planDispatch, scoreReport, type Analysis } from "@/lib/waste";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SwachhLens — AI Waste Reporting for Citizens" },
      {
        name: "description",
        content:
          "Snap overflowing bins or illegal dumps and let AI classify the waste, estimate volume and plan municipal cleanup in seconds.",
      },
      { property: "og:title", content: "SwachhLens — AI Waste Reporting for Citizens" },
      {
        property: "og:description",
        content:
          "Citizen photo in, operational intelligence out: waste type, volume estimate, priority and dispatch plan.",
      },
    ],
  }),
  component: ReportPage,
});

const LOCATIONS = [
  { label: "Market Road, Ward 12", lat: 12.9721, lng: 77.5933 },
  { label: "Nala side, Vidyanagar", lat: 12.9754, lng: 77.5981 },
  { label: "Sector 7 vacant plot", lat: 12.9668, lng: 77.6042 },
  { label: "Campus gate 3, Ward 09", lat: 12.9805, lng: 77.5867 },
];

function ReportPage() {
  const analyze = useServerFn(analyzeWaste);
  const { addReport } = useReports();
  const fileRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<string>("");
  const [comment, setComment] = useState("");
  const [spot, setSpot] = useState(LOCATIONS[0]!);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [duplicateOf, setDuplicateOf] = useState<string | undefined>();

  const pick = (file: File) => {
    if (file.size > 8_000_000) {
      toast.error("Please use a photo under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(String(reader.result));
      setAnalysis(null);
      setSubmittedId(null);
    };
    reader.readAsDataURL(file);
  };

  const runAnalysis = async () => {
    if (!image) return;
    setBusy(true);
    try {
      const result = await analyze({ data: { imageDataUrl: image, comment } });
      setAnalysis(result as Analysis);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "AI analysis failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!analysis) return;
    const report = addReport({ imageDataUrl: image, comment, location: spot, analysis });
    setSubmittedId(report.id);
    setDuplicateOf(report.duplicateOf);
    toast.success(
      report.duplicateOf
        ? `Merged into existing complaint ${report.duplicateOf}`
        : `Complaint ${report.id} logged and assigned a priority`,
    );
  };

  const preview = analysis
    ? {
        ...scoreReport(analysis, 0, 0),
        dispatch: planDispatch(analysis),
      }
    : null;

  return (
    <AppShell
      title="Report waste in 3 taps"
      subtitle="Photo + GPS in. Waste type, volume and cleanup plan out."
    >
      <section className="space-y-4">
        <div className="scan-sweep relative aspect-4/3 overflow-hidden rounded-2xl border border-border bg-secondary/50">
          {image ? (
            <img src={image} alt="Waste site captured by citizen" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center px-6 text-center">
              <div>
                <Camera className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Capture the bin, dump or blocked drain. Keep a bin, kerb or person in frame so AI
                  can estimate volume.
                </p>
              </div>
            </div>
          )}
          {busy ? (
            <div className="absolute inset-0 bg-primary/50">
              <div className="scan-line h-16 w-full bg-gradient-signal opacity-60" />
            </div>
          ) : null}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) pick(file);
          }}
        />

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> {image ? "Retake" : "Capture"}
          </Button>
          <Button onClick={runAnalysis} disabled={!image || busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
            {busy ? "Scanning" : "Analyse"}
          </Button>
        </div>

        <div className="rounded-2xl border border-border p-3">
          <p className="text-eyebrow text-muted-foreground">GPS location</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LOCATIONS.map((l) => (
              <button
                key={l.label}
                onClick={() => setSpot(l)}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  spot.label === l.label
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" /> {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)} ·{" "}
            {new Date().toLocaleString()}
          </p>
        </div>

        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional note — e.g. not cleared since Friday, cattle feeding on it"
          rows={2}
        />

        {analysis && preview ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-lift">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-eyebrow text-muted-foreground">AI assessment</p>
                <h2 className="text-lg">{WASTE_LABEL[analysis.wasteType]}</h2>
                <p className="text-xs text-muted-foreground">
                  {Math.round(analysis.confidence * 100)}% confidence · scale ref:{" "}
                  {analysis.scaleReference}
                </p>
              </div>
              <PriorityPill priority={preview.priority} score={preview.score} />
            </div>

            <p className="text-sm">{analysis.summary}</p>
            {analysis.secondaryTypes.length ? <TypeChips types={analysis.secondaryTypes} /> : null}
            <AnalysisFacts
              report={{
                analysis,
                location: spot,
                imageDataUrl: image,
              } as never}
            />

            <div className="rounded-xl bg-gradient-ink p-3 text-xs text-primary-foreground">
              <p className="text-eyebrow opacity-70">Recommended dispatch</p>
              <p className="mt-1 font-medium">{preview.dispatch.team}</p>
              <p className="opacity-80">
                {preview.dispatch.vehicle} · crew of {preview.dispatch.crewSize} · ~
                {preview.dispatch.estimatedMinutes} min
              </p>
              <p className="opacity-80">{preview.dispatch.recyclingRoute}</p>
            </div>

            {submittedId ? (
              <div className="rounded-xl bg-secondary p-3 text-sm">
                <p className="font-medium">
                  {duplicateOf ? `Merged into ${duplicateOf}` : `Complaint ${submittedId} filed`}
                </p>
                <Link to="/reports" className="text-xs underline">
                  Track it in the complaint feed
                </Link>
              </div>
            ) : (
              <Button className="w-full" onClick={submit}>
                <Sparkles className="size-4" /> Submit complaint
              </Button>
            )}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
