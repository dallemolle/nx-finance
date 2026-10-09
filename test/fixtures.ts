import { db } from "@/lib/db";

// Cenário base usado pelos testes de integração: um usuário com instituição,
// cartão (fecha 25 / vence 5 por padrão), categoria de saída e meio de pagamento.
export async function createUserWithCard(opts: { closingDay?: number; dueDay?: number } = {}) {
    const user = await db.user.create({ data: { email: `teste-${crypto.randomUUID()}@example.com`, password: "x" } });
    const institution = await db.financialInstitution.create({ data: { nome: "Banco Teste", userId: user.id } });
    const card = await db.creditCard.create({
        data: {
            nome: "Cartão Teste",
            closingDay: opts.closingDay ?? 25,
            dueDay: opts.dueDay ?? 5,
            institution_id: institution.id,
            userId: user.id,
        },
    });
    const category = await db.category.create({
        data: { nome: "Compras", cor: "#6366f1", icone: "ShoppingCart", tipo: "SAIDA", userId: user.id },
    });
    const paymentMethod = await db.paymentMethod.create({ data: { nome: "Cartão de crédito", userId: user.id } });
    return { user, institution, card, category, paymentMethod };
}

export type Scenario = Awaited<ReturnType<typeof createUserWithCard>>;

// Header de fatura (Transaction com is_invoice_header) pro cartão do cenário.
export function invoiceHeaderData(s: Scenario, args: {
    invoiceMonth: number;
    invoiceYear: number;
    dueDate: Date;
    provisioned: boolean;
    valor?: number;
}) {
    return {
        descricao: `Fatura ${args.invoiceMonth}/${args.invoiceYear}`,
        valor: args.valor ?? 0,
        data_vencimento: args.dueDate,
        status: "PENDENTE" as const,
        tipo: "SAIDA" as const,
        is_invoice_header: true,
        is_provisioned: args.provisioned,
        userId: s.user.id,
        credit_card_id: s.card.id,
        invoice_month: args.invoiceMonth,
        invoice_year: args.invoiceYear,
        categoria_id: s.category.id,
        tipo_pagamento_id: s.paymentMethod.id,
        institution_id: s.institution.id,
    };
}
