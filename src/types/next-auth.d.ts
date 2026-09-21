import "next-auth";
import "next-auth/jwt";

/**
 * The second factor, carried on the session.
 *
 * Declared here rather than cast at each use so that a page which forgets to
 * check it fails to compile. `pinVerified` is the difference between "Google
 * says this mailbox" and "the owner is at the keyboard", and a missing check
 * should be a build error, not a runtime one on a live account.
 */
declare module "next-auth" {
  interface Session {
    pinVerified: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    pinVerified?: boolean;
    pinVerifiedAt?: number;
  }
}
