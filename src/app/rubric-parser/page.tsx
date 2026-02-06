"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings2, History } from "lucide-react";
import { RUBRIC_SYSTEM_PROMPT, RUBRIC_USER_PROMPT } from "@/lib/prompts";
import { RubricResultView } from "@/components/rubric-result-view";
import { PromptEditor } from "@/components/prompt-editor";
import { RunHistorySheet } from "@/components/run-history";
import { RunComparison } from "@/components/run-comparison";
import { useRunHistory, useRunHistoryDispatch } from "@/lib/run-history-context";
import type { RubricResult } from "@/lib/types";

export default function RubricParserPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<RubricResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prompt state
  const [systemPrompt, setSystemPrompt] = useState(RUBRIC_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useState(RUBRIC_USER_PROMPT);
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);

  // History state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const { runs, selectedForCompare } = useRunHistory();
  const dispatch = useRunHistoryDispatch();

  const isDefaultPrompts =
    systemPrompt === RUBRIC_SYSTEM_PROMPT && userPrompt === RUBRIC_USER_PROMPT;

  function handleFile(f: File) {
    if (f.type !== "application/pdf") {
      setError("Only PDF files are supported.");
      return;
    }
    setFile(f);
    setText("");
    setError(null);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  async function parseRubric() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else {
        formData.append("text", text);
      }
      formData.append("systemPrompt", systemPrompt);
      formData.append("userPrompt", userPrompt);

      const res = await fetch("/api/parse-rubric", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error ?? "Something went wrong";
        setError(errMsg);
        dispatch({
          type: "ADD_RUN",
          run: {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            input: {
              fileName: file?.name,
              textSnippet: text ? text.slice(0, 100) : undefined,
            },
            prompts: { system: systemPrompt, user: userPrompt },
            result: null,
            error: errMsg,
          },
        });
      } else {
        setResult(data);
        dispatch({
          type: "ADD_RUN",
          run: {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            input: {
              fileName: file?.name,
              textSnippet: text ? text.slice(0, 100) : undefined,
            },
            prompts: { system: systemPrompt, user: userPrompt },
            result: data,
          },
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Network error";
      setError(errMsg);
      dispatch({
        type: "ADD_RUN",
        run: {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          input: {
            fileName: file?.name,
            textSnippet: text ? text.slice(0, 100) : undefined,
          },
          prompts: { system: systemPrompt, user: userPrompt },
          result: null,
          error: errMsg,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = (file || text.trim().length > 0) && !loading;
  const canCompare =
    selectedForCompare[0] !== null && selectedForCompare[1] !== null;

  return (
    <div className="p-6">
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Rubric Parser</CardTitle>
              <CardDescription>
                Upload a PDF rubric or paste rubric text to extract structured
                data via Gemini.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPromptEditorOpen(true)}
              >
                <Settings2 className="mr-1.5 h-4 w-4" />
                Edit Prompts
                {!isDefaultPrompts && (
                  <Badge variant="secondary" className="ml-1.5">
                    Custom
                  </Badge>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="mr-1.5 h-4 w-4" />
                History
                {runs.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5">
                    {runs.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* File upload */}
          <div className="space-y-2">
            <Label>Upload PDF</Label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
            >
              {file ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{file.name}</Badge>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Drag & drop a PDF here, or click to browse
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={onFileChange}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Text input */}
          <div className="space-y-2">
            <Label htmlFor="rubric-text">Paste rubric text</Label>
            <Textarea
              id="rubric-text"
              placeholder="Paste your rubric text here..."
              rows={6}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value.trim()) {
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }
              }}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full"
            disabled={!canSubmit}
            onClick={parseRubric}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Parsing...
              </span>
            ) : (
              "Parse Rubric"
            )}
          </Button>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Result */}
          {result && <RubricResultView result={result} />}
        </CardContent>
      </Card>

      {/* Prompt editor sheet */}
      <PromptEditor
        systemPrompt={systemPrompt}
        userPrompt={userPrompt}
        onPromptsChange={(system, user) => {
          setSystemPrompt(system);
          setUserPrompt(user);
        }}
        open={promptEditorOpen}
        onOpenChange={setPromptEditorOpen}
      />

      {/* Run history sheet */}
      <RunHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onCompare={() => {
          setHistoryOpen(false);
          setCompareOpen(true);
        }}
        canCompare={canCompare}
      />

      {/* Run comparison dialog */}
      <RunComparison open={compareOpen} onOpenChange={setCompareOpen} />
    </div>
  );
}
