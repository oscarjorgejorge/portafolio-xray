import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes safely.
 * Handles conflicting classes by letting the last one win.
 * 
 * @example
 * cn('bg-blue-500', 'bg-red-500') // => 'bg-red-500'
 * cn('px-2 py-1', condition && 'px-4') // => 'px-4 py-1' if condition is true
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return twMerge(inputs.filter(Boolean).join(' '));
}
