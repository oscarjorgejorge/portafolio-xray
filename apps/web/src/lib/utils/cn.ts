import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes safely.
 * Combines clsx for conditional classes with tailwind-merge for conflict resolution.
 *
 * @example
 * cn('bg-blue-500', 'bg-red-500') // => 'bg-red-500'
 * cn('px-2 py-1', condition && 'px-4') // => 'px-4 py-1' if condition is true
 * cn('base', { 'active': isActive, 'error': hasError }) // => 'base active' if isActive is true
 * cn(['flex', 'items-center'], isLarge && 'text-lg') // => 'flex items-center text-lg'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
