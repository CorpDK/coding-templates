'use client';

import { signIn } from 'next-auth/react';

interface SignInButtonProps {
  provider?: string;
  callbackUrl?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SignInButton({
  provider,
  callbackUrl = '/',
  children = 'Sign in',
  className,
}: SignInButtonProps) {
  return (
    <button
      onClick={() => signIn(provider, { callbackUrl })}
      className={
        className ??
        'px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors'
      }
    >
      {children}
    </button>
  );
}
