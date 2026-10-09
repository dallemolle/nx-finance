import { describe, expect, test } from "vitest";
import { addMonths } from "date-fns";
import { db } from "./db";
import { getInvoiceTimelineDetail } from "./credit-card-provision-actions";
import { createUserWithCard, invoiceHeaderData } from "../../test/fixtures";

describe("getInvoiceTimelineDetail", () => {
    test("agrupa itens por cartão e mês de vencimento, separando confirmado de previsto", async () => {
        const s = await createUserWithCard();
        const now = new Date();
        const next = addMonths(now, 1);
        const thisMonth = { month: now.getMonth() + 1, year: now.getFullYear() };
        const nextMonth = { month: next.getMonth() + 1, year: next.getFullYear() };
        const dueIn = (m: { month: number; year: number }) => new Date(m.year, m.month - 1, 10);

        // 2 faturas reais no mesmo cartão+mês: as duas precisam ser somadas
        for (const [descricao, valor] of [["Compra A", 100], ["Compra B", 50]] as const) {
            const header = await db.transaction.create({
                data: invoiceHeaderData(s, { invoiceMonth: thisMonth.month, invoiceYear: thisMonth.year, dueDate: dueIn(thisMonth), provisioned: false }),
            });
            await db.creditCardInvoiceItem.create({
                data: { transactionId: header.id, descricao, valor, data_compra: now, categoria_id: s.category.id },
            });
        }
        // 1 fatura prevista no mês seguinte
        const provisioned = await db.transaction.create({
            data: invoiceHeaderData(s, { invoiceMonth: nextMonth.month, invoiceYear: nextMonth.year, dueDate: dueIn(nextMonth), provisioned: true }),
        });
        await db.creditCardInvoiceItem.create({
            data: { transactionId: provisioned.id, descricao: "Estimativa C", valor: 75, data_compra: now, categoria_id: s.category.id, is_provisioned: true },
        });

        const groups = await getInvoiceTimelineDetail(s.user.id);

        expect(groups).toHaveLength(1);
        expect(groups[0].cardId).toBe(s.card.id);
        expect(groups[0].months).toHaveLength(6);

        const byKey = new Map(groups[0].months.map(m => [`${m.year}-${m.month}`, m]));
        const m0 = byKey.get(`${thisMonth.year}-${thisMonth.month}`)!;
        const m1 = byKey.get(`${nextMonth.year}-${nextMonth.month}`)!;

        expect(m0.items).toHaveLength(2);
        expect({ confirmed: m0.confirmed, provisioned: m0.provisioned, total: m0.total }).toEqual({ confirmed: 150, provisioned: 0, total: 150 });

        expect(m1.items).toHaveLength(1);
        expect(m1.items[0].is_provisioned).toBe(true);
        expect({ confirmed: m1.confirmed, provisioned: m1.provisioned }).toEqual({ confirmed: 0, provisioned: 75 });

        const empty = groups[0].months.find(m => m !== m0 && m !== m1)!;
        expect({ items: empty.items.length, total: empty.total }).toEqual({ items: 0, total: 0 });
    });

    test("não mostra faturas de outro usuário", async () => {
        const mine = await createUserWithCard();
        const other = await createUserWithCard();
        const now = new Date();
        const header = await db.transaction.create({
            data: invoiceHeaderData(other, { invoiceMonth: now.getMonth() + 1, invoiceYear: now.getFullYear(), dueDate: new Date(now.getFullYear(), now.getMonth(), 10), provisioned: false }),
        });
        await db.creditCardInvoiceItem.create({
            data: { transactionId: header.id, descricao: "Do outro", valor: 999, data_compra: now, categoria_id: other.category.id },
        });

        const groups = await getInvoiceTimelineDetail(mine.user.id);

        expect(groups.flatMap(g => g.months.flatMap(m => m.items))).toEqual([]);
    });
});
