import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Google OAuth, restricted to an explicit allowlist, followed by a PIN.
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
    // Eight hours. Long enough for a working day, short enough that a
    // forgotten tab stops being a live window into the account overnight.
    maxAge: 8 * 60 * 60,
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
    async jwt({ token, trigger, session }) {
      // The PIN is verified by its own route, which updates the session. The
      // flag lives in the JWT rather than in a cookie of its own so that
      // signing out clears both factors together.
      if (trigger === "update" && session?.pinVerified === true) {
        token.pinVerified = true;
        token.pinVerifiedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      session.pinVerified = token.pinVerified === true;
      return session;
    },
  },
});
