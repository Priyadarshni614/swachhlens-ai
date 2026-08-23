export const WASTE_TYPES = [
  "overflowing_bin",
  "garbage_dump",
  "plastic_waste",
  "construction_debris",
  "organic_waste",
  "e_waste",
  "hazardous_waste",
  "drain_blockage",
] as const;

export type WasteType = (typeof WASTE_TYPES)[number];

export const WASTE_LABEL: Record<WasteType, string> = {
  overflowing_bin: "Overflowing bin",
  garbage_dump: "Illegal garbage dump",
  plastic_waste: "Plastic waste",
  construction_debris: "Construction debris",
  organic_waste: "Organic / wet waste",
  e_waste: "E-waste",
  hazardous_waste: "Hazardous waste",
  drain_blockage: "Drain blockage",
};

export const VOLUME_CLASSES = ["small", "medium", "large", "very_large"] as const;
export type VolumeClass = (typeof VOLUME_CLASSES)[number];

export const VOLUME_LABEL: Record<VolumeClass, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  very_large: "Very large",
};

export type Priority = "routine" | "elevated" | "urgent" | "critical";

export const PRIORITY_LABEL: Record<Priority, string> = {
  routine: "Routine",
  elevated: "Elevated",
  urgent: "Urgent",
  critical: "Critical",
};

export type ReportStatus = "new" | "assigned" | "in_progress" | "resolved";

export const STATUS_LABEL: Record<ReportStatus, string> = {
  new: "New",
  assigned: "Assigned",
  in_progress: "Cleanup on-site",
  resolved: "Resolved",
};

export type Analysis = {
  wasteType: WasteType;
  secondaryTypes: WasteType[];
  confidence: number;
  volumeClass: VolumeClass;
  volumeCubicMetres: number;
  scaleReference: string;
  recyclableShare: number;
  blocksDrainage: boolean;
  healthRisk: "low" | "moderate" | "high";
  summary: string;
};

export type Visibility = "public" | "anonymous" | "private";

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: "Public",
  anonymous: "Anonymous",
  private: "Private",
};

export const VISIBILITY_HINT: Record<Visibility, string> = {
  public: "Your name is shown with this complaint in the city feed.",
  anonymous: "Visible in the city feed, but your name is hidden.",
  private: "Only you and you alone can see this complaint.",
};

export type AiFeedback = {
  verdict: "correct" | "wrong";
  correctedType?: WasteType;
  note?: string;
  at: string;
};

export type ReportEvent = {
  status: ReportStatus;
  note: string;
  createdAt: string;
};

export type WasteReport = {
  id: string;
  rowId?: string;
  createdAt: string;
  imageDataUrl: string;
  comment: string;
  location: { lat: number; lng: number; label: string };
  analysis: Analysis;
  priority: Priority;
  priorityScore: number;
  dispatch: Dispatch;
  status: ReportStatus;
  duplicateOf?: string;
  duplicateCount: number;
  visibility: Visibility;
  reporterName?: string | null;
  feedback?: AiFeedback | null;
  events?: ReportEvent[];
  mine?: boolean;
};

export type Dispatch = {
  team: string;
  crewSize: number;
  vehicle: string;
  estimatedMinutes: number;
  recyclingRoute: string;
};

const VOLUME_WEIGHT: Record<VolumeClass, number> = {
  small: 12,
  medium: 26,
  large: 40,
  very_large: 52,
};

const TYPE_WEIGHT: Record<WasteType, number> = {
  hazardous_waste: 34,
  drain_blockage: 30,
  garbage_dump: 22,
  overflowing_bin: 18,
  e_waste: 20,
  construction_debris: 14,
  organic_waste: 16,
  plastic_waste: 12,
};

/** Deterministic priority score (0-100) derived from the AI analysis. */
export function scoreReport(analysis: Analysis, duplicateCount: number, ageHours: number) {
  const risk = analysis.healthRisk === "high" ? 16 : analysis.healthRisk === "moderate" ? 8 : 0;
  const drain = analysis.blocksDrainage ? 12 : 0;
  const repeat = Math.min(duplicateCount * 5, 15);
  const age = Math.min(Math.floor(ageHours / 12) * 4, 12);
  const score = Math.min(
    100,
    Math.round(VOLUME_WEIGHT[analysis.volumeClass] + TYPE_WEIGHT[analysis.wasteType] + risk + drain + repeat + age),
  );
  const priority: Priority =
    score >= 80 ? "critical" : score >= 62 ? "urgent" : score >= 45 ? "elevated" : "routine";
  return { score, priority };
}

