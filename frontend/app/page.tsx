'use client';

import Link from "next/link";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="flex flex-col items-center overflow-hidden">
      {/* Background Mesh */}
      <div className="absolute inset-0 z-[-1] opacity-20 pointer-events-none">
          <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-sky-900 rounded-full blur-[120px] mix-blend-screen animate-pulse duration-[4s]" />
          <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-emerald-900 rounded-full blur-[100px] mix-blend-screen" />
      </div>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 text-center max-w-5xl mx-auto relative">
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
        >
            <h1 className="text-5xl md:text-7xl font-mono mb-8 tracking-tighter">
              context for <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">ai agents</span>
            </h1>
            <p className="text-xl md:text-2xl text-[var(--muted)] mb-12 max-w-3xl mx-auto font-light leading-relaxed">
              An API and MCP layer that gives agents continuously updated context from libraries,
              research papers, and docs. <span className="text-[var(--fg)]">Eliminate hallucinations.</span>
            </p>
        </motion.div>

        {/* Console / Demo */}
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-[#0a0a0a] border border-[#333] rounded-xl p-1 mb-12 shadow-2xl mx-auto w-full max-w-2xl overflow-hidden"
        >
          <div className="bg-[#111] px-4 py-2 flex items-center gap-2 border-b border-[#333]">
              <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"/>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"/>
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"/>
              </div>
              <div className="text-xs text-[var(--muted)] ml-2 font-mono">search-context — agent-v1</div>
          </div>
          <div className="p-6 text-left font-mono text-sm md:text-base h-[200px] flex flex-col">
             <div className="text-[var(--muted)] mb-2">$ agent ask "how does Auth work in Shared Context?"</div>
             <div className="flex-1 text-emerald-400">
                <Typewriter text={"> Searching indexed docs... found 4 references.\n> Analyzing 'lib/auth.ts'...\n> The system uses generic JWTs signed with APP_SESSION_SECRET.\n> Middleware intercepts requests to check for 'sc_session' cookie.\n> \n> Context loaded. Ready to implement."} />
             </div>
             <div className="mt-4 flex justify-between items-center text-xs text-[var(--muted)] border-t border-[#333] pt-3">
                 <span>4 sources indexed</span>
                 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/> System Online</span>
             </div>
          </div>
        </motion.div>

        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col md:flex-row gap-4 justify-center"
        >
          <Link href="/login" className="btn-primary text-lg px-8 py-3 rounded-full">
            Get Started
          </Link>
          <div className="flex items-center gap-3 bg-[#1a1a1a] px-6 py-3 rounded-full border border-[var(--border)] font-mono text-sm group cursor-pointer hover:border-[var(--fg)] transition-colors">
             <span className="text-[var(--muted)]">$</span> npx shared-context-wizard@latest
             <CopyIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ml-2"/>
          </div>
        </motion.div>
      </section>

      {/* Pricing / Features */}
      <section className="py-20 w-full border-t border-[var(--border)] bg-[#0a0a0a]/50 backdrop-blur-sm">
        <div className="container-custom">
            <h2 className="text-2xl font-mono mb-16 text-center tracking-widest text-[var(--muted)]">PRICING</h2>
            
            <motion.div 
                whileHover={{ y: -5 }}
                className="max-w-md mx-auto border border-[var(--border)] p-8 rounded-2xl bg-[#0a0a0a] relative overflow-hidden group"
            >
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
                
                <div className="relative z-10">
                    <div className="flex justify-between items-baseline mb-4">
                        <h3 className="text-xl font-bold">Pro</h3>
                        <div className="text-4xl font-mono"><span className="text-sm text-[var(--muted)]">/mo</span></div>
                    </div>
                    <p className="text-[var(--muted)] mb-8">Everything you need to give your agents infinite context.</p>
                    <ul className="space-y-4 mb-4 text-sm">
                        {['Unlimited indexing', 'Unlimited queries', 'Deep research enabled', 'MCP Server Access', 'Priority Support'].map(item => (
                            <li key={item} className="flex gap-3 items-center">
                                <span className="bg-emerald-900/50 text-emerald-400 rounded-full p-1"><CheckIcon className="w-3 h-3"/></span>
                                {item}
                            </li>
                        ))}
                    </ul>
                    <form action="/api/stripe/checkout" method="POST" className="mt-8">
                    <button type="submit" className="w-full btn-primary py-3 rounded-lg font-bold">Subscribe</button>
                    </form>
                </div>
            </motion.div>
        </div>
      </section>
    </div>
  );
}

// Simple Typewriter Component
function Typewriter({ text }: { text: string }) {
    return (
        <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
        >
            {text.split('\n').map((line, i) => (
                <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.8, duration: 0.5 }}
                >
                    {line}
                </motion.div>
            ))}
        </motion.div>
    )
}

function CheckIcon(props: any) {
    return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
}

function CopyIcon(props: any) {
    return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
}
