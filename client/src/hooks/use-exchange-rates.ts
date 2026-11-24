import { useQuery } from "@tanstack/react-query";

export function useExchangeRates() {
  return useQuery<{ rates: Record<string, number>; lastUpdated?: string; cached?: boolean }>({
    queryKey: ["/api/exchange-rates"],
    staleTime: 1000 * 60 * 5,
  });
}
