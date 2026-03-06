"use client";

import {
  useState,
  useRef,
  useEffect,
  type ChangeEvent,
  type DragEvent,
} from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, FileText, File as FileIcon, X } from "lucide-react";
import { StateRubricResultEditor } from "@/components/state-rubric-result-editor";
import type { StateRubricResult } from "@/lib/types";

const SUPPORTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf") return FileText;
  return FileIcon;
}

export default function StateRubricsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StateRubricResult | null>(null);
  const [editedResult, setEditedResult] = useState<StateRubricResult | null>(null);
  const [resultVersion, setResultVersion] = useState(0);
  const [pushing, setPushing] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(nextFile: File) {
    if (!SUPPORTED_TYPES.includes(nextFile.type)) {
      setError(
        `Unsupported file type: ${nextFile.type || "unknown"}. Supported: PDF, PNG, JPEG, GIF, WebP.`
      );
      return;
    }

    setFile(nextFile);
    setText("");
    setError(null);

    if (nextFile.type.startsWith("image/")) {
      const url = URL.createObjectURL(nextFile);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  }

  function clearFile() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const pasted = item.getAsFile();
          if (pasted) handleFile(pasted);
          return;
        }
      }
    }

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  async function parseStateRubric() {
    setLoading(true);
    setError(null);
    setPushMessage(null);
    setResult(null);
    setEditedResult(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append("file", file);
      } else {
        formData.append("text", text);
      }

      const res = await fetch("/api/parse-state-rubric", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      setResult(data);
      setEditedResult(data);
      setResultVersion((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function addRubricToWayground() {
    if (!editedResult) return;
    setPushing(true);
    setError(null);
    setPushMessage(null);
    try {
      const res = await fetch("/api/wayground/rubrics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editedResult),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to add rubric");
      }
      setPushMessage("Rubric added to Wayground library.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rubric");
    } finally {
      setPushing(false);
    }
  }

  const canSubmit = (file || text.trim().length > 0) && !loading;
  const Icon = file ? getFileIcon(file.type) : null;

  return (
    <div className="p-6">
      <Card className="mx-auto w-full max-w-[1600px]">
        <CardHeader>
          <CardTitle className="text-2xl">State Rubrics</CardTitle>
          <CardDescription>
            Upload a state rubric (PDF/image) or paste text. The parser extracts
            strict rubric JSON, then you can review and edit it before finalizing.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Upload file</Label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : file
                    ? "border-border"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
            >
              {file ? (
                <div className="flex w-full items-center gap-3">
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-md border object-cover"
                    />
                  ) : (
                    Icon && (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                        <Icon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Drag and drop a file here, click to browse, or paste an image
                  with Cmd+V / Ctrl+V
                </p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={SUPPORTED_TYPES.join(",")}
                className="hidden"
                onChange={onFileChange}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="state-rubric-text">Paste rubric text</Label>
            <Textarea
              id="state-rubric-text"
              placeholder="Paste state rubric text here..."
              rows={7}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value.trim()) clearFile();
              }}
            />
          </div>

          <Button className="w-full" disabled={!canSubmit} onClick={parseStateRubric}>
            {loading ? "Parsing..." : "Parse State Rubric"}
          </Button>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {pushMessage && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-700">
              {pushMessage}
            </div>
          )}

          {result && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Update details and rubric table before adding to Wayground.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={addRubricToWayground}
                    disabled={
                      pushing ||
                      !editedResult?.name?.trim() ||
                      !editedResult.rubricTable ||
                      Object.keys(editedResult.rubricTable).length === 0
                    }
                  >
                    {pushing ? "Adding..." : "Add Rubric"}
                  </Button>
                </div>
              </div>
              <StateRubricResultEditor
                key={resultVersion}
                result={result}
                onChange={setEditedResult}
                isEditing
                showEditToggle={false}
                showPreviewMatrix={false}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
