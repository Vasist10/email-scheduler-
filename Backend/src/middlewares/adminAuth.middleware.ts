import basicAuth from "express-basic-auth";
import { env } from "../config/env";

/**
 * HTTP Basic Auth guard for admin routes.
 *
 * Credentials are read from environment variables:
 *   ADMIN_USER     – the username  (default: "admin")
 *   ADMIN_PASSWORD – the password  (required in production; default: "admin" for local dev)
 *
 * On failure the middleware responds with 401 and a
 * WWW-Authenticate header so the browser shows a login dialog.
 */
export const adminAuth = basicAuth({
  users: { [env.ADMIN_USER]: env.ADMIN_PASSWORD },
  challenge: true,           // sends WWW-Authenticate → triggers browser login prompt
  realm: "BullMQ Dashboard", // shown in the browser dialog title
});
