import { z } from "zod";
import { toDateOnly } from "./date-only";

// Data sem hora (vencimento, compra): sai como meia-noite UTC do dia (BL-025).
const dateOnly = z.coerce.date().transform(toDateOnly);

export const TransactionType = z.enum(["ENTRADA", "SAIDA"]);
export const TransactionStatus = z.enum(["PENDENTE", "PAGO", "ATRASADO"]);

export const transactionSchema = z.object({
    descricao: z.string().min(1, "Descrição é obrigatória").transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase()),
    valor: z.coerce.number().positive("Valor deve ser positivo"),
    data_vencimento: dateOnly,
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

// Criação: sem cor, o servidor sorteia uma diferente das categorias do usuário.
export const newCategorySchema = categorySchema.extend({
    cor: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor inválida").optional(),
});

export const paymentMethodSchema = z.object({
    nome: z.string().min(1, "Nome é obrigatório").transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase()),
});

export const financialInstitutionSchema = z.object({
    nome: z.string().min(1, "Nome da Instituição é obrigatório").transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase()),
    cor: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor inválida").optional().or(z.literal("")),
});

// Ativar o 2FA: código de 6 dígitos do app + senha (BL-022 — sessão roubada
// não ativa 2FA com outro celular e tranca o dono fora).
export const enableTwoFactorSchema = z.object({
    secret: z.string().min(16).max(128),
    code: z.string().trim().regex(/^\d{6}$/, "Código deve ter 6 dígitos"),
    password: z.string().min(1, "Informe sua senha"),
});

// Desativar o 2FA ou gerar novos códigos de recuperação: senha + código do app
// ou de recuperação (BL-021/BL-022).
export const twoFactorConfirmSchema = z.object({
    code: z.string().trim().min(6, "Informe o código").max(20, "Código inválido"),
    password: z.string().min(1, "Informe sua senha"),
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
    // Negativo representa estorno/reembolso — reduz o total da fatura em vez de somar.
    valor: z.coerce.number().refine(v => v !== 0, "Valor não pode ser zero"),
    categoria_id: z.string().min(1, "Categoria é obrigatória"),
    data_compra: dateOnly,
    isInstallment: z.boolean().default(false),
    // Qual parcela este item representa (permite começar no meio de um parcelamento
    // já em andamento, ex: usuário só passou a usar o app na parcela 3/6).
    installmentNumber: z.coerce.number().int().min(1).optional().nullable(),
    installmentsCount: z.coerce.number().int().min(2, "Mínimo de 2 parcelas").max(48, "Máximo de 48 parcelas").optional().nullable(),
}).refine((data) => {
    if (!data.isInstallment) return true;
    return !!data.installmentsCount && !!data.installmentNumber && data.installmentNumber <= data.installmentsCount;
}, {
    message: "Informe corretamente o número da parcela e o total de parcelas",
    path: ["installmentsCount"],
});

export const creditCardInvoiceSchema = z.object({
    descricao: z.string().min(1, "Descrição da fatura é obrigatória").transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase()),
    data_vencimento: dateOnly,
    institution_id: z.string().min(1, "Instituição é obrigatória"),
    tipo_pagamento_id: z.string().min(1, "Meio de pagamento é obrigatório"),
    credit_card_id: z.string().optional().nullable(),
    items: z.array(creditCardInvoiceItemSchema).min(1, "Adicione ao menos um item à fatura"),
});

export const creditCardSchema = z.object({
    nome: z.string().min(1, "Nome do cartão é obrigatório").transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase()),
    institution_id: z.string().min(1, "Instituição é obrigatória"),
    closingDay: z.coerce.number().int().min(1, "Dia inválido").max(31, "Dia inválido"),
    dueDay: z.coerce.number().int().min(1, "Dia inválido").max(31, "Dia inválido"),
    limite: z.coerce.number().positive("Limite deve ser positivo").optional().nullable(),
    cor: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor inválida").optional().or(z.literal("")),
});

