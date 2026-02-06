"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RubricResultView } from "./rubric-result-view";
import { useRunHistory } from "@/lib/run-history-context";
import { RUBRIC_SYSTEM_PROMPT, RUBRIC_USER_PROMPT } from "@/lib/prompts";
import type { RunRecord } from "@/lib/types";

interface RunComparisonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function isDefaultPrompts(system: string, user: string) {
  return system === RUBRIC_SYSTEM_PROMPT && user === RUBRIC_USER_PROMPT;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function RunColumn({ run }: { run: RunRecord }) {
  const [showPrompts, setShowPrompts] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* Run metadata */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatTime(run.timestamp)}
          </span>
          <Badge
            variant={
              isDefaultPrompts(run.prompts.system, run.prompts.user)
                ? "secondary"
                : "outline"
            }
            className="text-[10px]"
          >
            {isDefaultPrompts(run.prompts.system, run.prompts.user)
              ? "Default Prompts"
              : "Custom Prompts"}
          </Badge>
        </div>
        <p className="truncate text-sm font-medium">
          {run.input.fileName ?? run.input.textSnippet ?? "Unknown input"}
        </p>
      </div>

      <Separator />

      {/* Result or error */}
      {run.error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {run.error}
        </div>
      ) : run.result ? (
        <RubricResultView result={run.result} />
      ) : (
        <p className="text-sm text-muted-foreground">No result</p>
      )}

      <Separator />

      {/* Collapsible prompt text */}
      <button
        type="button"
        onClick={() => setShowPrompts(!showPrompts)}
        className="text-left text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {showPrompts ? "Hide Prompts" : "Show Prompts"}
      </button>
      {showPrompts && (
        <div className="space-y-2">
          <div>
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">
              System Prompt
            </p>
            <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-[11px] whitespace-pre-wrap">
              {run.prompts.system}
            </pre>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">
              User Prompt
            </p>
            <pre className="max-h-40 overflow-auto rounded bg-muted p-2 text-[11px] whitespace-pre-wrap">
              {run.prompts.user}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function RunComparison({ open, onOpenChange }: RunComparisonProps) {
  const { runs, selectedForCompare } = useRunHistory();
  const [a, b] = selectedForCompare;

  const runA = runs.find((r) => r.id === a);
  const runB = runs.find((r) => r.id === b);

  if (!runA || !runB) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-full max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Compare Runs</DialogTitle>
          <DialogDescription>
            Side-by-side comparison of two rubric parsing runs.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div className="grid grid-cols-2 gap-6 pr-4">
            <RunColumn run={runA} />
            <RunColumn run={runB} />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
