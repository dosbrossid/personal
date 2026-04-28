'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
    Send,
    Sparkles,
    Loader2,
    Bot,
    User,
    X,
    Minus,
    MessageCircle,
    ImagePlus,
    Link2,
    Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DraftPreview } from './DraftPreview';
import type { AIResponseItem } from '@/core/types';
import type { RoleContext } from '@/core/constants';

const HISTORY_STORAGE_KEY = 'secondbrain-ai-chat-history';
const MAX_ATTACHMENT_SIZE_BYTES = 4 * 1024 * 1024;

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    isStreaming?: boolean;
}

interface ImageAttachment {
    name: string;
    mimeType: string;
    dataUrl: string;
    sizeBytes: number;
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
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/#{1,6}\s?/g, '')
        .replace(/^[-*+]\s/gm, '• ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function formatFileSize(sizeBytes: number) {
    if (sizeBytes < 1024 * 1024) {
        return `${Math.round(sizeBytes / 102.4) / 10} KB`;
    }

    return `${Math.round(sizeBytes / 104857.6) / 10} MB`;
}

function readImageAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
        reader.readAsDataURL(file);
    });
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
    const [attachment, setAttachment] = useState<ImageAttachment | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    const isPanelVisible = isOpen && !isMinimized;

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
        if (isPanelVisible && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 250);
        }
    }, [isPanelVisible]);

    const toggleOpen = useCallback(() => {
        if (isOpen && isMinimized) {
            setIsMinimized(false);
            setUnreadCount(0);
            return;
        }

        if (isOpen) {
            setIsOpen(false);
            setIsMinimized(false);
        } else {
            setIsOpen(true);
            setIsMinimized(false);
            setUnreadCount(0);
        }
    }, [isMinimized, isOpen]);

    async function handleAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Yang didukung hanya file gambar.');
            return;
        }

        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
            toast.error('Ukuran gambar maksimal 4MB agar analisa tetap ringan.');
            return;
        }

        try {
            const dataUrl = await readImageAsDataUrl(file);
            if (!dataUrl) {
                toast.error('Gagal membaca gambar.');
                return;
            }

            setAttachment({
                name: file.name,
                mimeType: file.type,
                dataUrl,
                sizeBytes: file.size,
            });
        } catch {
            toast.error('Gagal menyiapkan gambar untuk analisa.');
        }
    }

    async function handleSubmit(e?: React.FormEvent) {
        e?.preventDefault();
        if (isSubmitting || (!input.trim() && !attachment)) return;
        setIsSubmitting(true);

        const conversation = messages
            .filter((message) => !message.isStreaming)
            .slice(-8)
            .map((message) => ({
                role: message.role,
                content: message.content,
            }));

        const normalizedInput = input.trim() || 'Tolong analisa gambar ini dan jelaskan secara ringkas.';
        const attachmentForRequest = attachment;
        const userBubbleContent = attachmentForRequest
            ? `${normalizedInput}\n\n[📷 Gambar terlampir untuk dianalisis]`
            : normalizedInput;

        const userMsg: Message = {
            role: 'user',
            content: userBubbleContent,
            timestamp: new Date().toISOString(),
        };

        const placeholderMsg: Message = {
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            isStreaming: true,
        };

        setMessages((prev) => [...prev, userMsg, placeholderMsg]);
        setInput('');
        setAttachment(null);

        abortRef.current = new AbortController();

        try {
            const res = await fetch('/api/ai/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: normalizedInput,
                    conversation,
                    attachment: attachmentForRequest
                        ? {
                              name: attachmentForRequest.name,
                              mimeType: attachmentForRequest.mimeType,
                              dataUrl: attachmentForRequest.dataUrl,
                          }
                        : null,
                }),
                signal: abortRef.current.signal,
            });

            if (!res.ok) {
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

                setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (updated[lastIdx]?.isStreaming) {
                        updated[lastIdx] = { ...updated[lastIdx], isStreaming: false };
                    }
                    return updated;
                });
            } else {
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
        setAttachment(null);
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
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAttachmentChange}
            />

            <div
                className={cn(
                    'fixed inset-x-3 bottom-20 z-50 flex flex-col overflow-hidden',
                    'max-h-[calc(100vh-7rem)] rounded-2xl border border-border bg-card/95 backdrop-blur-xl',
                    'shadow-2xl shadow-black/10 dark:shadow-black/30 transition-all duration-300 ease-out',
                    'origin-bottom-right sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[400px] sm:max-h-[600px]',
                    isPanelVisible
                        ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto'
                        : 'scale-95 opacity-0 translate-y-4 pointer-events-none'
                )}
            >
                <div className="flex items-start gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
                    <div className="relative shrink-0">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-emerald-300/20 dark:from-primary/30 dark:to-emerald-400/20">
                            <Sparkles className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500">
                            <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-50 animate-ping" />
                        </span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold leading-tight text-foreground">
                            Asisten Pribadi
                        </h3>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                            {isSubmitting
                                ? 'Sedang menganalisis, berdiskusi, atau menyusun draft...'
                                : 'Bisa diajak diskusi, analisa gambar, atau bantu task, agenda, catatan, dan link vault'}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={handleClearConversation}
                            className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                            aria-label="Clear conversation"
                        >
                            Reset
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsMinimized(true)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                            aria-label="Minimize"
                        >
                            <Minus className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={toggleOpen}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                            aria-label="Close"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div
                    ref={scrollRef}
                    className="min-h-[180px] flex-1 space-y-3 overflow-y-auto px-3 py-4 scrollbar-thin sm:max-h-[340px] sm:px-4"
                >
                    {messages.length === 0 && (
                        <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-emerald-300/15">
                                <Sparkles className="h-7 w-7 text-primary" />
                            </div>
                            <h3 className="mb-1 text-sm font-semibold text-foreground">
                                Halo, mau ngobrol atau bikin apa dulu?
                            </h3>
                            <p className="max-w-[280px] text-xs leading-relaxed text-muted-foreground">
                                Kamu bisa diskusi biasa, kirim gambar untuk dianalisis, atau minta saya bantu pecah jadi task, agenda, catatan, dan draft link vault.
                            </p>
                            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                                {[
                                    'Besok jam 10 meeting klien',
                                    'Bantu susun ide konten dari topik AI',
                                    'Simpan link jurnal ini ke vault',
                                ].map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        type="button"
                                        onClick={() => setInput(suggestion)}
                                        className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-[11px] text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={`${msg.timestamp}-${i}`}
                            className={cn(
                                'flex gap-2.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                            )}
                        >
                            {msg.role === 'assistant' && (
                                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-emerald-300/20">
                                    <Bot className="h-3.5 w-3.5 text-primary" />
                                </div>
                            )}

                            <div
                                className={cn(
                                    'max-w-[85%] px-3.5 py-2.5 text-[13px] leading-relaxed sm:max-w-[78%]',
                                    msg.role === 'user'
                                        ? 'rounded-2xl rounded-br-md bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                                        : 'rounded-2xl rounded-bl-md border border-border/50 bg-muted/80 text-foreground'
                                )}
                            >
                                <p className="whitespace-pre-wrap break-words">
                                    {msg.content}
                                    {msg.isStreaming && (
                                        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary/70 align-text-bottom" />
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
                                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {showDraft && draftItems.length > 0 && (
                    <DraftPreview
                        items={draftItems}
                        onDismiss={handleDraftDismiss}
                        onSuccess={handleDraftSuccess}
                    />
                )}

                <form onSubmit={handleSubmit} className="border-t border-border/60 p-3">
                    {attachment && (
                        <div className="mb-2 rounded-xl border border-primary/20 bg-primary/[0.04] p-2.5">
                            <div className="flex items-start gap-3">
                                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border/60">
                                    <Image
                                        src={attachment.dataUrl}
                                        alt={attachment.name}
                                        fill
                                        sizes="56px"
                                        className="object-cover"
                                        unoptimized
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium text-foreground">{attachment.name}</p>
                                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                                        {formatFileSize(attachment.sizeBytes)} · Hanya dianalisa sekali, tidak disimpan
                                    </p>
                                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                                        Kalau mau masuk vault, kirim link-nya. Upload gambar di sini hanya untuk diskusi atau analisa cepat.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAttachment(null)}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    aria-label="Hapus gambar"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="rounded-xl border border-border/60 bg-muted/50 p-1.5 transition-all duration-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                        <div className="flex items-end gap-2">
                            <textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ketik pertanyaan, ide, perintah, atau link..."
                                rows={1}
                                className="min-h-[36px] max-h-28 flex-1 resize-none bg-transparent px-2.5 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                            />
                            <button
                                type="submit"
                                disabled={isSubmitting || (!input.trim() && !attachment)}
                                className={cn(
                                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200',
                                    input.trim() || attachment
                                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90'
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

                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                                >
                                    <ImagePlus className="h-3.5 w-3.5" />
                                    Analisa gambar
                                </button>
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
                                    <Link2 className="h-3 w-3" />
                                    Vault di chat hanya menerima link
                                </span>
                            </div>
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
                    </div>

                    <p className="mt-1.5 text-[10px] text-muted-foreground/50">
                        Enter untuk kirim · Shift+Enter untuk baris baru
                    </p>
                </form>
            </div>

            <button
                type="button"
                onClick={toggleOpen}
                aria-label={isPanelVisible ? 'Close AI Chat' : 'Open AI Chat'}
                className={cn(
                    'fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300 ease-out group sm:right-6',
                    isPanelVisible
                        ? 'border border-border bg-muted text-foreground shadow-lg shadow-black/5 hover:bg-muted/80 dark:shadow-black/20'
                        : 'bg-gradient-to-br from-primary to-emerald-600 text-primary-foreground hover:scale-105 hover:shadow-2xl hover:shadow-primary/30 active:scale-95 dark:from-primary dark:to-emerald-500'
                )}
            >
                {isPanelVisible ? (
                    <X className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
                ) : (
                    <>
                        <MessageCircle className="h-6 w-6 transition-transform group-hover:scale-110" />
                        {unreadCount > 0 && (
                            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm animate-in zoom-in-50">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                        <span className="pointer-events-none absolute inset-0 rounded-full bg-primary/20 opacity-30 animate-ping" />
                    </>
                )}
            </button>
        </>
    );
}
