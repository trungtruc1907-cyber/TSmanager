import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
}

export function calculateSolarProduction(sizeKWp: number, sunHoursDay: number = 4) {
  return sizeKWp * sunHoursDay * 365 * 0.8;
}

export function getAverageElectricityPrice(monthlyBill: number, usageType?: string) {
  let avgPrice = 2500;

  if (usageType === 'residential') {
    if (monthlyBill > 5000000) avgPrice = 3000;
    else if (monthlyBill > 2000000) avgPrice = 2800;
    else avgPrice = 2500;
  } else if (usageType === 'commercial') {
    avgPrice = 3100;
  } else if (usageType === 'industrial') {
    avgPrice = 2100;
  }

  return avgPrice;
}

export function estimateSystemSize(monthlyBill: number, usageType?: string, phaseType?: string) {
  const avgPrice = getAverageElectricityPrice(monthlyBill, usageType);
  const kwhPerMonth = monthlyBill / avgPrice;
  
  // Recommended size covers ~80% of consumption
  let sizeKWp = kwhPerMonth / (4 * 30 * 0.8);

  // Apply constraints based on Phase
  if (phaseType === '1phase') {
    sizeKWp = Math.min(sizeKWp, 10);
  }

  return Math.ceil(sizeKWp * 2) / 2; // Round to nearest 0.5
}
