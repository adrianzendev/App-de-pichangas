import * as React from "react"

import { cn } from "@/lib/utils"

// Texto que hace de placeholder en un boton o caja que imita un campo: mismo tamano y color que `placeholder:text-placeholder` de Input y Textarea.
export const FIELD_PLACEHOLDER = "text-base text-placeholder"

// Campo completo: borde verde de 2px (1px de borde + 1px de anillo interior), asi el campo no cambia de tamano. Pasarlo por cn.
export const FIELD_COMPLETE = "border-primary-600 ring-1 ring-inset ring-primary-600 focus-visible:ring-1 focus-visible:ring-primary-600"

// Campo con error: borde rojo de 2px, con la misma tecnica que FIELD_COMPLETE. Pasarlo por cn.
export const FIELD_ERROR = "border-error ring-1 ring-inset ring-error focus-visible:border-error focus-visible:ring-1 focus-visible:ring-error aria-[invalid=true]:focus-visible:ring-1 aria-[invalid=true]:focus-visible:ring-error"

// Mensaje de error bajo un campo de Publicar: mismo rojo que FIELD_ERROR.
export const FIELD_ERROR_MESSAGE = "text-caption font-semibold text-error-fg"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-field w-full rounded-control border border-field bg-white px-4 py-3 text-base text-gray-900 placeholder:text-placeholder transition-colors focus-visible:outline-none focus-visible:border-primary-600 focus-visible:ring-2 focus-visible:ring-primary-100 aria-[invalid=true]:border-error aria-[invalid=true]:focus-visible:border-error aria-[invalid=true]:focus-visible:ring-error-bg read-only:bg-gray-50 read-only:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
