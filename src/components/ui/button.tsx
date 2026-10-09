import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-ink font-extrabold tracking-tight transition-[transform,box-shadow,background-color,color] duration-150 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white shadow-hard-sm hover:bg-ink-2",
        secondary: "bg-white text-ink shadow-hard-sm hover:bg-surface-2",
        aura: "bg-aura-high text-ink shadow-hard-sm hover:brightness-95",
        boost: "bg-aura-mid text-ink shadow-hard-sm hover:brightness-95",
        danger: "bg-aura-low text-ink shadow-hard-sm hover:brightness-95",
        ghost: "border-transparent bg-transparent text-ink hover:bg-surface-2",
        outline: "bg-transparent text-ink hover:bg-surface-2",
      },
      size: {
        xs: "h-7 px-2 text-[11px] rounded-lg",
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0 rounded-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, type, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
