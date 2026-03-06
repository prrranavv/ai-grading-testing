"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StateRubricResultEditor } from "@/components/state-rubric-result-editor";
import type { StateRubricResult } from "@/lib/types";

interface RubricSummary {
  id: string;
  name: string;
  status?: string;
  grade?: string[];
  subject?: string[];
  updated?: string;
}

function extractArray(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;

  const directCandidates = ["rubrics", "result", "items", "rubricSchemas"];
  for (const key of directCandidates) {
    if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
  }

  const dataNode = obj.data;
  if (dataNode && typeof dataNode === "object" && !Array.isArray(dataNode)) {
    const nested = dataNode as Record<string, unknown>;
    const nestedCandidates = ["rubricSchemas", "rubrics", "items", "result"];
    for (const key of nestedCandidates) {
      if (Array.isArray(nested[key])) {
        return nested[key] as Record<string, unknown>[];
      }
    }
  }

  const resultNode = obj.result;
  if (resultNode && typeof resultNode === "object" && !Array.isArray(resultNode)) {
    const nested = resultNode as Record<string, unknown>;
    const nestedCandidates = ["rubricSchemas", "rubrics", "items", "data"];
    for (const key of nestedCandidates) {
      if (Array.isArray(nested[key])) {
        return nested[key] as Record<string, unknown>[];
      }
    }
  }

  const candidates = ["data"];
  for (const key of candidates) {
    if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
  }
  return [];
}

function getRubricId(item: Record<string, unknown>): string | null {
  const idValue = item._id ?? item.id;
  return typeof idValue === "string" && idValue ? idValue : null;
}

function getRubricName(item: Record<string, unknown>): string {
  return typeof item.name === "string" && item.name.trim()
    ? item.name.trim()
    : "Untitled Rubric";
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed = value.filter((v): v is string => typeof v === "string");
  return parsed.length > 0 ? parsed : undefined;
}

function normalizeResultFromApi(value: unknown): StateRubricResult {
  if (!value || typeof value !== "object") return {};
  const obj = value as Record<string, unknown>;

  const dataNode =
    typeof obj.data === "object" && obj.data
      ? (obj.data as Record<string, unknown>)
      : null;
  const resultNode =
    typeof obj.result === "object" && obj.result
      ? (obj.result as Record<string, unknown>)
      : null;

  const root =
    (typeof obj.rubricSchema === "object" && obj.rubricSchema
      ? (obj.rubricSchema as Record<string, unknown>)
      : null) ||
    (typeof obj.rubric === "object" && obj.rubric
      ? (obj.rubric as Record<string, unknown>)
      : null) ||
    (dataNode &&
    typeof dataNode.rubricSchema === "object" &&
    dataNode.rubricSchema
      ? (dataNode.rubricSchema as Record<string, unknown>)
      : null) ||
    (dataNode &&
    typeof dataNode.rubric === "object" &&
    dataNode.rubric
      ? (dataNode.rubric as Record<string, unknown>)
      : null) ||
    (resultNode &&
    typeof resultNode.rubricSchema === "object" &&
    resultNode.rubricSchema
      ? (resultNode.rubricSchema as Record<string, unknown>)
      : null) ||
    (resultNode &&
    typeof resultNode.rubric === "object" &&
    resultNode.rubric
      ? (resultNode.rubric as Record<string, unknown>)
      : null) ||
    dataNode ||
    resultNode ||
    obj;

  return {
    name: typeof root.name === "string" ? root.name : undefined,
    state: Array.isArray(root.state)
      ? root.state.filter((v): v is string => typeof v === "string")
      : undefined,
    country: Array.isArray(root.country)
      ? root.country.filter((v): v is string => typeof v === "string")
      : undefined,
    src: typeof root.src === "string" ? root.src : "",
    subject: Array.isArray(root.subject)
      ? root.subject.filter((v): v is string => typeof v === "string")
      : undefined,
    grade: Array.isArray(root.grade)
      ? root.grade.filter((v): v is string => typeof v === "string")
      : undefined,
    rubricTable:
      root.rubricTable && typeof root.rubricTable === "object"
        ? (root.rubricTable as StateRubricResult["rubricTable"])
        : {},
  };
}

export default function WaygroundRubricsPage() {
  const [list, setList] = useState<RubricSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRubric, setSelectedRubric] = useState<StateRubricResult | null>(
    null
  );
  const [draft, setDraft] = useState<StateRubricResult | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(
    () =>
      !!selectedId &&
      !!draft?.name &&
      !!draft?.rubricTable &&
      Object.keys(draft.rubricTable).length > 0 &&
      !saving,
    [selectedId, draft, saving]
  );

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/wayground/rubrics?limit=50&skip=0");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch rubric list");

      const summaries = extractArray(data)
        .map((item) => {
          const id = getRubricId(item);
          if (!id) return null;
          return {
            id,
            name: getRubricName(item),
            status: typeof item.status === "string" ? item.status : undefined,
            grade: getStringArray(item.grade),
            subject: getStringArray(item.subject),
            updated: typeof item.updated === "string" ? item.updated : undefined,
          };
        })
        .filter((item): item is RubricSummary => item !== null);

      setList(summaries);
      setSelectedId((prev) => prev ?? summaries[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rubric list");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/wayground/rubrics/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch rubric");

      const normalized = normalizeResultFromApi(data);
      setSelectedRubric(normalized);
      setDraft(normalized);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch rubric");
      setSelectedRubric(null);
      setDraft(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  async function updateRubric() {
    if (!selectedId || !draft) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/wayground/rubrics/${selectedId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update rubric");
      setSelectedRubric(draft);
      setMessage("Rubric updated in Wayground.");
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update rubric");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRubric() {
    if (!selectedId) return;
    const shouldDelete = window.confirm(
      "Delete this rubric from Wayground library?"
    );
    if (!shouldDelete) return;

    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/wayground/rubrics/${selectedId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete rubric");
      setMessage("Rubric deleted from Wayground.");

      const deletedId = selectedId;
      await loadList();
      const remaining = list.filter((item) => item.id !== deletedId);
      const nextId = remaining[0]?.id ?? null;
      setSelectedId(nextId);
      if (!nextId) {
        setSelectedRubric(null);
        setDraft(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rubric");
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  return (
    <div className="p-6">
      <Card className="mx-auto w-full max-w-[1600px]">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Wayground Library</CardTitle>
              <CardDescription>
                Browse existing rubrics, open one, edit details, and delete when
                needed.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={loadList} disabled={loadingList}>
              {loadingList ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="rounded-lg border">
            <div className="border-b px-3 py-2 text-sm font-medium">
              Rubrics ({list.length})
            </div>
            <div className="max-h-[70vh] overflow-auto p-2">
              {loadingList ? (
                <p className="p-2 text-sm text-muted-foreground">Loading...</p>
              ) : list.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">
                  No rubrics found.
                </p>
              ) : (
                list.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`mb-1 w-full rounded-md border px-3 py-2 text-left transition-colors ${
                      selectedId === item.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    }`}
                  >
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(item.subject ?? []).join(", ") || "No subject"} ·{" "}
                      {(item.grade ?? []).length > 0
                        ? `Grade ${(item.grade ?? []).join(", ")}`
                        : "No grade"}
                    </p>
                    {item.status && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {item.status}
                        {item.updated ? ` · updated ${item.updated}` : ""}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-3">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700">
                {message}
              </div>
            )}

            {loadingDetail && (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                Loading rubric details...
              </div>
            )}

            {!loadingDetail && selectedRubric && draft && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {editing
                      ? "Editing enabled. Update metadata/table, then save your changes."
                      : "Read-only preview. Click Edit Rubric to make changes."}
                  </p>
                  <div className="flex items-center gap-2">
                    {!editing ? (
                      <Button onClick={() => setEditing(true)}>Edit Rubric</Button>
                    ) : (
                      <>
                        <Button
                          variant="destructive"
                          onClick={deleteRubric}
                          disabled={!selectedId || deleting}
                        >
                          {deleting ? "Deleting..." : "Delete"}
                        </Button>
                        <Button onClick={updateRubric} disabled={!canSave}>
                          {saving ? "Saving..." : "Save Changes"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <StateRubricResultEditor
                  key={selectedId}
                  title="Wayground Rubric"
                  result={selectedRubric}
                  onChange={setDraft}
                  isEditing={editing}
                  onEditToggle={setEditing}
                  showEditToggle={false}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
