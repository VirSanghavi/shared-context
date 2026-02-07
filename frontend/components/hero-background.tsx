'use client';

import { useEffect, useRef } from 'react';

class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    w: number;
    h: number;

    constructor(w: number, h: number) {
        this.w = w;
        this.h = h;
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 1.5 + 0.5;
    }

    update(w: number, h: number) {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0) this.x = w;
        if (this.x > w) this.x = 0;
        if (this.y < 0) this.y = h;
        if (this.y > h) this.y = 0;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
        ctx.fill();
    }
}

export function HeroBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (typeof window === 'undefined') return;
        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;

        const particles: Particle[] = [];
        const particleCount = 60;
        const connectionDistance = 150;

        // Init
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle(w, h));
        }

        const mouse = { x: 0, y: 0 };

        // Add interactions
        const handleMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('mousemove', handleMouseMove);
        }

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, w, h);

            // Draw Particles & Connections
            particles.forEach((p, i) => {
                p.update(w, h);
                p.draw(ctx);

                // Connect to nearby particles
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < connectionDistance) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(100, 100, 100, ${0.1 * (1 - dist / connectionDistance)})`;
                        ctx.stroke();
                    }
                }

                // Connect to mouse
                const dx = p.x - mouse.x;
                const dy = p.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 200) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.strokeStyle = `rgba(16, 185, 129, ${0.15 * (1 - dist / 200)})`; // Emerald accent
                    ctx.stroke();
                }

            });

            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(animate);
            }
        };

        animate();

        const handleResize = () => {
            if (typeof window === 'undefined') return;
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        };
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', handleResize);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('resize', handleResize);
                window.removeEventListener('mousemove', handleMouseMove);
            }
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 z-[-1] bg-[#050505]"
        />
    );
}
