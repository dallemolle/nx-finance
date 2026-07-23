import type { Category, PaymentMethod, FinancialInstitution, TransactionStatus, TransactionType } from "@prisma/client";

export type { Category, PaymentMethod, FinancialInstitution, TransactionStatus, TransactionType };

// Shape of a CreditCardInvoiceItem after Decimal → number serialization,
// with the linked Category included and optional report-only display fields.
export interface InvoiceItemDisplay {
    id: string;
    descricao: string;
    valor: number;
    data_compra: Date | string;
    data_vencimento?: Date | string;
    data_vencimento_original?: Date | string | null;
    transactionId?: string;
    categoria_id: string;
    category: Category;
    formattedAmount?: string;
    displayDate?: string;
}

// Union shape consumed by dashboard/report UI: covers both a regular
// Transaction row (Decimal → number serialized) and a CreditCardInvoiceItem
// flattened into a transaction-like row (see dashboard.ts:invoiceItemsAsTransactions).
// Prisma-only fields are optional because the invoice-item variant omits them.
export interface TransactionDisplay {
    id: string;
    descricao: string;
    valor: number;
    data_lancamento?: Date | string;
    data_vencimento: Date | string;
    data_pagamento?: Date | string | null;
    status: TransactionStatus | "ATRASADO";
    tipo: TransactionType;
    is_invoice_header?: boolean;
    userId?: string;
    categoria_id: string;
    category: Category;
    tipo_pagamento_id?: string | null;
    paymentMethod?: PaymentMethod | null;
    institution_id?: string;
    institution?: FinancialInstitution | null;
    invoiceItems?: InvoiceItemDisplay[];
    isInvoiceItem?: boolean;
    formattedAmount?: string;
    displayDate?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}
