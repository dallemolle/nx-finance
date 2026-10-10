// Regras de negócio de provisionamento que recebem o userId explicitamente.
// NÃO é "use server": nada aqui pode ser chamado direto pelo navegador. Os
// Server Actions em credit-card-provision-actions.ts resolvem o userId pela
// sessão e delegam pra cá — o que também permite testar estas funções.
import { db } from "@/lib/db";
import { addMonths, differenceInCalendarMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Decimal } from "decimal.js";
import {
    cardInstallmentPurchaseSchema,
    confirmEstimatedExpenseSchema,
    type CardInstallmentPurchaseInput,
    type ConfirmEstimatedExpenseInput,
} from "@/lib/validations";
import {
    addInvoiceMonths,
    computeInvoiceDueDate,
    getInvoiceReferenceMonth,
    splitInstallments,
} from "@/lib/credit-card-cycle";
import {
    getOrCreateInvoiceCategory,
    getOrCreateProvisionedPaymentMethod,
} from "@/lib/credit-card-shared";
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function findOrCreateProvisionedHeader(
    tx: Tx,
    args: {
        userId: string;
        card: { id: string; nome: string; closingDay: number; dueDay: number; institution_id: string };
        invoiceMonth: number;
        invoiceYear: number;
        categoryId: string;
        paymentMethodId: string;
    }
) {
    const existing = await tx.transaction.findFirst({
        where: {
            userId: args.userId,
            credit_card_id: args.card.id,
            is_invoice_header: true,
            is_provisioned: true,
            invoice_month: args.invoiceMonth,
            invoice_year: args.invoiceYear,
        },
    });
    if (existing) return existing;

    const dueDate = computeInvoiceDueDate(args.invoiceMonth, args.invoiceYear, args.card.closingDay, args.card.dueDay);
    // O nome usa o mês/ano CALENDÁRIO do vencimento real (dueDate), não o
    // invoiceMonth/invoiceYear (mês de ciclo de fechamento — só serve pra
    // dedup/offset interno, ver 4.11/nota em getInvoiceTimeline). Se usasse
    // invoiceMonth direto, um cartão com dueDay<=closingDay teria fatura com
    // vencimento em setembro nomeada "08/2026", parecendo estar em agosto.
    return tx.transaction.create({
        data: {
            descricao: `Fatura Prevista - ${args.card.nome} - ${String(dueDate.getMonth() + 1).padStart(2, "0")}/${dueDate.getFullYear()}`,
            valor: 0,
            data_vencimento: dueDate,
            status: "PENDENTE",
            tipo: "SAIDA",
            is_invoice_header: true,
            is_provisioned: true,
            userId: args.userId,
            credit_card_id: args.card.id,
            invoice_month: args.invoiceMonth,
            invoice_year: args.invoiceYear,
            categoria_id: args.categoryId,
            tipo_pagamento_id: args.paymentMethodId,
            institution_id: args.card.institution_id,
        },
    });
}

export async function provisionCardInstallmentPurchaseForUser(userId: string, data: CardInstallmentPurchaseInput) {
    const validatedData = cardInstallmentPurchaseSchema.parse(data);

    const card = await db.creditCard.findFirst({ where: { id: validatedData.credit_card_id, userId } });
    if (!card) throw new Error("Cartão não encontrado.");

    const totalValue = new Decimal(validatedData.valor);
    const installments = splitInstallments(totalValue, validatedData.installmentsCount);
    const reference = getInvoiceReferenceMonth(validatedData.data_compra, card.closingDay);
    const installmentGroupId = crypto.randomUUID();

    await db.$transaction(async (tx) => {
        const category = await getOrCreateInvoiceCategory(tx, userId);
        const paymentMethod = await getOrCreateProvisionedPaymentMethod(tx, userId);

        // Cada parcela cai num mês distinto (addInvoiceMonths com offsets únicos), então
        // as N cadeias find-or-create/create/update podem rodar em paralelo com segurança
        // (sem risco de duas parcelas disputarem o mesmo cabeçalho) — evita estourar o
        // timeout padrão da transação interativa do Prisma em parcelamentos longos.
        await Promise.all(installments.map(async (installment, i) => {
            const { month, year } = addInvoiceMonths(reference.month, reference.year, i);
            const header = await findOrCreateProvisionedHeader(tx, {
                userId,
                card,
                invoiceMonth: month,
                invoiceYear: year,
                categoryId: category.id,
                paymentMethodId: paymentMethod.id,
            });

            const value = installment.value;
            await tx.creditCardInvoiceItem.create({
                data: {
                    transactionId: header.id,
                    descricao: `${validatedData.descricao} (${String(i + 1).padStart(2, "0")}/${String(installments.length).padStart(2, "0")})`,
                    valor: value.toNumber(),
                    data_compra: validatedData.data_compra,
                    categoria_id: validatedData.categoria_id,
                    is_provisioned: true,
                    installment_group_id: installmentGroupId,
                    installment_number: i + 1,
                    installment_total: installments.length,
                },
            });
            await tx.transaction.update({
                where: { id: header.id },
                data: { valor: { increment: value.toNumber() } },
            });
        }));
    }, { timeout: 20000 });
}

