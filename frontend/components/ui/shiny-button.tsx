'use client';

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShinyButtonProps extends HTMLMotionProps<"button"> {
    children: React.ReactNode;
    className?: string;
}

export function ShinyButton({ children, className, ...props }: ShinyButtonProps) {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
                "relative rounded-lg px-8 py-3 font-medium text-sm transition-all duration-300",
                "bg-gradient-to-t from-[#1a1a1a] to-[#262626] border border-[#333]",
                "hover:border-[#555] hover:text-white text-gray-300",
                "group overflow-hidden",
                className
            )}
            {...props}
        >
            <div className="absolute inset-0 -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />
            <span className="relative z-10 flex items-center justify-center gap-2">
                {children}
            </span>
        </motion.button>
    );
}
