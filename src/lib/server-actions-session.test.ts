import { describe, expect, test, vi } from "vitest";

// Sem sessão: getServerSession devolve null, como numa chamada anônima.
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));

const { getCategories, getPaymentMethods, getFinancialInstitutions } = await import("./reports");
const { getCreditCards, getInvoiceTimelineDetail } = await import("./credit-card-provision-actions");
const { getNotifications } = await import("./notifications");

// Server Actions chamados de Client Components: viram endpoints públicos.
describe("Server Actions expostos ao navegador recusam chamada sem sessão", () => {
    test.each([
        ["getCategories", () => getCategories()],
        ["getPaymentMethods", () => getPaymentMethods()],
        ["getFinancialInstitutions", () => getFinancialInstitutions()],
        ["getCreditCards", () => getCreditCards()],
        ["getInvoiceTimelineDetail", () => getInvoiceTimelineDetail()],
        ["getNotifications", () => getNotifications()],
    ])("%s", async (_, call) => {
        await expect(call()).rejects.toThrow("Não autorizado");
    });
});
