'use client';

import {
  SignInButton,
  SignOutButton,
  IfAuthenticated,
  IfPermission,
  useSession,
} from "@corpdk/ui-auth";

function SessionInfo() {
  const { data: session, status } = useSession();

  if (status === "loading") return <p className="text-sm text-muted-foreground">Loading session...</p>;
  if (!session) return <p className="text-sm text-muted-foreground">Not signed in</p>;

  return (
    <div className="text-sm space-y-1">
      <p><strong>Name:</strong> {session.user?.name}</p>
      <p><strong>Email:</strong> {session.user?.email}</p>
    </div>
  );
}

export default function AuthPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 space-y-10">
      <h1 className="text-2xl font-bold">Auth</h1>
      <p className="text-sm text-muted-foreground">
        Auth requires a configured <code className="font-mono">AUTH_*</code> environment and the BFF scaffold. Components are shown in their unauthenticated state here.
      </p>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Session</h2>
        <SessionInfo />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">SignInButton / SignOutButton</h2>
        <div className="flex gap-3">
          <SignInButton provider="oidc" callbackUrl="/">Sign in with SSO</SignInButton>
          <SignOutButton />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">IfAuthenticated</h2>
        <IfAuthenticated fallback={<p className="text-sm text-muted-foreground">Hidden — sign in to see this content</p>}>
          <p className="text-sm text-green-600">You are authenticated!</p>
        </IfAuthenticated>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">IfPermission (role = admin)</h2>
        <IfPermission role="admin" fallback={<p className="text-sm text-muted-foreground">Hidden — requires admin role</p>}>
          <p className="text-sm text-green-600">Admin content visible</p>
        </IfPermission>
      </section>
    </main>
  );
}
