"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Toaster } from "@/components/ui/toaster";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={window.location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={cn("w-full", className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function StaggerContainer({ children, className, delay = 0.05 }: StaggerContainerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: delay },
        },
      }}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<React.ComponentProps<React.ElementType>>, { variants: staggerItem })
          : child
      )}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function StaggerItem({ children, className, delay = 0 }: StaggerItemProps) {
  return (
    <motion.div
      className={className}
      variants={staggerItem}
      custom={delay}
    >
      {children}
    </motion.div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  message?: string;
}

export function LoadingOverlay({ isLoading, children, message = "Loading..." }: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center"
            transition={{ duration: 0.2 }}
          >
            <Card className="shadow-premium-xl max-w-sm w-full mx-4 animate-scale-in">
              <CardContent className="flex flex-col items-center gap-4 py-8 px-6 text-center">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-3 border-primary/20" />
                  <motion.div
                    className="absolute inset-0 h-12 w-12 rounded-full border-3 border-primary"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    style={{ clipPath: "polygon(50% 0%, 100% 0%, 100% 50%, 50% 50%)" }}
                  />
                </div>
                <div>
                  <p className="font-medium text-foreground">{message}</p>
                  <p className="text-caption text-muted-foreground mt-1">Please wait while we process your request</p>
                </div>
                <div className="loading-dots flex gap-1 mt-2">
                  <span />
                  <span />
                  <span />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SkeletonCard({ className, lines = 3, style }: { className?: string; lines?: number; style?: React.CSSProperties }) {
  return (
    <Card className={cn("overflow-hidden", className)} style={style}>
      <CardContent className="p-6 space-y-4">
        <div className="h-6 w-1/4 skeleton rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: lines }).map((_, i) => (
            <div key={i} className="h-4 w-full skeleton rounded" style={{ width: `${70 + Math.random() * 20}%` }} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonList({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("text-center py-12 px-6", className)}>
      <CardContent className="flex flex-col items-center gap-4 max-w-sm mx-auto">
        <div className="p-4 rounded-2xl bg-secondary/50 text-muted-foreground">
          {icon}
        </div>
        <div>
          <h3 className="text-display-sm font-semibold text-foreground">{title}</h3>
          <p className="text-caption text-muted-foreground mt-2">{description}</p>
        </div>
        {action && <div className="mt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn("text-center py-12 px-6 border-destructive/20", className)}>
      <CardContent className="flex flex-col items-center gap-4 max-w-sm mx-auto">
        <div className="p-4 rounded-2xl bg-destructive/10 text-destructive">
          <svg className="h-8 w-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-display-sm font-semibold text-foreground">{title}</h3>
          <p className="text-caption text-muted-foreground mt-2">{description}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn-primary inline-flex items-center gap-2 shrink-0 text-sm font-semibold"
          >
            Try Again
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export function PageLayout({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("container-wide py-8 md:py-12", className)}>
      <PageTransition>{children}</PageTransition>
      <Toaster />
    </div>
  );
}