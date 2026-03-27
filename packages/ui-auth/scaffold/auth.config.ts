import NextAuth from 'next-auth';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: 'oidc',
      name: process.env.AUTH_PROVIDER_NAME ?? 'SSO',
      type: 'oidc',
      issuer: process.env.AUTH_ISSUER,
      clientId: process.env.AUTH_CLIENT_ID,
      clientSecret: process.env.AUTH_CLIENT_SECRET,
    },
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, profile }) {
      if (profile?.sub) token.sub = profile.sub;
      if ((profile as { role?: string })?.role) {
        (token as { role?: string }).role = (profile as { role?: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.name = token.name ?? session.user.name;
        (session.user as { role?: string }).role = (token as { role?: string }).role;
      }
      return session;
    },
  },
});
