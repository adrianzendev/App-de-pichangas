import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<React.ComponentPropsWithoutRef<typeof Input>, "type"> & {
  toggleTestId?: string;
};

// Input de contraseña con boton mostrar/ocultar integrado (estado propio).
// Las props (id, aria-*, data-testid) van al <input>, asi que funciona dentro de <FormControl>.
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, placeholder = "••••••••", toggleTestId, ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    return (
      <div className="relative flex items-center">
        <Input
          ref={ref}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          className={cn("pr-12", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-1 top-1/2 flex h-touch w-touch -translate-y-1/2 items-center justify-center rounded-md text-gray-700 transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          data-testid={toggleTestId}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
