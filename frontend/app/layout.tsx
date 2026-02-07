import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shared Context - AI Agent Context Layer",
  description: "API and MCP layer that gives agents continuously updated context.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased min-h-screen flex flex-col`}>
        <header className="border-b border-[var(--border)] py-4">
          <div className="container-custom flex items-center justify-between">
            <Link href="/" className="font-bold text-lg tracking-tight">
              shared-context
            </Link>
            <nav className="hidden md:flex gap-6 text-sm text-[var(--muted)]">
              <Link href="/product" className="hover:text-[var(--fg)]">Product</Link>
              <Link href="/developers" className="hover:text-[var(--fg)]">Developers</Link>
              <Link href="/company" className="hover:text-[var(--fg)]">Company</Link>
              <Link href="/pricing" className="hover:text-[var(--fg)]">Pricing</Link>
              <Link href="/blog" className="hover:text-[var(--fg)]">Blog</Link>
            </nav>
            <div className="flex gap-4 text-sm">
                <Link href="/login" className="hover:text-[var(--fg)] flex items-center">Login</Link>
                <Link href="#" className="border border-[var(--border)] px-3 py-1.5 rounded hover:bg-neutral-800">Schedule a call</Link>
            </div>
          </div>
        </header>

        <main className="flex-1">
          {children}
        </main>

        <footer className="border-t border-[var(--border)] py-12 mt-20 text-sm text-[var(--muted)]">
            <div className="container-custom grid grid-cols-2 md:grid-cols-4 gap-8">
                <div>
                   <div className="font-bold text-[var(--fg)] mb-4">shared-context</div>
                   <p>Context for AI Agents.</p>
                </div>
                 <div>
                   <div className="font-bold text-[var(--fg)] mb-4">Product</div>
                   <ul className="space-y-2">
                       <li><Link href="#">Features</Link></li>
                       <li><Link href="#">Pricing</Link></li>
                   </ul>
                </div>
                 <div>
                   <div className="font-bold text-[var(--fg)] mb-4">Developers</div>
                   <ul className="space-y-2">
                       <li><Link href="/docs">Docs</Link></li>
                       <li><Link href="#">API</Link></li>
                   </ul>
                </div>
            </div>
        </footer>
      </body>
    </html>
  );
}
