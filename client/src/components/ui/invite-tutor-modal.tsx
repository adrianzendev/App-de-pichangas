import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Send, X, FileText, Image } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage, OutlinedFormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DateTimeField } from "@/components/ui/datetime-field";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertTaskSchema } from "@shared/schema";
import { UserAvatar } from "./user-avatar";

const publishFormSchema = insertTaskSchema.extend({
  title: z.string().min(10, "El título debe tener al menos 10 caracteres"),
  description: z.string().min(1, "La descripción es requerida"),
  budget: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, "El presupuesto debe ser mayor a 0"),
  deadline: z.string().min(1, "La fecha límite es requerida").refine((val) => {
    const selectedDate = new Date(val);
    const now = new Date();
    const minimumTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return selectedDate >= minimumTime;
  }, "La fecha límite debe ser al menos 2 horas en el futuro"),
  subject: z.string().min(1, "La materia es requerida"),
});

const subjects = [
  { value: "matematica", label: "Matemática" },
  { value: "fisica", label: "Física" },
  { value: "quimica", label: "Química" },
  { value: "biologia", label: "Biología" },
  { value: "ingles", label: "Inglés" },
  { value: "historia", label: "Historia" },
  { value: "geografia", label: "Geografía" },
  { value: "literatura", label: "Literatura" },
  { value: "filosofia", label: "Filosofía" },
  { value: "economia", label: "Economía" },
  { value: "contabilidad", label: "Contabilidad" },
  { value: "derecho", label: "Derecho" },
  { value: "ingenieria", label: "Ingeniería" },
  { value: "arquitectura", label: "Arquitectura" },
  { value: "medicina", label: "Medicina" },
  { value: "psicologia", label: "Psicología" },
  { value: "informatica", label: "Informática" },
  { value: "diseño", label: "Diseño" },
  { value: "arte", label: "Arte" },
  { value: "musica", label: "Música" },
  { value: "otro", label: "Otro" },
];

