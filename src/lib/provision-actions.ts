"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addMonths } from "date-fns";
import { Decimal } from "decimal.js";

async function getUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Não autorizado");
  return session.user.id;
}

export async function provisionRecurringTransactions(data: {
  descricao: string;
  valor: number;
  categoria_id: string;
  tipo_pagamento_id: string;
  institution_id: string;
  startMonth: number;
  startYear: number;
  totalMonths: number;
}) {
  try {
    const userId = await getUserId();
    const groupId = crypto.randomUUID();

    const startDate = new Date(data.startYear, data.startMonth - 1, 1);
    const provisions = Array.from({ length: data.totalMonths }).map((_, i) => {
      const dueDate = addMonths(startDate, i);
      return db.transaction.create({
        data: {
          descricao: `${data.descricao.trim()} (${String(i + 1).padStart(2, "0")}/${String(data.totalMonths).padStart(2, "0")})`,
          valor: new Decimal(data.valor).toNumber(),
          data_vencimento: dueDate,
          status: "PENDENTE",
          tipo: "SAIDA",
          is_provisioned: true,
          is_installment: true,
          current_installment: i + 1,
          total_installments: data.totalMonths,
          unique_installment_group: groupId,
          userId,
          categoria_id: data.categoria_id,
          tipo_pagamento_id: data.tipo_pagamento_id,
          institution_id: data.institution_id,
        },
      });
    });

    const created = await db.$transaction(provisions);

    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return {
      success: true,
      count: created.length,
      groupId,
    };
  } catch (error: any) {
    console.error("Error provisioning recurring transactions:", error);
    throw new Error(error.message || "Erro ao criar provisões recorrentes");
  }
}

