import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-label font-medium transition duration-fast active:scale-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-green-600 text-white hover:bg-green-700",
        secondary: "bg-white text-green-600 border border-green-600 hover:bg-gray-50",
        destructive: "bg-coral-700 text-white hover:bg-coral-900",
        // Accion peligrosa secundaria (Eliminar cuenta, Eliminar en un detalle): sin relleno en reposo; al pasar el cursor, fondo rojo suave.
        "destructive-outline": "border border-error text-error-fg hover:bg-error-bg",
        ghost: "hover:bg-gray-100 text-gray-700",
        outline: "border border-field bg-white hover:bg-gray-50 text-gray-900",
        link: "text-green-600 underline-offset-4 hover:text-green-700 hover:underline",
        // Tema Pichanga Black (jugador, /play): verde electrico sobre fondo oscuro. Radio md (12px), igual que PitchButton, las tarjetas y las filas.
        pitch: "rounded-md bg-pitch font-bold text-pitch-on hover:bg-pitch-strong focus-visible:ring-pitch focus-visible:ring-offset-night-container",
      },
      size: {
        default: "h-11 px-5 py-3",
        xs: "h-10 px-3",
        // Accion dentro de una fila de lista (p. ej. "Separar ahora" en la plantilla): 32px, texto de 12px.
        compact: "h-8 px-3 text-caption",
        sm: "h-10 px-4 py-2",
        touch: "h-10 px-3",
        lg: "h-12 px-6 py-3",
        xl: "h-14 px-6 py-3 text-base",
        // Accion principal del menu de escritorio (estilo X, "Postear"): 56px de alto, texto de 16px en negrita.
        xxl: "h-14 px-6 py-3 text-body font-bold",
        icon: "h-10 w-10",
        "icon-sm": "h-10 w-10 p-0",
        // Solo icono, de 20px (cabeceras, volver, chat, menus): el resto de tamanos lo deja en 16px.
        "icon-lg": "h-10 w-10 p-0 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {asChild ? children : (
          <>
            {isLoading && <Loader2 className="animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
