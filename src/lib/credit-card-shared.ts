import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

// Find-or-create da categoria sintética "Fatura Cartão", usada só pra
// satisfazer a FK de categoria em cabeçalhos de fatura (reais ou
// projetados) — é excluída da agregação do gráfico de categorias.
export async function getOrCreateInvoiceCategory(tx: Tx, userId: string) {
    return (
        (await tx.category.findFirst({
            where: { userId, nome: "Fatura Cartão", tipo: "SAIDA" },
        })) ||
        (await tx.category.create({
            data: {
                nome: "Fatura Cartão",
                cor: "#6366f1",
                icone: "CreditCard",
                tipo: "SAIDA",
                userId,
            },
        }))
    );
}

// Find-or-create do meio de pagamento sintético usado por faturas projetadas
// (ainda não têm um "meio de pagamento" real escolhido pelo usuário no import).
export async function getOrCreateProvisionedPaymentMethod(tx: Tx, userId: string) {
    return (
        (await tx.paymentMethod.findFirst({
            where: { userId, nome: "Cartão (Provisionado)" },
        })) ||
        (await tx.paymentMethod.create({
            data: { nome: "Cartão (Provisionado)", userId },
        }))
    );
}
