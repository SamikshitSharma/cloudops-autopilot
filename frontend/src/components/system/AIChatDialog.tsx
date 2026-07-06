import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { api } from "@/api/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AIChatDialog({ open, onOpenChange }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I am the Autopilot AI assistant. Ask me to summarize resources, summarize recommendations, explain workflows, or audit trails." }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      setTimeout(scrollToBottom, 100);
    }
  }, [open, messages]);

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || query;
    if (!promptText.trim()) return;

    if (!textToSend) setQuery("");
    setMessages((prev) => [...prev, { role: "user", content: promptText }]);
    setLoading(true);

    try {
      const selectedResourceId = localStorage.getItem("last_selected_resource_id") || undefined;
      const contextUrl = window.location.pathname + window.location.search;

      const res = await api.post<{ success: boolean; data: { response: string } }>("/api/v1/ask-ai", { 
        query: promptText,
        context_url: contextUrl,
        selected_resource_id: selectedResourceId
      });
      const aiResponse = res?.data?.response || "I'm sorry, I could not retrieve an answer right now.";
      setMessages((prev) => [...prev, { role: "assistant", content: aiResponse }]);
    } catch (err: any) {
      const detail = err?.response?.data?.message || err?.response?.data?.detail || err.message || "AI endpoint unavailable";
      toast.error(`AI search failed: ${detail}`);
      setMessages((prev) => [...prev, { role: "assistant", content: `AI reasoning is unavailable: ${detail}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-2xl h-[550px] flex flex-col p-6 gap-4">
        <DialogHeader className="flex flex-row items-center gap-2 pb-2 border-b border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">Ask Autopilot AI</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Connected to reasoning engine and database state</DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/60 border border-border"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-muted/60 border border-border flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Reasoning over backend state...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={() => handleSend("Summarize discovered resources")}>Summarize resources</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={() => handleSend("Summarize recommendations")}>Summarize recommendations</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={() => handleSend("Explain workflow runs")}>Explain workflows</Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={() => handleSend("Explain audit ledger trail")}>Explain audit trail</Button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask anything about resources, recommendations..." className="flex-1" />
          <Button type="submit" disabled={loading} size="icon" className="bg-gradient-primary text-primary-foreground"><Send className="h-4 w-4" /></Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
