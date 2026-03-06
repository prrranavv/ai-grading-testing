import { NextRequest, NextResponse } from "next/server";
import { waygroundRequest } from "@/lib/wayground";

type Params = { params: Promise<{ id: string }> };

function isRouteMismatchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("no route matching this path found") ||
    message.includes("failed with 404")
  );
}

async function updateRubricWithFallbacks(id: string, body: unknown) {
  const payload = JSON.stringify(body);
  const attempts: Array<{ path: string; method: "POST" | "PUT" | "PATCH" }> = [
    { path: `/v2/rubric/${id}`, method: "POST" },
    { path: `/v2/rubric/${id}`, method: "PUT" },
    { path: `/v2/rubric/${id}`, method: "PATCH" },
    { path: `/v2/rubric/update-rubric/${id}`, method: "POST" },
    { path: `/v2/rubric/update-rubric?id=${id}`, method: "POST" },
    { path: `/v2/rubric/add-rubric/${id}`, method: "POST" },
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      return await waygroundRequest(attempt.path, {
        method: attempt.method,
        body: payload,
      });
    } catch (error) {
      lastError = error;
      if (!isRouteMismatchError(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Failed to update rubric");
}

export async function GET(_req: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const data = await waygroundRequest(`/v2/rubric/${id}`, {
      method: "GET",
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch rubric";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const data = await updateRubricWithFallbacks(id, body);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to update rubric";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const data = await waygroundRequest(`/v2/rubric/${id}`, {
      method: "DELETE",
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to delete rubric";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
