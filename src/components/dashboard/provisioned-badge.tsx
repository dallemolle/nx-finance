import { Badge } from "@/components/ui/badge";

// Mesmo formato dos badges de status já existentes (recent-transactions.tsx,
// report-content.tsx), em âmbar — cor já usada pro "provisionado" no gráfico
// de timeline de faturas (invoice-timeline-chart.tsx).
export function ProvisionedBadge() {
    return (
        <Badge className="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 hover:bg-amber-100 border-none px-2 py-0 text-[10px] uppercase font-bold tracking-tight">
            Previsto
        </Badge>
    );
}