// Chamada de dentro de importCreditCardInvoice quando a fatura real importada
// informa um credit_card_id. A fatura real substitui a prevista do mesmo
// cartão e ciclo: o extrato do banco já traz tudo o que foi cobrado naquele
// mês (inclusive a parcela do mês de cada compra parcelada), então a prevista
// é apagada inteira — parcelas e estimativas — em vez de ter itens movidos pra
// real, o que duplicava a parcela (BL-026). As previstas de outros ciclos
// continuam como estão.
export async function replaceProvisionedInvoice(
    tx: Tx,
    args: { userId: string; creditCardId: string; invoiceMonth: number; invoiceYear: number }
): Promise<{ removedCount: number; removedTotal: number }> {
    const provisioned = await tx.transaction.findMany({
        where: {
            userId: args.userId,
            credit_card_id: args.creditCardId,
            is_invoice_header: true,
            is_provisioned: true,
            invoice_month: args.invoiceMonth,
            invoice_year: args.invoiceYear,
        },
        include: { invoiceItems: { select: { valor: true } } },
    });
    if (provisioned.length === 0) return { removedCount: 0, removedTotal: 0 };

    const items = provisioned.flatMap(h => h.invoiceItems);
    // Itens saem junto com o cabeçalho (onDelete: Cascade em CreditCardInvoiceItem).
    await tx.transaction.deleteMany({ where: { id: { in: provisioned.map(h => h.id) } } });

    return {
        removedCount: items.length,
        removedTotal: items.reduce((sum, i) => sum + Number(i.valor), 0),
    };
}

// Exclui um ou mais itens de faturas previstas (parcelas futuras ou
// estimativas no cartão), de um ou de vários meses. Só toca em itens previstos
// do próprio usuário — itens de fatura real e de outros usuários são ignorados.
// Cada fatura prevista afetada tem o valor recalculado, ou é removida se ficar
// vazia. Tudo numa transação: ou exclui a seleção inteira, ou nada.
export async function deleteProvisionedInvoiceItemsForUser(userId: string, itemIds: string[]): Promise<{ deletedCount: number }> {
    if (itemIds.length === 0) return { deletedCount: 0 };

    return db.$transaction(async (tx) => {
        const items = await tx.creditCardInvoiceItem.findMany({
            where: { id: { in: itemIds }, is_provisioned: true, transaction: { userId, is_provisioned: true } },
            select: { id: true, transactionId: true },
        });
        if (items.length === 0) return { deletedCount: 0 };

        await tx.creditCardInvoiceItem.deleteMany({ where: { id: { in: items.map(i => i.id) } } });

        const headerIds = [...new Set(items.map(i => i.transactionId))];
        const sums = await tx.creditCardInvoiceItem.groupBy({
            by: ["transactionId"],
            where: { transactionId: { in: headerIds } },
            _sum: { valor: true },
        });
        const sumByHeader = new Map(sums.map(s => [s.transactionId, s._sum.valor ?? 0]));

        const emptyHeaders = headerIds.filter(id => !sumByHeader.has(id));
        if (emptyHeaders.length > 0) await tx.transaction.deleteMany({ where: { id: { in: emptyHeaders } } });
        for (const [id, valor] of sumByHeader) {
            await tx.transaction.update({ where: { id }, data: { valor } });
        }

        return { deletedCount: items.length };
    });
}

// "Efetiva" uma despesa prevista GENÉRICA (sem cartão): confirma o valor real
// (pode divergir do estimado, ex: conta de luz) e tira a marca de "previsto".
// Guarda no servidor (não só na UI): só aceita is_provisioned:true e
// credit_card_id:null — a versão vinculada a cartão fica de fora de propósito,
// pra não mexer com fatura parcialmente confirmada/parcialmente projetada.
export async function confirmEstimatedExpenseForUser(userId: string, id: string, data: ConfirmEstimatedExpenseInput) {
    const validatedData = confirmEstimatedExpenseSchema.parse(data);

    const existing = await db.transaction.findFirst({
        where: { id, userId, is_provisioned: true, credit_card_id: null },
    });
    if (!existing) throw new Error("Despesa prevista não encontrada (ou não é genérica).");

    return db.transaction.update({
        where: { id },
        data: {
            valor: validatedData.valor,
            descricao: validatedData.descricao ?? existing.descricao,
            categoria_id: validatedData.categoria_id ?? existing.categoria_id,
            data_vencimento: validatedData.data_vencimento ?? existing.data_vencimento,
            is_provisioned: false,
        },
    });
}

