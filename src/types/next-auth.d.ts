import "next-auth";
import "next-auth/jwt";

/**
 * The session id, carried on the session.
 *
 * The PIN's freshness is NOT on the session any more — it lives in the
 * `cdx_lock` cookie, which is bound to this id (see src/lib/access.ts). Code
 * asks `getAccess()` whether a request may see the account; a page that reads
 * the session alone gets an identity, never a permission.
 */
declare module "next-auth" {
  interface Session {
    sid: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sid?: string;
    /** Epoch ms of the Google sign-in. The 7-day limit counts from here. */
    loginAt?: number;
  }
}
