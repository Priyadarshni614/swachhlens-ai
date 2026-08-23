import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import {
  buildHotspots,
  findDuplicateMatch,
  planDispatch,
  scoreReport,
  type Analysis,
  type AiFeedback,
  type DuplicateMatch,
  type Priority,
  type ReportEvent,
  type ReportStatus,
  type Visibility,
  type WasteReport,
} from "./waste";

const KEY = "swachhlens.reports.v1";
const EVENT = "swachhlens:change";

function seed(): WasteReport[] {
  const now = Date.now();
  const make = (
    minsAgo: number,
    label: string,
    lat: number,
    lng: number,
    analysis: Analysis,
    status: ReportStatus,
    comment: string,
  ): WasteReport => {
    const createdAt = new Date(now - minsAgo * 60000).toISOString();
    const { score, priority } = scoreReport(analysis, 0, minsAgo / 60);
    return {
      id: `SL-${Math.round(now / 1000 - minsAgo * 60)}`,
      createdAt,
      imageDataUrl: "",
      comment,
      location: { lat, lng, label },
      analysis,
      priority,
      priorityScore: score,
      dispatch: planDispatch(analysis),
      status,
      duplicateCount: 0,
      visibility: "public",
      reporterName: "Demo citizen",
      events: [{ status: "new", note: "Complaint filed by citizen", createdAt }],
    };
  };

  return [
    make(35, "Market Road, Ward 12", 12.9721, 77.5933, {
      wasteType: "overflowing_bin",
      secondaryTypes: ["organic_waste", "plastic_waste"],
      confidence: 0.92,
      volumeClass: "large",
      volumeCubicMetres: 3.4,
      scaleReference: "Two 240 L bins beside a kerb",
      recyclableShare: 0.35,
      blocksDrainage: false,
      healthRisk: "high",
      summary: "Twin bins overflowing onto footpath outside vegetable market.",
    }, "assigned", "Bins not cleared since Friday, strong smell."),
    make(140, "Nala side, Vidyanagar", 12.9754, 77.5981, {
      wasteType: "drain_blockage",
      secondaryTypes: ["plastic_waste"],
      confidence: 0.88,
      volumeClass: "medium",
      volumeCubicMetres: 1.6,
      scaleReference: "Drain slab width used as reference",
      recyclableShare: 0.5,
      blocksDrainage: true,
      healthRisk: "high",
      summary: "Plastic mass choking open drain, standing water upstream.",
    }, "new", "Water overflows onto road when it rains."),
    make(420, "Vacant plot, Sector 7", 12.9668, 77.6042, {
      wasteType: "construction_debris",
      secondaryTypes: [],
      confidence: 0.94,
      volumeClass: "very_large",
      volumeCubicMetres: 11.5,
      scaleReference: "Debris pile taller than compound wall",
      recyclableShare: 0.15,
      blocksDrainage: false,
      healthRisk: "moderate",
      summary: "Illegal night dumping of building rubble on vacant plot.",
    }, "in_progress", "Trucks dump here after midnight."),
    make(1500, "Bus stand rear gate", 12.9702, 77.5888, {
      wasteType: "garbage_dump",
      secondaryTypes: ["organic_waste"],
      confidence: 0.9,
      volumeClass: "medium",
      volumeCubicMetres: 1.2,
      scaleReference: "Compared against adjacent auto tyre",
      recyclableShare: 0.28,
      blocksDrainage: false,
      healthRisk: "moderate",
      summary: "Mixed waste heap near bus stand exit, cattle feeding on it.",
    }, "resolved", ""),
  ];
}

function readLocal(): WasteReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const initial = seed();
      window.localStorage.setItem(KEY, JSON.stringify(initial));
      return initial;
    }
    return (JSON.parse(raw) as WasteReport[]).map((r) => ({
      ...r,
      visibility: r.visibility ?? "public",
    }));
  } catch {
    return [];
  }
}

function writeLocal(reports: WasteReport[]) {
  window.localStorage.setItem(KEY, JSON.stringify(reports));
  window.dispatchEvent(new Event(EVENT));
}