export async function reconcileProvisionedTransaction(
  provisionId: string,
  updateData: {
    valor?: number;
    data_pagamento?: Date | null;
    status?: "PENDENTE" | "PAGO";
    categoria_id?: string;
    descricao?: string;
  }
) {
  try {
    const userId = await getUserId();

    const existing = await db.transaction.findUnique({
      where: { id: provisionId, userId },
    });
    if (!existing) throw new Error("Provisão não encontrada");
    if (!existing.is_provisioned) throw new Error("Registro já foi reconciliado");

    const transaction = await db.transaction.update({
      where: { id: provisionId },
      data: {
        ...updateData,
        is_provisioned: false,
        ...(updateData.status === "PAGO"
          ? { data_pagamento: updateData.data_pagamento || new Date() }
          : {}),
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return {
      success: true,
      data: { ...transaction, valor: Number(transaction.valor) },
    };
  } catch (error: any) {
    console.error("Error reconciling provisioned transaction:", error);
    throw new Error(error.message || "Erro ao reconciliar provisão");
  }
}

export async function provisionCreditCardInstallments(data: {
  descricao: string;
  valor: number;
  categoria_id: string;
  institution_id: string;
  data_compra: Date;
  totalInstallments: number;
  currentInstallment: number;
  dueDate: Date;
}) {
  try {
    const userId = await getUserId();
    const groupId = crypto.randomUUID();
    const totalValor = new Decimal(data.valor);
    const installmentValue = totalValor
      .dividedBy(data.totalInstallments)
      .toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const lastInstallmentValue = totalValor.minus(
      installmentValue.times(data.totalInstallments - 1)
    );

    const items = Array.from({ length: data.totalInstallments }).map((_, i) => {
      const currentVal =
        i === data.totalInstallments - 1 ? lastInstallmentValue : installmentValue;
      const installmentNumber = i + 1;
      const isFirst = installmentNumber === data.currentInstallment;
      const dueDate = addMonths(data.dueDate, i);

      return db.creditCardInvoiceItem.create({
        data: {
          descricao: `${data.descricao.trim()} (${String(installmentNumber).padStart(2, "0")}/${String(data.totalInstallments).padStart(2, "0")})`,
          valor: currentVal.toNumber(),
          data_compra: data.data_compra,
          data_vencimento_original: dueDate,
          is_provisioned: !isFirst,
          is_installment: true,
          current_installment: installmentNumber,
          total_installments: data.totalInstallments,
          unique_installment_group: groupId,
          institution_id: data.institution_id,
          categoria_id: data.categoria_id,
        },
      });
    });

    const created = await db.$transaction(items);

    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return {
      success: true,
      count: created.length,
      groupId,
      firstItemId: created[0].id,
    };
  } catch (error: any) {
    console.error("Error provisioning credit card installments:", error);
    throw new Error(error.message || "Erro ao provisionar parcelas de cartão");
  }
}

export async function reconcileCreditCardItem(
  provisionItemId: string,
  invoiceTransactionId: string
) {
  try {
    const userId = await getUserId();

    const item = await db.creditCardInvoiceItem.findUnique({
      where: { id: provisionItemId },
      include: {
        transaction: { select: { userId: true } },
      },
    });

    if (!item) throw new Error("Item provisionado não encontrado");
    if (item.transaction && item.transaction.userId !== userId) {
      throw new Error("Não autorizado");
    }
    if (!item.is_provisioned) throw new Error("Item já foi reconciliado");

    // Validate the target invoice exists and belongs to user
    const invoice = await db.transaction.findUnique({
      where: { id: invoiceTransactionId, userId },
    });
    if (!invoice) throw new Error("Fatura de destino não encontrada");
    if (!invoice.is_invoice_header) {
      throw new Error("A transação de destino não é uma fatura de cartão");
    }

    const updated = await db.creditCardInvoiceItem.update({
      where: { id: provisionItemId },
      data: {
        transactionId: invoiceTransactionId,
        is_provisioned: false,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return {
      success: true,
      data: { ...updated, valor: Number(updated.valor) },
    };
  } catch (error: any) {
    console.error("Error reconciling credit card item:", error);
    throw new Error(error.message || "Erro ao reconciliar item de fatura");
  }
}

export async function getProvisionedItems(
  institutionId?: string,
  type?: "transaction" | "invoice_item"
) {
  try {
    const userId = await getUserId();

    const results: {
      transactions: any[];
      invoiceItems: any[];
    } = { transactions: [], invoiceItems: [] };

    if (!type || type === "transaction") {
      const transactionWhere: any = {
        userId,
        is_provisioned: true,
      };
      if (institutionId) {
        transactionWhere.institution_id = institutionId;
      }

      results.transactions = await db.transaction.findMany({
        where: transactionWhere,
        include: { category: true, institution: true },
        orderBy: { data_vencimento: "asc" },
      });
    }

    if (!type || type === "invoice_item") {
      const baseWhere: any = {
        is_provisioned: true,
      };
      if (institutionId) {
        baseWhere.institution_id = institutionId;
      }

      results.invoiceItems = await db.creditCardInvoiceItem.findMany({
        where: baseWhere,
        include: {
          category: true,
          institution: true,
          ...(type === "invoice_item"
            ? {
                transaction: {
                  select: { userId: true },
                },
              }
            : {}),
        },
        orderBy: { data_compra: "asc" },
      });

      // Filter by userId through the transaction relation
      if (type === "invoice_item") {
        results.invoiceItems = results.invoiceItems.filter(
          (item: any) => item.transaction?.userId === userId
        );
      }
    }

    return {
      transactions: results.transactions.map((t: any) => ({
        ...t,
        valor: Number(t.valor),
      })),
      invoiceItems: results.invoiceItems.map((item: any) => ({
        ...item,
        valor: Number(item.valor),
      })),
    };
  } catch (error: any) {
    console.error("Error fetching provisioned items:", error);
    throw new Error("Erro ao buscar itens provisionados");
  }
}

export async function batchReconcile(
  decisions: Array<{
    provisionId: string;
    type: "transaction" | "invoice_item";
    targetInvoiceId?: string;
    updateData?: {
      valor?: number;
      data_pagamento?: Date | null;
      status?: "PENDENTE" | "PAGO";
      categoria_id?: string;
      descricao?: string;
    };
  }>
) {
  try {
    const userId = await getUserId();

    const operations = decisions.map((decision) => {
      if (decision.type === "transaction") {
        return db.transaction.update({
          where: { id: decision.provisionId, userId, is_provisioned: true },
          data: {
            ...decision.updateData,
            is_provisioned: false,
            ...(decision.updateData?.status === "PAGO"
              ? { data_pagamento: decision.updateData.data_pagamento || new Date() }
              : {}),
          },
        });
      } else {
        if (!decision.targetInvoiceId) {
          throw new Error("targetInvoiceId é obrigatório para reconciliação de itens de fatura");
        }
        return db.creditCardInvoiceItem.update({
          where: { id: decision.provisionId },
          data: {
            transactionId: decision.targetInvoiceId,
            is_provisioned: false,
          },
        });
      }
    });

    const results = await db.$transaction(operations);

    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return {
      success: true,
      count: results.length,
    };
  } catch (error: any) {
    console.error("Error in batch reconciliation:", error);
    throw new Error(error.message || "Erro na conciliação em lote");
  }
}
