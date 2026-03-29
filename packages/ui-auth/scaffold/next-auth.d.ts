import type { DefaultSession } from 'next-auth';
import type { AppUserClaims } from '@corpdk/ui-auth';

/**
 * Augments next-auth types with the claims defined in AppUserClaims.
 *
 * - Session.user  — typed claims on the client-side session object
 * - User          — typed claims in callback context (JWT strategy)
 * - Profile       — typed claims from the OIDC provider profile (no cast needed)
 * - JWT           — typed claims stored in the server-side token
 *
 * To add custom SSO claims, extend AppUserClaims in your app's type declaration:
 *
 * @example
 * // types/auth.d.ts
 * declare module '@corpdk/ui-auth' {
 *   interface AppUserClaims {
 *     department?: string;
 *     tenantId?: string;
 *   }
 * }
 */
declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & AppUserClaims;
  }

  // Covers session.user inside callbacks.session when using JWT strategy
  interface User extends AppUserClaims {}

  // Covers profile fields from the OIDC provider — no casting required in callbacks.jwt
  interface Profile extends AppUserClaims {}
}

declare module 'next-auth/jwt' {
  interface JWT extends AppUserClaims {}
}
