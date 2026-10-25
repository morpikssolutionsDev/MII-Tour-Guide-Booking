import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Loader2 } from "lucide-react"
import { Slot } from "radix-ui"

// design-system §7.1: one primary per view; destructive triggers are outline only.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-colors duration-[120ms] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-merah-700",
        secondary: "border-input-border bg-card text-foreground hover:bg-kabut-50",
        outline: "border-input-border bg-card text-foreground hover:bg-kabut-50",
        ghost: "text-foreground hover:bg-kabut-100 aria-expanded:bg-kabut-100",
        "danger-outline": "border-merah-700 bg-card text-merah-700 hover:bg-merah-50",
        danger: "bg-merah-700 text-white hover:bg-merah-800",
        destructive: "bg-merah-700 text-white hover:bg-merah-800",
        link: "text-danau-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 md:h-10",
        sm: "h-9 rounded-md px-3 text-[0.8125rem]",
        xs: "h-7 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 px-5 text-base",
        icon: "size-11 md:size-10",
        "icon-sm": "size-9",
        "icon-xs": "size-7 rounded-sm",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  pending = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner in place of the icon, keeps the label and width, and disables the button. */
    pending?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({ variant, size, className }),
        pending && "[&>svg:not([data-spinner])]:hidden"
      )}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && !asChild ? (
        <>
          <Loader2 data-spinner className="animate-spin" aria-hidden />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
