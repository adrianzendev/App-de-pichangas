import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";
import { bp } from "./breakpoints";

/* Color desde una CSS var CON soporte de opacidad (bg-green-500/10, bg-muted/50).
   Un string "var(--x)" no deja a Tailwind inyectar alpha y la clase /NN no genera CSS;
   con funcion, el alpha se aplica via color-mix. */
const tok = (name: string) =>
  ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined
      ? `var(${name})`
      : `color-mix(in srgb, var(${name}) calc(${opacityValue} * 100%), transparent)`;

/* Escala numerica: scale('--green', [100, 500]) -> { 100: tok('--green-100'), 500: ... } */
const scale = (prefix: string, steps: number[]) =>
  Object.fromEntries(steps.map((s) => [s, tok(`${prefix}-${s}`)]));

/* Estado semantico: DEFAULT + bg + fg */
const state = (name: string) => ({
  DEFAULT: tok(`--${name}`),
  bg: tok(`--${name}-bg`),
  fg: tok(`--${name}-fg`),
});

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    /* ============================================================
       MILTAREAS DESIGN SYSTEM 2025
       Todo valor sale de index.css (:root). Las claves de abajo estan en `theme`
       (no en `extend`) a proposito: cierran las escalas por defecto de Tailwind
       (red-*, slate-*, z-50, shadow-2xl...) para que solo existan los tokens.
       ============================================================ */

    /* Colors */
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      white: tok("--white"),
      black: tok("--black"),
      /* Brand tokens */
      "primary-dark": tok("--color-primary-dark"),   /* green-600: texto blanco >=4.5:1 */
      "primary-hover": tok("--color-primary-hover"), /* green-700 */
      "primary-light": tok("--green-400"),
      "primary-text": tok("--color-primary-text"),   /* texto verde sobre superficies claras */
      green: scale("--green", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
      gray: scale("--gray", [0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
      /* Escalas de estado */
      blue: scale("--blue", [100, 500, 700]),
      coral: scale("--coral", [100, 500, 700, 900]),
      yellow: scale("--yellow", [100, 500, 700, 900]),
      /* Estados semanticos: bg-success, bg-success-bg, text-success-fg, etc. */
      success: state("success"),
      warning: state("warning"),
      error: state("error"),
      "error-strong": tok("--error-strong"),
      info: state("info"),
      /* Semantic colors (shadcn) */
      background: tok("--background"),
      foreground: tok("--foreground"),
      surface: tok("--color-surface"),
      "bubble-own": tok("--chat-bubble-own"),
      "bubble-other": tok("--chat-bubble-other"),
      scrim: tok("--scrim"),
      file: { pdf: tok("--file-pdf"), word: tok("--file-word"), excel: tok("--file-excel"), ppt: tok("--file-ppt"), default: tok("--file-default") },
      card: { DEFAULT: tok("--card"), foreground: tok("--card-foreground") },
      popover: { DEFAULT: tok("--popover"), foreground: tok("--popover-foreground") },
      primary: { DEFAULT: tok("--primary"), foreground: tok("--primary-foreground"), ...scale("--primary", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]) },
      secondary: { DEFAULT: tok("--secondary"), foreground: tok("--secondary-foreground") },
      muted: { DEFAULT: tok("--muted"), foreground: tok("--muted-foreground") },
      accent: { DEFAULT: tok("--accent"), foreground: tok("--accent-foreground") },
      destructive: { DEFAULT: tok("--destructive"), foreground: tok("--destructive-foreground") },
      border: tok("--border"),
      input: tok("--input"),
      ring: tok("--ring"),
    },

    /* Font sizes — escala Manrope (ver sistema de diseño) */
    fontSize: {
      'xs':  ['var(--fs-xs)',  { lineHeight: 'var(--lh-4)', letterSpacing: 'var(--ls-wide)' }],
      'sm':  ['var(--fs-sm)',  { lineHeight: 'var(--lh-5)', letterSpacing: 'var(--ls-normal)' }],
      'base':['var(--fs-base)',{ lineHeight: 'var(--lh-6)', letterSpacing: 'var(--ls-normal)' }],
      'xl':  ['var(--fs-xl)',  { lineHeight: 'var(--lh-7)',   fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }],
      '2xl': ['var(--fs-2xl)', { lineHeight: 'var(--lh-8)',   fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }],
      '3xl': ['var(--fs-3xl)', { lineHeight: 'var(--lh-10)',  fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tighter)' }],
      '4xl': ['var(--fs-4xl)', { lineHeight: 'var(--lh-12)',  fontWeight: 'var(--fw-extrabold)', letterSpacing: 'var(--ls-tighter)' }],
      '5xl': ['var(--fs-5xl)', { lineHeight: 'var(--lh-16)',  fontWeight: 'var(--fw-extrabold)', letterSpacing: 'var(--ls-tighter)' }],
      /* Responsive semantic aliases — 3 tiers en index.css (movil / tablet / escritorio) */
      'heading':    ['var(--text-heading)',    { lineHeight: 'var(--lh-heading)' }],
      'subheading': ['var(--text-subheading)', { lineHeight: 'var(--lh-subheading)' }],
      'nav': ['var(--text-nav)', { lineHeight: 'var(--lh-nav)' }],
      'body':       ['var(--text-body)',      { lineHeight: 'var(--lh-body)' }],
      'caption':    ['var(--text-caption)',    { lineHeight: 'var(--lh-caption)' }],
      'label':      ['var(--text-label)',      { lineHeight: 'var(--lh-label)' }],
      /* Escala h1-h6 (landing/editorial): tamano responsivo + peso + interlineado + tracking del nivel */
      'h1': ['var(--text-h1)', { lineHeight: 'var(--lh-h1)',  fontWeight: 'var(--fw-extrabold)', letterSpacing: 'var(--ls-tighter)' }],
      'h2': ['var(--text-h2)', { lineHeight: 'var(--lh-h2)',  fontWeight: 'var(--fw-extrabold)', letterSpacing: 'var(--ls-tight)' }],
      'h3': ['var(--text-h3)', { lineHeight: 'var(--lh-h3)',   fontWeight: 'var(--fw-bold)',      letterSpacing: 'var(--ls-tight)' }],
      'h4': ['var(--text-h4)', { lineHeight: 'var(--lh-h4)',   fontWeight: 'var(--fw-bold)' }],
      'h5': ['var(--text-h5)', { lineHeight: 'var(--lh-6)', fontWeight: 'var(--fw-semibold)' }],
      'h6': ['var(--text-h6)', { lineHeight: 'var(--lh-5)', fontWeight: 'var(--fw-semibold)', letterSpacing: 'var(--ls-wider)' }],
    },

    /* Border radius */
    borderRadius: {
      inherit: 'inherit',
      'none': '0',
      'xs': 'var(--radius-xs)',         /* 2px */
      'sm': 'var(--radius-sm)',         /* 8px */
      'DEFAULT': 'var(--radius-md)',    /* 12px */
      'md': 'var(--radius-md)',         /* 12px */
      'lg': 'var(--radius-lg)',         /* 16px */
      'xl': 'var(--radius-xl)',         /* 24px — unico radio de 24px, ya no hay 2xl duplicado */
      'chip': 'var(--radius-chip)',       /* 6px: Chip */
      'control': 'var(--radius-control)', /* 12px: campos de formulario (los botones son rounded-full) */
      'thumb': 'var(--radius-thumb)',     /* 12px: miniaturas */
      'row': 'var(--radius-row)',         /* 12px: filas y celdas */
      'card': 'var(--radius-card)',      /* 14px→16px responsivo */
      'sheet': 'var(--radius-sheet)',    /* 20px→24px responsivo */
      'modal': 'var(--radius-modal)',    /* 16px→20px responsivo */
      'full': 'var(--radius-full)',
    },

    /* Z-index scale — usar z-sticky, z-modal, etc. en lugar de z-10, z-50, etc. */
    zIndex: {
      'auto':     'auto',
      'base':     'var(--z-base)',
      'dropdown': 'var(--z-dropdown)',
      'sticky':   'var(--z-sticky)',
      'overlay':  'var(--z-overlay)',
      'modal':    'var(--z-modal)',
      'toast':    'var(--z-toast)',
      'tooltip':  'var(--z-tooltip)',
      'viewer':   'var(--z-viewer)',
    },

    /* Box shadows — float/modal = capas flotantes (menus, modales, la hoja que sube sobre el banner: TutorsBanner); las tarjetas Bento no llevan sombra */
    boxShadow: {
      'none':  'none',
      'sm':    'var(--shadow-sm)',
      'md':    'var(--shadow-md)',
      'lg':    'var(--shadow-lg)',
      'xl':    'var(--shadow-xl)',
      'float': 'var(--shadow-float)',
      'modal': 'var(--shadow-modal)',
    },

    /* Spacing: escala CERRADA (theme, no extend). Solo existen estos valores; si falta uno, se crea en index.css y aqui. */
    spacing: {
      '0': 'var(--space-0)',
      'px': 'var(--space-px)',
      '0.5': 'var(--space-0-5)',
      '1': 'var(--space-1)',
      '1.5': 'var(--space-1-5)',
      '2': 'var(--space-2)',
      '2.5': 'var(--space-2-5)',
      '3': 'var(--space-3)',
      '3.5': 'var(--space-3-5)',
      '4': 'var(--space-4)',
      '5': 'var(--space-5)',
      '6': 'var(--space-6)',
      '7': 'var(--space-7)',
      '8': 'var(--space-8)',
      '9': 'var(--space-9)',
      '10': 'var(--space-10)',
      '11': 'var(--space-11)',
      '12': 'var(--space-12)',
      '14': 'var(--space-14)',
      '16': 'var(--space-16)',
      '20': 'var(--space-20)',
      '24': 'var(--space-24)',
      '28': 'var(--space-28)',
      '32': 'var(--space-32)',
      '36': 'var(--space-36)',
      '40': 'var(--space-40)',
      '44': 'var(--space-44)',
      '48': 'var(--space-48)',
      '52': 'var(--space-52)',
      '56': 'var(--space-56)',
      '60': 'var(--space-60)',
      '64': 'var(--space-64)',
      '72': 'var(--space-72)',
      '80': 'var(--space-80)',
      '96': 'var(--space-96)',
      'icon': 'var(--space-icon)',
      'touch': 'var(--space-touch)',
      'chip-touch': 'var(--chip-touch-inset)',
      'presence-offset': 'var(--presence-offset)',
      'field-gap': 'var(--field-gap)',
      'avatar': 'var(--space-avatar)',
      'bottom-safe': 'var(--space-bottom-safe)',
      'safe-top': 'var(--safe-top)',
      'safe-bottom': 'var(--safe-bottom)',
      'safe-nav': 'var(--safe-pad-nav)',
      'safe-min': 'var(--safe-pad-min)',
      /* Structural spacing tokens */
      'page-top': 'var(--spacing-page-top)',
      'page-h': 'var(--spacing-page-horizontal)',
      'section-gap': 'var(--spacing-section-gap)',
      'card-pad': 'var(--spacing-card-padding)',
      'card-gap': 'var(--spacing-card-gap)',
      'grid-gap': 'var(--spacing-grid-gap)',
      'bottom-nav': 'var(--spacing-bottom-nav)',
      'nav-h': 'var(--nav-height)',
      'badge-sm': 'var(--badge-size-sm)',
      'badge-md': 'var(--badge-size-md)',
      'badge-lg': 'var(--badge-size-lg)',
      'time-col': 'var(--time-col-width)',
    'icon-sm': 'var(--icon-sm)',
    'icon-md': 'var(--icon-md)',
    'icon-lg': 'var(--icon-lg)',
    'icon-box': 'var(--icon-box)',
    'icon-nav': 'var(--icon-nav)',
    'icon-empty': 'var(--icon-empty)',
    'dot-sm': 'var(--dot-sm)',
    'menu-row': 'var(--menu-row-h)',
    'account-row': 'var(--account-row-h)',
    'popover-menu': 'var(--popover-menu-w)',
    'skeleton-panel': 'var(--skeleton-panel-h)',
    'icon-xs': 'var(--icon-xs)',
    'typing-dot-md': 'var(--typing-dot-md)',
    'typing-dot-sm': 'var(--typing-dot-sm)',
    'icon-circle': 'var(--icon-circle)',
    'icon-xl': 'var(--icon-xl)',
    'icon-star': 'var(--icon-star)',
    'icon-badge': 'var(--icon-badge)',
    'icon-badge-lg': 'var(--icon-badge-lg)',
    'thumb': 'var(--thumb)',
    'avatar-mdl': 'var(--avatar-mdl)',
    'avatar-lg': 'var(--avatar-lg)',
    'skeleton-line': 'var(--skeleton-line)',
    'skeleton-meta-h': 'var(--skeleton-meta-h)',
    'skeleton-name-w': 'var(--skeleton-name-w)',
    'skeleton-title-w': 'var(--skeleton-title-w)',
    'skeleton-meta-w': 'var(--skeleton-meta-w)',
    'skeleton-title': 'var(--skeleton-title)',
    'skeleton-badge-h': 'var(--skeleton-badge-h)',
    'skeleton-badge-w': 'var(--skeleton-badge-w)',
    'skeleton-pill-w': 'var(--skeleton-pill-w)',
    'sheet-pad': 'var(--sheet-pad)',
    'bento-pad': 'var(--bento-pad)',
    'sheet-overlap': 'var(--sheet-overlap)',
    'banner-page': 'var(--banner-h-page)',
    'banner-hero': 'var(--banner-h-hero)',
    'caret-h-md': 'var(--caret-h-md)',
    'caret-h-sm': 'var(--caret-h-sm)',
    'caret-w-md': 'var(--caret-w-md)',
    'caret-w-sm': 'var(--caret-w-sm)',
    'presence-sm': 'var(--presence-dot-sm)',
    'presence-md': 'var(--presence-dot-md)',
    'sidebar-slot': 'var(--sidebar-slot)',
      'skeleton-sm': 'var(--skeleton-width-sm)',
      'skeleton-lg': 'var(--skeleton-width-lg)',
    },

    /* Escalas cerradas: solo existen estos valores (si falta uno, se crea en index.css y aqui). */
    maxWidth: ({ theme }) => ({
      ...theme('spacing'),
      content: 'var(--content-width)',
      container: 'var(--container-width)',
      shell: 'var(--shell-width)',
      modal: 'var(--modal-width)',
      'modal-md': 'var(--modal-width-md)',
      chip: 'var(--chip-max-width)',
      name: 'var(--name-max-width)',
      'name-lg': 'var(--name-max-width-lg)',
      'viewport-gutter': 'var(--viewport-gutter-width)',
      form: 'var(--form-width)',
      bubble: 'var(--chat-bubble-max-width)',
      'bubble-system': 'var(--chat-bubble-max-width-system)',
      'truncate-xs': 'var(--truncate-width-xs)',
      'truncate-sm': 'var(--truncate-width-sm)',
      'truncate-lg': 'var(--truncate-width-lg)',
      none: 'none',
      full: 'var(--size-full)',
      max: 'max-content',
      xs: 'var(--max-width-xs)',
      sm: 'var(--max-width-sm)',
      md: 'var(--max-width-md)',
      lg: 'var(--max-width-lg)',
      '2xl': 'var(--max-width-2xl)',
    }),
    borderWidth: {
      DEFAULT: 'var(--border-width)',
      0: '0px',
      2: 'var(--border-width-2)',
      4: 'var(--border-width-4)',
      ring: 'var(--border-width-ring)',
    },
    transitionDuration: {
      fast: 'var(--duration-fast)',
      base: 'var(--duration-base)',
      slow: 'var(--duration-slow)',
      DEFAULT: 'var(--duration-fast)',
      150: 'var(--duration-fast)',
      200: 'var(--duration-200)',
      300: 'var(--duration-300)',
      500: 'var(--duration-500)',
      1000: 'var(--duration-1000)',
    },
    transitionTimingFunction: {
      standard: 'var(--ease-standard)',
      out: 'var(--ease-out)',
      DEFAULT: 'var(--ease-in-out)',
      'in-out': 'var(--ease-in-out)',
    },
    letterSpacing: {
      tighter: 'var(--ls-tighter)',
      tight: 'var(--ls-tight)',
      normal: 'var(--ls-normal)',
      wide: 'var(--ls-wide)',
      wider: 'var(--ls-wider)',
      widest: 'var(--ls-widest)',
    },
    textUnderlineOffset: {
      auto: 'auto',
      4: 'var(--underline-offset)',
    },
    keyframes: {
      'caret-blink': { '0%, 70%, 100%': { opacity: '1' }, '20%, 50%': { opacity: '0' } },
      spin: { to: { transform: 'rotate(360deg)' } },
      pulse: { '50%': { opacity: 'var(--pulse-min-opacity)' } },
      bounce: {
        '0%, 100%': { transform: 'translateY(-25%)', animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)' },
        '50%': { transform: 'none', animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' },
      },
      'accordion-down': {
        from: { height: '0' },
        to: { height: 'var(--radix-accordion-content-height)' },
      },
      'accordion-up': {
        from: { height: 'var(--radix-accordion-content-height)' },
        to: { height: '0' },
      },
      /* Onda blanca del boton "Publicar" (1.4s de pulso + 1.6s de pausa = 3s) */
      'pulse-ring': {
        '0%': { boxShadow: '0 0 0 0 color-mix(in srgb, var(--gray-0) 60%, transparent)' },
        '47%, 100%': { boxShadow: '0 0 0 14px color-mix(in srgb, var(--gray-0) 0%, transparent)' },
      },
    },
    animation: {
      'caret-blink': 'caret-blink var(--duration-caret) ease-out infinite',
      spin: 'spin var(--duration-spin) linear infinite',
      pulse: 'pulse var(--duration-pulse) var(--ease-pulse) infinite',
      bounce: 'bounce var(--duration-spin) infinite',
      'pulse-ring': 'pulse-ring var(--duration-pulse-ring) var(--ease-out-soft) infinite',
      'accordion-down': 'accordion-down var(--duration-base) var(--ease-out)',
      'accordion-up': 'accordion-up var(--duration-base) var(--ease-out)',
    },
    opacity: {
      0: '0',
      2: 'var(--opacity-2)',
      5: 'var(--opacity-5)',
      10: 'var(--opacity-10)',
      15: 'var(--opacity-15)',
      20: 'var(--opacity-20)',
      30: 'var(--opacity-30)',
      40: 'var(--opacity-40)',
      50: 'var(--opacity-50)',
      60: 'var(--opacity-60)',
      70: 'var(--opacity-70)',
      80: 'var(--opacity-80)',
      90: 'var(--opacity-90)',
      95: 'var(--opacity-95)',
      100: '1',
    },
    ringWidth: {
      0: '0px',
      1: 'var(--border-width)',
      2: 'var(--border-width-2)',
    },
    ringOffsetWidth: {
      0: '0px',
      1: 'var(--border-width)',
      2: 'var(--border-width-2)',
    },
    rotate: {
      45: 'var(--rotate-45)',
      90: 'var(--rotate-90)',
      180: 'var(--rotate-180)',
    },
    scale: {
      90: 'var(--scale-90)',
      95: 'var(--scale-95)',
      100: 'var(--scale-100)',
      110: 'var(--scale-110)',
      125: 'var(--scale-125)',
      press: 'var(--scale-press)',
      'press-sm': 'var(--scale-press-sm)',
    },
    backdropBlur: {
      sm: 'var(--blur-sm)',
      md: 'var(--blur-md)',
    },
    blur: {
      sm: 'var(--blur-sm)',
      md: 'var(--blur-md)',
    },
    lineClamp: {
      1: '1',
      2: '2',
      3: '3',
      none: 'none',
    },
    flexGrow: {
      0: '0',
      DEFAULT: '1',
    },
    flexShrink: {
      0: '0',
      DEFAULT: '1',
    },
    lineHeight: {
      none: 'var(--lh-none)',
      normal: 'var(--lh-normal)',
      /* Rejilla 4pt: leading-4 = 16px ... leading-16 = 64px */
      4: 'var(--lh-4)', 5: 'var(--lh-5)', 6: 'var(--lh-6)', 7: 'var(--lh-7)', 8: 'var(--lh-8)',
      9: 'var(--lh-9)', 10: 'var(--lh-10)', 12: 'var(--lh-12)', 14: 'var(--lh-14)', 16: 'var(--lh-16)',
    },
    fontWeight: {
      regular: 'var(--fw-regular)',
      normal: 'var(--fw-regular)',
      medium: 'var(--fw-medium)',
      semibold: 'var(--fw-semibold)',
      bold: 'var(--fw-bold)',
      extrabold: 'var(--fw-extrabold)',
    },
    fontFamily: {
      sans: ['var(--font-family)'],
      display: ['var(--font-family)'],
      mono: ['var(--font-mono)'],
    },
    /* Breakpoints: salen de --bp-* en index.css (via breakpoints.ts); los media queries no aceptan var(). */
    screens: {
      sm: `${bp.sm}px`,
      md: `${bp.md}px`,
      lg: `${bp.lg}px`,
      xl: `${bp.xl}px`,
      tablet: { raw: `(min-width: ${bp.md}px) and (max-width: ${bp.lg - 1}px) and (min-height: ${bp.tabletMinHeight}px)` },
    },
    width: ({ theme }) => ({
      ...theme('spacing'),
      auto: 'auto',
      full: 'var(--size-full)',
      screen: 'var(--size-screen-w)',
      min: 'min-content',
      max: 'max-content',
      fit: 'fit-content',
      '1/2': 'var(--size-1-2)',
      '2/3': 'var(--size-2-3)',
      '3/4': 'var(--size-3-4)',
      '2/5': 'var(--size-2-5)',
      'dialog-fluid': 'var(--dialog-width-fluid)',
      'chat-doc': 'var(--chat-doc-width)',
      'control-sm': 'var(--control-width-sm)',
      'control-md': 'var(--control-width-md)',
      'radix-nav-viewport': 'var(--radix-navigation-menu-viewport-width)',
    }),
    height: ({ theme }) => ({
      ...theme('spacing'),
      auto: 'auto',
      full: 'var(--size-full)',
      screen: 'var(--size-screen-h)',
      dvh: 'var(--size-dvh)',
      'chat-split': 'var(--chat-split-height)',
      'pdf-cover': 'var(--chat-pdf-cover-height)',
      field: 'var(--field-height)',
      'radix-nav-viewport': 'var(--radix-navigation-menu-viewport-height)',
      'radix-select-trigger': 'var(--radix-select-trigger-height)',
    }),
    minWidth: ({ theme }) => ({
      ...theme('spacing'),
      0: '0',
      full: 'var(--size-full)',
      min: 'min-content',
      max: 'max-content',
      fit: 'fit-content',
      'dropdown-sm': 'var(--dropdown-width-sm)',
      'dropdown-md': 'var(--dropdown-width-md)',
      'btn-sm': 'var(--button-min-width-sm)',
      'control-sm': 'var(--control-width-sm)',
      'control-md': 'var(--control-width-md)',
      'radix-select-trigger': 'var(--radix-select-trigger-width)',
      menu: 'var(--menu-min-width)',
      'menu-lg': 'var(--menu-min-width-lg)',
      label: 'var(--label-min-width)',
      count: 'var(--count-min-width)',
      'count-lg': 'var(--count-min-width-lg)',
      'badge-sm': 'var(--badge-size-sm)',
      'badge-md': 'var(--badge-size-md)',
      'badge-lg': 'var(--badge-size-lg)',
    }),
    minHeight: ({ theme }) => ({
      ...theme('spacing'),
      0: '0',
      full: 'var(--size-full)',
      screen: 'var(--size-screen-h)',
      dvh: 'var(--size-dvh)',
      textarea: 'var(--textarea-min-height)',
      field: 'var(--field-height)',
      select: 'var(--select-min-height)',
      panel: 'var(--panel-min-height)',
      'task-meta': 'var(--task-meta-min-h)',
      'task-candidates': 'var(--task-candidates-min-h)',
      view: 'var(--view-min-height)',
      'empty-center': 'var(--empty-center-min-height)',
    }),
    maxHeight: ({ theme }) => ({
      ...theme('spacing'),
      none: 'none',
      full: 'var(--size-full)',
      screen: 'var(--size-screen-h)',
      sheet: 'var(--sheet-max-height)',
      'sheet-sm': 'var(--sheet-max-height-sm)',
      'sheet-md': 'var(--sheet-max-height-md)',
      'sheet-lg': 'var(--sheet-max-height-lg)',
      table: 'var(--table-max-height)',
      thumb: 'var(--thumb-max-height)',
      'modal-body': 'var(--modal-body-max-height)',
      half: 'var(--half-max-height)',
      'radix-context-menu': 'var(--radix-context-menu-content-available-height)',
      'radix-dropdown-menu': 'var(--radix-dropdown-menu-content-available-height)',
      'radix-select': 'var(--radix-select-content-available-height)',
      dropdown: 'var(--dropdown-max-height)',
    }),
    inset: ({ theme }) => ({
      ...theme('spacing'),
      auto: 'auto',
      full: 'var(--size-full)',
      '1/2': 'var(--size-1-2)',
      'nav-dynamic': 'var(--bottom-nav-height, var(--spacing-bottom-nav))',
      arrow: 'var(--arrow-offset)',
    }),
    translate: ({ theme }) => ({
      ...theme('spacing'),
      full: 'var(--size-full)',
      '1/2': 'var(--size-1-2)',
      'toggle-off': 'var(--toggle-offset)',
      'toggle-on': 'var(--toggle-on)',
      'toggle-on-lg': 'var(--toggle-on-lg)',
      'dialog-slide': 'var(--dialog-slide)',
      'alert-nudge': 'var(--alert-icon-nudge)',
      'toast-swipe-end': 'var(--radix-toast-swipe-end-x)',
      'toast-swipe-move': 'var(--radix-toast-swipe-move-x)',
    }),
    flexBasis: {
      auto: 'auto',
      full: 'var(--size-full)',
    },
    flex: {
      1: 'var(--flex-1)',
      auto: '1 1 auto',
      none: 'none',
    },
    aspectRatio: {
      auto: 'auto',
      square: 'var(--aspect-square)',
    },
    gridTemplateColumns: {
      none: 'none',
      1: 'var(--cols-1)',
      2: 'var(--cols-2)',
      3: 'var(--cols-3)',
      4: 'var(--cols-4)',
      6: 'var(--cols-6)',
      7: 'var(--cols-7)',
      10: 'var(--cols-10)',
      12: 'var(--cols-12)',
      'chat-3': 'var(--chat-cols-3)',
      'chat-2': 'var(--chat-cols-2)',
      fit: 'minmax(0, 1fr)',
    },
    gridColumn: {
      auto: 'auto',
      'span-full': '1 / -1',
      'span-2': 'var(--span-2)',
      'span-3': 'var(--span-3)',
      'span-4': 'var(--span-4)',
      'span-6': 'var(--span-6)',
      'span-7': 'var(--span-7)',
      'span-10': 'var(--span-10)',
    },
    extend: {
      borderColor: {
        field: "var(--border-field)",
      },
      /* text-muted = texto secundario (gray-700). `muted` en colors es el FONDO shadcn (bg-muted). */
      textColor: {
        muted: tok("--color-text-muted"),
        placeholder: tok("--color-text-placeholder"),
      },
      /* Tablet (p. ej. 800x1280 vertical): 768-1023px de ancho Y >=600px de alto. El alto excluye
         celulares en horizontal (844x390), donde lista + chat lado a lado no caben. No se solapa con lg:, asi
         que tablet: y lg: nunca compiten por la misma propiedad. Lo usa el
         split de Mensajes; desde lg: (>=1024px) manda el layout de escritorio. */

      /* Anchos / altos con nombre (antes eran utilidades a mano en index.css) */
      transformOrigin: {
        'radix-context-menu': 'var(--radix-context-menu-content-transform-origin)',
        'radix-dropdown-menu': 'var(--radix-dropdown-menu-content-transform-origin)',
        'radix-hover-card': 'var(--radix-hover-card-content-transform-origin)',
        'radix-menubar': 'var(--radix-menubar-content-transform-origin)',
        'radix-popover': 'var(--radix-popover-content-transform-origin)',
        'radix-select': 'var(--radix-select-content-transform-origin)',
        'radix-tooltip': 'var(--radix-tooltip-content-transform-origin)',
      },

      /* Motion */

      /* Font family */

      /* Font weight — conserva las claves de Tailwind (font-normal/medium/...) y suma `regular` */

      /* Line height — todas las utilidades leading-* salen de los tokens --lh-* */

      /* Letter spacing — tracking-wider/widest siguen siendo los de Tailwind */

      /* Animations */
    },
  },
  /* Se desactivan outlineStyle y accessibility del core porque emiten literales (outline-none, sr-only):
     se reescriben abajo con var(--token) de index.css. */
  corePlugins: { outlineStyle: false, accessibility: false },
  /* `hover:` solo bajo @media (hover: hover): en pantallas tactiles el hover no se queda pegado tras el toque. */
  future: { hoverOnlyWhenSupported: true },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    plugin(({ addUtilities, addVariant }) => {
      addVariant('hover-none', '@media (hover: none)');
      addUtilities({
        '.break-anywhere': { 'overflow-wrap': 'anywhere' },
        '.delay-typing-1': { 'animation-delay': 'var(--typing-delay-1)' },
        '.delay-typing-2': { 'animation-delay': 'var(--typing-delay-2)' },
        '.outline-none': { outline: 'var(--outline-none)', 'outline-offset': 'var(--outline-offset)' },
        '.sr-only': {
          position: 'absolute',
          width: 'var(--space-px)',
          height: 'var(--space-px)',
          padding: '0',
          margin: 'calc(var(--space-px) * -1)',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          borderWidth: '0',
        },
      });
    }),
  ],
} satisfies Config;
