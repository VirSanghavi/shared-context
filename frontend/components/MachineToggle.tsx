'use client';

import { usePathname } from 'next/navigation';
import { useMachineMode } from '@/context/MachineModeContext';
import { useEffect, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import BootAnimation from './BootAnimation';

type MachineToggleProps = {
    placement?: 'inline' | 'floating';
};

export default function MachineToggle({ placement = 'floating' }: MachineToggleProps) {
    const pathname = usePathname();
    const { mode, setMode, isBooting, setIsBooting } = useMachineMode();
    const [isClient, setIsClient] = useState(false);

    const isInline = placement === 'inline';

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isInline || pathname !== '/') return null;

    const handleToggle = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (mode === 'human') {
            setIsBooting(true);
        } else {
            setMode('human');
        }
    };

    const handleHumanMode = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setMode('human');
    };

    const handleBootComplete = () => {
        setMode('machine');
        setIsBooting(false);
    };

    const containerClass = 'mr-2 h-full flex items-stretch rounded-md border border-white/15 bg-black/35 text-[10px] font-mono tracking-[0.22em] uppercase backdrop-blur-sm overflow-hidden';
    const activeClass = 'bg-white/12 text-white';
    const inactiveClass = 'text-white/55 hover:text-white/75';
    const buttonClass = 'h-full px-4 flex items-center gap-2 transition-all';

    return (
        <>
            {isClient && isBooting && createPortal(
                <BootAnimation onComplete={handleBootComplete} />,
                document.body
            )}

            <div className={containerClass}>
                <button
                    type="button"
                    onClick={handleHumanMode}
                    className={`${buttonClass} ${mode === 'human' ? activeClass : inactiveClass}`}
                    aria-label="Switch to human mode"
                >
                    <div className={`w-1.5 h-1.5 rounded-full ${mode === 'human' ? 'bg-white shadow-[0_0_8px_rgba(255,255,255,0.85)]' : 'border border-white/45'}`} />
                    human
                </button>
                <div className="w-[1px] h-full bg-white/15" />
                <button
                    type="button"
                    onClick={handleToggle}
                    className={`${buttonClass} ${mode === 'machine' ? activeClass : inactiveClass}`}
                    aria-label="Switch to machine mode"
                >
                    <div className={`w-1.5 h-1.5 rounded-full ${mode === 'machine' ? 'bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.9)]' : 'border border-zinc-300/60'}`} />
                    machine
                </button>
            </div>
        </>
    );
}
