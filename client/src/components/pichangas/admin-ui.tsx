import type { HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TdHTMLAttributes, TextareaHTMLAttributes, ThHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NightChip, NightEmpty, PitchButton } from "@/components/pichangas/night-ui";

// Piezas del panel de administracion en el tema "Pichanga Black": mismas superficies night-* y verde pitch del jugador.

// ───────────── Cabecera, tarjetas y metricas ─────────────

export function AdminHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="space-y-1">
      <h1 className="text-heading font-bold text-night-text">{title}</h1>
      <p className="text-body text-night-muted">{subtitle}</p>
    </header>
  );
}

export function AdminPanel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-md bg-night-container p-card-pad shadow-night-card", className)} {...props} />;
}

export function AdminMetric({ title, value, icon: Icon, subtitle, testId }: { title: string; value: string | number; icon: LucideIcon; subtitle: string; testId: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-night-container p-card-pad shadow-night-card" data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-caption font-bold uppercase text-night-muted">{title}</p>
        <Icon className="size-icon-lg text-pitch" aria-hidden />
      </div>
      <p className="text-heading font-bold text-night-text" data-testid={`${testId}-value`}>{value}</p>
      <p className="text-caption text-night-muted">{subtitle}</p>
    </div>
  );
}

// ───────────── Botones ─────────────

type BtnTone = "pitch" | "soft" | "danger";
const BTN_TONE: Record<BtnTone, string> = {
  pitch: "bg-pitch text-pitch-on hover:bg-pitch-strong",
  soft: "bg-night-high text-night-text hover:bg-night-highest",
  danger: "bg-night-high text-crimson hover:bg-crimson-container",
};

export function AdminButton({ tone = "soft", compact, className, ...props }: { tone?: BtnTone; compact?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-bold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-icon-md",
        compact ? "h-8 px-3 text-caption" : "h-11 px-5 text-label",
        BTN_TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

// ───────────── Badges ─────────────

type BadgeTone = "success" | "info" | "neutral" | "danger";
const BADGE_TONE: Record<BadgeTone, string> = {
  success: "bg-pitch/15 text-pitch",
  info: "bg-aqua/15 text-aqua",
  neutral: "bg-night-highest text-night-muted",
  danger: "bg-crimson/15 text-crimson",
};

export function AdminBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-caption font-bold", BADGE_TONE[tone])}>{children}</span>;
}

// ───────────── Filtros ─────────────

export function AdminPills<T extends string>({ options, value, onChange }: { options: readonly { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div role="group" className="flex items-center gap-2 overflow-x-auto scrollbar-none">
      {options.map((o) => (
        <NightChip key={o.id} active={value === o.id} onClick={() => onChange(o.id)}>{o.label}</NightChip>
      ))}
    </div>
  );
}

// ───────────── Tabla ─────────────

/** Tarjeta de la tabla: llena el alto libre de la pantalla (su borde inferior siempre llega al final, con 0, 3 o 300 filas). */
export function AdminTableCard({ children }: { children: ReactNode }) {
  return <div className="flex-1 overflow-x-auto rounded-md bg-night-container shadow-night-card">{children}</div>;
}

export function AdminTable({ minWidth, className, style, ...props }: HTMLAttributes<HTMLTableElement> & { minWidth?: number }) {
  return <table className={cn("w-full", className)} style={minWidth ? { minWidth: `${minWidth}px`, ...style } : style} {...props} />;
}

export function AdminThead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("sticky top-0 z-sticky bg-night-high", className)} {...props} />;
}

export function AdminTr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors duration-fast hover:bg-night-high", className)} {...props} />;
}

type Align = "left" | "center" | "right";
const ALIGN: Record<Align, string> = { left: "text-left", center: "text-center", right: "text-right" };

