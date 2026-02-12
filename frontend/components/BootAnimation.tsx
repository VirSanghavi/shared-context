'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const STATIC_LOGS = [
    "[ 0.000000] axis: kernel v1.0.0-prod",
    "[ 0.000312] loading context modules...",
    "[ 0.001024] mem: 16384MB available",
    "[ 0.001337] cpu: neural_engine x8 online",
    "[ 0.002048] init: mounting /dev/knowledge",
    "[ 0.002561] init: vector_db connected",
    "[ 0.003072] init: embedding_engine ready",
    "__PROGRESS__",
    "[ 0.004096] axis: machine mode activated",
    "root@axis:~# ./render --mode=machine",
];

export default function BootAnimation({ onComplete }: { onComplete: () => void }) {
    const [lines, setLines] = useState<string[]>([]);

    useEffect(() => {
        let currentLine = 0;
        let lineInterval: ReturnType<typeof setInterval> | null = null;
        let progressInterval: ReturnType<typeof setInterval> | null = null;
        let completionTimeout: ReturnType<typeof setTimeout> | null = null;

        const buildProgressLine = (percent: number) => {
            const BAR_LENGTH = 26;
            const filled = Math.round((percent / 100) * BAR_LENGTH);
            const bar = `${'█'.repeat(filled)}${'░'.repeat(BAR_LENGTH - filled)}`;
            return `[ 0.003584] ${bar} ${percent}%`;
        };

        const cleanup = () => {
            if (lineInterval) clearInterval(lineInterval);
            if (progressInterval) clearInterval(progressInterval);
            if (completionTimeout) clearTimeout(completionTimeout);
        };

        const startProgressSequence = () => {
            let progress = 0;
            setLines(prev => [...prev, buildProgressLine(progress)]);
            progressInterval = setInterval(() => {
                progress = Math.min(progress + 4, 100);
                setLines(prev => [...prev.slice(0, -1), buildProgressLine(progress)]);

                if (progress >= 100) {
                    if (progressInterval) clearInterval(progressInterval);
                    currentLine++;
                    lineInterval = setInterval(appendNextLine, 250);
                }
            }, 65);
        };

        const appendNextLine = () => {
            if (currentLine < STATIC_LOGS.length) {
                const nextLine = STATIC_LOGS[currentLine];
                if (nextLine === "__PROGRESS__") {
                    if (lineInterval) clearInterval(lineInterval);
                    startProgressSequence();
                    return;
                }
                setLines(prev => [...prev, nextLine]);
                currentLine++;
            } else {
                if (lineInterval) clearInterval(lineInterval);
                completionTimeout = setTimeout(onComplete, 500);
            }
        };

        lineInterval = setInterval(appendNextLine, 250);

        return cleanup;
    }, [onComplete]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black p-8 font-mono text-[13px] text-white leading-relaxed flex flex-col items-center justify-center overflow-hidden text-center"
        >
            <div className="max-w-xl w-full">
                {lines.map((line, i) => (
                    <div key={i} className="mb-1">
                        {line}
                    </div>
                ))}
                {lines.length === STATIC_LOGS.length && (
                    <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ repeat: Infinity, duration: 0.8 }}
                        className="inline-block w-2 h-4 bg-white align-middle"
                    />
                )}
            </div>
        </motion.div>
    );
}
