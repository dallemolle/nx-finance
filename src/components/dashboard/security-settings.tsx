"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateTwoFactorSetup, enableTwoFactor, disableTwoFactor } from "@/lib/two-factor-actions";
import { getErrorMessage } from "@/lib/utils";

interface SecuritySettingsProps {
    enabled: boolean;
}

export function SecuritySettings({ enabled }: SecuritySettingsProps) {
    const [isEnabled, setIsEnabled] = useState(enabled);
    const [setupData, setSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
    const [code, setCode] = useState("");
    const [isPending, setIsPending] = useState(false);

    const handleStartSetup = async () => {
        setIsPending(true);
        try {
            const data = await generateTwoFactorSetup();
            setSetupData(data);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Erro ao gerar configuração de 2FA"));
        } finally {
            setIsPending(false);
        }
    };

    const handleCancelSetup = () => {
        setSetupData(null);
        setCode("");
    };

    const handleConfirmEnable = async () => {
        if (!setupData) return;
        setIsPending(true);
        try {
            await enableTwoFactor(setupData.secret, { code });
            toast.success("2FA ativado com sucesso!");
            setIsEnabled(true);
            setSetupData(null);
            setCode("");
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Erro ao ativar 2FA"));
        } finally {
            setIsPending(false);
        }
    };

    const handleDisable = async () => {
        setIsPending(true);
        try {
            await disableTwoFactor({ code });
            toast.success("2FA desativado.");
            setIsEnabled(false);
            setCode("");
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Erro ao desativar 2FA"));
        } finally {
            setIsPending(false);
        }
    };

    return (
        <Card className="border-none shadow-none">
            <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                    {isEnabled ? (
                        <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    ) : (
                        <ShieldOff className="h-5 w-5 text-slate-400" />
                    )}
                    Autenticação em Duas Etapas (2FA)
                </CardTitle>
                <CardDescription>
                    Proteja sua conta exigindo um código do seu aplicativo autenticador (Google Authenticator, Authy) a cada login.
                </CardDescription>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
                {isEnabled ? (
                    <div className="max-w-sm space-y-3">
                        <p className="text-sm text-muted-foreground">
                            2FA está <span className="font-semibold text-emerald-600 dark:text-emerald-400">ativado</span>. Para desativar, digite o código atual do seu aplicativo autenticador.
                        </p>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Código de Verificação</Label>
                            <Input
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="000000"
                                maxLength={6}
                                className="h-9 bg-slate-50 border-none dark:bg-slate-800"
                            />
                        </div>
                        <Button
                            variant="destructive"
                            onClick={handleDisable}
                            disabled={isPending || code.length !== 6}
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Desativar 2FA
                        </Button>
                    </div>
                ) : setupData ? (
                    <div className="max-w-sm space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Escaneie o QR code abaixo com seu aplicativo autenticador e digite o código gerado para confirmar.
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element -- data: URI gerado em runtime, next/image não otimiza esse caso */}
                        <img src={setupData.qrCodeDataUrl} alt="QR code para configurar o 2FA" className="rounded-lg border border-slate-200 dark:border-slate-800 w-44 h-44" />
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Ou digite manualmente</Label>
                            <code className="block text-xs bg-slate-50 dark:bg-slate-800 rounded px-2 py-1.5 break-all">{setupData.secret}</code>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Código de Verificação</Label>
                            <Input
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="000000"
                                maxLength={6}
                                className="h-9 bg-slate-50 border-none dark:bg-slate-800"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleCancelSetup} disabled={isPending}>
                                Cancelar
                            </Button>
                            <Button onClick={handleConfirmEnable} disabled={isPending || code.length !== 6}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Confirmar e Ativar
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button onClick={handleStartSetup} disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Ativar 2FA
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
