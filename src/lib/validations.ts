import { z } from "zod";

export const TransactionType = z.enum(["ENTRADA", "SAIDA"]);
export const TransactionStatus = z.enum(["PENDENTE", "PAGO", "ATRASADO"]);

export const transactionSchema = z.object({
    descricao: z.string().min(1, "Descrição é obrigatória"),
    valor: z.coerce.number().positive("Valor deve ser positivo"),
    data_vencimento: z.coerce.date(),
    data_pagamento: z.coerce.date().optional().nullable(),
    status: TransactionStatus,
    tipo: TransactionType,
    categoria_id: z.string().min(1, "Categoria é obrigatória"),
    tipo_pagamento_id: z.string().optional().nullable(),
});

export const categorySchema = z.object({
    nome: z.string().min(1, "Nome é obrigatório"),
    cor: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor inválida"),
    icone: z.string().min(1, "Ícone é obrigatório"),
    tipo: TransactionType,
});

export const paymentMethodSchema = z.object({
    nome: z.string().min(1, "Nome é obrigatório"),
});

export const loginSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const registerSchema = loginSchema.extend({
    // Add other registration fields if needed
});
