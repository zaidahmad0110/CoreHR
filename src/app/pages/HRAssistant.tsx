import { FormEvent, useMemo, useState } from "react";
import { Bot, SendHorizontal, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { chatbotService } from "../api/services";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  confidence?: number;
};

export function HRAssistant() {
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      text: "Ask me about leave, payroll, expenses, loans, attendance, recruitment, or training workflows.",
      timestamp: new Date().toISOString(),
    },
  ]);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [messages],
  );

  const handleAsk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", text: trimmed, timestamp: now },
    ]);
    setQuestion("");

    try {
      const response = await chatbotService.ask(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: response.answer,
          confidence: response.confidence,
          timestamp: response.asked_at,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to get assistant response.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">HR Assistant</h1>
        <p className="text-gray-600 mt-1">AI-assisted help for HR workflows and policies</p>
      </div>

      {error && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[460px] overflow-y-auto space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            {sortedMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-sm ${
                    message.role === "user"
                      ? "bg-[#2563EB] text-white"
                      : "bg-white text-gray-900 border border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {message.role === "user" ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4 text-[#2563EB]" />
                    )}
                    <span className="text-xs opacity-80">
                      {message.role === "user" ? "You" : "Assistant"}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap">{message.text}</div>
                  {message.role === "assistant" && typeof message.confidence === "number" && (
                    <div className="mt-2 text-[11px] text-gray-500">
                      Confidence: {(message.confidence * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form className="flex gap-3" onSubmit={(event) => void handleAsk(event)}>
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Type your HR question..."
              disabled={submitting}
            />
            <Button
              type="submit"
              className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
              disabled={submitting || question.trim().length === 0}
            >
              <SendHorizontal className="w-4 h-4 mr-2" />
              {submitting ? "Asking..." : "Ask"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

