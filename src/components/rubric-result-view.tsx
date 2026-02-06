"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RubricResult, RubricCriterion } from "@/lib/types";

function getColumnHeaders(rubricTable: RubricCriterion[]): string[] {
  const cols = new Set<string>();
  for (const criterion of rubricTable) {
    for (const level of criterion.levels) {
      cols.add(level.columnName ?? "");
    }
  }
  return Array.from(cols);
}

export function RubricResultView({ result }: { result: RubricResult }) {
  const [viewMode, setViewMode] = useState<"table" | "json">("table");

  return (
    <div className="space-y-3">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <Label>Result</Label>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === "table"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode("json")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === "json"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            JSON
          </button>
        </div>
      </div>

      {viewMode === "table" && result.rubricTable ? (
        <div className="space-y-3">
          {/* Rubric name and metadata */}
          {result.name && (
            <p className="text-sm font-semibold">{result.name}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {result.subject?.map((s) => (
              <Badge key={s} variant="secondary">
                {s}
              </Badge>
            ))}
            {result.grade?.map((g) => (
              <Badge key={g} variant="outline">
                Grade {g}
              </Badge>
            ))}
          </div>

          {/* Rubric table: criteria (rows) × score levels (columns) */}
          <div className="overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Criterion</TableHead>
                  {getColumnHeaders(result.rubricTable).map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rubricTable.map((criterion, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium align-top">
                      {criterion.criterionName}
                    </TableCell>
                    {criterion.levels.length > 0 ? (
                      getColumnHeaders(result.rubricTable!).map((col) => {
                        const level = criterion.levels.find(
                          (l) => (l.columnName ?? "") === col
                        );
                        return (
                          <TableCell key={col} className="align-top">
                            {level ? (
                              <div>
                                <Badge variant="secondary" className="mb-1">
                                  {level.maxScore}
                                </Badge>
                                <p className="text-muted-foreground text-xs mt-1">
                                  {level.basisForEvaluation}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      })
                    ) : (
                      <TableCell
                        colSpan={getColumnHeaders(result.rubricTable!).length}
                        className="text-muted-foreground italic"
                      >
                        No scoring levels extracted
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
