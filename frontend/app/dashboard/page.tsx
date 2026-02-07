'use client';

import { useState, useEffect } from 'react';
import { MotionConfig, motion, AnimatePresence } from 'framer-motion';
import { Key, trash2, Check, Copy, Plus, Trash2, Shield, CreditCard, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Helper for classes
function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Dashboard() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Determine user from session? Not easily exposed to client without an endpoint
    // Just fetch keys for now which validates auth
    fetchKeys();
  }, []);

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await fetch('/api/keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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

  return (
    <div className="container-custom py-20 max-w-5xl">
      <div className="flex justify-between items-end mb-12">
        <div>
           <h1 className="text-4xl font-mono mb-2">Dashboard</h1>
           <p className="text-[var(--muted)]">Manage your API keys and billing.</p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        {/* Sidebar / Stats */}
        <div className="space-y-6">
           <div className="border border-[var(--border)] rounded-lg p-6 bg-[#1a1a1a]/50">
              <div className="flex items-center gap-3 mb-4 text-[var(--fg)]">
                <Shield className="w-5 h-5"/>
                <h2 className="font-bold">Subscription</h2>
              </div>
              <div className="mb-6">
                <div className="text-2xl font-mono">Pro Plan</div>
                <div className="text-sm text-[var(--muted)]">Active until Mar 01, 2026</div>
              </div>
              <form action="/api/stripe/portal" method="POST">
                 <button className="btn-secondary w-full flex items-center justify-center gap-2">
                    <CreditCard className="w-4 h-4"/>
                    Manage Billing
                 </button>
              </form>
           </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2 space-y-8">
           
           {/* Create Key */}
           <section className="border border-[var(--border)] rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">API Keys</h2>
              
              <AnimatePresence>
              {createdKey && (
                <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6 bg-green-900/20 border border-green-800 rounded p-4 overflow-hidden"
                >
                    <div className="text-green-400 text-sm mb-2 font-bold">New Key Generated (Copy immediately, it won't be shown again)</div>
                    <div className="flex gap-2">
                        <code className="flex-1 bg-black/30 p-2 rounded font-mono text-sm break-all">{createdKey}</code>
                        <button onClick={() => navigator.clipboard.writeText(createdKey)} className="p-2 hover:bg-white/10 rounded"><Copy className="w-4 h-4"/></button>
                    </div>
                </motion.div>
              )}
              </AnimatePresence>

              <form onSubmit={createKey} className="flex gap-3 mb-8">
                 <input 
                    type="text" 
                    placeholder="e.g. CI/CD Agent" 
                    className="flex-1 bg-transparent border border-[var(--border)] rounded px-3 py-2 text-sm focus:outline-none focus:border-[var(--fg)]"
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                 />
                 <button type="submit" className="btn-primary flex items-center gap-2" disabled={!newKeyName}>
                    <Plus className="w-4 h-4"/>
                    Create Key
                 </button>
              </form>

              <div className="space-y-3">
                 {loading ? (
                    <div className="flex justify-center py-8 text-[var(--muted)]"><Loader2 className="w-6 h-6 animate-spin"/></div>
                 ) : keys.length === 0 ? (
                    <div className="text-center py-8 text-[var(--muted)] text-sm">No API keys found.</div>
                 ) : (
                    keys.map(key => (
                        <div key={key.id} className="flex items-center justify-between p-3 border border-[var(--border)] rounded bg-[#1a1a1a]/30">
                            <div>
                                <div className="font-bold text-sm">{key.name}</div>
                                <div className="text-xs text-[var(--muted)] font-mono">sk_sc_...{key.id.slice(0,4)}</div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-[var(--muted)]">Created {new Date(key.created_at).toLocaleDateString()}</span>
                                <button onClick={() => deleteKey(key.id)} className="text-[var(--muted)] hover:text-red-500 transition-colors">
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    ))
                 )}
              </div>
           </section>
        </div>
      </div>
    </div>
  );
}
