import { z } from "zod";

export const TransactionType = z.enum(["ENTRADA", "SAIDA"]);
export const TransactionStatus = z.enum(["PENDENTE", "PAGO", "ATRASADO"]);

export const transactionSchema = z.object({
    descricao: z.string().min(1, "Descrição é obrigatória").transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase()),
    valor: z.coerce.number().positive("Valor deve ser positivo"),
    data_vencimento: z.coerce.date(),
    data_pagamento: z.coerce.date().optional().nullable(),
    status: TransactionStatus,
    tipo: TransactionType,
    categoria_id: z.string().min(1, "Categoria é obrigatória"),
    tipo_pagamento_id: z.string().optional().nullable(),
    institution_id: z.string().min(1, "Instituição é obrigatória"),
    isInstallment: z.boolean().default(false),
    installmentsCount: z.coerce.number().min(2, "Mínimo de 2 parcelas").max(48, "Máximo de 48 parcelas").optional().nullable(),
}).refine((data) => {
    if (data.isInstallment && !data.installmentsCount) {
        return false;
    }
    return true;
}, {
    message: "Quantidade de parcelas é obrigatória para despesas parceladas",
    path: ["installmentsCount"],
});

export const categorySchema = z.object({
    nome: z.string().min(1, "Nome é obrigatório").transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase()),
    cor: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor inválida"),
    icone: z.string().min(1, "Ícone é obrigatório"),
    tipo: TransactionType,
});

export const paymentMethodSchema = z.object({
    nome: z.string().min(1, "Nome é obrigatório").transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase()),
});

export const financialInstitutionSchema = z.object({
    nome: z.string().min(1, "Nome da Instituição é obrigatório").transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase()),
    cor: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor inválida").optional().or(z.literal("")),
});

export const loginSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const registerSchema = loginSchema.extend({
    // Add other registration fields if needed
});
