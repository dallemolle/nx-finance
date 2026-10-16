import { describe, expect, test } from "vitest";
import { paymentDateForStatus } from "./transactions";

describe("paymentDateForStatus (BL-038)", () => {
    const now = new Date("2026-10-16T12:00:00Z");
    const before = new Date("2026-10-01T12:00:00Z");

    test("fora de Pago não há data de pagamento", () => {
        expect(paymentDateForStatus("PENDENTE", before, now)).toBeNull();
        expect(paymentDateForStatus("ATRASADO", before, now)).toBeNull();
    });

    test("Pago mantém a data que já tinha, ou usa agora", () => {
        expect(paymentDateForStatus("PAGO", before, now)).toBe(before);
        expect(paymentDateForStatus("PAGO", null, now)).toBe(now);
    });
});