export function AdminTh({ align = "left", className, ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  return <th className={cn("whitespace-nowrap px-4 py-3 text-caption font-bold uppercase text-night-muted", ALIGN[align], className)} {...props} />;
}

export function AdminActionsTh() {
  return (
    <AdminTh align="right">
      Acciones
    </AdminTh>
  );
}

const TD_TONE = { primary: "font-bold text-night-text", secondary: "text-night-muted", plain: "text-night-text" } as const;

export function AdminTd({ align = "left", tone = "plain", className, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: Align; tone?: keyof typeof TD_TONE }) {
  return <td className={cn("px-4 py-3 text-label", TD_TONE[tone], ALIGN[align], className)} {...props} />;
}

/** Segunda linea de una celda (direccion, correo, suplentes). */
export function AdminSub({ children }: { children: ReactNode }) {
  return <span className="block text-caption font-normal text-night-muted">{children}</span>;
}

export function AdminActionsTd({ children }: { children: ReactNode }) {
  return (
    <td className="whitespace-nowrap px-4 py-3">
      <div className="flex items-center justify-end gap-2">{children}</div>
    </td>
  );
}

export function AdminSkeletonRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}><td colSpan={columns} className="px-4 py-3"><Skeleton className="h-4 w-full bg-night-high" /></td></tr>
      ))}
    </>
  );
}

/** Tabla con sus estados: error, vacio y cargando. */
export function AdminTableState({ isLoading, isError, empty, columns, onRetry, children }: {
  isLoading: boolean; isError: boolean; empty: boolean; columns: number; onRetry: () => void; children: ReactNode;
}) {
  if (isError) {
    return <NightEmpty icon={<ListChecks className="size-icon-empty" />} title="No pudimos cargar los datos" fill description="Revisa tu conexión e inténtalo de nuevo." action={<PitchButton onClick={onRetry}>Reintentar</PitchButton>} />;
  }
  if (!isLoading && empty) return <NightEmpty fill icon={<ListChecks className="size-icon-empty" />} title="No hay registros todavía" />;
  return (
    <AdminTableCard>
      {isLoading ? <AdminTable minWidth={720}><tbody><AdminSkeletonRows columns={columns} /></tbody></AdminTable> : children}
    </AdminTableCard>
  );
}

// ───────────── Campos de formulario ─────────────

const CONTROL = "w-full rounded-sm bg-night-lowest px-3 text-base text-night-text placeholder:text-night-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pitch aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-crimson";

export function AdminField({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string | false; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-caption font-bold uppercase text-night-muted">{label}</label>
      {children}
      {hint && <p className="text-caption text-night-muted">{hint}</p>}
      {error && <p className="text-caption font-bold text-crimson">{error}</p>}
    </div>
  );
}

export function AdminInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CONTROL, "h-11", className)} {...props} />;
}

export function AdminTextarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CONTROL, "py-2.5", className)} {...props} />;
}

export function AdminSelect({ options, placeholder, className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select className={cn(CONTROL, "h-11", className)} {...props}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ───────────── Dialogos ─────────────

const DIALOG = "border-night-highest bg-night text-night-text";

export function AdminFormDialog({ open, onOpenChange, title, testId, children, onCancel, onSubmit, submitLabel, submitDisabled }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; testId?: string; children: ReactNode;
  onCancel: () => void; onSubmit: () => void; submitLabel: string; submitDisabled?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={testId} className={DIALOG}>
        <DialogHeader><DialogTitle className="text-night-text">{title}</DialogTitle></DialogHeader>
        <div className="space-y-field-gap">
          {children}
          <div className="flex gap-2 pt-2">
            <AdminButton className="flex-1" onClick={onCancel}>Cancelar</AdminButton>
            <AdminButton tone="pitch" className="flex-1" disabled={submitDisabled} onClick={onSubmit}>{submitLabel}</AdminButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AdminConfirm({ open, onOpenChange, title, description, confirmLabel, cancelLabel = "Volver", destructive, onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; confirmLabel: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={cn("mx-4", DIALOG)}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-night-text">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription className="text-night-muted">{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-md border-0 bg-night-high font-bold text-night-text hover:bg-night-highest hover:text-night-text">{cancelLabel}</AlertDialogCancel>
          <AdminButton
            tone={destructive ? "danger" : "pitch"}
            className={destructive ? "bg-crimson text-crimson-on hover:bg-crimson/80" : undefined}
            onClick={() => { onConfirm(); onOpenChange(false); }}
          >
            {confirmLabel}
          </AdminButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminTbody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}
