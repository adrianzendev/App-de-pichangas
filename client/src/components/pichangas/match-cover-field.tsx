import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NightBadge } from "@/components/pichangas/night-ui";
import { toast } from "@/hooks/use-toast";
import { uploadMatchCover } from "@/lib/admin-pichangas";

export const MAX_COVERS = 6;

// Portadas de un partido: sube varias fotos, la primera es la principal. Se usa en el formulario del admin y del host.
export function MatchCoverField({ value, onChange }: { value: string[]; onChange: (urls: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let next = value;
    for (const file of Array.from(files)) {
      if (next.length >= MAX_COVERS) { toast({ title: `Máximo ${MAX_COVERS} portadas` }); break; }
      try {
        next = [...next, await uploadMatchCover(file)];
        onChange(next);
      } catch (e) {
        toast({ variant: "destructive", title: "No pudimos subir la foto", description: e instanceof Error ? e.message : undefined });
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const makeMain = (i: number) => onChange([value[i], ...value.filter((_, k) => k !== i)]);

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {value.map((url, i) => (
            <li key={url} className="space-y-2">
              <div className="relative aspect-video overflow-hidden rounded-md bg-night-high">
                <img src={url} alt={`Portada ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                {i === 0 && <NightBadge tone="pitch" size="sm" className="absolute left-2 top-2 bg-night-container">Principal</NightBadge>}
              </div>
              <div className="flex gap-2">
                {i > 0 && <Button type="button" variant="pitch-outline" size="compact" onClick={() => makeMain(i)}>Principal</Button>}
                <Button type="button" variant="crimson-outline" size="compact" onClick={() => onChange(value.filter((_, k) => k !== i))}>Quitar</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <input id="am-cover" ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Elegir fotos de portada" onChange={(e) => void onFiles(e.target.files)} />
      <Button type="button" variant="pitch-outline" size="sm" disabled={uploading || value.length >= MAX_COVERS} onClick={() => inputRef.current?.click()}>
        <ImagePlus aria-hidden />
        {uploading ? "Subiendo…" : value.length === 0 ? "Agregar portadas" : "Agregar más"}
      </Button>
    </div>
  );
}
