import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage, OutlinedFormControl } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CountrySelect } from "@/components/ui/country-select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import logoPichangas from "@/assets/logo-pichangas.png";
import type { UserWithType } from "@shared/schema";
import { useCountries } from "@/hooks/use-countries";
import { usePhonePrefix } from "@/hooks/use-phone-prefix";

const schema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  country: z.string().min(1, "Selecciona tu país"),
  whatsapp: z.string().min(6, "Ingresa tu número de WhatsApp"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  currentUser: UserWithType;
}

export default function OnboardingModal({ currentUser }: Props) {
  const { toast } = useToast();

  const countries = useCountries();

  const defaultCountry = currentUser.country || "PE";
  const defaultPhone = countries.find(c => c.code === defaultCountry)?.phoneCode || "+51";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: currentUser.name || "",
      country: defaultCountry,
      whatsapp: currentUser.whatsapp || defaultPhone,
    },
  });

  usePhonePrefix(form, countries);

  const onSubmit = async (data: FormValues) => {
    try {
      await apiRequest("PATCH", "/api/auth/complete-profile", data);
      await queryClient.invalidateQueries({ queryKey: ["/api/user/current"] });
    } catch {
      toast({
        title: "Error al guardar",
        description: "No se pudieron guardar los datos. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const { isSubmitting } = form.formState;

  return (
    <Dialog open>
      <DialogContent
        hideClose
        className="max-w-sm gap-5"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="text-center space-y-2">
          <img src={logoPichangas} alt="Pichangas Perú" width={92} height={64} className="w-auto h-16 mx-auto" />
          <DialogTitle className="text-heading font-bold text-gray-900">¡Bienvenido a MilTareas!</DialogTitle>
          <DialogDescription className="text-label text-gray-700">
            Completa tu perfil para continuar. Solo toma un momento.
          </DialogDescription>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-field-gap">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <OutlinedFormControl label="Nombre completo">
                    <FormControl>
                      <div className="relative flex items-center">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-700 pointer-events-none" />
                        <Input placeholder="Tu nombre completo" {...field} className="pl-9" />
                      </div>
                    </FormControl>
                  </OutlinedFormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <OutlinedFormControl label="País">
                      <FormControl>
                        <CountrySelect
                          value={field.value}
                          onValueChange={field.onChange}
                          countries={countries}
                          contentPosition="popper"
                          className="h-10"
                        />
                      </FormControl>
                    </OutlinedFormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <OutlinedFormControl label="WhatsApp">
                      <FormControl>
                        <div className="relative flex items-center">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-700 pointer-events-none" />
                          <Input placeholder="+51987654321" {...field} className="pl-9" />
                        </div>
                      </FormControl>
                    </OutlinedFormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando…</>
              ) : (
                "Continuar a MilTareas"
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
