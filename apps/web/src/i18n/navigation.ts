import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Wrapped navigation APIs that handle locale automatically
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
