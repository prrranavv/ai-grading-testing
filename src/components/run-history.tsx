"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useRunHistory, useRunHistoryDispatch } from "@/lib/run-history-context";
import { RUBRIC_SYSTEM_PROMPT, RUBRIC_USER_PROMPT } from "@/lib/prompts";

interface RunHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompare: () => void;
  canCompare: boolean;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RunHistorySheet({
  open,
  onOpenChange,
  onCompare,
  canCompare,
}: RunHistorySheetProps) {
  const { runs, selectedForCompare } = useRunHistory();
  const dispatch = useRunHistoryDispatch();

  function toggleSelect(runId: string) {
    const [a, b] = selectedForCompare;
    if (a === runId) {
      dispatch({ type: "SET_COMPARE_SELECTION", selection: [b, null] });
    } else if (b === runId) {
      dispatch({ type: "SET_COMPARE_SELECTION", selection: [a, null] });
    } else if (a === null) {
      dispatch({ type: "SET_COMPARE_SELECTION", selection: [runId, b] });
    } else if (b === null) {
      dispatch({ type: "SET_COMPARE_SELECTION", selection: [a, runId] });
    } else {
      // Both slots full — replace second
      dispatch({ type: "SET_COMPARE_SELECTION", selection: [a, runId] });
    }
  }

  function isSelected(runId: string) {
    return selectedForCompare[0] === runId || selectedForCompare[1] === runId;
  }

  function isDefaultPrompts(system: string, user: string) {
    return system === RUBRIC_SYSTEM_PROMPT && user === RUBRIC_USER_PROMPT;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>Run History</SheetTitle>
          <SheetDescription>
            Select up to 2 runs to compare side by side.
          </SheetDescription>
        </SheetHeader>

        {runs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No runs yet. Parse a rubric to get started.
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-2 pb-4">
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => toggleSelect(run.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    isSelected(run.id)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(run.timestamp)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {run.error && (
                        <Badge variant="destructive" className="text-[10px]">
                          Error
                        </Badge>
                      )}
                      <Badge
                        variant={
                          isDefaultPrompts(
                            run.prompts.system,
                            run.prompts.user
                          )
                            ? "secondary"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {isDefaultPrompts(run.prompts.system, run.prompts.user)
                          ? "Default"
                          : "Custom"}
                      </Badge>
                      {isSelected(run.id) && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {selectedForCompare[0] === run.id ? "1" : "2"}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">
                    {run.input.fileName ??
                      run.input.textSnippet ??
                      "Unknown input"}
                  </p>
                  {run.result?.name && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {run.result.name}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {runs.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: "CLEAR_HISTORY" })}
              >
                Clear All
              </Button>
              <Button size="sm" disabled={!canCompare} onClick={onCompare}>
                Compare Selected
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
