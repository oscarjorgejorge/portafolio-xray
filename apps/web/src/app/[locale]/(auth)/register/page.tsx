'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuthModal } from '@/lib/auth/AuthModalContext';

export default function RegisterRedirectPage() {
  const router = useRouter();
  const { openAuthModal } = useAuthModal();

  useEffect(() => {
    openAuthModal({ tab: 'register' });
    router.replace('/');
  }, [openAuthModal, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
