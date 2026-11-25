import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { NightInput } from "@/components/pichangas/night-controls";
import { UserAvatar } from "@/components/ui/user-avatar";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

const MAX_BYTES = 5 * 1024 * 1024;

// Foto de perfil del jugador: tocar el avatar abre el selector; el servidor la recorta a 400x400 (POST /api/user/upload-photo).
export function ProfilePhoto({ name, avatar }: { name: string; avatar?: string | null }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("profilePhoto", file);
      return apiRequest("POST", "/api/user/upload-photo", formData);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/user/current"] });
      toast({ title: "Foto actualizada", variant: "success" });
    },
    onError: (e) => toast({ variant: "destructive", title: "No pudimos subir tu foto", description: e instanceof Error ? e.message : undefined }),
  });

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast({ variant: "destructive", title: "Elige una imagen (JPG, PNG o WebP)" });
    if (file.size > MAX_BYTES) return toast({ variant: "destructive", title: "La imagen pesa más de 5 MB" });
    upload.mutate(file);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={upload.isPending}
        aria-label="Cambiar foto de perfil"
        className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch disabled:opacity-60"
      >
        <UserAvatar name={name} avatar={avatar} size="lg" />
        <span aria-hidden className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-night-high text-pitch">
          <Camera className="size-icon-sm" />
        </span>
      </button>
      <NightInput ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={onPick} />
    </>
  );
}
