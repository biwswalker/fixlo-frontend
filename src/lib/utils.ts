import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBaht(amount: number) {
  return new Intl.NumberFormat('th-TH', { 
    style: 'currency', 
    currency: 'THB' 
  }).format(amount);
}

export function formatThaiDate(dateStr: string | Date | null | undefined) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";
  
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}
