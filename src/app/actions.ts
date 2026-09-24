"use server";

import { signOut } from "@/lib/auth";

/**
 * Sign out in one tap. The link to /api/auth/signout it replaces showed
 * Auth.js's own unstyled "Are you sure?" page first.
 */
export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
