interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Nombre accesible del interruptor (obligatorio cuando no hay texto dentro del boton). */
  'aria-label'?: string;
}

export function ToggleSwitch({ 
  checked, 
  onChange, 
  disabled = false,
  size = 'md',
  'aria-label': ariaLabel,
}: ToggleSwitchProps) {
  const sizes = {
    sm: {
      track: 'h-6 w-10',
      thumb: 'h-5 w-5',
      translate: checked ? 'translate-x-toggle-on' : 'translate-x-toggle-off'
    },
    // Fino (20x36); el `before` de la raiz mantiene 40px de zona tactil.
    md: {
      track: 'h-5 w-9',
      thumb: 'h-4 w-4',
      translate: checked ? 'translate-x-toggle-on' : 'translate-x-toggle-off'
    },
    lg: {
      track: 'h-10 w-16',
      thumb: 'h-9 w-9',
      translate: checked ? 'translate-x-toggle-on-lg' : 'translate-x-toggle-off'
    }
  };

  const currentSize = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 before:absolute before:inset-x-0 before:-inset-y-2.5 ${currentSize.track} ${
        checked ? 'bg-primary' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block transform rounded-full bg-white shadow-md transition-transform duration-200 ${currentSize.thumb} ${currentSize.translate}`}
      />
    </button>
  );
}
