/**
 * AI Event Generation — PRD 14.4
 * Generates event suggestions, descriptions, agenda
 */

export interface EventSuggestion {
  title: string;
  description: string;
  category: string;
  location?: string;
  suggestedDate?: string;
}

export async function generateEventIdeas(interests: string[], location?: string): Promise<EventSuggestion[]> {
  const res = await fetch("/api/ai/event-gen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interests, location }),
  });
  
  const data = await res.json();
  return data.events ?? [];
}

export async function generateEventDescription(title: string, category: string): Promise<string> {
  const res = await fetch("/api/ai/event-description", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, category }),
  });
  
  const data = await res.json();
  return data.description ?? "";
}

export async function suggestEventAgenda(eventId: string): Promise<string[]> {
  const res = await fetch(`/api/ai/event-agenda?eventId=${eventId}`);
  const data = await res.json();
  return data.agenda ?? [];
}
