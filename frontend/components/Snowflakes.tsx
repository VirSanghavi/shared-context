'use client';

import React, { useEffect, useState } from 'react';

const Snowflakes = () => {
    const [flakes, setFlakes] = useState<{ id: number; left: string; delay: string; duration: string; size: string }[]>([]);

    useEffect(() => {
        const newFlakes = Array.from({ length: 50 }).map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            delay: `${Math.random() * 20}s`,
            duration: `${10 + Math.random() * 20}s`,
            size: `${2 + Math.random() * 4}px`
        }));
        setFlakes(newFlakes);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
            {flakes.map((flake) => (
                <div
                    key={flake.id}
                    className="absolute bg-white/40 rounded-full blur-[1px] mix-blend-difference"
                    style={{
                        left: flake.left,
                        top: '-10px',
                        width: flake.size,
                        height: flake.size,
                        animation: `fall ${flake.duration} linear ${flake.delay} infinite`,
                    }}
                />
            ))}
            <style jsx>{`
                @keyframes fall {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                    }
                    90% {
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(110vh) rotate(360deg);
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    );
};

export default Snowflakes;
