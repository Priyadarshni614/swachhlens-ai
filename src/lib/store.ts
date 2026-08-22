import { useCallback, useEffect, useState } from "react";
import {
  buildHotspots,
  findDuplicate,
  planDispatch,
  scoreReport,
  type Analysis,
  type ReportStatus,
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

function read(): WasteReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      const initial = seed();
      window.localStorage.setItem(KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as WasteReport[];
  } catch {
    return [];
  }
}

function write(reports: WasteReport[]) {
  window.localStorage.setItem(KEY, JSON.stringify(reports));
  window.dispatchEvent(new Event(EVENT));
}

export function useReports() {
  const [reports, setReports] = useState<WasteReport[]>([]);

  useEffect(() => {
    const sync = () => setReports(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addReport = useCallback(
    (input: {
      imageDataUrl: string;
      comment: string;
      location: { lat: number; lng: number; label: string };
      analysis: Analysis;
    }) => {
      const current = read();
      const createdAt = new Date().toISOString();
      const dup = findDuplicate(current, {
        location: input.location,
        wasteType: input.analysis.wasteType,
        createdAt,
      });
      const duplicateCount = dup ? dup.duplicateCount + 1 : 0;
      const { score, priority } = scoreReport(input.analysis, duplicateCount, 0);
      const report: WasteReport = {
        id: `SL-${Date.now().toString().slice(-8)}`,
        createdAt,
        imageDataUrl: input.imageDataUrl,
        comment: input.comment,
        location: input.location,
        analysis: input.analysis,
        priority,
        priorityScore: score,
        dispatch: planDispatch(input.analysis),
        status: "new",
        duplicateCount: 0,
        ...(dup ? { duplicateOf: dup.id } : {}),
      };
      const next = current.map((r) =>
        dup && r.id === dup.id
          ? {
              ...r,
              duplicateCount,
              ...scoreReportInto(r, duplicateCount),
            }
          : r,
      );
      write([report, ...next]);
      return report;
    },
    [],
  );

  const setStatus = useCallback((id: string, status: ReportStatus) => {
    write(read().map((r) => (r.id === id ? { ...r, status } : r)));
  }, []);

  const reset = useCallback(() => {
    window.localStorage.removeItem(KEY);
    write(read());
  }, []);

  return { reports, addReport, setStatus, reset, hotspots: buildHotspots(reports) };
}

function scoreReportInto(report: WasteReport, duplicateCount: number) {
  const ageHours = (Date.now() - new Date(report.createdAt).getTime()) / 36e5;
  const { score, priority } = scoreReport(report.analysis, duplicateCount, ageHours);
  return { priorityScore: score, priority };
}
