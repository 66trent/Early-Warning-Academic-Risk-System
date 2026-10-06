import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * BỘ KIỂM THỬ A11Y & TUÂN THỦ PHÁP LÝ (PHASE 7 HARDENING)
 * Kiểm chứng trang /legal/privacy-policy chứa đầy đủ 7 mục bắt buộc
 * theo Luật 91/2025/QH15 và NĐ 356/2025/NĐ-CP, cùng các tiêu chuẩn a11y.
 */
describe("Phase 7 Hardening: Accessibility (a11y) & Legal Compliance Verification", () => {
  const privacyPolicyPath = path.join(
    process.cwd(),
    "src",
    "app",
    "legal",
    "privacy-policy",
    "page.tsx"
  );

  it("Tệp tin trang chính sách bảo vệ dữ liệu cá nhân tồn tại", () => {
    expect(fs.existsSync(privacyPolicyPath)).toBe(true);
  });

  const privacyPolicyContent = fs.readFileSync(privacyPolicyPath, "utf-8");

  describe("1. Tuân thủ 7 Mục Bắt buộc theo 04-legal-compliance.md", () => {
    it("Mục 1: Có thông tin Bên kiểm soát dữ liệu & DPO", () => {
      expect(privacyPolicyContent).toContain("1. Bên Kiểm Soát và Xử Lý Dữ Liệu Cá Nhân");
      expect(privacyPolicyContent).toContain("Trường Đại học Kỹ thuật - Công nghệ Cần Thơ");
      expect(privacyPolicyContent).toContain("dpo@ctuet.edu.vn");
    });

    it("Mục 2: Phân loại dữ liệu cơ bản vs dữ liệu nhạy cảm (confidentialityLevel = SENSITIVE)", () => {
      expect(privacyPolicyContent).toContain("2. Phân Loại Dữ Liệu Được Xử Lý");
      expect(privacyPolicyContent).toContain("Dữ liệu cá nhân cơ bản");
      expect(privacyPolicyContent).toContain("Dữ liệu cá nhân nhạy cảm");
      expect(privacyPolicyContent).toContain("confidentialityLevel = SENSITIVE");
    });

    it("Mục 3: Mục đích xử lý, cam kết không dùng cho thương mại & tính tham khảo (isReferenceOnly = true)", () => {
      expect(privacyPolicyContent).toContain("3. Mục Đích Xử Lý & Ranh Giới Nghiệp Vụ Bất Biến");
      expect(privacyPolicyContent).toContain("isReferenceOnly = true");
      expect(privacyPolicyContent).toContain("officialAcademicStatus");
    });

    it("Mục 4: Căn cứ pháp lý theo Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP", () => {
      expect(privacyPolicyContent).toContain("4. Căn Cứ Pháp Lý Xử Lý Dữ Liệu");
      expect(privacyPolicyContent).toContain("91/2025/QH15");
      expect(privacyPolicyContent).toContain("356/2025/NĐ-CP");
    });

    it("Mục 5: Thời hạn lưu trữ dữ liệu (tối thiểu 5 năm, audit log append-only)", () => {
      expect(privacyPolicyContent).toContain("5. Thời Hạn Lưu Trữ Dữ Liệu");
      expect(privacyPolicyContent).toContain("05 năm");
      expect(privacyPolicyContent).toContain("Audit Log");
    });

    it("Mục 6: Quyền của sinh viên & cơ chế ẩn danh hóa thay vì xóa cứng", () => {
      expect(privacyPolicyContent).toContain("6. Quyền và Nghĩa Vụ của Chủ Thể Dữ Liệu");
      expect(privacyPolicyContent).toContain("/student/alerts");
      expect(privacyPolicyContent).toContain("ẩn danh hóa");
    });

    it("Mục 7: Biện pháp bảo mật & kỹ thuật (TLS, RBAC assertScope, Audit Log)", () => {
      expect(privacyPolicyContent).toContain("7. Biện Pháp Kỹ Thuật và An Toàn Dữ Liệu Áp Dụng");
      expect(privacyPolicyContent).toContain("TLS");
      expect(privacyPolicyContent).toContain("assertScope()");
    });
  });

  describe("2. Tiêu chuẩn Accessibility (a11y WCAG 2.1)", () => {
    it("Đảm bảo các nút bấm và liên kết có tap target tối thiểu 44px (min-h-[44px])", () => {
      expect(privacyPolicyContent).toContain("min-h-[44px]");
    });

    it("Đảm bảo có aria-label cho các thành phần điều hướng", () => {
      expect(privacyPolicyContent).toContain("aria-label=");
    });

    it("Đảm bảo phân cấp thẻ tiêu đề ngữ nghĩa (h1, h2, h3)", () => {
      expect(privacyPolicyContent).toContain("<h1");
      expect(privacyPolicyContent).toContain("<h2");
      expect(privacyPolicyContent).toContain("<h3");
      expect(privacyPolicyContent).toContain("<header");
      expect(privacyPolicyContent).toContain("<main");
      expect(privacyPolicyContent).toContain("<article");
      expect(privacyPolicyContent).toContain("<section");
    });
  });
});
