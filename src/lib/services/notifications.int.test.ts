import { expect, test } from "vitest";
import { addDays } from "date-fns";
import { db } from "@/lib/db";
import { getNotificationsForUser } from "./notifications";
import { createUserWithCard, invoiceHeaderData, type Scenario } from "../../../test/fixtures";

const now = new Date(2026, 9, 15, 12, 0);

function expense(s: Scenario, descricao: string, data_vencimento: Date, extra: { status?: "PAGO" | "PENDENTE"; is_provisioned?: boolean } = {}) {
    return db.transaction.create({
        data: {
            descricao,
            valor: 100,
            data_vencimento,
            status: extra.status ?? "PENDENTE",
            data_pagamento: extra.status === "PAGO" ? now : null,
            tipo: "SAIDA",
            is_provisioned: extra.is_provisioned ?? false,
            userId: s.user.id,
            categoria_id: s.category.id,
            tipo_pagamento_id: s.paymentMethod.id,
            institution_id: s.institution.id,
        },
    });
}

test("classifica pendências em atrasada, vencendo, fatura a importar e prevista, nessa ordem", async () => {
    const s = await createUserWithCard();
    await expense(s, "Conta de luz", addDays(now, 2));
    await expense(s, "Internet", addDays(now, -1));
    await expense(s, "Água", addDays(now, -2), { status: "PAGO" });
    await expense(s, "Mercado (estimativa)", now, { is_provisioned: true });
    await expense(s, "Viagem (estimativa)", addDays(now, 40), { is_provisioned: true }); // mês que vem: ainda não
    await db.transaction.create({
        data: invoiceHeaderData(s, { invoiceMonth: 10, invoiceYear: 2026, dueDate: addDays(now, 5), provisioned: true, valor: 300 }),
    });

    const notifications = await getNotificationsForUser(s.user.id, now);

    expect(notifications.map(n => [n.type, n.title])).toEqual([
        ["overdue", "Internet"],
        ["due_soon", "Conta de luz"],
        ["invoice_pending_import", "Cartão Teste"],
        ["estimate_pending", "Mercado (estimativa)"],
    ]);
});

test("não mostra pendências de outro usuário", async () => {
    const mine = await createUserWithCard();
    const other = await createUserWithCard();
    await expense(other, "Do outro", addDays(now, -1));

    expect(await getNotificationsForUser(mine.user.id, now)).toEqual([]);
});
