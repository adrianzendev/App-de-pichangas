import { AlertCircle, Check, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

// El estado se comunica con el circulo de icono (no con el color de toda la tarjeta).
const STATUS = {
  default: { Icon: Info, circle: "bg-primary-50 text-primary-600" },
  success: { Icon: Check, circle: "bg-success-bg text-success-fg" },
  destructive: { Icon: AlertCircle, circle: "bg-error-bg text-error-fg" },
} as const

// Aviso unico de la app: toast({ title, description, variant?, icon?, action?, cancel? }).
// `action` = boton principal (ToastAction, con altText); `cancel` = secundario que solo cierra (ToastCancel).
export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, cancel, variant, icon, ...props }) {
        const { Icon: StatusIcon, circle } = STATUS[variant ?? "default"]
        const Icon = icon ?? StatusIcon
        return (
          <Toast key={id} variant={variant} {...props}>
            <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${circle}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
              {(action || cancel) && (
                <div className="mt-3 flex items-center gap-2">
                  {action}
                  {cancel}
                </div>
              )}
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
