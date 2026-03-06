import { NextRequest, NextResponse } from "next/server";
import Portkey from "portkey-ai";
import {
  STATE_RUBRIC_SYSTEM_PROMPT,
  STATE_RUBRIC_USER_PROMPT,
} from "@/lib/prompts";
import type { StateRubricResult, StateRubricTable } from "@/lib/types";

const portkey = new Portkey({
  apiKey: process.env.PORTKEY_API_KEY!,
});

const ALLOWED_SUBJECTS = new Set(["English", "Science", "Social Studies"]);

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const arr = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}

function formatBasisForEvaluation(value: string): string {
  const normalized = value
    .replace(/\\n/g, "\n")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!normalized) return "";

  const splitForBullets = normalized.replace(/\s*•\s*/g, "\n");
  const parts = splitForBullets
    .split("\n")
    .map((part) => part.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);

  if (parts.length <= 1) return parts[0] ?? "";
  return parts.map((part) => `• ${part}`).join(" ");
}

function normalizeRubricTable(value: unknown): StateRubricTable | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const table: StateRubricTable = {};

  for (const [criterion, levels] of entries) {
    const criterionName = criterion.trim();
    if (!criterionName || !Array.isArray(levels)) continue;

    const normalizedLevels = levels
      .map((level) => {
        if (!level || typeof level !== "object") return null;
        const obj = level as Record<string, unknown>;
        const basisForEvaluation =
          typeof obj.basisForEvaluation === "string"
            ? formatBasisForEvaluation(obj.basisForEvaluation)
            : "";
        const parsedScore =
          typeof obj.maxScore === "number"
            ? obj.maxScore
            : typeof obj.maxScore === "string"
              ? Number(obj.maxScore)
              : Number.NaN;
        const columnName =
          typeof obj.columnName === "string" ? obj.columnName.trim() : undefined;

        if (!basisForEvaluation || Number.isNaN(parsedScore)) return null;

        return {
          basisForEvaluation,
          ...(columnName ? { columnName } : {}),
          maxScore: parsedScore,
        };
      })
      .filter((level): level is NonNullable<typeof level> => level !== null);

    table[criterionName] = normalizedLevels;
  }

  return table;
}

function normalizeResult(value: unknown): StateRubricResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { raw: typeof value === "string" ? value : JSON.stringify(value) };
  }

  const obj = value as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name.trim() : undefined;
  const subject = toStringArray(obj.subject)?.filter((s) =>
    ALLOWED_SUBJECTS.has(s)
  );

  const result: StateRubricResult = {
    ...(name ? { name } : {}),
    ...(toStringArray(obj.state) ? { state: toStringArray(obj.state) } : {}),
    ...(toStringArray(obj.country)
      ? { country: toStringArray(obj.country) }
      : {}),
    src: typeof obj.src === "string" ? obj.src : "",
    ...(subject && subject.length > 0 ? { subject } : {}),
    ...(toStringArray(obj.grade) ? { grade: toStringArray(obj.grade) } : {}),
    ...(normalizeRubricTable(obj.rubricTable)
      ? { rubricTable: normalizeRubricTable(obj.rubricTable) }
      : {}),
  };

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    let textContent: string | null = null;
    let fileBase64: string | null = null;
    let fileMimeType: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const pastedText = formData.get("text") as string | null;

      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        fileBase64 = buffer.toString("base64");
        fileMimeType = file.type || "application/octet-stream";
      } else if (pastedText && pastedText.trim().length > 0) {
        textContent = pastedText.trim();
      } else {
        return NextResponse.json(
          { error: "No file or text provided" },
          { status: 400 }
        );
      }
    } else {
      const body = await req.json();
      if (!body.text || body.text.trim().length === 0) {
        return NextResponse.json(
          { error: "No text provided" },
          { status: 400 }
        );
      }
      textContent = body.text.trim();
    }

    type ContentPart =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } };

    let userContent: string | ContentPart[];
    if (fileBase64 && fileMimeType) {
      userContent = [
        {
          type: "text",
          text: STATE_RUBRIC_USER_PROMPT.replace(
            "{textContent}",
            "[See attached document]"
          ),
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${fileMimeType};base64,${fileBase64}`,
          },
        },
      ];
    } else {
      userContent = STATE_RUBRIC_USER_PROMPT.replace("{textContent}", textContent!);
    }

    const response = await portkey.chat.completions.create({
      model: "@vertex-ai-shared/gemini-2.5-flash",
      messages: [
        { role: "system", content: STATE_RUBRIC_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const responseText = typeof raw === "string" ? raw : JSON.stringify(raw);

    try {
      const cleaned = responseText
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      return NextResponse.json(normalizeResult(parsed));
    } catch {
      return NextResponse.json({ raw: responseText });
    }
  } catch (error: unknown) {
    console.error("parse-state-rubric error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
