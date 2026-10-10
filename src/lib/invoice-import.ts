// Regras puras da importação de fatura (credit-card-invoice-dialog.tsx):
// leitura das colunas do CSV, valores padrão a partir do cartão, atalho de
// parcela e aplicação de categoria. Sem dependência de servidor, testável.
import { detectInstallmentInDescription, getMerchantSignature } from "@/lib/dashboard-utils";

const pad = (n: number) => String(n).padStart(2, "0");
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Monta a data e confere que ela existe de verdade (31/02 não vira 03/03).
function validDate(year: number, month: number, day: number): Date | null {
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d : null;
}

// Aceita AAAA-MM-DD (com ou sem hora) e DD/MM/AAAA ou DD/MM/AA. Barra é
// sempre dia/mês, como nos extratos brasileiros: new Date("02/10/2026")
// interpretaria como 10 de fevereiro.
export function parseInvoiceDate(raw: string, today: Date): string {
    const s = (raw ?? "").trim();

    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
        const d = validDate(+iso[1], +iso[2], +iso[3]);
        if (d) return toYmd(d);
    }

    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (br) {
        const year = br[3].length === 2 ? 2000 + +br[3] : +br[3];
        const d = validDate(year, +br[2], +br[1]);
        if (d) return toYmd(d);
    }

    return toYmd(today);
}

// Aceita "245.90", "245,90", "R$ 1.234,56", "1,234.56", "-74,50". Quando os
// dois separadores aparecem, o último é o decimal; um único ponto seguido de
// exatamente 3 dígitos ("1.000") é separador de milhar.
export function parseInvoiceAmount(raw: string): number {
    const s = String(raw ?? "").replace(/[^\d,.-]/g, "");
    const negative = s.includes("-");
    let digits = s.replace(/-/g, "");

    const lastComma = digits.lastIndexOf(",");
    const lastDot = digits.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) {
        const decimal = lastComma > lastDot ? "," : ".";
        const thousands = decimal === "," ? "." : ",";
        digits = digits.split(thousands).join("").replace(decimal, ".");
    } else if (lastComma >= 0) {
        digits = digits.split(",").length > 2 ? digits.split(",").join("") : digits.replace(",", ".");
    } else if (lastDot >= 0) {
        const parts = digits.split(".");
        if (parts.length > 2 || parts[1].length === 3) digits = parts.join("");
    }

    const value = parseFloat(digits);
    if (isNaN(value)) return 0;
    return negative ? -value : value;
}

// Vencimento do cartão no mês corrente, mesmo que já tenha passado: a fatura
// costuma ser lançada depois de fechar, às vezes depois de vencer. Pular pro
// mês seguinte fazia a importação ser tratada como a fatura errada (BL-027).
// O dia é limitado ao último dia do mês (vencimento 31 em fevereiro -> 28/29).
export function currentMonthDueDate(dueDay: number, today: Date): string {
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return toYmd(new Date(today.getFullYear(), today.getMonth(), Math.min(dueDay, lastDay)));
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface InvoiceDefaults {
    institutionId: string;
    dueDate: string;
    paymentMethodId: string | null;
    description: string;
}

// Escolher o cartão já define a instituição, o vencimento, o meio de
// pagamento ("Cartão de crédito", se existir) e uma descrição sugerida.
export function buildInvoiceDefaults({ card, paymentMethods, today }: {
    card: { nome: string; dueDay: number; institution_id: string };
    paymentMethods: { id: string; nome: string }[];
    today: Date;
}): InvoiceDefaults {
    const dueDate = currentMonthDueDate(card.dueDay, today);
    const [year, month] = dueDate.split("-").map(Number);
    const creditCardMethod = paymentMethods.find(pm => normalize(pm.nome).includes("credito"));
    return {
        institutionId: card.institution_id,
        dueDate,
        paymentMethodId: creditCardMethod?.id ?? null,
        description: `Fatura ${card.nome} ${MONTHS[month - 1]}/${year}`,
    };
}

// Atalho de 1 clique pra ativar o parcelamento: vale pra qualquer parcela
// reconhecida na descrição que não seja a última (a última não tem o que
// projetar). Parcela > 1 passa pelo aviso de duplicidade ao ativar.
export function installmentShortcut(title: string): { number: number; total: number } | null {
    const detected = detectInstallmentInDescription(title);
    return detected && detected.number < detected.total ? detected : null;
}

interface CategorizableRow {
    id: number;
    title: string;
    category_id: string;
}

// Define a categoria de um item e repete nos outros itens ainda sem
// categoria do mesmo estabelecimento (ex.: várias corridas de Uber).
export function applyCategory<T extends CategorizableRow>(rows: T[], rowId: number, categoryId: string): T[] {
    const target = rows.find(r => r.id === rowId);
    const signature = target ? getMerchantSignature(target.title) : null;
    return rows.map(r => {
        if (r.id === rowId) return { ...r, category_id: categoryId };
        if (signature && !r.category_id && getMerchantSignature(r.title) === signature) return { ...r, category_id: categoryId };
        return r;
    });
}

export function applyCategoryToUncategorized<T extends CategorizableRow>(rows: T[], categoryId: string): T[] {
    return rows.map(r => (r.category_id ? r : { ...r, category_id: categoryId }));
}

// O que ainda falta pra avançar da primeira etapa, na ordem em que aparece na tela.
export function missingStepOneFields(form: {
    hasFile: boolean;
    description: string;
    dueDate: string;
    institutionId: string;
    paymentMethodId: string;
}): string[] {
    const missing: string[] = [];
    if (!form.hasFile) missing.push("arquivo CSV");
    if (!form.description.trim()) missing.push("descrição");
    if (!form.dueDate) missing.push("vencimento");
    if (!form.institutionId) missing.push("instituição");
    if (!form.paymentMethodId || form.paymentMethodId === "none") missing.push("meio de pagamento");
    return missing;
}
