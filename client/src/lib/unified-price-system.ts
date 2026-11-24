// =============================
// UNIFIED GLOBAL PRICE SYSTEM
// Single source of truth for all price data across the entire PWA
// =============================

import { useState, useEffect } from 'react';

// Normalize price: remove trailing .00, keep decimals only if non-zero
const normalizePrice = (price: string): string => {
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

interface PriceUpdate {
  taskId: string;
  currentPrice: string;
  lastUpdated: Date;
  source: 'api' | 'chat' | 'initial';
}

interface TaskPriceData {
  currentPrice: string;
  lastUpdated: Date;
  isLoading: boolean;
}

// GLOBAL STATE - Single source of truth
const globalPrices = new Map<string, TaskPriceData>();

// EVENT SYSTEM for real-time updates
const priceUpdateListeners = new Set<(update: PriceUpdate) => void>();



export const UnifiedPriceSystem = {
  // =============================
  // CORE PRICE MANAGEMENT
  // =============================
  
  // Get current price for a task (always returns the most up-to-date price)
  getCurrentPrice(taskId: string): string | null {
    const data = globalPrices.get(taskId);
    return data?.currentPrice || null;
  },

  // Get full price data including metadata
  getPriceData(taskId: string): TaskPriceData | null {
    return globalPrices.get(taskId) || null;
  },

  // Set price with metadata (internal use)
  _setPriceData(taskId: string, currentPrice: string, source: 'api' | 'chat' | 'initial' = 'api') {
    const now = new Date();
    
    // Normalize price to avoid oscillation between "369" and "369.00"
    const normalizedPrice = normalizePrice(currentPrice);
    
    // Update global state
    globalPrices.set(taskId, {
      currentPrice: normalizedPrice,
      lastUpdated: now,
      isLoading: false
    });

    // Broadcast update event
    const update: PriceUpdate = {
      taskId,
      currentPrice: normalizedPrice,
      lastUpdated: now,
      source
    };
    
    // Notify all subscribers
    priceUpdateListeners.forEach(listener => {
      try {
        listener(update);
      } catch (error) {
        console.error('[UNIFIED_PRICE] Error in listener:', error);
      }
    });
    
  },

  // =============================
  // API INTEGRATION
  // =============================

  // Fetch current price from backend API (authoritative source)
  async fetchCurrentPrice(taskId: string): Promise<string | null> {
    try {
      // Mark as loading
      const existing = globalPrices.get(taskId);
      if (existing) {
        globalPrices.set(taskId, { ...existing, isLoading: true });
      }

      
      const response = await fetch(`/api/tasks/${taskId}/price`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[UNIFIED_PRICE] Task ${taskId} not found or no price available`);
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.currentPrice) {
        this._setPriceData(taskId, data.currentPrice, 'api');
        return data.currentPrice;
      } else {
        console.warn('[UNIFIED_PRICE] Invalid response format:', data);
        return null;
      }
    } catch (error) {
      console.error(`[UNIFIED_PRICE] Failed to fetch price for task ${taskId}:`, error);
      
      // Clear loading state
      const existing = globalPrices.get(taskId);
      if (existing) {
        globalPrices.set(taskId, { ...existing, isLoading: false });
      }
      
      return null;
    }
  },

  // Update price via backend API (when tutor sends new quote)
  async updatePrice(taskId: string, newPrice: string): Promise<boolean> {
    try {
      
      const response = await fetch(`/api/tasks/${taskId}/price`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPrice })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        this._setPriceData(taskId, data.currentPrice, 'api');
        return true;
      } else {
        console.error('[UNIFIED_PRICE] API update failed:', data);
        return false;
      }
    } catch (error) {
      console.error(`[UNIFIED_PRICE] Failed to update price for task ${taskId}:`, error);
      return false;
    }
  },

  // =============================
  // CHAT INTEGRATION
  // =============================

  parsePriceFromMessage(message: string): string | null {
    const newFormatMatch = message.match(/💰\s*Nueva cotización:\s*(\d+(?:\.\d{2})?)\s*(?:PEN|MXN|COP|ARS|CLP|USD|EUR)/i);
    if (newFormatMatch) return newFormatMatch[1];
    const legacyMatch = message.match(/💰\s*Nueva cotización:\s*S\/\.(\d+(?:\.\d{2})?)/i);
    return legacyMatch ? legacyMatch[1] : null;
  },

  // Analyze array of messages for price updates
  _analyzeMessagesForPrice(messages: any[], taskId: string) {
    if (!messages || messages.length === 0) return;
    
    let mostRecentPrice = '';
    let latestTimestamp = '';
    
    // Sort messages by timestamp to get the most recent price
    const sortedMessages = [...messages].sort((a, b) => {
      const timeA = new Date(a.timestamp || '').getTime();
      const timeB = new Date(b.timestamp || '').getTime();
      return timeB - timeA; // Most recent first
    });
    
    // Find the most recent price quotation
    for (const message of sortedMessages) {
      const price = this.parsePriceFromMessage(message.message || '');
      if (price) {
        mostRecentPrice = price;
        latestTimestamp = message.timestamp || '';
        break; // Take the first (most recent) price found
      }
    }
    
    if (mostRecentPrice) {
      const currentPrice = this.getCurrentPrice(taskId);
      const recentNumeric = parseFloat(mostRecentPrice);
      const currentNumeric = currentPrice ? parseFloat(currentPrice) : 0;
      
      // Update if we found a different price (higher OR lower)
      if (recentNumeric !== currentNumeric) {
        this._setPriceData(taskId, mostRecentPrice, 'chat');
        
        // Also update backend to ensure consistency
        this.updatePrice(taskId, mostRecentPrice);
      }
    }
  },

  // Detect and process price updates from chat messages
  async processChatMessage(message: string, taskId: string): Promise<boolean> {
    const newPrice = this.parsePriceFromMessage(message);
    if (newPrice) {
      
      // Update via API to ensure backend consistency
      const success = await this.updatePrice(taskId, newPrice);
      if (success) {
        // Also mark as chat-originated for tracking
        this._setPriceData(taskId, newPrice, 'chat');
      }
      
      return success;
    }
    return false;
  },

  // =============================
  // SUBSCRIPTION SYSTEM
  // =============================

  // Subscribe to price updates
  onPriceUpdate(listener: (update: PriceUpdate) => void): () => void {
    priceUpdateListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      priceUpdateListeners.delete(listener);
    };
  },

  // =============================
  // INITIALIZATION & SYNC
  // =============================

  // Initialize prices for multiple tasks (from task list, conversations, etc.)
  async initializePrices(taskIds: string[]): Promise<void> {
    
    // Fetch all prices in parallel
    const promises = taskIds.map(taskId => this.fetchCurrentPrice(taskId));
    await Promise.all(promises);
    
  },

  // =============================
  // UTILITY METHODS
  // =============================

  // Get all current prices (for debugging)
  getAllPrices(): Map<string, TaskPriceData> {
    return new Map(globalPrices);
  },

  // Clear all prices (useful for logout/reset)
  clearPrices() {
    globalPrices.clear();
    this.stopPolling();
  },

  // No-op: el polling real vive por-instancia dentro del hook
  // useUnifiedPrice (su propio setInterval, limpiado en su useEffect) —
  // no hay un poller global que detener aca, pero clearPrices() ya
  // llamaba a este metodo antes de que existiera (bug de runtime
  // latente, tiraba TypeError si corria). Se agrega como no-op para
  // que el call site siga siendo valido sin inventar logica que no
  // existe a este nivel.
  stopPolling() {},

  // Get loading state for a task
  isLoading(taskId: string): boolean {
    return globalPrices.get(taskId)?.isLoading || false;
  },

  // Check if we have price data for a task
  hasPrice(taskId: string): boolean {
    return globalPrices.has(taskId);
  }
};

// Hook for React components to use the unified price system
export const useUnifiedPrice = (taskId: string) => {
  const [currentPrice, setCurrentPrice] = useState<string | null>(
    UnifiedPriceSystem.getCurrentPrice(taskId)
  );
  const [isLoading, setIsLoading] = useState(
    UnifiedPriceSystem.isLoading(taskId)
  );

  useEffect(() => {
    
    // FORCE fresh fetch every time - no caching
    setIsLoading(true);
    
    // Always fetch fresh data
    UnifiedPriceSystem.fetchCurrentPrice(taskId).then(() => {
      const freshPrice = UnifiedPriceSystem.getCurrentPrice(taskId);
      setCurrentPrice(freshPrice);
      setIsLoading(false);
    });

    // Subscribe to updates
    const unsubscribe = UnifiedPriceSystem.onPriceUpdate((update) => {
      if (update.taskId === taskId) {
        setCurrentPrice(update.currentPrice);
        setIsLoading(false);
      }
    });

    // Force periodic refresh to combat cache issues
    const refreshInterval = setInterval(() => {
      UnifiedPriceSystem.fetchCurrentPrice(taskId);
    }, 5000); // Every 5 seconds

    return () => {
      unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [taskId]);

  return { currentPrice, isLoading };
};