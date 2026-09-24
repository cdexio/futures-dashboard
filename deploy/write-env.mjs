#!/usr/bin/env node
/**
 * Write `.env.local` from environment variables, without printing any value.
 *
 * The alternatives are all worse. A heredoc through ssh puts a client secret
 * one bad quote away from a file that looks right and fails at the first
 * OAuth callback with a message about redirect URIs. `sed -i` on a file
 * holding a secret has the same problem with none of the warning.
 *
 * VALUES COME FROM THE ENVIRONMENT, never from argv: arguments are visible in
 * `ps` to every user on the box, and this box is shared with other projects.
 *
 *   CDX_GOOGLE_CLIENT_ID=... CDX_AUTH_SECRET=... node deploy/write-env.mjs
 */

import { writeFileSync, chmodSync } from "node:fs";

const KEYS = [
  ["GOOGLE_CLIENT_ID", true],
  ["GOOGLE_CLIENT_SECRET", true],
  ["ALLOWED_EMAILS", true],
  ["DASHBOARD_PIN_SHA256", true],
  ["AUTH_SECRET", true],
  ["AUTH_URL", true],
  ["AUTH_TRUST_HOST", false],
  ["BOT_API_URL", false],
  // Not required: the first deploy has no owner yet, and the /device page is
  // where the owner reads the value to put here. The app fails closed without it.
  ["OWNER_DEVICE_HASH", false],
  ["DEVICES_FILE", false],
];

const lines = [];
const missing = [];

for (const [key, required] of KEYS) {
  const value = process.env[`CDX_${key}`];
  if (value === undefined || value === "") {
    if (required) missing.push(key);
    continue;
  }
  lines.push(`${key}=${value}`);
}

if (missing.length) {
  console.error(`missing: ${missing.join(", ")}`);
  process.exit(1);
}

const path = "/opt/cdexio-dashboard/.env.local";
writeFileSync(path, lines.join("\n") + "\n", { mode: 0o600 });
chmodSync(path, 0o600);

// Names and lengths only. A script that echoes a secret back puts it in the
// terminal scrollback, the ssh session log, and anything capturing either.
for (const line of lines) {
  const [key, ...rest] = line.split("=");
  console.log(`${key}: set (${rest.join("=").length} chars)`);
}
