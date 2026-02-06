"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RUBRIC_SYSTEM_PROMPT, RUBRIC_USER_PROMPT } from "@/lib/prompts";

interface PromptEditorProps {
  systemPrompt: string;
  userPrompt: string;
  onPromptsChange: (system: string, user: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PromptEditor({
  systemPrompt,
  userPrompt,
  onPromptsChange,
  open,
  onOpenChange,
}: PromptEditorProps) {
  const [localSystem, setLocalSystem] = useState(systemPrompt);
  const [localUser, setLocalUser] = useState(userPrompt);

  // Sync local state when sheet opens
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setLocalSystem(systemPrompt);
      setLocalUser(userPrompt);
    }
    onOpenChange(nextOpen);
  }

  function handleSave() {
    onPromptsChange(localSystem, localUser);
    onOpenChange(false);
  }

  function handleReset() {
    setLocalSystem(RUBRIC_SYSTEM_PROMPT);
    setLocalUser(RUBRIC_USER_PROMPT);
  }

  const isDefault =
    localSystem === RUBRIC_SYSTEM_PROMPT && localUser === RUBRIC_USER_PROMPT;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-xl w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>Edit Prompts</SheetTitle>
          <SheetDescription>
            Customize the system and user prompts sent to the AI model.
            {" {textContent}"} in the user prompt will be replaced with the
            document text.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="system" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full">
            <TabsTrigger value="system" className="flex-1">
              System Prompt
            </TabsTrigger>
            <TabsTrigger value="user" className="flex-1">
              User Prompt
            </TabsTrigger>
          </TabsList>
          <TabsContent value="system" className="flex-1 min-h-0">
            <Textarea
              value={localSystem}
              onChange={(e) => setLocalSystem(e.target.value)}
              className="h-full min-h-[400px] resize-none font-mono text-xs"
            />
          </TabsContent>
          <TabsContent value="user" className="flex-1 min-h-0">
            <Textarea
              value={localUser}
              onChange={(e) => setLocalUser(e.target.value)}
              className="h-full min-h-[400px] resize-none font-mono text-xs"
            />
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isDefault}
          >
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
