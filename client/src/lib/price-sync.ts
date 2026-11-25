// Global price synchronization utility
// Detects price updates from chat messages and synchronizes across all components

export const taskPrices = new Map<string, string>();

// Normalize price: remove trailing .00, keep decimals only if non-zero
export const normalizePrice = (price: string): string => {
  if (!price) return price;
  const num = parseFloat(price);
  if (isNaN(num)) return price;
  // If it's a whole number, return without decimals
  if (num === Math.floor(num)) {
    return String(Math.floor(num));
  }
  // Otherwise keep 2 decimals
  return num.toFixed(2);
};

export const detectPriceFromMessage = (message: string): string | null => {
  if (!message || typeof message !== 'string') return null;
  
  const patterns = [
    /💰.*?(\d+(?:\.\d{2})?)\s*(?:PEN|MXN|COP|ARS|CLP|USD|EUR)/i,
    /cotización.*?(\d+(?:\.\d{2})?)\s*(?:PEN|MXN|COP|ARS|CLP|USD|EUR)/i,
    /💰.*?S\/\.(\d+(?:\.\d{2})?)/i,
    /cotización.*?S\/\.(\d+(?:\.\d{2})?)/i,
    /S\/\.(\d+(?:\.\d{2})?)/i
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const normalizedPrice = normalizePrice(match[1]);
      return normalizedPrice;
    }
  }
  
  return null;
};

export const broadcastPriceUpdate = (taskId: string, conversationKey: string, newPrice: string) => {
  
  // Store in global cache with FORCE
  taskPrices.set(taskId, newPrice);
  taskPrices.set(conversationKey, newPrice);
  
  // Broadcast events to all components
  const eventDetails = { taskId, conversationKey, newPrice, source: 'auto-detect' };
  
  window.dispatchEvent(new CustomEvent('globalPriceUpdate', { detail: eventDetails }));
  window.dispatchEvent(new CustomEvent('priceUpdate', { detail: eventDetails }));
  window.dispatchEvent(new CustomEvent('taskPriceUpdate', { detail: eventDetails }));
  
};

let _syncPaused = false;

export const pausePriceSync = () => { _syncPaused = true; };
export const resumePriceSync = () => { _syncPaused = false; };

export const syncAllPrices = async () => {
  if (_syncPaused) return;
  
  try {
    const response = await fetch('/api/chat/last-messages', { credentials: 'include' });
    if (!response.ok) return;
    
    const lastMessages = await response.json();
    
    Object.entries(lastMessages).forEach(([conversationKey, messageData]: [string, any]) => {
      const message = messageData?.message;
      if (message) {
        const detectedPrice = detectPriceFromMessage(message);
        if (detectedPrice) {
          const taskId = conversationKey.split('-')[0];
          const currentPrice = taskPrices.get(taskId);
          
          if (currentPrice !== detectedPrice) {
            taskPrices.set(taskId, detectedPrice);
            taskPrices.set(conversationKey, detectedPrice);
            broadcastPriceUpdate(taskId, conversationKey, detectedPrice);
          }
        }
      }
    });
  } catch (error) {
  }
};