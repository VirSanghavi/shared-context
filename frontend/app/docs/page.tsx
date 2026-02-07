'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Book, Code, Server, Terminal, Key, Search } from 'lucide-react';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Setup simplified style if import fails or types issues, but standard usage:
const codeStyle = vscDarkPlus;

export default function Docs() {
  const [activeTab, setActiveTab] = useState('quickstart');

  const tabs = [
    { id: 'quickstart', label: 'Quickstart', icon: Terminal },
    { id: 'mcp', label: 'MCP Config', icon: Server },
    { id: 'api', label: 'API Reference', icon: Code },
    { id: 'python', label: 'Python SDK', icon: Book },
  ];

  return (
    <div className="container-custom py-12 max-w-6xl">
       <div className="grid md:grid-cols-[240px_1fr] gap-12">
          {/* Sidebar */}
          <div className="space-y-2">
             <div className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-4 px-2">Documentation</div>
             {tabs.map(tab => (
                 <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors ${activeTab === tab.id ? 'bg-[#1a1a1a] text-[var(--fg)] border border-[var(--border)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
                 >
                    <tab.icon className="w-4 h-4"/>
                    {tab.label}
                 </button>
             ))}
          </div>

          {/* Content */}
          <div className="min-h-[600px]">
             <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
             >
                {activeTab === 'quickstart' && <QuickstartSection />}
                {activeTab === 'mcp' && <MCPSection />}
                {activeTab === 'api' && <APISection />}
                {activeTab === 'python' && <PythonSection />}
             </motion.div>
          </div>
       </div>
    </div>
  );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-mono font-bold">{title}</h1>
            <div className="border-b border-[var(--border)]"/>
            {children}
        </div>
    );
}

function CodeBlock({ code, lang = 'bash' }: { code: string, lang?: string }) {
    return (
        <div className="rounded-lg overflow-hidden border border-[var(--border)] text-sm my-4">
            <div className="bg-[#1a1a1a] px-4 py-2 text-xs text-[var(--muted)] font-mono border-b border-[var(--border)] flex justify-between items-center">
               <span>{lang}</span>
               <button onClick={() => navigator.clipboard.writeText(code)} className="hover:text-[var(--fg)] text-xs uppercase hover:underline">Copy</button>
            </div>
            <SyntaxHighlighter 
                language={lang} 
                style={codeStyle}
                customStyle={{ margin: 0, padding: '1rem', background: '#0a0a0a', fontSize: '0.875rem' }}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    );
}

function QuickstartSection() {
    return (
        <Section title="Quickstart">
            <div className="prose prose-invert max-w-none">
            <p className="text-lg text-[var(--muted)] leading-relaxed mb-8">
                Shared Context allows you to instantly give your AI agents memory and knowledge without complex RAG pipelines.
            </p>

            <h3 className="text-xl font-bold mb-4">1. Install the MCP Server</h3>
            <p className="text-[var(--muted)] mb-4">The fastest way to get started is using our wizard. Currently supports Claude Desktop, Cursor, and Windsurf.</p>
            <CodeBlock code="npx shared-context-wizard@latest" />

            <h3 className="text-xl font-bold mt-8 mb-4">2. Manual Installation</h3>
            <p className="text-[var(--muted)] mb-4">If you prefer manual setup, you can run the server directly.</p>
            <CodeBlock code={`npm install -g @shared-context/server
export SHARED_CONTEXT_KEY=sk_sc_...
shared-context-server`} />
            </div>
        </Section>
    )
}

function MCPSection() {
    return (
        <Section title="MCP Configuration">
            <p className="text-[var(--muted)] mb-4">
                Add this configuration to your MCP settings file (e.g., <code className="bg-[#1a1a1a] px-1 rounded text-red-300">claude_desktop_config.json</code>).
            </p>

            <h3 className="font-bold mb-2">Visual Studio Code / Cursor</h3>
            <CodeBlock lang="json" code={`{
  "mcpServers": {
    "shared-context": {
      "command": "npx",
      "args": [
        "-y",
        "@shared-context/server"
      ],
      "env": {
        "SHARED_CONTEXT_KEY": "sk_sc_YOUR_KEY_HERE"
      }
    }
  }
}`} />
        </Section>
    )
}

function APISection() {
    return (
        <Section title="API Reference">
             <div className="space-y-12">
                <div>
                   <div className="flex items-center gap-2 mb-4">
                      <span className="bg-green-900/30 text-green-400 px-2 py-1 rounded text-xs font-bold border border-green-900">GET</span>
                      <code className="font-mono text-lg">/v1/context/search</code>
                   </div>
                   <p className="text-sm text-[var(--muted)] mb-4">Semantic search across all your indexed libraries and documents.</p>
                   <CodeBlock lang="bash" code={`curl -X GET "https://api.shared-context.com/v1/context/search?q=auth" \
  -H "Authorization: Bearer sk_sc_..."`} />
                </div>

                <div>
                   <div className="flex items-center gap-2 mb-4">
                      <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded text-xs font-bold border border-blue-900">POST</span>
                      <code className="font-mono text-lg">/v1/memory</code>
                   </div>
                   <p className="text-sm text-[var(--muted)] mb-4">Store a new memory fragment for your agents.</p>
                   <CodeBlock lang="bash" code={`curl -X POST "https://api.shared-context.com/v1/memory" \
  -H "Authorization: Bearer sk_sc_..." \
  -d '{"content": "User prefers dark mode", "tags": ["preferences"]}'`} />
                </div>
             </div>
        </Section>
    )
}

function PythonSection() {
    return (
        <Section title="Python SDK">
             <p className="text-[var(--muted)] mb-4">Use our Python SDK to integrate Shared Context into your LangChain or LlamaIndex workflows.</p>
             
             <CodeBlock code="pip install shared-context-sdk" />
             
             <CodeBlock lang="python" code={`from shared_context import SharedContext

client = SharedContext(api_key="sk_sc_...")

# Search context
results = client.search("how to implement auth")
for res in results:
    print(res.content)

# Add memory
client.memory.add("Implemented JWT auth on Feb 7th")
`} />
        </Section>
    )
}
