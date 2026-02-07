'use client';

import { useState, useEffect } from 'react';
import { MotionConfig, motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Link from 'next/link';

// Helper for classes
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

// Simple bar chart component for usage
function UsageChart({ data }: { data: { day: string; requests: number }[] }) {
  const max = Math.max(...data.map(d => d.requests), 1);
  
  return (
    <div className="h-24 flex items-end gap-1">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: `${(d.requests / max) * 100}%` }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t min-h-[2px]"
          />
          <span className="text-[8px] text-neutral-400 font-mono">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<{ day: string; requests: number }[]>([]);
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    fetchKeys();
    fetchUsage();
  }, []);

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await fetch('/api/keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsage() {
    setUsageLoading(true);
    try {
      const res = await fetch('/api/usage');
      if (res.ok) {
        const data = await res.json();
        setUsageData(data.usage || []);
      } else {
        // Fallback to empty data
        setUsageData([]);
      }
    } catch (e) {
      console.error(e);
      setUsageData([]);
    } finally {
      setUsageLoading(false);
    }
  }

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName) return;

    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName })
      });
      if (res.ok) {
        const data = await res.json();
        setKeys([...keys, data.key]);
        setCreatedKey(data.key.secret);
        setNewKeyName('');
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteKey(id: string) {
    if (!confirm('Are you sure? This action cannot be undone.')) return;
    try {
      await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      setKeys(keys.filter(k => k.id !== id));
    } catch (e) {
      console.error(e);
    }
  }

  const totalRequests = usageData.reduce((sum, d) => sum + d.requests, 0);

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-white/10 tracking-tight lowercase">
      {/* Avalanche background */}
      <div className="bg-avalanche" />
      
      {/* Minimal inline navbar */}
      <nav className="w-full fixed top-0 z-50 py-6 px-8 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">axis</Link>
        <div className="flex items-center gap-6 text-[11px] font-medium tracking-[0.2em] opacity-60">
          <Link href="/feedback" className="hover:text-white transition-colors">thoughts?</Link>
          <Link href="https://github.com/VirSanghavi/shared-context" className="hover:text-white transition-colors">github</Link>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="hover:text-white transition-colors">logout</button>
          </form>
        </div>
      </nav>

      {/* White modal container */}
      <main className="pt-32 pb-20 px-6 relative z-10">
        <div className="max-w-4xl mx-auto bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 text-neutral-900 max-h-[85vh] overflow-hidden flex flex-col">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-3xl font-medium tracking-tight mb-2">dashboard</h1>
              <p className="text-[11px] text-neutral-500 uppercase tracking-[0.2em]">manage your api keys and context governance.</p>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-12 flex-1 min-h-0">
            {/* Main Content */}
            <div className="md:col-span-7 flex flex-col min-h-0">
              <section className="flex flex-col min-h-0 flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[11px] font-bold tracking-[0.3em] uppercase text-neutral-600">your api keys</h2>
                  <button 
                    onClick={() => setCreatedKey(null)}
                    className="text-[10px] font-mono text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-widest"
                  >
                    create new key
                  </button>
                </div>

                {/* Create key form - always visible at top */}
                <motion.form 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  onSubmit={createKey} 
                  className="mb-3 flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="key name (e.g. production)"
                    className="flex-1 bg-neutral-100 border border-neutral-200 rounded px-3 py-2 outline-none focus:border-neutral-400 text-[12px] font-mono tracking-wider text-neutral-900"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                  <button 
                    type="submit" 
                    className="bg-neutral-900 text-white px-4 py-2 rounded text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-neutral-800 transition-colors"
                  >
                    create
                  </button>
                </motion.form>

                {/* Fixed height scrollable container for keys */}
                <div className="h-28 overflow-y-auto space-y-2 pr-1 border border-neutral-100 rounded-lg p-1.5 bg-neutral-50/50">
                  {/* Show the newly created key at top of scroll area */}
                  {createdKey && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-emerald-50 border border-emerald-200 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-emerald-700">key created</h3>
                        <button 
                          onClick={() => setCreatedKey(null)}
                          className="text-[9px] font-mono text-emerald-500 hover:text-emerald-700 transition-colors uppercase tracking-widest"
                        >
                          dismiss
                        </button>
                      </div>
                      <p className="text-[9px] text-emerald-600 mb-2">
                        copy now—you won't see it again.
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white border border-emerald-200 rounded px-2 py-1.5 text-[10px] font-mono text-neutral-800 select-all break-all">
                          {createdKey}
                        </code>
                        <button 
                          onClick={() => navigator.clipboard.writeText(createdKey)}
                          className="bg-emerald-600 text-white px-2 py-1.5 rounded text-[9px] font-bold tracking-[0.1em] uppercase hover:bg-emerald-700 transition-colors"
                        >
                          copy
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {loading ? (
                    <div className="font-mono text-[11px] text-neutral-400 uppercase tracking-[0.3em] py-4 text-center">loading...</div>
                  ) : keys.length === 0 && !createdKey ? (
                    <div className="font-mono text-[11px] text-neutral-400 uppercase tracking-[0.3em] py-4 text-center">no keys yet</div>
                  ) : (
                    keys.map((key) => (
                      <div key={key.id} className="bg-white border border-neutral-200 rounded-lg p-3 flex items-center justify-between group transition-all hover:bg-neutral-100">
                        <div>
                          <div className="text-[12px] font-medium tracking-tight mb-0.5">{key.name}</div>
                          <div className="font-mono text-[10px] text-neutral-400 tracking-wider">
                            {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'never used'}
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteKey(key.id)}
                          className="text-neutral-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Usage Graph */}
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-600">usage this week</h3>
                    <span className="text-[11px] font-mono text-neutral-500">{totalRequests.toLocaleString()} requests</span>
                  </div>
                  <UsageChart data={usageData} />
                </div>
              </section>
            </div>

            {/* Sidebar */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-neutral-100 border border-neutral-200 rounded-lg p-5">
                <h3 className="text-[9px] font-mono text-neutral-500 uppercase tracking-[0.3em] mb-3">subscription</h3>
                <div className="mb-4">
                  <div className="text-[16px] font-medium tracking-tight mb-0.5">pro plan</div>
                  <div className="text-[10px] font-mono text-neutral-400 tracking-wider">active until march 2026</div>
                </div>
                <Link 
                  href="/billing"
                  className="block w-full bg-neutral-900 text-white py-2.5 rounded text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-neutral-800 transition-colors text-center"
                >
                  manage billing
                </Link>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-5">
                <h3 className="text-[9px] font-mono text-neutral-500 uppercase tracking-[0.3em] mb-2">support</h3>
                <p className="text-[10px] text-neutral-500 leading-relaxed normal-case mb-3">
                  need help with mcp headers or context governance?
                </p>
                <Link href="/support" className="text-[9px] font-mono text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-widest">
                  contact support ↗
                </Link>
              </div>

              {/* Docs button */}
              <Link 
                href="/docs" 
                className="block w-full bg-neutral-900 text-white py-2.5 rounded text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-neutral-800 transition-colors text-center"
              >
                view docs
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
