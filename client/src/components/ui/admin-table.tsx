import { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminTableProps extends HTMLAttributes<HTMLTableElement> {
  minWidth?: number;
}

export function AdminTable({ minWidth, className, children, ...props }: AdminTableProps) {
  return (
    <table
      className={cn("w-full", className)}
      style={minWidth ? { minWidth: `${minWidth}px` } : undefined}
      {...props}
    >
      {children}
    </table>
  );
}

export function AdminTableHead({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("bg-gray-100 sticky top-0 z-sticky shadow-sm text-caption font-medium text-gray-700 uppercase tracking-wider", className)}
      {...props}
    >
      {children}
    </thead>
  );
}

export function AdminTableBody({ className, children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={className}
      {...props}
    >
      {children}
    </tbody>
  );
}

export function AdminTr({ className, children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("hover:bg-gray-50 transition-colors", className)}
      {...props}
    >
      {children}
    </tr>
  );
}

interface AdminThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
}

export function AdminTh({ align = "left", className, children, ...props }: AdminThProps) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-caption font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap",
        align === "left" && "text-left",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

interface AdminTdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
  variant?: "primary" | "secondary" | "muted";
}

const TD_VARIANT_CLASS: Record<NonNullable<AdminTdProps["variant"]>, string> = {
  primary: "text-body font-medium text-gray-900",
  secondary: "text-body text-gray-700",
  muted: "text-caption text-gray-700",
};

export function AdminTd({ align = "left", variant, className, children, ...props }: AdminTdProps) {
  return (
    <td
      className={cn(
        "py-3 px-4",
        variant ? TD_VARIANT_CLASS[variant] : "text-body text-gray-900",
        align === "center" && "text-center",
        align === "right" && "text-right",
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

// Columna "País": UN solo origen para todas las tablas admin. Acepta codigo ("PE") o nombre ("Perú") y siempre muestra el nombre, sin bandera.
export function AdminCountryTd({ country }: { country?: string | null }) {
  const { data: countries } = useQuery<{ code: string; name: string }[]>({
    queryKey: ["/api/countries"],
    staleTime: 30 * 60 * 1000,
  });
  const name = countries?.find((c) => c.code === country)?.name ?? country;
  return <AdminTd variant="secondary">{name || "—"}</AdminTd>;
}

// Columna "Acciones": UN solo origen para todas las tablas admin, siempre al final y alineada a la derecha.
export function AdminActionsTh() {
  return <AdminTh align="right">Acciones</AdminTh>;
}

interface AdminActionsTdProps {
  children: ReactNode;
  /** Si la fila termina en un boton de solo icono (40px, el icono va centrado): lo corre para que el icono acabe en el borde del texto "Acciones". Apagar si termina en texto o Badge. */
  endsWithIcon?: boolean;
}

export function AdminActionsTd({ children, endsWithIcon = true }: AdminActionsTdProps) {
  return (
    <AdminTd className="whitespace-nowrap">
      <div className={cn("flex items-center justify-end gap-1", endsWithIcon && "-mr-3")}>{children}</div>
    </AdminTd>
  );
}

export function AdminEyebrowLabel({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-caption font-medium text-gray-700 uppercase tracking-wider", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function AdminTableSkeletonRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={columns} className="px-4 py-3">
            <Skeleton className="h-4 w-full" />
          </td>
        </tr>
      ))}
    </>
  );
}

// Tarjeta blanca que envuelve una AdminTable, con UN solo contenedor de scroll (cabecera fija dentro de el).
// Por defecto llena TODO el alto que deja la seccion (`AdminSection`): igual con 0, 3 o 300 registros, su borde inferior llega al final
// de la pantalla. `fill={false}` la deja con la altura de sus filas (tope `max-h-table`).
export function AdminTableCard({ fill = true, className, children }: { fill?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={cn("bg-white rounded-none border border-field overflow-hidden", fill && "flex-1 min-h-0", className)}>
      <div className={cn("overflow-auto", fill ? "h-full" : "max-h-table")}>{children}</div>
    </div>
  );
}
