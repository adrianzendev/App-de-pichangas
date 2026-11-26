import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-label font-medium transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary-600 text-white",
        secondary:
          "border-transparent bg-primary-100 text-primary-700",
        destructive:
          "border-transparent bg-error text-white",
        outline: "border-border bg-card text-gray-900",
        success: "border-success-fg bg-transparent text-gray-900",
        neutral: "border-gray-700 bg-transparent text-gray-900",
        info: "border-transparent bg-info-bg text-info-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }