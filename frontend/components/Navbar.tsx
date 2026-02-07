'use client';

import { usePathname, useRouter } from "next/navigation";
import { Home, Info, MessageCircle, BookOpen, Github, LogOut, LogIn } from "lucide-react";
import Dock, { DockItemConfig } from "./Dock";
import { useRef, useState, useEffect } from "react";

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const logoutFormRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch("/api/auth/session");
                if (res.ok) {
                    const data = await res.json();
                    setIsAuthenticated(data.authenticated);
                }
            } catch (e) {
                setIsAuthenticated(false);
            }
        };
        checkAuth();
    }, [pathname]);

    const navItems: DockItemConfig[] = [
        {
            icon: <Home size={20} />,
            label: "home",
            onClick: () => router.push("/")
        },
        {
            icon: isAuthenticated === false ? <LogIn size={20} /> : <Info size={20} />,
            label: "about",
            onClick: () => router.push("/about")
        },
        {
            icon: <MessageCircle size={20} />,
            label: "thoughts?",
            onClick: () => router.push("/feedback")
        },
        {
            icon: <BookOpen size={20} />,
            label: "docs",
            onClick: () => router.push("/docs")
        },
        {
            icon: <Github size={20} />,
            label: "github",
            onClick: () => window.open("https://github.com/VirSanghavi/shared-context", "_blank")
        }
    ];

    if (isAuthenticated === true) {
        navItems.push({
            icon: <LogOut size={20} />,
            label: "logout",
            onClick: () => logoutFormRef.current?.submit()
        });
    } else if (isAuthenticated === false) {
        navItems.push({
            icon: <LogIn size={20} />,
            label: "sign in",
            onClick: () => router.push("/login")
        });
    }

    return (
        <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
            <form action="/api/auth/logout" method="POST" ref={logoutFormRef} className="hidden">
                <button type="submit">logout</button>
            </form>
            <div className="max-w-7xl mx-auto px-6">
                <Dock items={navItems} />
            </div>
        </header>
    );
}
