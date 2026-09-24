import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Google OAuth, restricted to an explicit allowlist, followed by a PIN.
 *
 * THREE GATES, ALL REQUIRED: this sign-in, an approved device, and the PIN.
 * The last two are decided in src/lib/access.ts.
 *
 * TWO FACTORS, BOTH REQUIRED. Google proves who holds the mailbox; the PIN
 * proves the person at the keyboard is the owner and not whoever borrowed an
 * unlocked laptop with a live Google session. This dashboard shows a real
 * account's balance and every position in it, and a signed-in browser tab left
 * open in a cafe is the likeliest way it gets read by somebody else.
 *
 * NO PASSWORD LOGIN AT ALL. Not disabled, not hidden — absent. A password path
 * is a brute-force surface, a reset-email surface and a reuse surface, and
 * none of that is worth having when Google already does it better.
 *
 * THE ALLOWLIST IS A LIST OF ADDRESSES, NOT A DOMAIN. Anyone with a Google
 * account can attempt this sign-in; without the list, "sign in with Google"
 * means "sign in", and the first person to find the URL is inside.
 */
const allowlist = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    // Seven days, counted from sign-in and NOT extended by use — see
    // `loginAt` below. The dashboard lives on a phone's home screen, and a
    // Google round-trip every morning is friction with no security in it: the
    // PIN, asked after an hour idle or 15 minutes closed, is what guards a
    // phone left on a table. See src/lib/access.ts.
    maxAge: SESSION_MAX_AGE_S,
  },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      // An EMPTY allowlist refuses everyone rather than admitting everyone.
      // A misconfigured deploy must fail closed: the alternative is a missing
      // environment variable quietly publishing the account.
      if (allowlist.length === 0) return false;
      return allowlist.includes(email);
    },
    async jwt({ token, trigger }) {
      if (trigger === "signIn") {
        // A new id on every sign-in. The PIN lock is bound to it, so signing
        // out and back in never inherits a lock that was still fresh.
        token.sid = crypto.randomUUID();
        token.loginAt = Date.now();
      }
      // Auth.js slides the cookie's expiry forward on use; this does not
      // slide. A token from before this field existed has no sign-in time to
      // count from and is ended the same way — one extra Google sign-in.
      if (!token.sid || !token.loginAt || Date.now() - token.loginAt > SESSION_MAX_AGE_S * 1000) {
        return null;
      }
      return token;
    },
    async session({ session, token }) {
      session.sid = token.sid ?? "";
      return session;
    },
  },
});
