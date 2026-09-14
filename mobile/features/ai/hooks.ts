import { useCallback } from "react";
import { aiService } from "@/services/ai";
import { describeError } from "@/services/errors";
import { newMessageId, useChatStore } from "@/stores/chatStore";

/**
 * Chat thread for one survey. Sends the farmer's question to the backend
 * assistant and records both the answer and which responder produced it.
 */
export function useChat(surveyId: string | null | undefined) {
  const key = surveyId ?? "";
  const messages = useChatStore((s) => s.threads[key] ?? []);
  const append = useChatStore((s) => s.append);
  const update = useChatStore((s) => s.update);
  const clear = useChatStore((s) => s.clear);

  const pending = messages.some((m) => m.status === "sending");

  const send = useCallback(
    async (question: string, source: "text" | "voice" = "text") => {
      const text = question.trim();
      if (!text || !surveyId) return;
      append(surveyId, { id: newMessageId(), role: "user", text, createdAt: Date.now(), source });
      const replyId = newMessageId();
      append(surveyId, { id: replyId, role: "assistant", text: "", createdAt: Date.now(), status: "sending" });
      try {
        const res = await aiService.ask(surveyId, text);
        update(surveyId, replyId, {
          text: res.answer,
          responder: res.responder,
          contextUsed: res.context_used,
          status: undefined,
        });
      } catch (err) {
        const d = describeError(err);
        update(surveyId, replyId, { status: "error", errorMessage: `${d.title}. ${d.message}`, text: "" });
      }
    },
    [surveyId, append, update]
  );

  const retryLast = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) void send(lastUser.text, lastUser.source);
  }, [messages, send]);

  return { messages, pending, send, retryLast, clear: () => surveyId && clear(surveyId) };
}
