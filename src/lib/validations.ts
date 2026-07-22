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
    tipo_pagamento_id: z.string().min(1, "Meio de pagamento é obrigatório"),
    institution_id: z.string().min(1, "Instituição é obrigatória"),
    isInstallment: z.boolean().default(false),
    installmentsCount: z.coerce.number().min(2, "Mínimo de 2 parcelas").max(48, "Máximo de 48 parcelas").optional().nullable(),
    installmentDescriptions: z.array(z.string()).optional(),
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

export const twoFactorCodeSchema = z.object({
    code: z.string().length(6, "Código deve ter 6 dígitos").regex(/^\d+$/, "Código deve conter apenas números"),
});

export const loginSchema = z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const registerSchema = loginSchema.extend({
    // Add other registration fields if needed
});

export const creditCardInvoiceItemSchema = z.object({
    descricao: z.string().min(1, "Descrição é obrigatória"),
    valor: z.coerce.number().positive("Valor deve ser positivo"),
    categoria_id: z.string().min(1, "Categoria é obrigatória"),
    data_compra: z.coerce.date(),
});

export const creditCardInvoiceSchema = z.object({
    descricao: z.string().min(1, "Descrição da fatura é obrigatória").transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase()),
    data_vencimento: z.coerce.date(),
    institution_id: z.string().min(1, "Instituição é obrigatória"),
    tipo_pagamento_id: z.string().min(1, "Meio de pagamento é obrigatório"),
    items: z.array(creditCardInvoiceItemSchema).min(1, "Adicione ao menos um item à fatura"),
});

// Server Actions receive data *before* Zod coercion runs (e.g. dates/numbers
// as raw strings from form inputs), so their parameter types use z.input
// (pre-parse shape) rather than z.infer/z.output (post-parse shape).
export type TransactionInput = z.input<typeof transactionSchema>;
// Coerced/output shape used by react-hook-form + zodResolver client-side
// (form state already holds real Date/number values, not raw strings).
export type TransactionFormValues = z.infer<typeof transactionSchema>;
export type CategoryInput = z.input<typeof categorySchema>;
export type PaymentMethodInput = z.input<typeof paymentMethodSchema>;
export type FinancialInstitutionInput = z.input<typeof financialInstitutionSchema>;
export type TwoFactorCodeInput = z.input<typeof twoFactorCodeSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type CreditCardInvoiceItemInput = z.input<typeof creditCardInvoiceItemSchema>;
export type CreditCardInvoiceInput = z.input<typeof creditCardInvoiceSchema>;
