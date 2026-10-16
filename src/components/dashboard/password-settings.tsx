"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { changePassword } from "@/lib/account-actions";
import { changePasswordSchema } from "@/lib/validations";
import { getErrorMessage } from "@/lib/utils";

const inputClass = "h-9 bg-slate-50 border-none dark:bg-slate-800";
const labelClass = "text-[10px] uppercase font-bold text-muted-foreground ml-1";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

// Alterar senha (BL-042). Mesmas regras no servidor (services/account.ts).
export function PasswordSettings() {
    const [fields, setFields] = useState(EMPTY);
    const [error, setError] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setFields(prev => ({ ...prev, [key]: e.target.value }));
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const parsed = changePasswordSchema.safeParse(fields);
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Dados inválidos");
            return;
        }
        setIsPending(true);
        try {
            const result = await changePassword(fields);
            if (!result.success) {
                setError(result.error);
                return;
            }
            toast.success("Senha alterada. Use a nova senha no próximo login.");
            setFields(EMPTY);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Erro ao alterar a senha"));
        } finally {
            setIsPending(false);
        }
    };

    return (
        <Card className="border-none shadow-none">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-slate-400" aria-hidden />
                    Alterar senha
                </CardTitle>
                <CardDescription>
                    Confirme a senha atual e escolha uma nova, com pelo menos 8 caracteres.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
                <form onSubmit={handleSubmit} className="max-w-sm space-y-3" aria-label="Alterar senha">
                    <div className="space-y-1">
                        <Label htmlFor="current-password" className={labelClass}>Senha atual</Label>
                        <Input id="current-password" type="password" autoComplete="current-password" value={fields.currentPassword} onChange={set("currentPassword")} className={inputClass} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="new-password" className={labelClass}>Nova senha</Label>
                        <Input id="new-password" type="password" autoComplete="new-password" value={fields.newPassword} onChange={set("newPassword")} className={inputClass} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="confirm-password" className={labelClass}>Confirmar nova senha</Label>
                        <Input id="confirm-password" type="password" autoComplete="new-password" value={fields.confirmPassword} onChange={set("confirmPassword")} className={inputClass} />
                    </div>
                    {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
                    <Button type="submit" disabled={isPending || !fields.currentPassword || !fields.newPassword || !fields.confirmPassword}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Alterar senha
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
