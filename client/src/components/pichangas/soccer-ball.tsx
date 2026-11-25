// Pelota de futbol con el mismo trazo que los iconos de Lucide (que no tiene una). Se usa donde el tema pedia
// "sports_soccer": bienvenida del feed y chip de superficie del pase.
export function SoccerBall({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8.5 15.3 10.9 14 14.8 10 14.8 8.7 10.9Z" />
      <path d="M12 8.5V2" />
      <path d="M15.3 10.9 21.5 8.9" />
      <path d="M14 14.8 17.5 20.3" />
      <path d="M10 14.8 6.5 20.3" />
      <path d="M8.7 10.9 2.5 8.9" />
    </svg>
  );
}