/** Rule-based dispatch planning: team, crew, vehicle, ETA, recycling route. */
export function planDispatch(analysis: Analysis): Dispatch {
  const { wasteType, volumeClass, volumeCubicMetres, recyclableShare } = analysis;

  let team = "Ward sanitation crew";
  let vehicle = "Compactor auto-tipper (1.5 t)";
  let crewSize = 2;

  if (wasteType === "hazardous_waste" || wasteType === "e_waste") {
    team = "Hazardous & e-waste cell";
    vehicle = "Sealed hazmat van + PPE kit";
    crewSize = 3;
  } else if (wasteType === "construction_debris") {
    team = "C&D debris squad";
    vehicle = "Tipper truck (9 t) + JCB";
    crewSize = 4;
  } else if (wasteType === "drain_blockage") {
    team = "Storm-water drainage unit";
    vehicle = "Jetting-cum-suction machine";
    crewSize = 4;
  } else if (wasteType === "garbage_dump") {
    team = "Bulk waste removal team";
    vehicle = "Tipper truck (7 t)";
    crewSize = 3;
  }

  if (volumeClass === "large") crewSize += 1;
  if (volumeClass === "very_large") {
    crewSize += 2;
    if (vehicle.startsWith("Compactor")) vehicle = "Tipper truck (7 t) + compactor";
  }

  const estimatedMinutes = Math.max(
    20,
    Math.round((volumeCubicMetres * 14) / crewSize + (wasteType === "drain_blockage" ? 45 : 15)),
  );

  const recyclingRoute =
    recyclableShare >= 0.4
      ? "Route A — Material recovery facility (dry segregation)"
      : wasteType === "organic_waste"
        ? "Route B — Wet waste composting plant"
        : wasteType === "construction_debris"
          ? "Route C — C&D recycling plant"
          : wasteType === "hazardous_waste" || wasteType === "e_waste"
            ? "Route D — Authorised treatment & disposal facility"
            : "Route E — Transfer station, then landfill";

  return { team, crewSize, vehicle, estimatedMinutes, recyclingRoute };
}

export const WASTE_FAMILY: Record<WasteType, string> = {
  overflowing_bin: "mixed_municipal",
  garbage_dump: "mixed_municipal",
  organic_waste: "mixed_municipal",
  plastic_waste: "dry_recoverable",
  e_waste: "regulated",
  hazardous_waste: "regulated",
  construction_debris: "debris",
  drain_blockage: "drainage",
};

const FAMILY_RADIUS: Record<string, number> = {
  mixed_municipal: 130,
  dry_recoverable: 110,
  regulated: 90,
  debris: 180,
  drainage: 160,
};

const VOLUME_RADIUS_BONUS: Record<VolumeClass, number> = {
  small: 0,
  medium: 20,
  large: 45,
  very_large: 80,
};

export type DuplicateMatch = {
  report: WasteReport;
  distanceMetres: number;
  hoursApart: number;
  sameType: boolean;
  confidence: number;
};

/**
 * Duplicate detection: geo + time + waste-family similarity, with a radius that
 * widens for bulky waste. Exact type matches merge over a wider ring than
 * same-family matches, so a debris pile and a bin overflow never collapse.
 */
export function findDuplicateMatch(
  reports: WasteReport[],
  candidate: {
    location: { lat: number; lng: number };
    wasteType: WasteType;
    volumeClass?: VolumeClass;
    createdAt: string;
  },
): DuplicateMatch | null {
  const family = WASTE_FAMILY[candidate.wasteType];
  const baseRadius =
    (FAMILY_RADIUS[family] ?? 120) + VOLUME_RADIUS_BONUS[candidate.volumeClass ?? "medium"];

  const matches: DuplicateMatch[] = [];
  for (const r of reports) {
    if (r.status === "resolved" || r.duplicateOf) continue;
    const sameType = r.analysis.wasteType === candidate.wasteType;
    const sameFamily = WASTE_FAMILY[r.analysis.wasteType] === family;
    if (!sameType && !sameFamily) continue;

    const hoursApart =
      Math.abs(new Date(candidate.createdAt).getTime() - new Date(r.createdAt).getTime()) / 36e5;
    const window = sameType ? 72 : 36;
    if (hoursApart > window) continue;

    const metres = distanceMetres(r.location, candidate.location);
    const radius = sameType ? baseRadius : baseRadius * 0.6;
    if (metres > radius) continue;

    const proximity = 1 - metres / radius;
    const freshness = 1 - hoursApart / window;
    const confidence = Math.min(
      0.99,
      Math.round((0.45 * proximity + 0.25 * freshness + (sameType ? 0.3 : 0.12)) * 100) / 100,
    );
    matches.push({ report: r, distanceMetres: Math.round(metres), hoursApart, sameType, confidence });
  }

  if (!matches.length) return null;
  matches.sort((a, b) => b.confidence - a.confidence);
  const best = matches[0]!;
  return best.confidence >= 0.45 ? best : null;
}

/** Back-compat helper returning just the duplicate report. */
export function findDuplicate(
  reports: WasteReport[],
  candidate: {
    location: { lat: number; lng: number };
    wasteType: WasteType;
    volumeClass?: VolumeClass;
    createdAt: string;
  },
) {
  return findDuplicateMatch(reports, candidate)?.report;
}

export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Hotspot = {
  key: string;
  label: string;
  reports: WasteReport[];
  score: number;
  centre: { lat: number; lng: number };
};

/** Cluster open reports into hotspots (~250 m grid). */
export function buildHotspots(reports: WasteReport[]): Hotspot[] {
  const open = reports.filter((r) => r.status !== "resolved" && !r.duplicateOf);
  const groups = new Map<string, WasteReport[]>();
  for (const r of open) {
    const key = `${r.location.lat.toFixed(3)}:${r.location.lng.toFixed(3)}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      label: group[0]!.location.label,
      reports: group,
      score: Math.round(
        group.reduce((sum, r) => sum + r.priorityScore, 0) / group.length + (group.length - 1) * 6,
      ),
      centre: {
        lat: group.reduce((s, r) => s + r.location.lat, 0) / group.length,
        lng: group.reduce((s, r) => s + r.location.lng, 0) / group.length,
      },
    }))
    .sort((a, b) => b.score - a.score);
}

export function timeAgo(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
