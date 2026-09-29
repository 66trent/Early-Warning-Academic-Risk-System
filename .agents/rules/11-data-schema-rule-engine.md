# 11 — Data Schema Reference: Rule Engine & Alerts

Xem `00-project-context.md` và `08-business-rules-catalog.md` trước. File này đặc tả 7 bảng — phạm vi module `rule-engine` và `alerts`.

## Rule

| Field     | Kiểu              | Null?    | Khóa | Ghi chú                                                                                                      |
| --------- | ----------------- | -------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| ruleCode  | String(20)        | NOT NULL | PK   | VD: `HR-ATT-01` — MUST giữ nguyên định dạng này                                                              |
| ruleName  | String(100)       | NOT NULL |      |                                                                                                              |
| ruleGroup | RuleGroup (enum)  | NOT NULL |      | `ATTENDANCE`/`ACADEMIC`/`LMS`/`COMBINED`/`EXCEPTION`                                                         |
| scope     | String(30)        | NOT NULL |      | `PER_COURSE`/`PER_STUDENT`                                                                                   |
| priority  | Int               | NOT NULL |      | Thứ tự ưu tiên khi có xung đột luật                                                                          |
| cooldown  | Int               | NOT NULL |      | Số giờ/ngày trước khi cho phép tạo `Alert` mới cho cùng khóa tương quan — xem `08-business-rules-catalog.md` |
| status    | RuleStatus (enum) | NOT NULL |      | `DRAFT`/`ACTIVE`/`INACTIVE`/`ARCHIVED`                                                                       |

## RuleVersion — MUST tạo bản ghi mới khi sửa, KHÔNG ghi đè

| Field         | Kiểu              | Null?    | Khóa      | Ghi chú                                                      |
| ------------- | ----------------- | -------- | --------- | ------------------------------------------------------------ |
| id            | String (uuid)     | NOT NULL | PK        |                                                              |
| ruleCode      | String(20)        | NOT NULL | FK → Rule |                                                              |
| version       | Int               | NOT NULL |           | Tăng dần                                                     |
| condition     | Json              | NOT NULL |           | Ngưỡng/toán tử cụ thể — MUST validate bằng Zod trước khi ghi |
| severity      | Severity (enum)   | NOT NULL |           | `LOW`/`MEDIUM`/`HIGH`/`CRITICAL`                             |
| action        | Json              | NOT NULL |           | Danh sách hành động khi kích hoạt                            |
| effectiveFrom | DateTime          | NOT NULL |           |                                                              |
| effectiveTo   | DateTime          | NULL     |           | NULL = đang dùng                                             |
| status        | RuleStatus (enum) | NOT NULL |           | `DRAFT`/`ACTIVE`/`INACTIVE`/`ARCHIVED`                       |
| configuredBy  | String(20)        | NOT NULL | FK → User |                                                              |
| approvedBy    | String(20)        | NULL     | FK → User | Cấu hình chỉ có hiệu lực (`ACTIVE`) sau khi khác NULL        |

RÀNG BUỘC: UNIQUE `(ruleCode, version)`. Rule Engine CHỈ đọc `RuleVersion` có `status = ACTIVE`.

## RuleTrigger — bằng chứng, KHÔNG hiển thị trực tiếp cho người dùng

| Field         | Kiểu            | Null?    | Khóa             | Ghi chú                                                                        |
| ------------- | --------------- | -------- | ---------------- | ------------------------------------------------------------------------------ |
| id            | String (uuid)   | NOT NULL | PK               |                                                                                |
| alertId       | String (uuid)   | NOT NULL | FK → Alert       |                                                                                |
| ruleCode      | String(20)      | NOT NULL | FK → Rule        |                                                                                |
| ruleVersionId | String (uuid)   | NOT NULL | FK → RuleVersion | Bắt buộc để tái lập kết quả                                                    |
| studentId     | String(20)      | NOT NULL | FK → Student     |                                                                                |
| scopeId       | String(20)      | NOT NULL |                  | `courseSectionId` nếu `Rule.scope = PER_COURSE`; `studentId` nếu `PER_STUDENT` |
| termId        | String(10)      | NOT NULL | FK → Term        |                                                                                |
| triggeredAt   | DateTime        | NOT NULL |                  |                                                                                |
| inputSnapshot | Json            | NOT NULL |                  | Giá trị dữ liệu thực tế dẫn đến kích hoạt (phục vụ explainability)             |
| reason        | String (text)   | NOT NULL |                  | Mô tả dễ hiểu cho CVHT                                                         |
| severity      | Severity (enum) | NOT NULL |                  |                                                                                |

## RiskScoreLog

| Field                 | Kiểu                         | Null?    | Khóa             | Ghi chú                                                                    |
| --------------------- | ---------------------------- | -------- | ---------------- | -------------------------------------------------------------------------- |
| id                    | String (uuid)                | NOT NULL | PK               |                                                                            |
| studentId             | String(20)                   | NOT NULL | FK → Student     |                                                                            |
| termId                | String(10)                   | NOT NULL | FK → Term        |                                                                            |
| riskScoreValue        | Float                        | NULL     |                  | NULL nếu `dataCompletenessLevel = INSUFFICIENT`                            |
| dataCompletenessLevel | DataCompletenessLevel (enum) | NOT NULL |                  | `FULL`/`PARTIAL`/`INSUFFICIENT` — xem tầng 2 trong `00-project-context.md` |
| componentsUsed        | Json                         | NOT NULL |                  | VD: `["Attendance","GPA"]`                                                 |
| ruleVersionId         | String (uuid)                | NOT NULL | FK → RuleVersion | Phiên bản trọng số dùng để tính                                            |
| calculatedAt          | DateTime                     | NOT NULL |                  |                                                                            |

