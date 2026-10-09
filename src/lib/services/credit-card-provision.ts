// Regras de negócio de provisionamento que recebem o userId explicitamente.
// NÃO é "use server": nada aqui pode ser chamado direto pelo navegador. Os
// Server Actions em credit-card-provision-actions.ts resolvem o userId pela
// sessão e delegam pra cá — o que também permite testar estas funções.
import { db } from "@/lib/db";
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
    findProvisionedHeader,
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

// Chamada de dentro de importCreditCardInvoice (credit-card-actions.ts) quando
// a fatura real importada informa um credit_card_id. Só concilia parcelas
// (installment_group_id preenchido) — geradas pelo próprio sistema, então o
// casamento é exato. Estimativas avulsas (installment_group_id null) não são
// tocadas: ficam pendentes até o usuário limpar manualmente.
export async function reconcileProvisionedInstallments(
    tx: Tx,
    args: { userId: string; creditCardId: string; invoiceMonth: number; invoiceYear: number; newHeaderId: string }
): Promise<{ carriedCount: number; carriedTotal: number }> {
    const provisioned = await findProvisionedHeader(tx, {
        userId: args.userId,
        creditCardId: args.creditCardId,
        invoiceMonth: args.invoiceMonth,
        invoiceYear: args.invoiceYear,
    });
    if (!provisioned) return { carriedCount: 0, carriedTotal: 0 };

    const toCarry = provisioned.invoiceItems.filter(i => i.installment_group_id !== null);
    if (toCarry.length === 0) return { carriedCount: 0, carriedTotal: 0 };

    const carriedTotal = toCarry.reduce((sum, i) => sum + Number(i.valor), 0);

    await tx.creditCardInvoiceItem.updateMany({
        where: { id: { in: toCarry.map(i => i.id) } },
        data: { transactionId: args.newHeaderId, is_provisioned: false },
    });
    await tx.transaction.update({
        where: { id: args.newHeaderId },
        data: { valor: { increment: carriedTotal } },
    });

    const remaining = await tx.creditCardInvoiceItem.count({ where: { transactionId: provisioned.id } });
    if (remaining === 0) {
        await tx.transaction.delete({ where: { id: provisioned.id } });
    } else {
        const sum = await tx.creditCardInvoiceItem.aggregate({
            where: { transactionId: provisioned.id },
            _sum: { valor: true },
        });
        await tx.transaction.update({
            where: { id: provisioned.id },
            data: { valor: sum._sum.valor ?? 0 },
        });
    }

    return { carriedCount: toCarry.length, carriedTotal };
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
