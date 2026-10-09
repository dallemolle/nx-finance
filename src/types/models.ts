import type { Category, PaymentMethod, FinancialInstitution, CreditCard, TransactionStatus, TransactionType } from "@prisma/client";

export type { Category, PaymentMethod, FinancialInstitution, CreditCard, TransactionStatus, TransactionType };

// CreditCard após Decimal → number (limite) e com a instituição emissora incluída.
export interface CreditCardDisplay extends Omit<CreditCard, "limite"> {
    limite: number | null;
    institution?: FinancialInstitution;
}

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
    is_provisioned?: boolean;
    installment_group_id?: string | null;
    installment_number?: number | null;
    installment_total?: number | null;
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
    is_provisioned?: boolean;
    invoice_month?: number | null;
    invoice_year?: number | null;
    userId?: string;
    categoria_id: string;
    category: Category;
    tipo_pagamento_id?: string | null;
    paymentMethod?: PaymentMethod | null;
    institution_id?: string;
    institution?: FinancialInstitution | null;
    credit_card_id?: string | null;
    creditCard?: CreditCard | null;
    invoiceItems?: InvoiceItemDisplay[];
    isInvoiceItem?: boolean;
    formattedAmount?: string;
    displayDate?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}