## Alert — cái CVHT thực sự thấy và xử lý

| Field             | Kiểu               | Null?                    | Khóa              | Ghi chú                                                                             |
| ----------------- | ------------------ | ------------------------ | ----------------- | ----------------------------------------------------------------------------------- |
| alertId           | String (uuid)      | NOT NULL                 | PK                |                                                                                     |
| studentId         | String(20)         | NOT NULL                 | FK → Student      |                                                                                     |
| termId            | String(10)         | NOT NULL                 | FK → Term         |                                                                                     |
| severity          | Severity (enum)    | NOT NULL                 |                   | = max() các `RuleTrigger` liên quan                                                 |
| status            | AlertStatus (enum) | NOT NULL                 |                   | `OPEN`/`ACKNOWLEDGED`/`IN_PROGRESS`/`RESOLVED`/`DISMISSED`/`INVALIDATED`/`REOPENED` |
| firstDetectedAt   | DateTime           | NOT NULL                 |                   |                                                                                     |
| lastDetectedAt    | DateTime           | NOT NULL                 |                   |                                                                                     |
| assignedAdvisorId | String(20)         | NOT NULL                 | FK → User         |                                                                                     |
| riskScoreLogId    | String (uuid)      | NULL                     | FK → RiskScoreLog | NULL nếu `Alert` chỉ phát sinh từ luật cứng                                         |
| isReferenceOnly   | Boolean            | NOT NULL, default `true` |                   | MUST luôn `true` — xem ràng buộc phạm vi hệ thống                                   |

RÀNG BUỘC chuyển trạng thái (MUST validate ở service, không chỉ ở DB):

- Chuyển sang `DISMISSED` MUST đi kèm lý do (field ghi trong `Intervention` liên quan).
- Chuyển sang `RESOLVED` SHOULD có ít nhất 1 `Intervention` liên kết.
- `INVALIDATED` dùng khi dữ liệu nguồn bị sửa khiến cảnh báo không còn đúng — MUST NOT tự xóa `Alert`.

## Intervention

| Field                | Kiểu                        | Null?    | Khóa       | Ghi chú                                                                     |
| -------------------- | --------------------------- | -------- | ---------- | --------------------------------------------------------------------------- |
| interventionId       | String (uuid)               | NOT NULL | PK         |                                                                             |
| alertId              | String (uuid)               | NOT NULL | FK → Alert |                                                                             |
| performedBy          | String(20)                  | NOT NULL | FK → User  |                                                                             |
| type                 | InterventionType (enum)     | NOT NULL |            | `EMAIL`/`PHONE_CALL`/`IN_PERSON_MEETING`/`ACADEMIC_PLAN`/`REFERRAL`/`OTHER` |
| content              | String (text)               | NOT NULL |            |                                                                             |
| performedAt          | DateTime                    | NOT NULL |            |                                                                             |
| outcome              | String (text)               | NULL     |            |                                                                             |
| nextFollowUpAt       | DateTime                    | NULL     |            |                                                                             |
| status               | String(20)                  | NOT NULL |            |                                                                             |
| confidentialityLevel | ConfidentialityLevel (enum) | NOT NULL |            | `NORMAL`/`SENSITIVE` — xem `04-legal-compliance.md` khi `SENSITIVE`         |

## Notification

| Field          | Kiểu                       | Null?    | Khóa       | Ghi chú                                         |
| -------------- | -------------------------- | -------- | ---------- | ----------------------------------------------- |
| notificationId | String (uuid)              | NOT NULL | PK         |                                                 |
| alertId        | String (uuid)              | NOT NULL | FK → Alert |                                                 |
| recipientId    | String(20)                 | NOT NULL | FK → User  |                                                 |
| channel        | NotificationChannel (enum) | NOT NULL |            | `EMAIL`/`IN_APP`/`SMS`                          |
| dedupKey       | String(100)                | NOT NULL |            | `studentId+ruleCode+severity`                   |
| status         | NotificationStatus (enum)  | NOT NULL |            | `QUEUED`/`SENT`/`FAILED`/`SUPPRESSED_DUPLICATE` |
| sentAt         | DateTime                   | NULL     |            |                                                 |
| createdAt      | DateTime                   | NOT NULL |            |                                                 |

RÀNG BUỘC: index trên `(dedupKey, createdAt)` — MUST tra bản ghi `SENT` gần nhất theo `dedupKey` trong cửa sổ debounce trước khi tạo `Notification` mới (xem `06-security.md`).

## Quan hệ tóm tắt

`Rule 1—n RuleVersion` · `RuleVersion 1—n RuleTrigger, RiskScoreLog` · `Alert 1—n RuleTrigger, Intervention, Notification` · `Alert n—1 User` (qua `assignedAdvisorId`) · `Alert n—0..1 RiskScoreLog`.
