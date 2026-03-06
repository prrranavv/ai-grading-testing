"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import type { StateRubricLevel, StateRubricResult } from "@/lib/types";

const ALLOWED_SUBJECTS = ["English", "Science", "Social Studies"] as const;

function parseCsv(value: string): string[] | undefined {
  const parsed = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : undefined;
}

function toCsv(value?: string[]): string {
  return value?.join(", ") ?? "";
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

function normalizeDraft(input: StateRubricResult): StateRubricResult {
  const formattedRubricTable = Object.fromEntries(
    Object.entries(input.rubricTable ?? {}).map(([criterionName, levels]) => [
      criterionName,
      levels.map((level) => ({
        ...level,
        basisForEvaluation: formatBasisForEvaluation(level.basisForEvaluation),
      })),
    ])
  );

  return {
    ...input,
    src: input.src ?? "",
    rubricTable: formattedRubricTable,
  };
}

function cloneRubricTable(result: StateRubricResult) {
  return structuredClone(result.rubricTable ?? {});
}

interface MatrixColumn {
  key: string;
  label: string;
  maxScore: number | null;
}

function getMatrixColumns(
  rubricTable: NonNullable<StateRubricResult["rubricTable"]>
): MatrixColumn[] {
  const map = new Map<string, MatrixColumn>();

  for (const levels of Object.values(rubricTable)) {
    for (const level of levels) {
      const label = (level.columnName ?? "").trim();
      const score = Number.isFinite(level.maxScore) ? level.maxScore : null;
      const key = `${label}::${score ?? "na"}`;
      if (!map.has(key)) {
        map.set(key, { key, label: label || (score !== null ? `${score}` : "—"), maxScore: score });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const aScore = a.maxScore ?? Number.NEGATIVE_INFINITY;
    const bScore = b.maxScore ?? Number.NEGATIVE_INFINITY;
    if (aScore !== bScore) return bScore - aScore;
    return a.label.localeCompare(b.label);
  });
}

function matchLevel(levels: StateRubricLevel[], col: MatrixColumn): StateRubricLevel | undefined {
  return levels.find((level) => {
    const label = (level.columnName ?? "").trim();
    const score = Number.isFinite(level.maxScore) ? level.maxScore : null;
    return `${label}::${score ?? "na"}` === col.key;
  });
}

export function StateRubricResultEditor({
  result,
  onChange,
  title = "Parsed State Rubric (Editable)",
  isEditing,
  onEditToggle,
  showEditToggle = true,
  showPreviewMatrix = true,
}: {
  result: StateRubricResult;
  onChange?: (next: StateRubricResult) => void;
  title?: string;
  isEditing?: boolean;
  onEditToggle?: (next: boolean) => void;
  showEditToggle?: boolean;
  showPreviewMatrix?: boolean;
}) {
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [internalEditing, setInternalEditing] = useState(false);
  const [draft, setDraft] = useState<StateRubricResult>(() => normalizeDraft(result));
  const [jsonText, setJsonText] = useState(
    JSON.stringify(normalizeDraft(result), null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const criteria = useMemo(
    () => Object.entries(draft.rubricTable ?? {}),
    [draft.rubricTable]
  );
  const matrixColumns = useMemo(
    () => getMatrixColumns(draft.rubricTable ?? {}),
    [draft.rubricTable]
  );
  const editing = isEditing ?? internalEditing;

  function setEditing(next: boolean) {
    if (isEditing === undefined) {
      setInternalEditing(next);
    }
    if (!next) {
      setDetailsOpen(false);
    }
    onEditToggle?.(next);
  }

  function commit(next: StateRubricResult) {
    setDraft(next);
    setJsonText(JSON.stringify(next, null, 2));
    onChange?.(next);
  }

  function setField(field: keyof StateRubricResult, value: unknown) {
    const next = { ...draft, [field]: value } as StateRubricResult;
    commit(next);
  }

  function updateLevel(
    criterionName: string,
    levelIndex: number,
    patch: Partial<StateRubricLevel>
  ) {
    const table = cloneRubricTable(draft);
    const levels = table[criterionName] ?? [];
    const current = levels[levelIndex];
    if (!current) return;
    const normalizedPatch =
      patch.basisForEvaluation === undefined
        ? patch
        : {
            ...patch,
            basisForEvaluation: formatBasisForEvaluation(
              patch.basisForEvaluation
            ),
          };
    levels[levelIndex] = { ...current, ...normalizedPatch };
    const next = { ...draft, rubricTable: table };
    commit(next);
  }

  function addCriterion() {
    const table = cloneRubricTable(draft);
    let nextName = "New Criterion";
    let suffix = 2;
    while (table[nextName]) {
      nextName = `New Criterion ${suffix}`;
      suffix += 1;
    }
    table[nextName] = [];
    const next = { ...draft, rubricTable: table };
    commit(next);
  }

  function renameCriterion(oldName: string, newNameRaw: string) {
    const newName = newNameRaw.trim();
    if (!newName || oldName === newName) return;
    const table = cloneRubricTable(draft);
    if (!table[oldName] || table[newName]) return;

    const reordered = Object.entries(table).reduce<Record<string, StateRubricLevel[]>>(
      (acc, [name, levels]) => {
        acc[name === oldName ? newName : name] = levels;
        return acc;
      },
      {}
    );

    const next = { ...draft, rubricTable: reordered };
    commit(next);
  }

  function removeCriterion(criterionName: string) {
    const table = cloneRubricTable(draft);
    delete table[criterionName];
    const next = { ...draft, rubricTable: table };
    commit(next);
  }

  function addLevel(criterionName: string) {
    const table = cloneRubricTable(draft);
    const levels = table[criterionName] ?? [];
    levels.push({
      basisForEvaluation: "",
      maxScore: 0,
    });
    table[criterionName] = levels;
    const next = { ...draft, rubricTable: table };
    commit(next);
  }

  function removeLevel(criterionName: string, levelIndex: number) {
    const table = cloneRubricTable(draft);
    const levels = table[criterionName] ?? [];
    table[criterionName] = levels.filter((_, idx) => idx !== levelIndex);
    const next = { ...draft, rubricTable: table };
    commit(next);
  }

  function applyJsonEdits() {
    try {
      const parsed = JSON.parse(jsonText) as StateRubricResult;
      const normalized = normalizeDraft(parsed);
      commit(normalized);
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "Invalid JSON");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>{title}</Label>
        <div className="flex items-center gap-2">
          {showEditToggle && (
            <Button
              variant={editing ? "outline" : "default"}
              size="sm"
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Done Editing" : "Edit Rubric"}
            </Button>
          )}
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
      </div>

      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="text-lg font-semibold">
          {draft.name?.trim() || "Untitled Rubric"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(draft.subject ?? []).map((item) => (
            <Badge key={`subject-${item}`} variant="secondary">
              {item}
            </Badge>
          ))}
          {(draft.grade ?? []).map((item) => (
            <Badge key={`grade-${item}`} variant="outline">
              Grade {item}
            </Badge>
          ))}
          {(draft.state ?? []).map((item) => (
            <Badge key={`state-${item}`} variant="outline">
              {item}
            </Badge>
          ))}
          {(draft.country ?? []).map((item) => (
            <Badge key={`country-${item}`} variant="outline">
              {item}
            </Badge>
          ))}
          {draft.src?.trim() && (
            <Badge variant="outline" className="max-w-full truncate">
              Source: {draft.src}
            </Badge>
          )}
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="space-y-3">
          {editing && (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailsOpen((prev) => !prev)}
              >
                {detailsOpen ? "Hide Details" : "Edit Name, Grade, Subject"}
              </Button>
              <Button variant="outline" size="sm" onClick={addCriterion}>
                Add Criterion
              </Button>
            </div>
          )}

          {detailsOpen && (
            <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="state-rubric-name">Name</Label>
                <input
                  id="state-rubric-name"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  defaultValue={draft.name ?? ""}
                  onBlur={(e) => setField("name", e.target.value)}
                  placeholder="Virginia SOL Grade 5 Instructional Rubric"
                  disabled={!editing}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state-rubric-src">Source URL / Notes</Label>
                <input
                  id="state-rubric-src"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  defaultValue={draft.src ?? ""}
                  onBlur={(e) => setField("src", e.target.value)}
                  placeholder="Leave empty for now"
                  disabled={!editing}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state-rubric-state">States (comma separated)</Label>
                <input
                  id="state-rubric-state"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  defaultValue={toCsv(draft.state)}
                  onBlur={(e) => setField("state", parseCsv(e.target.value))}
                  placeholder="CA, TX"
                  disabled={!editing}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state-rubric-country">
                  Country (comma separated)
                </Label>
                <input
                  id="state-rubric-country"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  defaultValue={toCsv(draft.country)}
                  onBlur={(e) => setField("country", parseCsv(e.target.value))}
                  placeholder="US"
                  disabled={!editing}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state-rubric-subject">
                  Subject (allowed: {ALLOWED_SUBJECTS.join(", ")})
                </Label>
                <input
                  id="state-rubric-subject"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  defaultValue={toCsv(draft.subject)}
                  onBlur={(e) => setField("subject", parseCsv(e.target.value))}
                  placeholder="English"
                  disabled={!editing}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state-rubric-grade">Grades (comma separated)</Label>
                <input
                  id="state-rubric-grade"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  defaultValue={toCsv(draft.grade)}
                  onBlur={(e) => setField("grade", parseCsv(e.target.value))}
                  placeholder="10, 11, 12"
                  disabled={!editing}
                />
              </div>
            </div>
          )}

          {showPreviewMatrix && (
            <div className="rounded-lg border">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[18%] whitespace-normal">Criterion</TableHead>
                    {matrixColumns.map((col) => (
                      <TableHead key={col.key} className="whitespace-normal text-center">
                        {col.label}
                        {col.maxScore !== null && (
                          <span className="text-muted-foreground font-normal">
                            {" "}({col.maxScore})
                          </span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Math.max(1, matrixColumns.length + 1)}
                        className="text-muted-foreground"
                      >
                        No criteria extracted yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    criteria.map(([criterionName, levels]) => (
                      <TableRow key={`preview-${criterionName}`}>
                        <TableCell className="align-top font-medium whitespace-normal py-3">
                          {criterionName}
                        </TableCell>
                        {matrixColumns.map((col) => {
                          const level = matchLevel(levels, col);
                          return (
                            <TableCell key={`${criterionName}-${col.key}`} className="align-top py-3">
                              {level ? (
                                <p className="text-xs leading-relaxed text-muted-foreground whitespace-normal">
                                  {level.basisForEvaluation}
                                </p>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {editing ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Edit table entries ({criteria.length} criteria)
                </span>
              </div>

              {criteria.length === 0 ? (
                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  No criteria extracted yet. Add a criterion or switch to JSON view.
                </div>
              ) : (
                criteria.map(([criterionName, levels]) => (
                  <div
                    key={criterionName}
                    className="space-y-2 rounded-xl border bg-background p-3"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm font-medium"
                        defaultValue={criterionName}
                        onBlur={(e) => renameCriterion(criterionName, e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCriterion(criterionName)}
                      >
                        Remove
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addLevel(criterionName)}
                      >
                        Add Level
                      </Button>
                    </div>

                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[15%]">Column Name</TableHead>
                            <TableHead className="w-[15%]">Max Score</TableHead>
                            <TableHead>Basis For Evaluation</TableHead>
                            <TableHead className="w-[10%]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {levels.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-muted-foreground">
                                No levels yet
                              </TableCell>
                            </TableRow>
                          ) : (
                            levels.map((level, index) => (
                              <TableRow key={`${criterionName}-${index}`}>
                                <TableCell>
                                  <input
                                    className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                                    value={level.columnName ?? ""}
                                    onChange={(e) =>
                                      updateLevel(criterionName, index, {
                                        columnName: e.target.value || undefined,
                                      })
                                    }
                                    placeholder="Optional"
                                  />
                                </TableCell>
                                <TableCell>
                                  <input
                                    type="number"
                                    className="w-full rounded-md border bg-background px-2 py-1 text-xs"
                                    value={level.maxScore}
                                    onChange={(e) =>
                                      updateLevel(criterionName, index, {
                                        maxScore: Number(e.target.value),
                                      })
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <textarea
                                    className="min-h-[72px] w-full rounded-md border bg-background px-2 py-1 text-xs"
                                    value={level.basisForEvaluation}
                                    onChange={(e) =>
                                      updateLevel(criterionName, index, {
                                        basisForEvaluation: e.target.value,
                                      })
                                    }
                                    onBlur={(e) =>
                                      updateLevel(criterionName, index, {
                                        basisForEvaluation: e.target.value,
                                      })
                                    }
                                    placeholder="Describe this level"
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeLevel(criterionName, index)}
                                  >
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))
              )}
            </>
          ) : (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
              This rubric is in read-only mode. Click Edit Rubric to modify metadata or
              scoring criteria.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            className="min-h-[360px] w-full rounded-lg border bg-muted p-4 font-mono text-sm"
            value={jsonText}
            readOnly={!editing}
            onChange={(e) => {
              if (!editing) return;
              setJsonText(e.target.value);
              setJsonError(null);
            }}
          />
          <div className="flex items-center justify-between">
            {jsonError ? (
              <p className="text-xs text-destructive">{jsonError}</p>
            ) : (
              <span className="text-xs text-muted-foreground">
                Apply JSON edits to sync table view.
              </span>
            )}
            <Button size="sm" onClick={applyJsonEdits} disabled={!editing}>
              Apply JSON Edits
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