const getMinimumDateTime = () => {
  const now = new Date();
  const minimumTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  
  const year = minimumTime.getFullYear();
  const month = String(minimumTime.getMonth() + 1).padStart(2, '0');
  const day = String(minimumTime.getDate()).padStart(2, '0');
  const hours = String(minimumTime.getHours()).padStart(2, '0');
  const minutes = String(minimumTime.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getCurrentMinDateTime = () => {
  const now = new Date();
  const minimumTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  
  const year = minimumTime.getFullYear();
  const month = String(minimumTime.getMonth() + 1).padStart(2, '0');
  const day = String(minimumTime.getDate()).padStart(2, '0');
  const hours = String(minimumTime.getHours()).padStart(2, '0');
  const minutes = String(minimumTime.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

interface InviteTutorModalProps {
  tutor: {
    id: string;
    name: string;
    avatar?: string;
    specialties?: string[];
    rating: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InviteTutorModal({ tutor, isOpen, onClose }: InviteTutorModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(publishFormSchema),
    defaultValues: {
      title: "",
      description: "",
      subject: "",
      budget: "",
      deadline: getMinimumDateTime(),
    },
  });

  const hasFormData = () => {
    const values = form.getValues();
    return (
      values.title.trim() !== "" ||
      values.description.trim() !== "" ||
      values.subject !== "" ||
      values.budget !== "" ||
      files.length > 0
    );
  };

  const handleClose = () => {
    if (hasFormData()) {
      setShowConfirmDialog(true);
    } else {
      onClose();
    }
  };

  const confirmClose = () => {
    form.reset();
    setFiles([]);
    setShowConfirmDialog(false);
    onClose();
  };

  const cancelClose = () => {
    setShowConfirmDialog(false);
  };

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/tasks", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: `¡Pedido enviado a ${tutor?.name}!`,
        description: "Tu pedido ha sido publicado y el tutor puede empezar a trabajar.",
      });
      form.reset();
      setFiles([]);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error al enviar el pedido",
        description: "Hubo un problema al enviar tu pedido. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: any) => {
    try {
      let uploadedFileNames: string[] = [];
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });

        const uploadResponse = await fetch('/api/tasks/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('File upload failed');
        }

        const uploadResult = await uploadResponse.json();
        uploadedFileNames = uploadResult.files.map((f: any) => f.originalName);
      }

      let deadline = undefined;
      if (data.deadline) {
        const localDate = new Date(data.deadline);
        deadline = localDate.toISOString();
      }
      
      const taskData = {
        ...data,
        deadline,
        attachments: uploadedFileNames
      };
      
      createTaskMutation.mutate(taskData);
      
    } catch (error) {
      toast({
        title: "Error subiendo archivos",
        description: "No se pudieron subir los archivos. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prevFiles => [...prevFiles, ...newFiles]);
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image className="size-icon-md text-gray-700" />;
    }
    return <FileText className="size-icon-md text-gray-700" />;
  };

  if (!tutor) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className=" max-h-sheet-lg overflow-hidden p-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="px-4 py-4">
          <div className="flex items-center gap-3">
            <UserAvatar
              name={tutor.name}
              avatar={tutor.avatar}
              size="md"
            />
            <div className="text-left">
              <DialogTitle>Invitar a {tutor.name}</DialogTitle>
              <p className="text-body text-gray-700">{tutor.specialties?.[0] || "Tutor"}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Form */}
        <div className="p-4 overflow-y-auto max-h-modal-body">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-field-gap">
              {/* Título */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <OutlinedFormControl label="Título">
                      <FormControl>
                        <Input
                          placeholder="Ej: Resolución de problemas de cálculo"
                          className="border-field"
                          {...field}
                        />
                      </FormControl>
                    </OutlinedFormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Descripción */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <OutlinedFormControl label="Descripción">
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder="Describe lo que necesitas…"
                          className="border-field resize-none"
                          {...field}
                        />
                      </FormControl>
                    </OutlinedFormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Materia */}
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <OutlinedFormControl label="Materia">
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-field">
                            <SelectValue placeholder="Selecciona una materia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem key={subject.value} value={subject.value}>
                              {subject.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </OutlinedFormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Archivos */}
              <div>
                <p className="block text-body font-medium text-gray-900 mb-1">Archivos</p>
                
                {files.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {files.map((file, index) => (
                      <div key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="flex items-center justify-between bg-gray-100 rounded-md p-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {getFileIcon(file.name)}
                          <span className="text-body text-gray-900 truncate">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="ml-2 h-10 rounded-md px-2 text-caption font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('file-input-invite')?.click()}
                  className="w-full"
                >
                  <Paperclip className="size-icon-md" />
                  Agregar archivos
                </Button>
                <input
                  id="file-input-invite"
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
              </div>

              {/* Presupuesto */}
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <OutlinedFormControl label="Presupuesto">
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Monto"
                          className="border-field"
                          {...field}
                        />
                      </FormControl>
                    </OutlinedFormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fecha límite */}
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <OutlinedFormControl label="Fecha límite">
                      <FormControl>
                        <DateTimeField
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                    </OutlinedFormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Submit */}
              <Button
                type="submit"
                disabled={createTaskMutation.isPending}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium"
              >
                <Send className="mr-2 size-icon-md" />
                {createTaskMutation.isPending ? "Enviando…" : "Enviar pedido"}
              </Button>
            </form>
          </Form>
        </div>
      </DialogContent>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={(open) => !open && cancelClose()}>
        <DialogContent className=" text-center">
          <div className="size-icon-empty bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <X className="size-icon-lg text-gray-700" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center">¿Cerrar formulario?</DialogTitle>
          </DialogHeader>
          <p className="text-body text-gray-700 -mt-2">Se perderán todos los datos que has escrito.</p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={cancelClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmClose}
              className="flex-1 bg-gray-900 hover:bg-gray-700 text-white"
            >
              Sí, cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