export const cardInstallmentPurchaseSchema = z.object({
    credit_card_id: z.string().min(1, "Cartão é obrigatório"),
    descricao: z.string().min(1, "Descrição é obrigatória").transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase()),
    valor: z.coerce.number().positive("Valor deve ser positivo"),
    data_compra: dateOnly,
    installmentsCount: z.coerce.number().int().min(1, "Mínimo de 1 parcela").max(48, "Máximo de 48 parcelas"),
    categoria_id: z.string().min(1, "Categoria é obrigatória"),
});

export const estimatedExpenseSchema = z.object({
    credit_card_id: z.string().optional().nullable(),
    descricao: z.string().min(1, "Descrição é obrigatória").transform(val => val.trim().charAt(0).toUpperCase() + val.slice(1).toLowerCase()),
    valor: z.coerce.number().positive("Valor deve ser positivo"),
    categoria_id: z.string().min(1, "Categoria é obrigatória"),
    invoice_month: z.coerce.number().int().min(1).max(12),
    invoice_year: z.coerce.number().int().min(2020).max(2100),
    tipo_pagamento_id: z.string().optional().nullable(),
    institution_id: z.string().optional().nullable(),
    isInstallment: z.boolean().default(false),
    installmentsCount: z.coerce.number().int().min(2, "Mínimo de 2 parcelas").max(48, "Máximo de 48 parcelas").optional().nullable(),
    // Recorrente (BL-030): o mesmo valor, cheio, repetido por N meses (assinatura,
    // mensalidade). Parcelada divide o valor; as duas não se combinam.
    isRecurring: z.boolean().default(false),
    recurringMonths: z.coerce.number().int().min(2, "Mínimo de 2 meses").max(36, "Máximo de 36 meses").optional().nullable(),
}).refine((data) => data.credit_card_id || (data.tipo_pagamento_id && data.institution_id), {
    message: "Informe um cartão ou um meio de pagamento + instituição",
    path: ["credit_card_id"],
}).refine((data) => !data.isInstallment || !!data.installmentsCount, {
    message: "Quantidade de parcelas é obrigatória para despesas previstas parceladas",
    path: ["installmentsCount"],
}).refine((data) => !data.isRecurring || !!data.recurringMonths, {
    message: "Informe por quantos meses a despesa se repete",
    path: ["recurringMonths"],
}).refine((data) => !(data.isRecurring && data.isInstallment), {
    message: "Escolha parcelada ou recorrente, não as duas",
    path: ["isRecurring"],
});

export const confirmEstimatedExpenseSchema = z.object({
    valor: z.coerce.number().positive("Valor deve ser positivo"),
    descricao: z.string().min(1, "Descrição é obrigatória").optional(),
    categoria_id: z.string().min(1).optional(),
    data_vencimento: dateOnly.optional(),
});

// Server Actions receive data *before* Zod coercion runs (e.g. dates/numbers
// as raw strings from form inputs), so their parameter types use z.input
// (pre-parse shape) rather than z.infer/z.output (post-parse shape).
export type TransactionInput = z.input<typeof transactionSchema>;
// Coerced/output shape used by react-hook-form + zodResolver client-side
// (form state already holds real Date/number values, not raw strings).
export type TransactionFormValues = z.infer<typeof transactionSchema>;
export type CategoryInput = z.input<typeof categorySchema>;
export type NewCategoryInput = z.input<typeof newCategorySchema>;
export type PaymentMethodInput = z.input<typeof paymentMethodSchema>;
export type FinancialInstitutionInput = z.input<typeof financialInstitutionSchema>;
export type EnableTwoFactorInput = z.input<typeof enableTwoFactorSchema>;
export type TwoFactorConfirmInput = z.input<typeof twoFactorConfirmSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type RegisterInput = z.input<typeof registerSchema>;
export type CreditCardInvoiceItemInput = z.input<typeof creditCardInvoiceItemSchema>;
export type CreditCardInvoiceInput = z.input<typeof creditCardInvoiceSchema>;
export type CreditCardInput = z.input<typeof creditCardSchema>;
export type CardInstallmentPurchaseInput = z.input<typeof cardInstallmentPurchaseSchema>;
export type EstimatedExpenseInput = z.input<typeof estimatedExpenseSchema>;
export type ConfirmEstimatedExpenseInput = z.input<typeof confirmEstimatedExpenseSchema>;
