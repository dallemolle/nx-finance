import { describe, expect, test, vi } from "vitest";

// Sem sessão: getServerSession devolve null, como numa chamada anônima.
vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));

const { getCategories, getPaymentMethods, getFinancialInstitutions } = await import("./reports");
const { getCreditCards, getInvoiceTimelineDetail, deleteProvisionedInvoiceItems } = await import("./credit-card-provision-actions");
const { getNotifications } = await import("./notifications");
const { deleteImportedInvoice } = await import("./credit-card-actions");

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
    ])("%s", async (_, call) => {
        await expect(call()).rejects.toThrow("Não autorizado");
    });
});
