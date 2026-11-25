import { timezoneForCountry } from "@shared/country-timezone";
export const countries = [
  { code: "PE", name: "Perú", flag: "🇵🇪", currency: "PEN", currencyCode: "PEN", phoneCode: "+51", timezone: "America/Lima", minBudget: 10 },
  { code: "CO", name: "Colombia", flag: "🇨🇴", currency: "COP", currencyCode: "COP", phoneCode: "+57", timezone: "America/Bogota", minBudget: 15 },
  { code: "MX", name: "México", flag: "🇲🇽", currency: "MXN", currencyCode: "MXN", phoneCode: "+52", timezone: "America/Mexico_City", minBudget: 20 },
  { code: "AR", name: "Argentina", flag: "🇦🇷", currency: "ARS", currencyCode: "ARS", phoneCode: "+54", timezone: "America/Argentina/Buenos_Aires", minBudget: 25 },
  { code: "CL", name: "Chile", flag: "🇨🇱", currency: "CLP", currencyCode: "CLP", phoneCode: "+56", timezone: "America/Santiago", minBudget: 18 },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", currency: "USD", currencyCode: "USD", phoneCode: "+593", timezone: "America/Guayaquil", minBudget: 12 },
  { code: "ES", name: "España", flag: "🇪🇸", currency: "EUR", currencyCode: "EUR", phoneCode: "+34", timezone: "Europe/Madrid", minBudget: 8 },
];

// formatPrice vive en currency-utils; se re-exporta para no tocar los imports existentes.
export { formatPrice } from "./currency-utils";

export function getCurrencyCodeByCountry(countryCode: string): string {
  const country = countries.find(c => c.code === countryCode);
  return country?.currencyCode || "PEN";
}

export function getTimezoneByCountry(countryCode: string): string {
  const known = timezoneForCountry(countryCode);
  if (known) return known;
  const country = countries.find(c => c.code === countryCode);
  return country?.timezone || "America/Lima"; // Default to Peru timezone
}

export function getCountryByCode(countryCode: string) {
  return countries.find(c => c.code === countryCode) || countries[0];
}

export function formatDateForUser(date: Date | string, countryCode: string): string {
  try {
    const timezone = getTimezoneByCountry(countryCode);
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (!dateObj || isNaN(dateObj.getTime())) {
      return new Date().toLocaleDateString('es-PE', { timeZone: timezone });
    }
    
    return dateObj.toLocaleDateString('es-PE', { timeZone: timezone });
  } catch (error) {
    console.error('Error in formatDateForUser:', error);
    return new Date().toLocaleDateString('es-PE');
  }
}

export function formatTimeForUser(date: Date | string, countryCode: string): string {
  const timezone = getTimezoneByCountry(countryCode);
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('es-PE', { 
    hour: '2-digit', 
    minute: '2-digit', 
    timeZone: timezone 
  });
}

export function formatDateTimeForUser(date: Date | string, countryCode: string): string {
  return `${formatDateForUser(date, countryCode)} - ${formatTimeForUser(date, countryCode)}`;
}

// SAFE DATE UTILITIES TO PREVENT INVALID DATE ERRORS
export function safeParseDate(dateInput: any): Date {
  if (!dateInput) return new Date();
  
  // If already a Date object
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  }
  
  // If string, try parsing
  if (typeof dateInput === 'string') {
    const parsed = new Date(dateInput);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  
  // If number (timestamp)
  if (typeof dateInput === 'number') {
    const parsed = new Date(dateInput);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }
  
  // Fallback to current date
  return new Date();
}

export function safeFormatTime(dateInput: any): string {
  try {
    if (!dateInput) return '';
    
    let date: Date;
    
    // Handle different timestamp formats
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput);
    } else {
      return '';
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateInput);
      return '';
    }
    
    return date.toLocaleTimeString('es-PE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return '';
  }
}

export function safeFormatDateTime(dateInput: any): string {
  const safeDate = safeParseDate(dateInput);
  return safeDate.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit', 
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Función para obtener el monto mínimo por país
export function getMinBudgetByCountry(countryCode: string): number {
  const country = countries.find(c => c.code === countryCode);
  return country?.minBudget || 10; // Default to Peru minimum
}

// Función para crear el mensaje de validación de presupuesto por país
export function getBudgetValidationMessage(countryCode: string): string {
  const country = countries.find(c => c.code === countryCode);
  const minBudget = country?.minBudget || 10;
  const currencyCode = country?.currencyCode || "PEN";
  return `El presupuesto debe ser al menos ${minBudget} ${currencyCode}`;
}