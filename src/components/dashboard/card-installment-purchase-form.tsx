"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cardInstallmentPurchaseSchema, type CardInstallmentPurchaseInput } from "@/lib/validations";
import { provisionCardInstallmentPurchase } from "@/lib/credit-card-provision-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker } from "@/components/ui/date-picker";
import { Combobox } from "@/components/ui/combobox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Decimal } from "decimal.js";
import { cn, formatCurrency, getErrorMessage } from "@/lib/utils";
import { getInvoiceReferenceMonth, addInvoiceMonths } from "@/lib/credit-card-cycle";
import type { Category, CreditCardDisplay } from "@/types/models";

interface CardInstallmentPurchaseFormProps {
    categories: Category[];
    creditCards: CreditCardDisplay[];
    onSuccess: () => void;
}

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function CardInstallmentPurchaseForm({ categories, creditCards, onSuccess }: CardInstallmentPurchaseFormProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<CardInstallmentPurchaseInput>({
        resolver: zodResolver(cardInstallmentPurchaseSchema),
        defaultValues: {
            data_compra: new Date(),
            installmentsCount: 1,
        },
    });

    const creditCardId = watch("credit_card_id");
    const categoriaId = watch("categoria_id");
    const dataCompraValue = watch("data_compra");
    const dataCompra = dataCompraValue ? new Date(dataCompraValue as string | number | Date) : new Date();
    const installmentsCount = Number(watch("installmentsCount") || 1);
    const valor = Number(watch("valor") || 0);

    const selectedCard = creditCards.find(c => c.id === creditCardId);

    const onSubmit = (data: CardInstallmentPurchaseInput) => {
        setError(null);
        startTransition(async () => {
            try {
                await provisionCardInstallmentPurchase(data);
                toast.success("Compra parcelada lançada!");
                reset();
                onSuccess();
            } catch (err: unknown) {
                const message = getErrorMessage(err, "Erro ao lançar compra parcelada");
                setError(message);
                toast.error(message);
            }
        });
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="space-y-2">
                <Label>Cartão</Label>
                <Combobox
                    options={creditCards.map(c => ({ value: c.id, label: `${c.nome} (fecha dia ${c.closingDay})` }))}
                    value={creditCardId}
                    onValueChange={(v) => setValue("credit_card_id", v)}
                    placeholder="Selecione o cartão..."
                    searchPlaceholder="Procurar cartão..."
                    emptyMessage="Nenhum cartão cadastrado. Cadastre um em Configurações → Cartões."
                />
                {errors.credit_card_id && <p className="text-xs text-red-500">{errors.credit_card_id.message as string}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input id="descricao" {...register("descricao")} placeholder="Ex: Notebook" />
                {errors.descricao && <p className="text-xs text-red-500">{errors.descricao.message as string}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="valor">Valor Total (R$)</Label>
                    <Input id="valor" type="number" step="0.01" {...register("valor")} placeholder="0,00" />
                    {errors.valor && <p className="text-xs text-red-500">{errors.valor.message as string}</p>}
                </div>
                <div className="space-y-2">
                    <Label>Data da Compra</Label>
                    <DatePicker date={dataCompra} setDate={(d) => setValue("data_compra", d as Date)} />
                    {errors.data_compra && <p className="text-xs text-red-500">{errors.data_compra.message as string}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="installmentsCount">Parcelas</Label>
                    <Input id="installmentsCount" type="number" min={1} max={48} {...register("installmentsCount")} placeholder="Ex: 6" />
                    {errors.installmentsCount && <p className="text-xs text-red-500">{errors.installmentsCount.message as string}</p>}
                </div>
                <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Combobox
                        options={categories.filter(c => c.tipo === "SAIDA").map(c => ({ value: c.id, label: c.nome }))}
                        value={categoriaId}
                        onValueChange={(v) => setValue("categoria_id", v)}
                        placeholder="Selecione..."
                        searchPlaceholder="Procurar categoria..."
                        emptyMessage="Categoria não encontrada."
                    />
                    {errors.categoria_id && <p className="text-xs text-red-500">{errors.categoria_id.message as string}</p>}
                </div>
            </div>

            {selectedCard && valor > 0 && installmentsCount > 0 && (
                <div className="space-y-2 border-t pt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prévia das faturas</p>
                    <div className="max-h-[220px] overflow-y-auto rounded-md border bg-background/50">
                        <table className="w-full text-left text-xs">
                            <thead className="sticky top-0 bg-muted/50 border-b">
                                <tr>
                                    <th className="p-2 font-medium w-16 text-center">Parc.</th>
                                    <th className="p-2 font-medium">Fatura</th>
                                    <th className="p-2 font-medium text-right">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const totalValue = new Decimal(valor);
                                    const installmentValue = totalValue.dividedBy(installmentsCount).toDecimalPlaces(2, Decimal.ROUND_DOWN);
                                    const lastInstallmentValue = totalValue.minus(installmentValue.times(installmentsCount - 1));
                                    const reference = getInvoiceReferenceMonth(dataCompra, selectedCard.closingDay);

                                    return Array.from({ length: installmentsCount }).map((_, i) => {
                                        const { month, year } = addInvoiceMonths(reference.month, reference.year, i);
                                        const currentVal = i === installmentsCount - 1 ? lastInstallmentValue : installmentValue;
                                        const isAdjusted = i === installmentsCount - 1 && !lastInstallmentValue.equals(installmentValue);

                                        return (
                                            <tr key={i} className={cn("border-b last:border-0", isAdjusted && "bg-blue-50/50 dark:bg-blue-900/20")}>
                                                <td className="p-2 text-center text-muted-foreground">{String(i + 1).padStart(2, "0")}/{String(installmentsCount).padStart(2, "0")}</td>
                                                <td className="p-2 capitalize">{MONTH_LABELS[month - 1]}/{year}</td>
                                                <td className={cn("p-2 text-right font-medium", isAdjusted && "text-blue-600 dark:text-blue-400")}>
                                                    {formatCurrency(currentVal.toNumber())}
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                    </>
                ) : (
                    "Lançar Compra Parcelada"
                )}
            </Button>
        </form>
    );
}
