import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoGrow?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoGrow = true, onChange, value, ...props }, ref) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);

    const adjustHeight = React.useCallback(() => {
      const textarea = internalRef.current;
      if (textarea && autoGrow) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, [autoGrow]);

    React.useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (autoGrow) {
        requestAnimationFrame(adjustHeight);
      }
      onChange?.(e);
    };

    React.useImperativeHandle(ref, () => internalRef.current!, []);

    return (
      <textarea
        className={cn(
          "flex min-h-textarea w-full rounded-control border border-field bg-white px-4 py-3 text-base text-gray-900 placeholder:text-placeholder transition-colors focus-visible:outline-none focus-visible:border-primary-600 focus-visible:ring-2 focus-visible:ring-primary-100 disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden",
          className
        )}
        ref={internalRef}
        onChange={handleChange}
        value={value}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
