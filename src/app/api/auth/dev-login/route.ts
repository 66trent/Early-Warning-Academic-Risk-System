import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

import { UserRole } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const role = (searchParams.get("role") || "TRAINING_OFFICER") as UserRole;
  const email = searchParams.get("email");
  const redirectTo = searchParams.get("redirect") || "/data-import";

  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({ where: { role } });

  if (!user) {
    return NextResponse.json(
      { error: `Không tìm thấy tài khoản với vai trò ${role}` },
      { status: 404 }
    );
  }

  // Create active session in DB
  const token = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

  await prisma.session.create({
    data: {
      id: sessionId,
      token,
      expiresAt,
      userId: user.userId,
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      userAgent: request.headers.get("user-agent") || "dev-browser",
    },
  });

  const response = NextResponse.redirect(new URL(redirectTo, request.url));

  // Set Better Auth session cookie
  response.cookies.set("better-auth.session_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return response;
}
