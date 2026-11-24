import { PAGE_SHEET } from "@/components/ui/list-screen";
import { useState } from "react";
import { ROUTES } from "@/lib/routes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage, OutlinedFormControl } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Spinner } from "@/components/ui/spinner";
import { Container } from "@/components/ui/Container";
import { PasswordInput } from '@/components/ui/password-input';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
  newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirma tu nueva contraseña"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

export default function ChangePassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordForm) => {
      const response = await apiRequest("POST", "/api/user/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al cambiar contraseña");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        variant: "success",
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido cambiada exitosamente",
      });
      setLocation(ROUTES.home);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ChangePasswordForm) => {
    changePasswordMutation.mutate(data);
  };

  return (
    <div>
      <Container fullWidth className="py-page-top space-y-section-gap">
        {/* Misma hoja y alto que Mi perfil: a sangre en movil, tarjeta desde lg */}
        <div className={PAGE_SHEET}>
          <h1 className="sr-only">Cambiar contraseña</h1>
          <div className="mx-auto w-full max-w-form">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-field-gap">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <OutlinedFormControl label="Contraseña actual">
                        <FormControl>
                          <PasswordInput
                            placeholder="••••••••"
                            {...field}
                            data-testid="input-current-password"
                          />
                        </FormControl>
                      </OutlinedFormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
  
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <OutlinedFormControl label="Nueva contraseña">
                        <FormControl>
                          <PasswordInput
                            placeholder="••••••••"
                            {...field}
                            data-testid="input-new-password"
                          />
                        </FormControl>
                      </OutlinedFormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
  
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <OutlinedFormControl label="Confirmar nueva contraseña">
                        <FormControl>
                          <PasswordInput
                            placeholder="Repite la nueva contraseña"
                            {...field}
                            data-testid="input-confirm-password"
                          />
                        </FormControl>
                      </OutlinedFormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
  
                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Spinner size="sm" className="text-white" />
                      Guardando…
                    </span>
                  ) : (
                    "Cambiar contraseña"
                  )}
                </Button>
              </form>
            </Form>
            </div>
        </div>
      </Container>
    </div>
  );
}
