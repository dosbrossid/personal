'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
    Send,
    Sparkles,
    Loader2,
    Bot,
    User,
    X,
    Minus,
    MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DraftPreview } from './DraftPreview';
import type { AIResponseItem } from '@/core/types';
import type { RoleContext } from '@/core/constants';

const HISTORY_STORAGE_KEY = 'secondbrain-ai-chat-history';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    isStreaming?: boolean;
}

export interface DraftItem {
    action: AIResponseItem['action'];
    title: string;
    role: RoleContext;
    detail: string;
    rawItem: AIResponseItem;
}

/** Strip markdown formatting from AI messages for clean display */
function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1')   // **bold** → bold
        .replace(/\*(.*?)\*/g, '$1')        // *italic* → italic
        .replace(/#{1,6}\s?/g, '')          // ## heading → heading
        .replace(/^[-*+]\s/gm, '• ')        // - bullet → • bullet
        .replace(/`([^`]+)`/g, '$1')        // `code` → code
        .replace(/\n{3,}/g, '\n\n')         // collapse multiple newlines
        .trim();
}

export function AIChatBubble() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
    const [showDraft, setShowDraft] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        try {
            const raw = window.sessionStorage.getItem(HISTORY_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Message[];
            if (Array.isArray(parsed)) {
                setMessages(parsed.slice(-20));
            }
        } catch {
            // ignore invalid cached history
        }
    }, []);

    useEffect(() => {
        try {
            window.sessionStorage.setItem(
                HISTORY_STORAGE_KEY,
                JSON.stringify(messages.slice(-20))
            );
        } catch {
            // ignore storage failures
        }
    }, [messages]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, showDraft]);

    useEffect(() => {
        if (isOpen && !isMinimized && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen, isMinimized]);

    const toggleOpen = useCallback(() => {
        if (isOpen) {
            setIsOpen(false);
            setIsMinimized(false);
        } else {
            setIsOpen(true);
            setIsMinimized(false);
            setUnreadCount(0);
        }
    }, [isOpen]);

    async function handleSubmit(e?: React.FormEvent) {
        e?.preventDefault();
        if (isSubmitting || !input.trim()) return;
        setIsSubmitting(true);

        const userMsg: Message = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');

        // Add a placeholder assistant message for streaming
        const placeholderMsg: Message = {
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            isStreaming: true,
        };
        setMessages((prev) => [...prev, placeholderMsg]);

        // Abort controller for cancellation
        abortRef.current = new AbortController();

        try {
            const res = await fetch('/api/ai/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: userMsg.content }),
                signal: abortRef.current.signal,
            });

            if (!res.ok) {
                // Non-streaming error response
                const errData = await res.json().catch(() => ({ error: 'Terjadi kesalahan' }));
                setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        role: 'assistant',
                        content: errData.ai_message || errData.error || 'Maaf, terjadi kesalahan. Silakan coba lagi.',
                        timestamp: new Date().toISOString(),
                    };
                    return updated;
                });
                setDraftItems([]);
                setShowDraft(false);
                setIsSubmitting(false);
                return;
            }

            const contentType = res.headers.get('content-type') || '';

            if (contentType.includes('text/event-stream')) {
                // ── Streaming SSE Response ──
                const reader = res.body?.getReader();
                if (!reader) throw new Error('No response body');

                const decoder = new TextDecoder();
                let buffer = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]') continue;
                        if (!trimmed.startsWith('data: ')) continue;

                        const jsonStr = trimmed.slice(6);
                        try {
                            const event = JSON.parse(jsonStr);

                            if (event.type === 'token') {
                                // Accumulate tokens silently — don't show raw JSON to user
                                // Just keep the "thinking" animation active
                                setMessages((prev) => {
                                    const updated = [...prev];
                                    const lastIdx = updated.length - 1;
                                    if (updated[lastIdx]?.isStreaming && !updated[lastIdx]?.content) {
                                        updated[lastIdx] = {
                                            ...updated[lastIdx],
                                            content: 'Sedang memproses...',
                                            isStreaming: true,
                                        };
                                    }
                                    return updated;
                                });
                            } else if (event.type === 'complete') {
                                // Finalize the assistant message with ai_message
                                const aiMessage = stripMarkdown(
                                    event.response?.ai_message || 'Draft telah dibuat. Silakan review dan simpan.'
                                );
                                setMessages((prev) => {
                                    const updated = [...prev];
                                    const lastIdx = updated.length - 1;
                                    updated[lastIdx] = {
                                        role: 'assistant',
                                        content: aiMessage,
                                        timestamp: new Date().toISOString(),
                                        isStreaming: false,
                                    };
                                    return updated;
                                });

                                // Process draft items
                                if (event.items && event.items.length > 0) {
                                    const drafts: DraftItem[] = event.items.map(
                                        (item: AIResponseItem & { detail: string }) => ({
                                            action: item.action,
                                            title: item.data.title,
                                            role: item.data.contextual_role as RoleContext,
                                            detail: item.detail,
                                            rawItem: item,
                                        })
                                    );
                                    setDraftItems(drafts);
                                    setShowDraft(true);
                                } else {
                                    setDraftItems([]);
                                    setShowDraft(false);
                                }
                            } else if (event.type === 'error') {
                                setMessages((prev) => {
                                    const updated = [...prev];
                                    const lastIdx = updated.length - 1;
                                    updated[lastIdx] = {
                                        role: 'assistant',
                                        content: event.ai_message || event.error || 'Maaf, terjadi kesalahan.',
                                        timestamp: new Date().toISOString(),
                                        isStreaming: false,
                                    };
                                    return updated;
                                });
                                setDraftItems([]);
                                setShowDraft(false);
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }

                // Ensure streaming flag is cleared
                setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (updated[lastIdx]?.isStreaming) {
                        updated[lastIdx] = { ...updated[lastIdx], isStreaming: false };
                    }
                    return updated;
                });
            } else {
                // ── Non-streaming JSON fallback ──
                const data = await res.json();

                if (data.error) {
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: 'assistant',
                            content: stripMarkdown(data.ai_message || data.error || 'Maaf, terjadi kesalahan.'),
                            timestamp: new Date().toISOString(),
                        };
                        return updated;
                    });
                    setDraftItems([]);
                    setShowDraft(false);
                } else {
                    const aiMessage = stripMarkdown(
                        data.response?.ai_message || 'Draft telah dibuat. Silakan review dan simpan.'
                    );
                    setMessages((prev) => {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: 'assistant',
                            content: aiMessage,
                            timestamp: new Date().toISOString(),
                        };
                        return updated;
                    });

                    if (data.items && data.items.length > 0) {
                        const drafts: DraftItem[] = data.items.map(
                            (item: AIResponseItem & { detail: string }) => ({
                                action: item.action,
                                title: item.data.title,
                                role: item.data.contextual_role as RoleContext,
                                detail: item.detail,
                                rawItem: item,
                            })
                        );
                        setDraftItems(drafts);
                        setShowDraft(true);
                    } else {
                        setDraftItems([]);
                        setShowDraft(false);
                    }
                }
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                // User cancelled — clean up
                setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (updated[lastIdx]?.isStreaming) {
                        updated[lastIdx] = {
                            ...updated[lastIdx],
                            content: updated[lastIdx].content || 'Dibatalkan.',
                            isStreaming: false,
                        };
                    }
                    return updated;
                });
            } else {
                setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    updated[lastIdx] = {
                        role: 'assistant',
                        content: 'Maaf, terjadi kesalahan jaringan. Silakan coba lagi.',
                        timestamp: new Date().toISOString(),
                        isStreaming: false,
                    };
                    return updated;
                });
            }
            setDraftItems([]);
            setShowDraft(false);
        } finally {
            setIsSubmitting(false);
            abortRef.current = null;
            if (isMinimized || !isOpen) {
                setUnreadCount((prev) => prev + 1);
            }
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }

    function handleDraftDismiss() {
        setShowDraft(false);
        setDraftItems([]);
    }

    function handleClearConversation() {
        setMessages([]);
        setDraftItems([]);
        setShowDraft(false);
        setUnreadCount(0);
        try {
            window.sessionStorage.removeItem(HISTORY_STORAGE_KEY);
        } catch {
            // ignore storage failures
        }
    }

    function handleCancelRequest() {
        abortRef.current?.abort();
    }

    function handleDraftSuccess() {
        setShowDraft(false);
        setDraftItems([]);
        setMessages((prev) => [
            ...prev,
            {
                role: 'assistant',
                content: 'Semua item berhasil disimpan!',
                timestamp: new Date().toISOString(),
            },
        ]);

        // Invalidate SWR caches for affected modules
        import('swr').then(({ mutate }) => {
            mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/tasks'));
            mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/notes'));
            mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/calendar'));
            mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/vault'));
            mutate((key: unknown) => typeof key === 'string' && key.startsWith('/api/dashboard'));
        });
    }

    return (
        <>
            {/* ── Chat Panel ── */}
            <div
                className={cn(
                    'fixed bottom-24 right-6 z-50 flex flex-col',
                    'w-[400px] max-h-[600px]',
                    'rounded-2xl border border-border',
                    'bg-card/95 backdrop-blur-xl',
                    'shadow-2xl shadow-black/10 dark:shadow-black/30',
                    'transition-all duration-300 ease-out',
                    'origin-bottom-right',
                    isOpen && !isMinimized
                        ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto'
                        : 'scale-95 opacity-0 translate-y-4 pointer-events-none'
                )}
            >
                {/* ─── Header ─── */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
                    <div className="relative">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-300/20 dark:from-primary/30 dark:to-emerald-400/20 flex items-center justify-center">
                            <Sparkles className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-card">
                            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-50" />
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground leading-tight">
                            Asisten Pribadi
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                            {isSubmitting ? 'Sedang menyusun jawaban dan draft...' : 'Bisa bantu task, agenda, catatan, dan ide cepat'}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleClearConversation}
                            className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                            aria-label="Clear conversation"
                        >
                            Reset
                        </button>
                        <button
                            onClick={() => setIsMinimized(true)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                            aria-label="Minimize"
                        >
                            <Minus className="h-4 w-4" />
                        </button>
                        <button
                            onClick={toggleOpen}
                            className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* ─── Messages Area ─── */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[200px] max-h-[340px] scrollbar-thin"
                >
                    {/* Empty state */}
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center py-8">
                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/15 to-emerald-300/15 flex items-center justify-center mb-3">
                                <Sparkles className="h-7 w-7 text-primary" />
                            </div>
                            <h3 className="text-sm font-semibold text-foreground mb-1">
                                Halo, mau dibantu yang mana dulu?
                            </h3>
                            <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">
                                Tulis seperti kamu ngobrol biasa. Saya bantu pecah jadi task, agenda, catatan, atau draft yang siap disimpan.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                                {[
                                    'Besok jam 10 meeting klien',
                                    'Catat ide hook FOMO TikTok',
                                    'Upload RPS Algoritma',
                                ].map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        onClick={() => setInput(suggestion)}
                                        className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-200"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Message bubbles */}
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={cn(
                                'flex gap-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                            )}
                        >
                            {msg.role === 'assistant' && (
                                <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-primary/20 to-emerald-300/20 flex items-center justify-center mt-0.5">
                                    <Bot className="h-3.5 w-3.5 text-primary" />
                                </div>
                            )}

                            <div
                                className={cn(
                                    'max-w-[78%] px-3.5 py-2.5 text-[13px] leading-relaxed',
                                    msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md shadow-sm shadow-primary/20'
                                        : 'bg-muted/80 text-foreground rounded-2xl rounded-bl-md border border-border/50'
                                )}
                            >
                                <p className="whitespace-pre-wrap">
                                    {msg.content}
                                    {msg.isStreaming && (
                                        <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary/70 animate-pulse rounded-sm align-text-bottom" />
                                    )}
                                </p>
                                {!msg.isStreaming && (
                                    <p
                                        className={cn(
                                            'mt-1 text-[10px]',
                                            msg.role === 'user'
                                                ? 'text-primary-foreground/60'
                                                : 'text-muted-foreground/70'
                                        )}
                                    >
                                        {format(new Date(msg.timestamp), 'HH:mm')}
                                    </p>
                                )}
                            </div>

                            {msg.role === 'user' && (
                                <div className="h-7 w-7 shrink-0 rounded-full bg-muted border border-border flex items-center justify-center mt-0.5">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* ─── Draft Preview ─── */}
                {showDraft && draftItems.length > 0 && (
                    <DraftPreview
                        items={draftItems}
                        onDismiss={handleDraftDismiss}
                        onSuccess={handleDraftSuccess}
                    />
                )}

                {/* ─── Input Area ─── */}
                <form onSubmit={handleSubmit} className="border-t border-border/60 p-3">
                    <div className="relative flex items-end gap-2 rounded-xl bg-muted/50 border border-border/60 p-1.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all duration-200">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ketik perintah, ide, atau URL..."
                            rows={1}
                            className="max-h-24 min-h-[36px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                        />
                        <button
                            type="submit"
                            disabled={isSubmitting || !input.trim()}
                            className={cn(
                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
                                input.trim()
                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/25'
                                    : 'bg-transparent text-muted-foreground/40'
                            )}
                        >
                            {isSubmitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-3.5 w-3.5" />
                            )}
                        </button>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p className="text-[10px] text-muted-foreground/50">
                            Enter untuk kirim · Shift+Enter untuk baris baru
                        </p>
                        {isSubmitting && (
                            <button
                                type="button"
                                onClick={handleCancelRequest}
                                className="text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Batalkan
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* ── Floating Action Button (FAB) ── */}
            <button
                onClick={toggleOpen}
                aria-label={isOpen ? 'Close AI Chat' : 'Open AI Chat'}
                className={cn(
                    'fixed bottom-6 right-6 z-50',
                    'h-14 w-14 rounded-full',
                    'flex items-center justify-center',
                    'shadow-xl transition-all duration-300 ease-out',
                    'group',
                    isOpen
                        ? 'bg-muted text-foreground border border-border hover:bg-muted/80 shadow-lg shadow-black/5 dark:shadow-black/20'
                        : 'bg-gradient-to-br from-primary to-emerald-600 dark:from-primary dark:to-emerald-500 text-primary-foreground hover:scale-105 hover:shadow-2xl hover:shadow-primary/30 active:scale-95'
                )}
            >
                {isOpen ? (
                    <X className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
                ) : (
                    <>
                        <MessageCircle className="h-6 w-6 transition-transform group-hover:scale-110" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm animate-in zoom-in-50">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                        <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-30 pointer-events-none" />
                    </>
                )}
            </button>
        </>
    );
}
