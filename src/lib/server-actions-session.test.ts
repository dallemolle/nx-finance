import { describe, expect, test, vi } from "vitest";

// Sem sessão: getServerSession devolve null, como numa chamada anônima.
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));

const { getCategories, getPaymentMethods, getFinancialInstitutions } = await import("./reports");
const { getCreditCards, getInvoiceTimelineDetail, deleteProvisionedInvoiceItems } = await import("./credit-card-provision-actions");
const { getNotifications } = await import("./notifications");
const { deleteImportedInvoice } = await import("./credit-card-actions");
const { generateTwoFactorSetup, enableTwoFactor, regenerateRecoveryCodes, disableTwoFactor } = await import("./two-factor-actions");
const { changePassword } = await import("./account-actions");

// Server Actions chamados de Client Components: viram endpoints públicos.
describe("Server Actions expostos ao navegador recusam chamada sem sessão", () => {
    test.each([
        ["getCategories", () => getCategories()],
        ["getPaymentMethods", () => getPaymentMethods()],
        ["getFinancialInstitutions", () => getFinancialInstitutions()],
        ["getCreditCards", () => getCreditCards()],
        ["getInvoiceTimelineDetail", () => getInvoiceTimelineDetail()],
        ["getNotifications", () => getNotifications()],
        ["deleteProvisionedInvoiceItems", () => deleteProvisionedInvoiceItems(["qualquer-id"])],
        ["deleteImportedInvoice", () => deleteImportedInvoice("qualquer-id")],
        ["generateTwoFactorSetup", () => generateTwoFactorSetup()],
        ["enableTwoFactor", () => enableTwoFactor({ secret: "S".repeat(32), code: "123456", password: "x" })],
        ["regenerateRecoveryCodes", () => regenerateRecoveryCodes({ code: "123456", password: "x" })],
        ["disableTwoFactor", () => disableTwoFactor({ code: "123456", password: "x" })],
        ["changePassword", () => changePassword({ currentPassword: "x", newPassword: "nova-senha-123", confirmPassword: "nova-senha-123" })],
    ])("%s", async (_, call) => {
        await expect(call()).rejects.toThrow("Não autorizado");
    });
});
