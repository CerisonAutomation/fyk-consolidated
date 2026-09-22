import { createFileRoute } from "@tanstack/react-router";
import { PhotoEnhancerPanel, TranslationPanel, AutocompleteDemo, MemeSuggestPanel, VoiceNotePanel } from "@/components/ai-panel/AIAssistantPanel";

export const Route = createFileRoute("/ai/photo-enhance/")({
  component: AIPhotoPage,
});

function AIPhotoPage() {
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">AI Features</h1>
      <p className="text-sm text-muted-foreground">Photo enhancer with identity protection, translation on-device, autocomplete in your voice, meme suggestions, voice notes — with explainability</p>
      <PhotoEnhancerPanel />
      <TranslationPanel />
      <AutocompleteDemo />
      <MemeSuggestPanel />
      <VoiceNotePanel />
    </div>
  );
}
