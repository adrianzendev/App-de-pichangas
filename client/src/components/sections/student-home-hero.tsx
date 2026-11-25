import { Chip } from "@/components/ui/chip";
import { FIELD_PLACEHOLDER } from "@/components/ui/input";
import { BookOpen, ClipboardList, FileText, GraduationCap, HelpCircle, Video } from "lucide-react";

const SERVICES = [
  { label: "Tarea", icon: FileText, service: "tarea" },
  { label: "Examen", icon: HelpCircle, service: "examen" },
  { label: "Ensayo", icon: BookOpen, service: "ensayo" },
  { label: "Tutoría", icon: Video, service: "tutoria" },
  { label: "Tesis", icon: GraduationCap, service: "tesis" },
  { label: "Ejercicios", icon: ClipboardList, service: "ejercicios" },
];

interface StudentHomeHeroProps {
  firstName?: string;
  onPublish: () => void;
  onService: (service: string) => void;
}

// Cabecera del Inicio del estudiante: saludo ("Hola, X" + bienvenida), debajo el compositor y los servicios como chips,
// sin tarjeta que los envuelva (estilo outline, sin bordes de contenedor).
// El compositor tiene la forma de un campo del formulario (blanco, borde de campo, rounded-control, 144px de alto, igual que el primer campo de Publicar, sin icono) pero no es un
// input real: al pulsarlo lleva al formulario de Publicar, donde se escribe el pedido.
export function StudentHomeHero({ firstName, onPublish, onService }: StudentHomeHeroProps) {
  return (
    <div data-testid="home-greeting" className="mb-6 flex flex-col gap-card-gap">
      <div>
        <h1 className="text-heading font-bold text-gray-900">{`Hola${firstName ? `, ${firstName}` : ""}`}</h1>
        <p className="text-body text-gray-700">Bienvenido a Mil Tareas</p>
      </div>
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onPublish}
          className="flex min-h-36 w-full items-start gap-3 rounded-control border border-field bg-white px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-testid="quick-actions"
          aria-label="Publicar un pedido"
        >
          <span className={`min-w-0 truncate ${FIELD_PLACEHOLDER}`}>Describe tu tarea o proyecto aquí…</span>
        </button>
        {/* Movil: una sola fila con desplazamiento horizontal que llega al borde de la pantalla (-mx-page-h); desde md, en varias filas si no caben. */}
        <div className="-mx-page-h flex flex-nowrap gap-2 overflow-x-auto px-page-h scrollbar-none md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {SERVICES.map(({ label, icon: Icon, service }) => (
            <Chip key={service} onClick={() => onService(service)} className="shrink-0 text-gray-900 border-transparent active:scale-95">
              <Icon className="size-icon-lg text-green-600" />
              {label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