type Row = {
  id: string;
  user_id: string;
  ref: string;
  image_data_url: string | null;
  comment: string;
  location_label: string;
  lat: number;
  lng: number;
  analysis: unknown;
  dispatch: unknown;
  priority: string;
  priority_score: number;
  status: string;
  duplicate_of: string | null;
  duplicate_count: number;
  visibility: string;
  reporter_name: string | null;
  feedback: unknown;
  created_at: string;
};

function toReport(row: Row, currentUserId: string | null, events: ReportEvent[]): WasteReport {
  return {
    id: row.ref,
    rowId: row.id,
    createdAt: row.created_at,
    imageDataUrl: row.image_data_url ?? "",
    comment: row.comment,
    location: { lat: row.lat, lng: row.lng, label: row.location_label },
    analysis: row.analysis as Analysis,
    dispatch: row.dispatch as WasteReport["dispatch"],
    priority: row.priority as Priority,
    priorityScore: row.priority_score,
    status: row.status as ReportStatus,
    duplicateCount: row.duplicate_count,
    visibility: row.visibility as Visibility,
    reporterName: row.visibility === "anonymous" ? null : row.reporter_name,
    feedback: (row.feedback as AiFeedback | null) ?? null,
    events,
    mine: currentUserId === row.user_id,
    ...(row.duplicate_of ? { duplicateOf: row.duplicate_of } : {}),
  };
}

export type NewReportInput = {
  imageDataUrl: string;
  comment: string;
  location: { lat: number; lng: number; label: string };
  analysis: Analysis;
  visibility?: Visibility;
};

