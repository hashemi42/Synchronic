import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Redirects "/" (and any path without a locale) to /en or /fa.
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
