// Utility functions for user connection status detection
// Centralized to ensure consistency across the entire system

// "Hace un momento" | "Hace 5 min" | "Hace 3 horas" | "Hace 1 día" | "Hace 23 días"
function elapsedLabel(diffMinutes: number): string {
  if (diffMinutes < 1) return "Hace un momento";
  if (diffMinutes < 60) return `Hace ${Math.floor(diffMinutes)} min`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `Hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
}

export function getConnectionStatus(lastSeen: Date | string | null, isRealtimeOnline?: boolean) {
  if (isRealtimeOnline) {
    return { 
      color: 'bg-success', 
      text: 'En línea',
      isOnline: true 
    };
  }
  
  if (lastSeen) {
    const lastSeenDate = typeof lastSeen === 'string' ? new Date(lastSeen) : lastSeen;
    const now = new Date();
    const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
    
    return { 
      color: 'bg-gray-300', 
      text: elapsedLabel(diffMinutes),
      isOnline: false 
    };
  }
  
  return { 
    color: 'bg-gray-300', 
    text: 'Sin conexión',
    isOnline: false 
  };
}

export function getTimeAgo(lastSeen: Date | string | null, isRealtimeOnline?: boolean): string {
  if (isRealtimeOnline) return 'En línea';
  
  if (!lastSeen) return 'Sin conexión';
  
  const lastSeenDate = typeof lastSeen === 'string' ? new Date(lastSeen) : lastSeen;
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
  
  return elapsedLabel(diffMinutes);
}