export function useReports() {
  const { user, loading: authLoading } = useAuth();
  const cloud = Boolean(user);
  const [reports, setReports] = useState<WasteReport[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCloud = useCallback(async () => {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];

    const eventsByRow = new Map<string, ReportEvent[]>();
    if (rows.length) {
      const { data: evts } = await supabase
        .from("report_events")
        .select("report_id, status, note, created_at")
        .order("created_at", { ascending: true });
      for (const e of (evts ?? []) as { report_id: string; status: string; note: string; created_at: string }[]) {
        const list = eventsByRow.get(e.report_id) ?? [];
        list.push({ status: e.status as ReportStatus, note: e.note, createdAt: e.created_at });
        eventsByRow.set(e.report_id, list);
      }
    }
    return rows.map((row) => toReport(row, user?.id ?? null, eventsByRow.get(row.id) ?? []));
  }, [user?.id]);

  const refresh = useCallback(async () => {
    if (!cloud) {
      setReports(readLocal());
      setLoading(false);
      return;
    }
    try {
      setReports(await loadCloud());
    } finally {
      setLoading(false);
    }
  }, [cloud, loadCloud]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
    if (cloud) return;
    const sync = () => setReports(readLocal());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [authLoading, cloud, refresh]);

  const addReport = useCallback(
    async (
      input: NewReportInput,
    ): Promise<{ report: WasteReport; duplicate: DuplicateMatch | null }> => {
      const createdAt = new Date().toISOString();
      const visibility: Visibility = input.visibility ?? "public";
      const current = cloud ? await loadCloud() : readLocal();
      const match = findDuplicateMatch(current, {
        location: input.location,
        wasteType: input.analysis.wasteType,
        volumeClass: input.analysis.volumeClass,
        createdAt,
      });
      const duplicateCount = match ? match.report.duplicateCount + 1 : 0;
      const { score, priority } = scoreReport(input.analysis, 0, 0);
      const ref = `SL-${Date.now().toString().slice(-8)}`;
      const dispatch = planDispatch(input.analysis);

      const report: WasteReport = {
        id: ref,
        createdAt,
        imageDataUrl: input.imageDataUrl,
        comment: input.comment,
        location: input.location,
        analysis: input.analysis,
        priority,
        priorityScore: score,
        dispatch,
        status: "new",
        duplicateCount: 0,
        visibility,
        events: [{ status: "new", note: "Complaint filed by citizen", createdAt }],
        mine: true,
        ...(match ? { duplicateOf: match.report.id } : {}),
      };

      if (cloud && user) {
        const { data, error } = await supabase
          .from("reports")
          .insert({
            user_id: user.id,
            ref,
            image_data_url: input.imageDataUrl || null,
            comment: input.comment,
            location_label: input.location.label,
            lat: input.location.lat,
            lng: input.location.lng,
            analysis: input.analysis as never,
            dispatch: dispatch as never,
            priority,
            priority_score: score,
            status: "new",
            visibility,
            reporter_name: user.user_metadata?.["display_name"] ?? user.email ?? null,
            duplicate_of: match ? match.report.id : null,
          })
          .select("id")
          .single();
        if (error) throw error;
        report.rowId = (data as { id: string }).id;
        await supabase.from("report_events").insert({
          report_id: report.rowId,
          status: "new",
          note: match
            ? `Filed and linked to existing complaint ${match.report.id}`
            : "Complaint filed by citizen",
          actor_id: user.id,
        });
        if (match?.report.rowId) {
          const escalated = scoreReport(
            match.report.analysis,
            duplicateCount,
            (Date.now() - new Date(match.report.createdAt).getTime()) / 36e5,
          );
          await supabase
            .from("reports")
            .update({
              duplicate_count: duplicateCount,
              priority: escalated.priority,
              priority_score: escalated.score,
            })
            .eq("id", match.report.rowId);
        }
        await refresh();
      } else {
        const next = current.map((r) =>
          match && r.id === match.report.id
            ? { ...r, duplicateCount, ...rescore(r, duplicateCount) }
            : r,
        );
        writeLocal([report, ...next]);
      }

      return { report, duplicate: match };
    },
    [cloud, loadCloud, refresh, user],
  );

  const setStatus = useCallback(
    async (report: WasteReport, status: ReportStatus, note = "") => {
      if (cloud && report.rowId && user) {
        await supabase.from("reports").update({ status }).eq("id", report.rowId);
        await supabase.from("report_events").insert({
          report_id: report.rowId,
          status,
          note: note || `Status moved to ${status.replace(/_/g, " ")}`,
          actor_id: user.id,
        });
        await refresh();
      } else {
        writeLocal(
          readLocal().map((r) =>
            r.id === report.id
              ? {
                  ...r,
                  status,
                  events: [
                    ...(r.events ?? []),
                    {
                      status,
                      note: note || `Status moved to ${status.replace(/_/g, " ")}`,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : r,
          ),
        );
      }
    },
    [cloud, refresh, user],
  );

  const submitFeedback = useCallback(
    async (report: WasteReport, feedback: Omit<AiFeedback, "at">) => {
      const payload: AiFeedback = { ...feedback, at: new Date().toISOString() };
      if (cloud && report.rowId) {
        await supabase
          .from("reports")
          .update({ feedback: payload as never })
          .eq("id", report.rowId);
        await refresh();
      } else {
        writeLocal(readLocal().map((r) => (r.id === report.id ? { ...r, feedback: payload } : r)));
      }
    },
    [cloud, refresh],
  );

  const setVisibility = useCallback(
    async (report: WasteReport, visibility: Visibility) => {
      if (cloud && report.rowId) {
        await supabase.from("reports").update({ visibility }).eq("id", report.rowId);
        await refresh();
      } else {
        writeLocal(readLocal().map((r) => (r.id === report.id ? { ...r, visibility } : r)));
      }
    },
    [cloud, refresh],
  );

  return {
    reports,
    loading: loading || authLoading,
    cloud,
    refresh,
    addReport,
    setStatus,
    submitFeedback,
    setVisibility,
    hotspots: buildHotspots(reports),
  };
}

function rescore(report: WasteReport, duplicateCount: number) {
  const ageHours = (Date.now() - new Date(report.createdAt).getTime()) / 36e5;
  const { score, priority } = scoreReport(report.analysis, duplicateCount, ageHours);
  return { priorityScore: score, priority };
}
