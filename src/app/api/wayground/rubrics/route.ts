import { NextRequest, NextResponse } from "next/server";
import { waygroundRequest } from "@/lib/wayground";

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? "50");
    const skip = Number(req.nextUrl.searchParams.get("skip") ?? "0");
    const data = await waygroundRequest(
      `/v2/rubric/get-all-rubrics?limit=${limit}&skip=${skip}`,
      {
        method: "GET",
      }
    );
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch rubrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await waygroundRequest("/v2/rubric/add-rubric", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to add rubric";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
