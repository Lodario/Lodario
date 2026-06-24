'use client';

import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, MessageSquare, Send, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

const FEEDBACK_EMAIL = 'contact.lodario@gmail.com';

interface FeedbackButtonProps {
  contextLabel?: string;
  className?: string;
  iconSize?: number;
}

interface FeedbackModalProps {
  contextLabel?: string;
  onClose: () => void;
}

function buildFeedbackBody(params: {
  userEmail: string;
  loggedInUserEmail: string;
  userRole: string;
  title: string;
  description: string;
  context: string;
  timestamp: string;
}): string {
  return [
    'Lodario Beta Feedback',
    '',
    `Logged-in user email: ${params.loggedInUserEmail || 'Not provided'}`,
    `Entered user email: ${params.userEmail || 'Not provided'}`,
    `User role: ${params.userRole || 'Not provided'}`,
    `Title: ${params.title.trim() || 'Untitled feedback'}`,
    `Page/context: ${params.context}`,
    `Timestamp: ${params.timestamp}`,
    '',
    'Description:',
    params.description.trim() || 'Not provided',
  ].join('\n');
}

function fallbackCopyToClipboard(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

export function FeedbackButton({ contextLabel, className, iconSize = 18 }: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className={className}>
        <MessageSquare size={iconSize} />
        <span>Send Feedback</span>
      </button>

      {isOpen && (
        <FeedbackModal
          contextLabel={contextLabel}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

export function FeedbackModal({ contextLabel, onClose }: FeedbackModalProps) {
  const { user, userRole } = useAuth();
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [isMounted, setIsMounted] = useState(false);
  const [website, setWebsite] = useState('');

  useEffect(() => {
    setUserEmail(user?.email ?? '');
  }, [user?.email]);

  useEffect(() => {
    setIsMounted(true);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const context = useMemo(() => {
    const parts = [contextLabel, pathname].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : 'Unknown';
  }, [contextLabel, pathname]);

  const timestamp = useMemo(() => new Date().toISOString(), []);
  const formattedFeedback = buildFeedbackBody({
    userEmail,
    loggedInUserEmail: user?.email ?? '',
    userRole: userRole ?? '',
    title,
    description,
    context,
    timestamp,
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    setSendNote(null);
    setSendError(null);

    if (!trimmedTitle || !trimmedDescription) {
      setSendError('Please add a title and description before sending.');
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail,
          loggedInUserEmail: user?.email ?? '',
          userRole,
          title: trimmedTitle,
          description: trimmedDescription,
          pagePath: pathname,
          context,
          timestamp,
          appContext: {
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            userAgent: navigator.userAgent,
          },
          website,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || 'Unable to send feedback right now.');
      }

      setSendNote('Feedback sent. Thank you.');
      setTitle('');
      setDescription('');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Unable to send feedback right now.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCopy = async () => {
    setCopyStatus('idle');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(formattedFeedback);
      } else if (!fallbackCopyToClipboard(formattedFeedback)) {
        throw new Error('Copy command failed');
      }

      setCopyStatus('copied');
    } catch {
      const copied = fallbackCopyToClipboard(formattedFeedback);
      setCopyStatus(copied ? 'copied' : 'failed');
    }
  };

  if (!isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.1)] bg-[var(--background)] shadow-2xl animate-slide-up sm:h-auto sm:max-h-[85vh] sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.1)] bg-[var(--card-bg)] p-4">
          <h2 className="text-lg font-bold text-white">Send Feedback</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[rgba(255,255,255,0.05)] p-2 text-gray-400 hover:text-white"
            aria-label="Close feedback"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5">
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              className="hidden"
              aria-hidden="true"
            />

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Your Email
              </label>
              <input
                type="email"
                value={userEmail}
                onChange={(event) => setUserEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] p-3 text-white outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Feedback Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What should we improve?"
                className="w-full rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] p-3 text-white outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Description
              </label>
              <textarea
                required
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Tell us what happened, what you expected, or what would help."
                rows={4}
                className="min-h-[110px] w-full resize-y rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] p-3 text-sm text-white outline-none focus:border-[var(--accent-primary)] sm:min-h-[140px]"
              />
            </div>

            <div className="rounded-xl border border-[rgba(var(--accent-secondary-rgb),0.25)] bg-[rgba(var(--accent-secondary-rgb),0.08)] p-3">
              <p className="text-xs leading-relaxed text-gray-300">
                Feedback is sent directly to {FEEDBACK_EMAIL}. If sending fails, copy the feedback and send it manually.
              </p>
              {sendNote && <p className="mt-2 text-xs text-gray-400">{sendNote}</p>}
              {sendError && <p className="mt-2 text-xs text-[#ff6b6b]">{sendError}</p>}
            </div>
          </div>

          <div className="shrink-0 border-t border-[rgba(255,255,255,0.1)] bg-[var(--background)] p-5">
            <button
              type="button"
              onClick={handleCopy}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] py-3 text-sm font-bold text-white transition-colors hover:bg-[rgba(255,255,255,0.08)] touch-target"
            >
              {copyStatus === 'copied' ? <Check size={18} /> : <Copy size={18} />}
              {copyStatus === 'copied' ? 'Feedback Copied' : 'Copy Feedback'}
            </button>
            {copyStatus === 'failed' && (
              <p className="mb-3 text-xs text-[#ff6b6b]">
                Copy failed. Please select and copy the feedback details manually.
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.05)] py-3 text-sm font-bold text-gray-300 transition-colors hover:text-white touch-target"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="flex-1 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-tertiary)] py-3 text-sm font-bold text-black shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 touch-target"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Send size={17} />
                  {isSending ? 'Sending...' : 'Send Feedback'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
