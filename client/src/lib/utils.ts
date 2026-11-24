import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// twMerge debe conocer los tokens de tailwind.config.ts (inyectados en build desde la config resuelta):
// sin esto trata `text-heading` como COLOR y `w-dropdown-sm` como clase desconocida, y deja ganar a
// `w-full` o `text-gray-*` segun el orden del CSS en vez del orden en cn().
declare const __TW_TOKENS__: Record<string, string[]>
const T = __TW_TOKENS__
const twMerge = extendTailwindMerge({
  extend: {
    theme: { spacing: T.spacing },
    classGroups: {
      w: [{ w: T.w }],
      h: [{ h: T.h }],
      "min-w": [{ "min-w": T["min-w"] }],
      "max-w": [{ "max-w": T["max-w"] }],
      "min-h": [{ "min-h": T["min-h"] }],
      "max-h": [{ "max-h": T["max-h"] }],
      "font-size": [{ text: T["font-size"] }],
      rounded: [{ rounded: T.rounded }],
      shadow: [{ shadow: T.shadow }],
      z: [{ z: T.z }],
      "border-w": [{ border: T["border-w"] }],
      duration: [{ duration: T.duration }],
      tracking: [{ tracking: T.tracking }],
      leading: [{ leading: T.leading }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Lee un archivo como data URL (previsualizacion de imagenes).
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
