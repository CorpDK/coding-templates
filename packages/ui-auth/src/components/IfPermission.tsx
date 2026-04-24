"use client";

import { useSession } from "next-auth/react";
import { type ReactNode } from "react";

interface IfPermissionProps {
  role: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function IfPermission({
  role,
  children,
  fallback = null,
}: IfPermissionProps) {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role;
  if (userRole === role) return <>{children}</>;
  return <>{fallback}</>;
}
