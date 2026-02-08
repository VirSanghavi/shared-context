'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function FeedbackPage() {
    const [category, setCategory] = useState('bug');
    const [message, setMessage] = useState('');
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!message.trim()) return;

        const res = await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category, email, message }),
        });

        if (res.ok) {
            setSubmitted(true);
        } else {
            const data = await res.json().catch(() => ({}));
            alert(data.error || "Failed to submit feedback");
        }
        setSubmitting(false);
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-white/10 tracking-tight lowercase">
            {/* Avalanche background */}
            <div className="bg-avalanche" />

            <Navbar />

            {/* White modal container */}
            <main className="pt-32 pb-20 px-6 relative z-10">
                <div className="max-w-lg mx-auto bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-10 text-neutral-900">
                    <div className="mb-8">
                        <h1 className="text-3xl font-medium tracking-tight mb-2">feedback</h1>
                        <p className="text-[11px] text-neutral-500 uppercase tracking-[0.2em]">help us improve axis</p>
                    </div>

                    {submitted ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="py-12"
                        >
                            <h2 className="text-xl font-medium mb-3">thank you</h2>
                            <p className="text-[13px] text-neutral-600 leading-relaxed mb-2">
                                Your feedback has been received. We read everything and use it to prioritize fixes and features.
                            </p>
                            <p className="text-[12px] text-neutral-500 leading-relaxed mb-8">
                                We can&apos;t reply to every message, but your input helps shape Axis. If you left an email and we need to follow up, we&apos;ll be in touch.
                            </p>
                            <Link
                                href="/dashboard"
                                className="inline-block bg-neutral-900 text-white px-6 py-3 rounded text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-neutral-800 transition-colors"
                            >
                                back to dashboard
                            </Link>
                        </motion.div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Category */}
                            <div>
                                <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-600 mb-3">
                                    category
                                </label>
                                <div className="flex gap-2">
                                    {['bug', 'feature', 'other'].map((cat) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setCategory(cat)}
                                            className={`px-4 py-2 rounded text-[10px] font-bold tracking-[0.1em] uppercase transition-colors ${category === cat
                                                ? 'bg-neutral-900 text-white'
                                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Email (optional) */}
                            <div>
                                <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-600 mb-2">
                                    email <span className="text-neutral-400">(optional)</span>
                                </label>
                                <input
                                    type="email"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-neutral-100 border border-neutral-200 rounded px-4 py-3 outline-none focus:border-neutral-400 text-[12px] font-mono text-neutral-900"
                                />
                            </div>

                            {/* Message */}
                            <div>
                                <label className="block text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-600 mb-2">
                                    message
                                </label>
                                <textarea
                                    placeholder="tell us what's on your mind..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={5}
                                    className="w-full bg-neutral-100 border border-neutral-200 rounded px-4 py-3 outline-none focus:border-neutral-400 text-[12px] text-neutral-900 resize-none"
                                    required
                                />
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={submitting || !message.trim()}
                                className="w-full bg-neutral-900 text-white py-3 rounded text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'sending...' : 'send feedback'}
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
