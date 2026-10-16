import type { CSSProperties } from "react";

// Tooltip dos gráficos (Recharts) com as cores do tema. O Recharts pinta cada
// linha do tooltip com a cor da série e, sem ela (barras coloridas por classe
// CSS), usa preto — ilegível no fundo escuro (BL-041). Por isso o texto dos
// itens também segue o tema, não só o fundo e o título.
const text = "hsl(var(--popover-foreground))";

export const chartTooltipProps = {
    contentStyle: {
        borderRadius: "12px",
        border: "1px solid hsl(var(--border))",
        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
        backgroundColor: "hsl(var(--popover))",
        color: text,
        fontSize: 12,
    } satisfies CSSProperties,
    itemStyle: { color: text } satisfies CSSProperties,
    labelClassName: "capitalize font-semibold",
};
