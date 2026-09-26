import React, { useState, useRef, useEffect } from 'react';
import {
  Heart,
  Send,
  Sparkles,
  RefreshCw,
  Trash2,
  Lock,
  Eye,
  AlertCircle,
  Copy,
  Check,
  Code2,
  Terminal,
  Shield,
  CornerDownLeft,
  Square,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../firebase/authContext';
import { ChatMessage } from '../../types';

const INITIAL_GREETING: ChatMessage = {
  id: 'greeting-1',
  sender: 'assistant',
  text: "Hello, my friend. Welcome to your safe space. I am Aria—your AI companion and personal assistant. Whether you need help troubleshooting Python or AWS architectures, talking through career milestones, or gently reflecting on your thoughts today, I'm here for you. How can I support you right now?",
  timestamp: 'Just now',
};

const SUGGESTED_PROMPTS = [
  'How do I architect a resilient microservice on AWS with ECS and Fargate?',
  'Explain Python decorators and asyncio with clean code examples.',
  'Help me prepare for a senior engineer or engineering manager interview.',
  'I feel a bit overwhelmed today—remind me to pause and breathe.',
  'Review best practices for CI/CD pipelines in DevOps with GitHub Actions.',
  'Help me find three quiet things to be grateful for today.',
];

/**
 * Clean markdown formatter for assistant messages:
 * Supports ```code blocks``` with copy button, inline `code`, bold **text**, and bullet lists.
 */
const FormattedMessage: React.FC<{ content: string; isUser: boolean }> = ({
  content,
  isUser,
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (isUser) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  const handleCopyCode = (codeStr: string, idx: number) => {
    navigator.clipboard.writeText(codeStr);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Split content by code fences ```
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-xs sm:text-sm font-light leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).trim().split('\n');
          let lang = 'code';
          let codeBody = part.slice(3, -3).trim();

          if (lines[0] && !lines[0].includes(' ') && lines.length > 1) {
            lang = lines[0].toLowerCase();
            codeBody = lines.slice(1).join('\n');
          }

          const isCopied = copiedIndex === index;

          return (
            <div
              key={index}
              className="my-3 rounded-xl overflow-hidden border border-[#27272B] bg-[#080809]"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#151518] border-b border-[#27272B] text-[11px] text-[#929099]">
                <span className="flex items-center gap-1.5 font-mono text-[#B8A4D8]">
                  <Terminal className="w-3 h-3" />
                  {lang}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCode(codeBody, index)}
                  className="flex items-center gap-1 text-[11px] text-[#929099] hover:text-[#E8E6EB] transition-colors"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto text-[11px] sm:text-xs font-mono text-[#E8E6EB] leading-normal selection:bg-[#B8A4D8]/30">
                <code>{codeBody}</code>
              </pre>
            </div>
          );
        }

        // Regular text formatting (paragraphs, inline code, bold, lists)
        const paragraphs = part.split('\n\n');

        return (
          <React.Fragment key={index}>
            {paragraphs.map((para, pIdx) => {
              if (!para.trim()) return null;

              // Check for bullet lists
              const lines = para.split('\n');
              const isList = lines.every((line) => line.trim().startsWith('- ') || line.trim().startsWith('* '));

              if (isList) {
                return (
                  <ul key={pIdx} className="list-disc list-inside space-y-1 my-1 pl-1 text-[#E8E6EB]/90">
                    {lines.map((line, lIdx) => {
                      const text = line.replace(/^[-*]\s+/, '');
                      return (
                        <li key={lIdx}>
                          <span dangerouslySetInnerHTML={{ __html: formatInline(text) }} />
                        </li>
                      );
                    })}
                  </ul>
                );
              }

              return (
                <p
                  key={pIdx}
                  className="my-1.5 text-[#E8E6EB]/90"
                  dangerouslySetInnerHTML={{ __html: formatInline(para) }}
                />
              );
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Safe helper for bold and inline code in text
function formatInline(str: string): string {
  // Escape HTML tags to prevent XSS
  const escaped = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    // `code`
    .replace(
      /`([^`]+)`/g,
      '<code class="px-1.5 py-0.5 rounded bg-[#151518] text-[#B8A4D8] font-mono text-[11px] border border-[#27272B]">$1</code>'
    )
    // **bold**
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-normal text-[#E8E6EB]">$1</strong>')
    // *italic*
    .replace(/\*([^*]+)\*/g, '<em class="italic text-[#E8E6EB]/80">$1</em>');
}

export const AIFriendView: React.FC = () => {
  const { userProfile, toggleJournalAwareAI, journalEntries, tasks } = useApp();
  const { currentUser, isGuest, openAuthModal, getIdToken } = useAuth();

  // Load chat session from sessionStorage (or fresh session)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem('mlw_chat_history');
      return saved ? JSON.parse(saved) : [INITIAL_GREETING];
    } catch {
      return [INITIAL_GREETING];
    }
  });

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingFirstChunk, setIsWaitingFirstChunk] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isWaitingFirstChunk]);

  // Persist session messages
  useEffect(() => {
    try {
      sessionStorage.setItem('mlw_chat_history', JSON.stringify(messages));
    } catch (e) {
      console.warn('Could not save chat history to session', e);
    }
  }, [messages]);

  const handleStopGenerating = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsWaitingFirstChunk(false);
  };

  const handleNewChat = () => {
    handleStopGenerating();
    setMessages([
      {
        id: `greeting-${Date.now()}`,
        sender: 'assistant',
        text: `Welcome to a fresh session, ${userProfile.name}. How can I assist you with your code, plans, or reflections today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setErrorNotice(null);
    setInputText('');
  };

  const handleClearHistory = () => {
    handleStopGenerating();
    setMessages([INITIAL_GREETING]);
    setErrorNotice(null);
    setInputText('');
    sessionStorage.removeItem('mlw_chat_history');
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const text = (customPrompt || inputText).trim();
    if (!text || isLoading) return;

    setErrorNotice(null);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    if (!customPrompt) setInputText('');
    setIsLoading(true);
    setIsWaitingFirstChunk(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Build personal context only if Journal-Aware Mode is explicitly toggled ON
      let personalContext: string | undefined = undefined;
      if (userProfile.journalAwareAI) {
        const recentJournalsSummary = journalEntries
          .slice(0, 3)
          .map((j) => `- "${j.title}" (${j.date}): ${j.tags.join(', ')}`)
          .join('\n');

        const activeTasksSummary = tasks
          .slice(0, 3)
          .map((t) => `- [${t.completed ? 'x' : ' '}] ${t.title}`)
          .join('\n');

        personalContext = `Preferred Name: ${userProfile.name}
Current Mood: ${userProfile.currentMood}
Low Energy Mode: ${userProfile.lowEnergyMode ? 'Active (prefer gentle pacing)' : 'Inactive'}
Recent Reflections:
${recentJournalsSummary || 'None recorded yet'}
Active Daily Anchors:
${activeTasksSummary || 'None'}`;
      }

      // Format payload for server-side Gemini streaming endpoint (recent 8 messages for low latency & memory)
      const apiMessages = newHistory
        .filter((m) => !m.error)
        .slice(-8)
        .map((m) => ({
          role: m.sender === 'assistant' ? 'assistant' : 'user',
          content: m.text,
        }));

      // Enforce Firebase ID Token authentication for protected backend API
      let authToken = '';
      if (currentUser) {
        try {
          authToken = (await getIdToken()) || '';
        } catch (tokenErr) {
          console.warn('Could not retrieve Firebase ID token:', tokenErr);
        }
      }

      if (!authToken) {
        throw new Error('Please sign in to your sanctuary account to converse with Aria AI.');
      }

      let res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          journalAware: !!userProfile.journalAwareAI,
          personalContext,
        }),
        signal: abortController.signal,
      });

      // If token expired, attempt automatic silent refresh and retry once
      if (res.status === 401 && currentUser) {
        try {
          const freshToken = await getIdToken(true);
          if (freshToken) {
            authToken = freshToken;
            res = await fetch('/api/chat/stream', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${freshToken}`,
              },
              body: JSON.stringify({
                messages: apiMessages,
                journalAware: !!userProfile.journalAwareAI,
                personalContext,
              }),
              signal: abortController.signal,
            });
          }
        } catch (refreshErr) {
          console.warn('Token refresh retry error:', refreshErr);
        }
      }

      if (!res.ok) {
        let errData: any = {};
        try {
          errData = await res.json();
        } catch {
          // ignore json parse error
        }
        throw new Error(errData.error || `Server responded with status ${res.status}`);
      }

      if (!res.body) {
        throw new Error('Streaming response body is unavailable.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      const assistantId = `assistant-${Date.now()}`;
      let accumulatedText = '';
      let messageCreated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataPayload = trimmed.slice(5).trim();
          if (dataPayload === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(dataPayload);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.text) {
              accumulatedText += parsed.text;

              if (!messageCreated) {
                messageCreated = true;
                setIsWaitingFirstChunk(false);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: assistantId,
                    sender: 'assistant',
                    text: accumulatedText,
                    timestamp: new Date().toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, text: accumulatedText } : m))
                );
              }
            }
          } catch (e: any) {
            if (e?.message && e.message !== 'Unexpected end of JSON input') {
              console.warn('SSE Chunk parsing note:', e);
            }
          }
        }
      }

      // If no text was yielded
      if (!messageCreated && !abortController.signal.aborted) {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            sender: 'assistant',
            text: 'I am here with you, but I could not formulate a response. Please ask me again.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User aborted the stream intentionally
        return;
      }

      console.error('Chat error:', err);
      const friendlyError =
        err?.message || 'Unable to connect to the Gemini service. Please check your connection.';

      setErrorNotice(friendlyError);

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        sender: 'assistant',
        text: `I apologize, but I encountered an issue reaching Gemini: ${friendlyError}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: true,
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsWaitingFirstChunk(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-6 animate-in fade-in duration-300">
      {/* Header with Title and Session Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-light text-[#929099] tracking-wider uppercase">
            <span>Companion & Assistant</span>
            <span>·</span>
            <span className="text-[#B8A4D8]">Aria</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-light text-[#E8E6EB] tracking-wide mt-1">
            AI Best Friend
          </h1>
          <p className="text-sm font-light text-[#929099] mt-1">
            Real Gemini-powered assistant for coding, AWS, DevOps, career, and heartfelt conversation.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            disabled={isLoading}
            className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-[#151518] hover:bg-[#101012] border border-[#27272B] hover:border-[#B8A4D8]/50 text-xs font-light text-[#E8E6EB] flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Start a fresh conversation"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#B8A4D8]" />
            <span>New Chat</span>
          </button>

          {/* Clear History */}
          <button
            onClick={handleClearHistory}
            disabled={isLoading || messages.length <= 1}
            className="min-h-[44px] px-3 rounded-xl bg-[#151518] hover:bg-[#101012] border border-[#27272B] hover:border-rose-400/50 text-xs font-light text-[#929099] hover:text-rose-300 flex items-center gap-1.5 transition-colors disabled:opacity-40"
            title="Clear all messages in this session"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Privacy Switch Card */}
      <section className="p-4 sm:p-5 rounded-2xl bg-[#151518] border border-[#27272B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
              userProfile.journalAwareAI
                ? 'bg-[#B8A4D8]/15 border-[#B8A4D8]/50 text-[#B8A4D8]'
                : 'bg-[#101012] border-[#27272B] text-[#929099]'
            }`}
          >
            {userProfile.journalAwareAI ? (
              <Eye className="w-4 h-4" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-normal text-[#E8E6EB]">
                Journal-Aware Mode:
              </span>
              <span
                className={`text-xs font-light px-2 py-0.5 rounded-full border ${
                  userProfile.journalAwareAI
                    ? 'bg-[#B8A4D8]/10 border-[#B8A4D8]/40 text-[#B8A4D8]'
                    : 'bg-[#101012] border-[#27272B] text-[#929099]'
                }`}
              >
                {userProfile.journalAwareAI ? 'Enabled (With Permission)' : 'OFF (Strict Privacy)'}
              </span>
            </div>
            <p className="text-xs font-light text-[#929099] mt-1 leading-relaxed">
              {userProfile.journalAwareAI
                ? 'Aria can gently reference your preferred name, current mood, and recent reflection topics for deeper empathy. Photos are never uploaded.'
                : 'Strict privacy active: Your journals, memories, and personal notes are never sent to the AI. Only current chat messages are processed.'}
            </p>
          </div>
        </div>

        <button
          onClick={toggleJournalAwareAI}
          type="button"
          role="switch"
          aria-checked={userProfile.journalAwareAI}
          className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs font-light whitespace-nowrap self-start sm:self-auto transition-colors ${
            userProfile.journalAwareAI
              ? 'bg-[#B8A4D8] text-[#080809] border-[#B8A4D8] font-medium'
              : 'bg-[#101012] text-[#929099] border-[#27272B] hover:text-[#E8E6EB]'
          }`}
        >
          {userProfile.journalAwareAI ? 'Disable Context' : 'Enable Context'}
        </button>
      </section>

      {/* Error Notice Banner if any */}
      {errorNotice && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 flex items-start gap-3 text-xs text-rose-200 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <span className="font-normal block">Connection or Quota Notice</span>
            <p className="text-rose-200/90 font-light leading-relaxed">
              {errorNotice}
            </p>
            {errorNotice.includes('API key') && (
              <p className="text-[11px] text-rose-300/80 pt-1">
                Tip: Configure your <code className="bg-rose-900/50 px-1 py-0.5 rounded">GEMINI_API_KEY</code> in the AI Studio Secrets panel or <code className="bg-rose-900/50 px-1 py-0.5 rounded">.env</code> file.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Chat Messages Display Box */}
      <div className="min-h-[420px] max-h-[580px] rounded-2xl bg-[#151518] border border-[#27272B] p-4 sm:p-6 overflow-y-auto flex flex-col space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const isError = msg.error;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-full`}
            >
              <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-[#929099] font-light">
                <span>{isUser ? userProfile.name : 'Aria'}</span>
                <span>·</span>
                <span>{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[92%] sm:max-w-[82%] p-3.5 sm:p-4 rounded-2xl transition-all ${
                  isUser
                    ? 'bg-[#B8A4D8] text-[#080809] font-normal rounded-tr-none'
                    : isError
                    ? 'bg-[#1e1315] border border-rose-800/60 text-rose-200 rounded-tl-none'
                    : 'bg-[#101012] border border-[#27272B] text-[#E8E6EB] rounded-tl-none shadow-sm'
                }`}
              >
                <FormattedMessage content={msg.text} isUser={isUser} />
              </div>
            </div>
          );
        })}

        {/* Typing Indicator while waiting for first chunk */}
        {isLoading && isWaitingFirstChunk && (
          <div className="flex flex-col items-start animate-in fade-in duration-200">
            <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-[#929099] font-light">
              <span>Aria</span>
              <span>·</span>
              <span className="text-[#B8A4D8]">Streaming thought...</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-[#101012] border border-[#27272B] text-xs text-[#929099] font-light rounded-tl-none flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-[#B8A4D8] animate-ping" />
              <span className="text-[#E8E6EB]/85 font-light">Aria is consulting Gemini...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] uppercase tracking-wider text-[#929099] font-light block">
          Suggested Topics
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5">
          {SUGGESTED_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-full bg-[#101012] border border-[#27272B] hover:border-[#B8A4D8]/50 text-xs font-light text-[#929099] hover:text-[#E8E6EB] whitespace-nowrap transition-colors min-h-[40px] disabled:opacity-40"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Guest / Unauthenticated Notice */}
      {(!currentUser || isGuest) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#121217] border border-[#272730] text-xs">
          <div className="flex items-center gap-2.5 text-[#929099]">
            <Lock className="w-4 h-4 text-[#B8A4D8] shrink-0" />
            <span>Sign in to your sanctuary account to converse with Aria AI and sync reflections.</span>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-[#B8A4D8] hover:bg-[#A691CB] text-[#080809] font-medium text-xs transition-colors shrink-0 cursor-pointer"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Chat Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="relative flex items-end gap-2.5 p-2 rounded-2xl bg-[#151518] border border-[#27272B] focus-within:border-[#B8A4D8]/50 transition-colors"
      >
        <textarea
          ref={textareaRef}
          rows={2}
          placeholder="Ask Aria about DevOps, AWS, Python, career decisions, or personal thoughts... (Enter to send, Shift+Enter for newline)"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="flex-1 bg-transparent px-3 py-1.5 text-xs sm:text-sm text-[#E8E6EB] placeholder-[#929099]/60 focus:outline-none resize-none font-light leading-relaxed disabled:opacity-50"
        />

        <div className="flex items-center gap-2 shrink-0 self-end">
          {isLoading && (
            <button
              type="button"
              onClick={handleStopGenerating}
              className="min-h-[44px] px-3.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 transition-colors text-xs font-light flex items-center gap-1.5 cursor-pointer"
              title="Stop Generating response"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Stop</span>
            </button>
          )}

          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-[#B8A4D8] text-[#080809] hover:bg-[#c7b6e4] transition-colors disabled:opacity-30 flex items-center justify-center shadow-sm"
            aria-label="Send message"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#080809]" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
