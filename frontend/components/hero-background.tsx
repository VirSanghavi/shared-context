'use client';

import { useEffect, useRef } from 'react';

export function HeroBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;

        const particles: Particle[] = [];
        const particleCount = 60; // Slightly sparser for a clean look
        const connectionDistance = 150;
        const items: Array<Particle> = [];

        class Particle {
            x: number;
            y: number;
            vx: number;
            vy: number;
            size: number;

            constructor() {
                this.x = Math.random() * w;
                this.y = Math.random() * h;
                this.vx = (Math.random() - 0.5) * 0.5;
                this.vy = (Math.random() - 0.5) * 0.5;
                this.size = Math.random() * 1.5 + 0.5;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;

                if (this.x < 0) this.x = w;
                if (this.x > w) this.x = 0;
                if (this.y < 0) this.y = h;
                if (this.y > h) this.y = 0;
            }

            draw() {
                if (!ctx) return;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
                ctx.fill();
            }
        }

        // Init
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }

        const mouse = { x: 0, y: 0 };

        // Add interactions
        const handleMouseMove = (e: MouseEvent) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
        };
        window.addEventListener('mousemove', handleMouseMove);

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, w, h);

            // Draw subtle grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            const gridSize = 50;

            // Moving grid effect
            const time = Date.now() * 0.0005;
            const functionY = (x: number) => Math.sin(x * 0.01 + time) * 20;

            // Draw Particles & Connections
            particles.forEach((p, i) => {
                p.update();
                p.draw();

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

            requestAnimationFrame(animate);
        };

        animate();

        const handleResize = () => {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 z-[-1] bg-[#050505]"
        />
    );
}
