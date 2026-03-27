'use client';

import { signOut } from 'next-auth/react';

interface SignOutButtonProps {
  callbackUrl?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SignOutButton({
  callbackUrl = '/',
  children = 'Sign out',
  className,
}: SignOutButtonProps) {
  return (
    <button
      onClick={() => signOut({ callbackUrl })}
      className={
        className ??
        'px-4 py-2 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors'
      }
    >
      {children}
    </button>
  );
}
