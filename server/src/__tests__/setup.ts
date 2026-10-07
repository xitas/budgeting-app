import { vi } from "vitest";

// No test sends real mail: every test file sees a mocked sendMail, and reads
// codes from its calls (see helpers.ts).
vi.mock("../utils/mailer", () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));
