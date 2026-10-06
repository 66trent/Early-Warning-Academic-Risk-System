import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { listPendingRuleVersionsService } from "@/modules/admin/services/rule-approval.service";
import { RuleApprovalsClient } from "./components/rule-approvals-client";

export default async function AdminRuleApprovalsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const u = session.user as Record<string, unknown>;
  const currentActorId = (u.userId as string) || (u.id as string) || "";
  const currentRole = (u.role as string) || "";

  if (currentRole !== "ADMIN" && currentRole !== "TRAINING_OFFICER") {
    redirect("/admin");
  }

  const pendingVersions = await listPendingRuleVersionsService();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl dark:text-white">
          Phê duyệt Phiên bản Luật Nghiệp vụ (RuleVersion)
        </h1>
        <p className="text-xs text-neutral-500 sm:text-sm">
          Thẩm định các phiên bản luật mới hoặc điều chỉnh ngưỡng, kích hoạt trạng thái ACTIVE theo
          nguyên tắc Phân chia nhiệm vụ (Separation of Duties).
        </p>
      </div>

      <RuleApprovalsClient
        pendingVersions={pendingVersions}
        currentActorId={currentActorId}
        currentRole={currentRole}
      />
    </div>
  );
}
