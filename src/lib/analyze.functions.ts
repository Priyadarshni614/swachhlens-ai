import { createServerFn } from "@tanstack/react-start";
import { streamText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  imageDataUrl: z.string().min(20),
  comment: z.string().default(""),
});

const AnalysisSchema = z.object({
  wasteType: z.enum([
    "overflowing_bin",
    "garbage_dump",
    "plastic_waste",
    "construction_debris",
    "organic_waste",
    "e_waste",
    "hazardous_waste",
    "drain_blockage",
  ]),
  secondaryTypes: z.array(z.string()),
  confidence: z.number(),
  volumeClass: z.enum(["small", "medium", "large", "very_large"]),
  volumeCubicMetres: z.number(),
  scaleReference: z.string(),
  recyclableShare: z.number(),
  blocksDrainage: z.boolean(),
  healthRisk: z.enum(["low", "moderate", "high"]),
  summary: z.string(),
});

const SYSTEM = `You are the vision engine of SwachhLens, a municipal waste-response decision support system in urban India.
Analyse the citizen photo and return one structured assessment.
Rules:
- wasteType is the single dominant issue. secondaryTypes lists other waste categories visible, using the same category ids, at most 3 entries.
- confidence is 0 to 1.
- Estimate volume by detecting the waste region and comparing it against visible scale references (bins, people, kerbs, tyres, doors, bricks). Name that reference in scaleReference in under 12 words.
- volumeCubicMetres is your numeric estimate of loose waste volume. Map it: small under 0.5, medium 0.5 to 2, large 2 to 8, very_large above 8.
- recyclableShare is 0 to 1: the fraction that is dry recoverable material.
- blocksDrainage is true when waste sits in or against a drain, nala, or water body.
- summary is one field-ops sentence under 22 words for the cleanup supervisor.
If the photo shows no waste, still pick the closest category, set confidence below 0.3 and say so in the summary.`;

export const analyzeWaste = createServerFn({ method: "POST" })
  .validator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const gateway = createLovableAiGatewayProvider(key);

    try {
      const result = streamText({
        model: gateway("google/gemini-3.7-flash"),
        system: SYSTEM,
        output: Output.object({ schema: AnalysisSchema }),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: data.comment
                  ? `Citizen comment: ${data.comment}`
                  : "Assess this citizen-submitted waste photo.",
              },
              {
                type: "file",
                mediaType: data.imageDataUrl.slice(5, data.imageDataUrl.indexOf(";")) || "image/jpeg",
                data: data.imageDataUrl,
              },
            ],
          },
        ],
      });
      return normalize(await result.output);
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const raw = error.text ?? "";
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = AnalysisSchema.safeParse(JSON.parse(match[0]));
          if (parsed.success) return normalize(parsed.data);
        }
      }
      throw error;
    }
  });

function normalize(a: z.infer<typeof AnalysisSchema>) {
  const clamp = (n: number, min: number, max: number) =>
    Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
  return {
    ...a,
    confidence: clamp(a.confidence, 0, 1),
    recyclableShare: clamp(a.recyclableShare, 0, 1),
    volumeCubicMetres: clamp(Number(a.volumeCubicMetres.toFixed(2)), 0.05, 200),
    secondaryTypes: a.secondaryTypes.slice(0, 3),
    summary: a.summary.slice(0, 180),
    scaleReference: a.scaleReference.slice(0, 90),
  };
}
