import { z } from "zod";
import { insertTaskSchema } from "@shared/schema";
import { MIN_LEAD_HOURS } from "./deadline-utils";

/* ─── Form schema ─── */
export const createPublishFormSchema = (minBudget: number = 10, currency: string = "PEN", countryName?: string) => {
  return insertTaskSchema.extend({
    service: z.string().min(1, "Selecciona el servicio"),
    studyArea: z.string().min(1, "El área académica es requerida"),
    subject: z.string().optional(),
    title: z.string().min(10, "Mínimo 10 caracteres"),
    description: z.string().min(1, "La descripción es requerida"),
    budget: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= minBudget, `${countryName ? `Mínimo en ${countryName}` : 'Mínimo'}: ${minBudget} ${currency}`),
    deadline: z.string().min(1, "Selecciona la fecha").refine((val) => {
      const target = new Date(val); const min = new Date(); min.setHours(min.getHours() + MIN_LEAD_HOURS);
      return target >= min;
    }, "La fecha debe ser al menos 3 horas desde ahora"),
    additionalComments: z.string().optional(),
    invitedTutorId: z.string().optional(),
  });
};
