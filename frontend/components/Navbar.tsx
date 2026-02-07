'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
    const pathname = usePathname();
    const isHome = pathname === "/";
    const isAuth = pathname === "/login" || pathname === "/signup";

    return (
        <nav className={`w-full fixed top-0 z-50 py-6 px-10 flex items-center justify-between ${!isHome && !isAuth ? 'bg-transparent' : 'mix-blend-difference'}`}>
            <div className="flex items-center gap-12">
                <Link href="/" className="font-bold text-lg tracking-tight text-white">axis</Link>
            </div>
            <div className="flex items-center gap-8 text-[11px] font-medium tracking-[0.2em] text-white/60">
                <Link href="/docs" className="hover:text-white transition-colors">docs</Link>
                <Link href="https://github.com/VirSanghavi/shared-context" className="hover:text-white transition-colors">github</Link>
                {!isAuth && (
                    <Link href="/login" className="hover:text-white transition-colors">sign in</Link>
                )}
            </div>
        </nav>
    );
}
