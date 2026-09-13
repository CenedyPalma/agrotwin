"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Bot, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUGGESTIONS = [
  "How is my field doing?",
  "Show problem areas",
  "Where should I inspect?",
  "What changed since the last survey?",
];

export default function AskAiPage() {
  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: api.listFields });
  const fieldWithSurvey = fields?.find((f) => f.latest_survey_id);
  const surveyId = fieldWithSurvey?.latest_survey_id ?? null;

  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  const ask = useMutation({
    mutationFn: (q: string) => api.askAssistant(surveyId as string, q),
    onSuccess: (res) => setHistory((h) => [...h, { q: res.question, a: res.answer }]),
  });

  function send(q: string) {
    if (!q.trim() || !surveyId) return;
    ask.mutate(q.trim());
    setQuestion("");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Bot size={18} />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold">Ask AI</h1>
          </div>
          <p className="text-muted-foreground mt-2 text-xs sm:text-sm">
            Answers are grounded in this field&apos;s real computed analysis and precision drone data —
            powered by your local offline Ollama model (<span className="text-foreground font-medium">Llama 3.2 3B</span>)
            with zero cloud latency or external API dependencies.
          </p>
        </div>

        {!surveyId && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No field with a survey yet — create one from Upload first.
          </div>
        )}

        {surveyId && (
          <>
            <div className="space-y-3">
              {history.map((h, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="ml-auto max-w-[85%] w-fit rounded-lg rounded-br-sm bg-brand px-3 py-2 text-sm text-white">
                    {h.q}
                  </div>
                  <div className="mr-auto max-w-[85%] w-fit whitespace-pre-line rounded-lg rounded-bl-sm border border-border bg-surface px-3 py-2 text-sm">
                    {h.a}
                  </div>
                </div>
              ))}
              {ask.isPending && (
                <div className="mr-auto flex w-fit items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" /> Thinking…
                </div>
              )}
            </div>

            {history.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="outline" size="sm" className="rounded-full" onClick={() => send(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(question);
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about this field…"
                className="flex-1"
              />
              <Button type="submit" size="icon-lg" disabled={ask.isPending || !question.trim()}>
                <Send />
              </Button>
            </form>
          </>
        )}
      </div>
    </AppShell>
  );
}
