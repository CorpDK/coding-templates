/**
 * Claims that your SSO provider maps onto the session and JWT.
 *
 * This interface uses TypeScript declaration merging — extend it in your app
 * to add provider-specific claims. All added fields automatically flow through
 * to `Session.user` and `JWT` via the scaffold's `next-auth.d.ts`.
 *
 * @example
 * // In your-app/types/auth.d.ts
 * declare module '@corpdk/ui-auth' {
 *   interface AppUserClaims {
 *     department?: string;
 *     tenantId?: string;
 *   }
 * }
 */
export interface AppUserClaims {
  role?: string;
  scope?: string;
}
