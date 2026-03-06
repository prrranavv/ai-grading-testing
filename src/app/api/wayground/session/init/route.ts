import { NextResponse } from "next/server";
import { initializeWaygroundSession } from "@/lib/wayground";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const force = req.nextUrl.searchParams.get("force") !== "0";
    await initializeWaygroundSession(force);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to initialize session";
    return NextResponse.json({ success: false, error: message });
  }
}
