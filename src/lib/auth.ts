import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    modelName: "User",
    fields: {
      id: "userId",
      name: "fullName",
    },
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "STUDENT",
      },
      scopeConfig: {
        type: "string",
        required: false,
      },
    },
  },
  session: {
    modelName: "Session",
    expiresIn: 60 * 60 * 8, // 8 giờ phiên thường theo 06-security.md
    updateAge: 60 * 60 * 1, // update mỗi 1 giờ
  },
  account: {
    modelName: "Account",
  },
  verification: {
    modelName: "Verification",
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  secret: process.env.BETTER_AUTH_SECRET || "ea74896835a7babc82f7cef48214736b",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
});

export type Session = typeof auth.$Infer.Session;
