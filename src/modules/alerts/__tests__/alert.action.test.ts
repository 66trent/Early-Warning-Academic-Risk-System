import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  acknowledgeAlertAction,
  dismissAlertAction,
  recordInterventionAction,
  getStudentStudyStatusAction,
} from "../actions/alert.action";
import * as sessionModule from "@/lib/session";
import * as lifecycleService from "../services/alert-lifecycle.service";
import * as interventionService from "../services/intervention.service";
import * as queryService from "../services/alert-query.service";

vi.mock("@/lib/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("../services/alert-lifecycle.service", () => ({
  acknowledgeAlert: vi.fn(),
  dismissAlert: vi.fn(),
}));

vi.mock("../services/intervention.service", () => ({
  recordIntervention: vi.fn(),
}));

vi.mock("../services/alert-query.service", () => ({
  getAlertDetails: vi.fn(),
  getStudentStudyStatus: vi.fn(),
}));

vi.mock("@/lib/authz", () => ({
  assertScope: vi.fn().mockImplementation((user, opts) => {
    if (user?.role === "STUDENT" && opts?.studentId && opts.studentId !== user.id) {
      throw new Error("Sinh viên chỉ được phép truy vấn dữ liệu của chính mình");
    }
    return Promise.resolve();
  }),
}));

type MockSessionReturn = Awaited<ReturnType<typeof sessionModule.getSession>>;
type MockAlertDetails = Awaited<ReturnType<typeof queryService.getAlertDetails>>;
type MockAcknowledgeReturn = Awaited<ReturnType<typeof lifecycleService.acknowledgeAlert>>;
type MockDismissReturn = Awaited<ReturnType<typeof lifecycleService.dismissAlert>>;
type MockInterventionReturn = Awaited<ReturnType<typeof interventionService.recordIntervention>>;
type MockStudyStatusReturn = Awaited<ReturnType<typeof queryService.getStudentStudyStatus>>;

describe("Phase 4 — Alerts Server Actions (Skill scaffold-server-action & RBAC)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdvisorSession = {
    user: {
      id: "GV001",
      userId: "GV001",
      role: "ADVISOR",
      fullName: "ThS. Nguyễn Văn A",
      email: "nguyenvana@ctuet.edu.vn",
    },
    session: { id: "sess-1" },
  };

  const validAlertId = "11111111-1111-4111-8111-111111111111";

  describe("1. acknowledgeAlertAction", () => {
    it("Xác nhận cảnh báo thành công khi CVHT đăng nhập hợp lệ", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(
        mockAdvisorSession as unknown as MockSessionReturn
      );
      vi.mocked(queryService.getAlertDetails).mockResolvedValueOnce({
        alertId: validAlertId,
        studentId: "B210001",
        student: { departmentId: "CNTT" },
      } as unknown as MockAlertDetails);
      vi.mocked(lifecycleService.acknowledgeAlert).mockResolvedValueOnce({
        alertId: validAlertId,
        status: "ACKNOWLEDGED",
      } as unknown as MockAcknowledgeReturn);

      const res = await acknowledgeAlertAction({ alertId: validAlertId });

      expect(res.success).toBe(true);
      expect(lifecycleService.acknowledgeAlert).toHaveBeenCalledWith(
        validAlertId,
        expect.objectContaining({ userId: "GV001" })
      );
    });

    it("Trả về lỗi khi chưa đăng nhập", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(null);

      const res = await acknowledgeAlertAction({ alertId: validAlertId });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Yêu cầu đăng nhập/);
    });
  });

  describe("2. dismissAlertAction", () => {
    it("Bác bỏ cảnh báo thành công khi có lý do hợp lệ", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(
        mockAdvisorSession as unknown as MockSessionReturn
      );
      vi.mocked(queryService.getAlertDetails).mockResolvedValueOnce({
        alertId: validAlertId,
        studentId: "B210001",
        student: { departmentId: "CNTT" },
      } as unknown as MockAlertDetails);
      vi.mocked(lifecycleService.dismissAlert).mockResolvedValueOnce({
        alertId: validAlertId,
        status: "DISMISSED",
      } as unknown as MockDismissReturn);

      const res = await dismissAlertAction({
        alertId: validAlertId,
        reason: "Sinh viên đã xin phép nghỉ học có xác nhận của phụ huynh",
      });

      expect(res.success).toBe(true);
      expect(lifecycleService.dismissAlert).toHaveBeenCalled();
    });

    it("Từ chối nếu lý do bác bỏ quá ngắn hoặc để trống", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(
        mockAdvisorSession as unknown as MockSessionReturn
      );

      const res = await dismissAlertAction({
        alertId: validAlertId,
        reason: "abc", // Dưới 5 ký tự
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Lý do bác bỏ cảnh báo bắt buộc tối thiểu 5 ký tự/);
    });
  });

  describe("3. recordInterventionAction", () => {
    it("Ghi nhận can thiệp thành công và liên kết với Alert", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce(
        mockAdvisorSession as unknown as MockSessionReturn
      );
      vi.mocked(queryService.getAlertDetails).mockResolvedValueOnce({
        alertId: validAlertId,
        studentId: "B210001",
        student: { departmentId: "CNTT" },
      } as unknown as MockAlertDetails);
      vi.mocked(interventionService.recordIntervention).mockResolvedValueOnce({
        interventionId: "int-101",
        alertId: validAlertId,
        type: "PHONE_CALL",
        content: "Đã gọi điện cho sinh viên",
      } as unknown as MockInterventionReturn);

      const res = await recordInterventionAction({
        alertId: validAlertId,
        type: "PHONE_CALL",
        content: "Đã gọi điện cho sinh viên nhắc nhở chuyên cần",
      });

      expect(res.success).toBe(true);
      expect(interventionService.recordIntervention).toHaveBeenCalled();
    });
  });

  describe("4. getStudentStudyStatusAction (Giao diện Sinh viên)", () => {
    it("Sinh viên xem tình hình học tập tích cực của chính mình thành công", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "B210001", role: "STUDENT", fullName: "Nguyễn Văn Sinh Viên" },
        session: { id: "s-stu" },
      } as unknown as MockSessionReturn);

      vi.mocked(queryService.getStudentStudyStatus).mockResolvedValueOnce({
        student: { studentId: "B210001", fullName: "Nguyễn Văn Sinh Viên" },
        supportStatus: {
          level: "STABLE",
          badgeText: "Học tập ổn định",
          summaryMessage: "Tiến độ học tập của bạn đang diễn ra thuận lợi.",
        },
        advisor: { fullName: "ThS. Nguyễn Văn A", email: "nguyenvana@ctuet.edu.vn" },
        suggestions: [],
      } as unknown as MockStudyStatusReturn);

      const res = await getStudentStudyStatusAction({ studentId: "B210001" });

      expect(res.success).toBe(true);
      const data = res.data as { supportStatus?: { badgeText?: string }; riskScoreValue?: unknown };
      expect(data?.supportStatus?.badgeText).toBe("Học tập ổn định");
      // Đảm bảo không chứa thuộc tính riskScoreValue thô
      expect(data?.riskScoreValue).toBeUndefined();
    });

    it("Chặn sinh viên A xem tình hình học tập của sinh viên B", async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValueOnce({
        user: { id: "B210001", role: "STUDENT" },
        session: { id: "s-stu" },
      } as unknown as MockSessionReturn);

      const res = await getStudentStudyStatusAction({ studentId: "B210999" });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Sinh viên chỉ được phép truy vấn dữ liệu của chính mình/);
    });
  });
});
