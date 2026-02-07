'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const codeStyle = vscDarkPlus;

export default function Docs() {
    const [activeTab, setActiveTab] = useState('quickstart');

    const tabs = [
        { id: 'quickstart', label: 'quickstart' },
        { id: 'mcp', label: 'mcp config' },
        { id: 'governance', label: 'governance' },
        { id: 'billing', label: 'billing' },
        { id: 'api', label: 'api reference' },
        { id: 'python', label: 'python sdk' },
    ];

    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-white/10 tracking-tight lowercase">
            {/* Avalanche background */}
            <div className="bg-avalanche" />

            {/* Minimal inline navbar */}
            <nav className="w-full fixed top-0 z-50 py-6 px-8 flex items-center justify-between">
                <Link href="/" className="font-bold text-lg tracking-tight">axis</Link>
                <div className="flex items-center gap-6 text-[11px] font-medium tracking-[0.2em] opacity-60">
                    <Link href="/dashboard" className="hover:text-white transition-colors">dashboard</Link>
                    <Link href="/feedback" className="hover:text-white transition-colors">thoughts?</Link>
                </div>
            </nav>

            {/* White modal container */}
            <main className="min-h-screen flex items-center justify-center py-20 px-6 relative z-10">
                <div className="max-w-5xl w-full mx-auto bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-0 text-neutral-900 overflow-hidden flex flex-col md:flex-row min-h-[700px]">

                    {/* Sidebar */}
                    <div className="w-full md:w-64 bg-neutral-50 border-r border-neutral-200 p-8 flex flex-col">
                        <div className="mb-10">
                            <h1 className="text-2xl font-medium tracking-tight mb-1">documentation</h1>
                            <p className="text-[10px] text-neutral-400 uppercase tracking-[0.2em]">axis v1.0</p>
                        </div>

                        <div className="space-y-1">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full text-left px-4 py-3 rounded-lg text-[11px] font-bold tracking-[0.15em] uppercase transition-all ${activeTab === tab.id
                                            ? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200'
                                            : 'text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="mt-auto pt-8 border-t border-neutral-200">
                            <Link href="/support" className="text-[10px] font-mono text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-widest">
                                need help? support ↗
                            </Link>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 p-10 md:p-14 overflow-y-auto max-h-[85vh]">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                            {activeTab === 'quickstart' && <QuickstartSection />}
                            {activeTab === 'mcp' && <MCPSection />}
                            {activeTab === 'governance' && <GovernanceSection />}
                            {activeTab === 'billing' && <BillingSection />}
                            {activeTab === 'api' && <APISection />}
                            {activeTab === 'python' && <PythonSection />}
                        </motion.div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function Section({ title, subtitle, children }: { title: string, subtitle: string, children: React.ReactNode }) {
    return (
        <div className="space-y-8">
            <div className="space-y-2">
                <h2 className="text-4xl font-medium tracking-tighter text-neutral-900">{title}</h2>
                <p className="text-[11px] text-neutral-500 uppercase tracking-[0.2em] font-medium">{subtitle}</p>
            </div>
            <div className="prose prose-neutral max-w-none text-neutral-600 leading-relaxed text-[14px]">
                {children}
            </div>
        </div>
    );
}

function CodeBlock({ code, lang = 'bash' }: { code: string, lang?: string }) {
    return (
        <div className="rounded-xl overflow-hidden border border-neutral-200 shadow-sm my-6">
            <div className="bg-neutral-50 px-5 py-3 text-[10px] text-neutral-400 font-mono border-b border-neutral-200 flex justify-between items-center tracking-widest uppercase font-bold">
                <span>{lang}</span>
                <button onClick={() => navigator.clipboard.writeText(code)} className="hover:text-neutral-900 transition-colors">copy</button>
            </div>
            <SyntaxHighlighter
                language={lang}
                style={codeStyle}
                customStyle={{
                    margin: 0,
                    padding: '1.25rem',
                    background: '#0a0a0a',
                    fontSize: '13px',
                    fontFamily: 'monospace'
                }}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    );
}

function QuickstartSection() {
    return (
        <Section title="quickstart" subtitle="get running in 60 seconds">
            <p className="text-lg text-neutral-500 leading-relaxed mb-8">
                axis mirrors your project structure and streams high-fidelity context directly into agent prompts without complex rag pipelines.
            </p>

            <div className="space-y-10">
                <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-neutral-900 mb-4">1. initialize the axis cli</h3>
                    <p className="mb-4">run the axis-init command in your project root to map your workspace.</p>
                    <CodeBlock code="npx axis-init@latest" />
                </div>

                <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-neutral-900 mb-4">2. connect your agent</h3>
                    <p className="mb-4">point your cursor or claude instance to the mirror endpoint.</p>
                    <CodeBlock code={`npm install -g @axis/server
export AXIS_API_KEY=sk_ax_...
axis-server`} />
                </div>
            </div>
        </Section>
    )
}

function MCPSection() {
    return (
        <Section title="mcp config" subtitle="model context protocol integration">
            <p className="mb-6">
                add this configuration to your mcp settings file (e.g., <code className="bg-neutral-100 px-1 rounded text-neutral-900">claude_desktop_config.json</code>).
            </p>

            <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-neutral-900 mb-4">visual studio code / cursor</h3>
            <CodeBlock lang="json" code={`{
  "mcpServers": {
    "axis": {
      "command": "npx",
      "args": [
        "-y",
        "@axis/server"
      ],
      "env": {
        "AXIS_API_KEY": "sk_ax_YOUR_KEY_HERE"
      }
    }
  }
}`} />
        </Section>
    )
}

function APISection() {
    return (
        <Section title="api reference" subtitle="restful control plane">
            <div className="space-y-12">
                <div className="p-8 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="bg-neutral-900 text-white px-2.5 py-1 rounded text-[10px] font-bold tracking-widest uppercase">get</span>
                        <code className="font-mono text-xl tracking-tighter text-neutral-900">/v1/context/mirror</code>
                    </div>
                    <p className="text-neutral-500 mb-6 font-medium">high-fidelity mirror extraction across mapped project directories.</p>
                    <CodeBlock lang="bash" code={`curl -X GET "https://api.axis.sh/v1/context/mirror?path=src/lib" \\
  -H "Authorization: Bearer sk_ax_..."`} />
                </div>

                <div className="p-8 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <div className="flex items-center gap-3 mb-6">
                        <span className="bg-neutral-900 text-white px-2.5 py-1 rounded text-[10px] font-bold tracking-widest uppercase">post</span>
                        <code className="font-mono text-xl tracking-tighter text-neutral-900">/v1/governance</code>
                    </div>
                    <p className="text-neutral-500 mb-6 font-medium">update governance rules and mapping protocols in real-time.</p>
                    <CodeBlock lang="bash" code={`curl -X POST "https://api.axis.sh/v1/governance" \\
  -H "Authorization: Bearer sk_ax_..." \\
  -d '{"rule": "exclude_node_modules", "target": "all"}'`} />
                </div>
            </div>
        </Section>
    )
}

function PythonSection() {
    return (
        <Section title="python sdk" subtitle="programmatic context steering">
            <p className="text-neutral-500 mb-6 font-medium">use our python sdk to integrate axis high-fidelity mirrors into your langchain or llama-index agents.</p>

            <CodeBlock code="pip install axis-sdk" />

            <CodeBlock lang="python" code={`from axis import AxisMirror

client = AxisMirror(api_key="sk_ax_...")

# extract mirror context
mirror = client.get_mirror("src/components")
for node in mirror.nodes:
    print(f"{node.name}: {node.type}")

# sync mapping
client.sync_mapping(".axis/mapping.json")
`} />
        </Section>
    )
}

function GovernanceSection() {
    return (
        <Section title="governance" subtitle="controlling agent behavior">
            <p className="mb-6">
                axis implies strict governance over your autonomous agents via file locking and job orchestration.
            </p>
            <div className="space-y-8">
                <div>
                     <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-neutral-900 mb-4">file locking</h3>
                     <p>prevent race conditions by forcing agents to acquire a lock before verifying or modifying critical paths.</p>
                     <CodeBlock lang="bash" code={`# protocol example
propose_file_access(request_id="...", file="src/auth.ts")
-> GRANTED`} />
                </div>
                <div>
                     <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-neutral-900 mb-4">job board</h3>
                     <p>orchestrate complex refactors by breaking them into atomic jobs on the axis job board.</p>
                </div>
            </div>
        </Section>
    )
}

function BillingSection() {
    return (
        <Section title="billing" subtitle="monetization primitives">
            <p className="mb-6">
                native primitives for managing subscription lifecycles within your agent loops.
            </p>
             <div className="space-y-8">
                <div className="p-6 bg-neutral-50 rounded-xl border border-neutral-100">
                     <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-neutral-900 mb-2">check status</h3>
                     <p className="text-[13px] text-neutral-600 mb-4">agents can self-verify if a user is on the pro plan before executing expensive tasks.</p>
                     <CodeBlock lang="typescript" code={`const status = await mcp.callTool('get_subscription_status', { 
  email: 'user@example.com' 
});`} />
                </div>
            </div>
        </Section>
    )
}
