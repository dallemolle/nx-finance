import { db } from "@/lib/db";

export const PAID_DELETE_MESSAGE = "Lançamento pago não pode ser excluído. Volte o status para Pendente antes de excluir.";

// Exclui um lançamento avulso, parcela ou despesa prevista (BL-038). Só o que
// ainda está pendente: o pago precisa voltar para Pendente antes, pra não sumir
// por engano um valor que já saiu da conta. Fatura de cartão tem exclusão
// própria (itens junto, só a importada).
export async function deleteTransactionForUser(userId: string, id: string): Promise<void> {
    const transaction = await db.transaction.findFirst({
        where: { id, userId },
        select: { status: true, is_invoice_header: true },
    });
    if (!transaction) throw new Error("Lançamento não encontrado.");
    if (transaction.is_invoice_header) throw new Error("Fatura de cartão não se exclui por aqui.");
    if (transaction.status === "PAGO") throw new Error(PAID_DELETE_MESSAGE);

    await db.transaction.delete({ where: { id } });
}

// Data de pagamento coerente com o status na edição: fora de Pago não há
// pagamento (antes, voltar para Pendente deixava a data antiga gravada); ao
// marcar Pago sem data, vale agora, como na baixa rápida.
export function paymentDateForStatus(status: string, current: Date | null, now: Date = new Date()): Date | null {
    if (status !== "PAGO") return null;
    return current ?? now;
}
