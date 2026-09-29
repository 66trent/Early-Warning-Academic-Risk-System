import { headers } from "next/headers";
import { auth } from "./auth";

/**
 * Lấy phiên đăng nhập hiện tại từ request headers.
 * Dùng trong Server Components và Server Actions.
 */
export async function getSession() {
  const requestHeaders = await headers();
  return await auth.api.getSession({
    headers: requestHeaders,
  });
}
