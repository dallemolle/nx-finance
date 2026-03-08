import { z } from "zod";

export const transactionSchema = z.object({
    descricao: z.string().min(3, "Descrição deve ter pelo menos 3 caracteres"),
    valor: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
        message: "Valor deve ser um número positivo",
    }),
    tipo: z.enum(["ENTRADA", "SAIDA"]),
    status: z.enum(["PENDENTE", "PAGO", "ATRASADO"]),
    data_vencimento: z.date({
        required_error: "Data de vencimento é obrigatória",
    }),
    categoria_id: z.string().min(1, "Categoria é obrigatória"),
    tipo_pagamento_id: z.string().optional(),
});

export const loginSchema = z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    code: z.string().optional(),
});

export const registerSchema = z.object({
    email: z.string().email("E-mail inválido"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});
