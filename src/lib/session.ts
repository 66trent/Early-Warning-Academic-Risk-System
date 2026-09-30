import { headers } from "next/headers";
import { auth } from "./auth";
import { prisma } from "./prisma";

/**
 * Lấy phiên đăng nhập hiện tại từ request headers.
 * Dùng trong Server Components và Server Actions.
 */
export async function getSession() {
  const requestHeaders = await headers();

  try {
    const betterAuthSession = await auth.api.getSession({
      headers: requestHeaders,
    });

    if (betterAuthSession?.user) {
      return betterAuthSession;
    }
  } catch {
    // Fall back to direct DB session verification
  }

  // Fallback: Kiểm tra session_token cookie trực tiếp trong CSDL
  const cookieHeader = requestHeaders.get("cookie") || "";
  const match = cookieHeader.match(/better-auth\.session_token=([^;]+)/);
  if (!match) return null;

  const rawToken = decodeURIComponent(match[1]);
  const token = rawToken.split(".")[0];

  const dbSession = await prisma.session.findFirst({
    where: {
      token: { in: [rawToken, token] },
      expiresAt: { gt: new Date() },
    },
    include: {
      user: true,
    },
  });

  if (!dbSession || !dbSession.user) {
    return null;
  }

  return {
    session: {
      id: dbSession.id,
      userId: dbSession.userId,
      expiresAt: dbSession.expiresAt,
    },
    user: {
      id: dbSession.user.userId,
      userId: dbSession.user.userId,
      role: dbSession.user.role as string,
      fullName: dbSession.user.fullName,
      email: dbSession.user.email,
      scopeConfig: dbSession.user.scopeConfig,
    },
  };
}
