import { NextRequest, NextResponse } from "next/server";
import Portkey from "portkey-ai";
import { RUBRIC_SYSTEM_PROMPT, RUBRIC_USER_PROMPT } from "@/lib/prompts";

const portkey = new Portkey({
  apiKey: process.env.PORTKEY_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    let customSystemPrompt: string | null = null;
    let customUserPrompt: string | null = null;
    let textContent: string | null = null;
    let fileBase64: string | null = null;
    let fileMimeType: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const pastedText = formData.get("text") as string | null;
      customSystemPrompt = formData.get("systemPrompt") as string | null;
      customUserPrompt = formData.get("userPrompt") as string | null;

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

    const systemPrompt = customSystemPrompt?.trim() || RUBRIC_SYSTEM_PROMPT;
    const userPromptTemplate = customUserPrompt?.trim() || RUBRIC_USER_PROMPT;

    // Build the user message — multimodal for files, plain text otherwise
    type ContentPart =
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } };

    let userContent: string | ContentPart[];

    if (fileBase64 && fileMimeType) {
      const userText = userPromptTemplate.replace(
        "{textContent}",
        "[See attached document]"
      );
      userContent = [
        { type: "text", text: userText },
        {
          type: "image_url",
          image_url: {
            url: `data:${fileMimeType};base64,${fileBase64}`,
          },
        },
      ];
    } else {
      userContent = userPromptTemplate.replace("{textContent}", textContent!);
    }

    const response = await portkey.chat.completions.create({
      model: "@vertex-ai-shared/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const responseText = typeof raw === "string" ? raw : JSON.stringify(raw);

    // Try to parse as JSON — model may wrap it in ```json ... ```
    let parsed;
    try {
      const cleaned = responseText
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { raw: responseText };
    }

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    console.error("parse-rubric error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
