'use client';

import { useSession } from 'next-auth/react';
import { type ReactNode } from 'react';

interface IfAuthenticatedProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function IfAuthenticated({ children, fallback = null }: IfAuthenticatedProps) {
  const { status } = useSession();
  if (status === 'authenticated') return <>{children}</>;
  if (status === 'loading') return null;
  return <>{fallback}</>;
}