// --- Timeline de faturas ---

export const TIMELINE_MONTHS_DEFAULT = 6;
// Teto de segurança pra janela dinâmica de /faturas (evita uma consulta
// aberta indefinidamente caso um usuário tenha um parcelamento absurdamente
// longo, ex. 48x) — ver getInvoiceTimelineDetail.
export const TIMELINE_MONTHS_MAX = 36;

// Igual a getInvoiceTimeline, mas preserva os itens individuais de cada fatura
// (em vez de só somar) — usado pela tela dedicada de análise por cartão
// (/faturas), onde o usuário precisa ver quais despesas compõem cada mês.
// Quando monthsAhead não é informado (uso normal via /faturas), a janela se
// estende automaticamente até o vencimento mais distante entre as faturas
// provisionadas do usuário — sem isso, um parcelamento de 10x+ tem parcelas
// que existem no banco mas nunca aparecem nessa tela (janela fixa de 6 meses
// só cobre o começo do parcelamento). Teto de segurança em TIMELINE_MONTHS_MAX.
export async function getInvoiceTimelineDetailForUser(userId: string, monthsAhead?: number) {
    const now = new Date();

    let effectiveMonthsAhead = monthsAhead ?? TIMELINE_MONTHS_DEFAULT;
    if (monthsAhead === undefined) {
        const furthest = await db.transaction.aggregate({
            where: { userId, is_invoice_header: true, is_provisioned: true, credit_card_id: { not: null } },
            _max: { data_vencimento: true },
        });
        if (furthest._max.data_vencimento) {
            const monthsUntilFurthest = differenceInCalendarMonths(startOfMonth(furthest._max.data_vencimento), startOfMonth(now)) + 1;
            effectiveMonthsAhead = Math.min(Math.max(effectiveMonthsAhead, monthsUntilFurthest), TIMELINE_MONTHS_MAX);
        }
    }

    const rangeStart = startOfMonth(now);
    const rangeEnd = endOfMonth(addMonths(now, effectiveMonthsAhead - 1));

    const [headers, cards] = await Promise.all([
        db.transaction.findMany({
            where: {
                userId,
                is_invoice_header: true,
                data_vencimento: { gte: rangeStart, lte: rangeEnd },
                credit_card_id: { not: null },
            },
            include: {
                invoiceItems: {
                    include: { category: true },
                    orderBy: { data_compra: "asc" },
                },
            },
        }),
        db.creditCard.findMany({ where: { userId }, orderBy: { nome: "asc" } }),
    ]);

    const monthBuckets = Array.from({ length: effectiveMonthsAhead }, (_, i) => {
        const bucketDate = addMonths(now, i);
        return {
            month: bucketDate.getMonth() + 1,
            year: bucketDate.getFullYear(),
            label: format(bucketDate, "MMM/yy", { locale: ptBR }),
        };
    });

    return cards.map(card => {
        const months = monthBuckets.map(b => {
            // filter (não find): nada impede duas faturas reais pro mesmo cartão+mês
            // em cenários incomuns (ver gap conhecido em CONTEXT.md) — soma todas.
            // Agrupa pelo mês calendário de data_vencimento, não invoice_month
            // (ciclo de fechamento — ver nota em getInvoiceTimeline).
            const matchingHeaders = headers.filter(
                h => h.credit_card_id === card.id
                    && h.data_vencimento.getMonth() + 1 === b.month
                    && h.data_vencimento.getFullYear() === b.year
            );
            const items = matchingHeaders.flatMap(h =>
                h.invoiceItems.map(item => ({
                    id: item.id,
                    descricao: item.descricao,
                    valor: Number(item.valor),
                    data_compra: item.data_compra,
                    is_provisioned: item.is_provisioned,
                    installment_number: item.installment_number,
                    installment_total: item.installment_total,
                    category: item.category ? { nome: item.category.nome, cor: item.category.cor } : null,
                }))
            );
            const confirmed = items.filter(i => !i.is_provisioned).reduce((sum, i) => sum + i.valor, 0);
            const provisioned = items.filter(i => i.is_provisioned).reduce((sum, i) => sum + i.valor, 0);
            return {
                label: b.label,
                month: b.month,
                year: b.year,
                confirmed,
                provisioned,
                total: confirmed + provisioned,
                items,
            };
        });
        return { cardId: card.id, cardNome: card.nome, cardCor: card.cor, months };
    });
}
