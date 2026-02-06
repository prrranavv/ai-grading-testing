"use client";

import type { ReactNode } from "react";
import { RunHistoryProvider } from "@/lib/run-history-context";
import { AppSidebar } from "./app-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RunHistoryProvider>
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </RunHistoryProvider>
  );
}
