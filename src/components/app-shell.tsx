"use client";

import { useEffect, type ReactNode } from "react";
import { RunHistoryProvider } from "@/lib/run-history-context";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    void fetch(`/api/wayground/session/init?force=1&t=${Date.now()}`, {
      cache: "no-store",
    }).catch(() => {
      // Session bootstrap is best-effort; CRUD pages surface errors if auth fails.
    });
  }, []);

  return (
    <RunHistoryProvider>
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </RunHistoryProvider>
  );
}
