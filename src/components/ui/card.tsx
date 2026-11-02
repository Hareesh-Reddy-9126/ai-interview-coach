import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "base" | "elevated" | "interactive" | "glow" | "plain";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantClass: Record<CardVariant, string> = {
  base: "card-base",
  elevated: "card-elevated",
  interactive: "card-interactive",
  glow: "card-glow",
  plain: "surface",
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "base", children, ...props }, ref) => (
    <div ref={ref} className={cn(variantClass[variant], className)} {...props}>
      {children}
    </div>
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("border-b border-border/60 px-5 py-4", className)} {...props}>
      {children}
    </div>
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-headline text-foreground", className)} {...props}>
      {children}
    </h3>
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <p ref={ref} className={cn("mt-0.5 text-[12.5px] leading-5 text-muted-foreground", className)} {...props}>
      {children}
    </p>
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("px-5 py-4", className)} {...props}>
      {children}
    </div>
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-3 border-t border-border/60 px-5 py-3.5", className)} {...props}>
      {children}
    </div>
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
