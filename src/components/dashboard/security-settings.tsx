"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Loader2, Copy, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateTwoFactorSetup, enableTwoFactor, disableTwoFactor, regenerateRecoveryCodes } from "@/lib/two-factor-actions";
import { getErrorMessage } from "@/lib/utils";

import { unwrap } from "@/lib/action-result";
interface SecuritySettingsProps {
    enabled: boolean;
    recoveryCodesLeft: number;
}

const LOW_CODES = 3;
const inputClass = "h-9 bg-slate-50 border-none dark:bg-slate-800";
const labelClass = "text-[10px] uppercase font-bold text-muted-foreground ml-1";

type ConfirmMode = "regenerate" | "disable";

export function SecuritySettings({ enabled, recoveryCodesLeft }: SecuritySettingsProps) {
    const [isEnabled, setIsEnabled] = useState(enabled);
    const [codesLeft, setCodesLeft] = useState(recoveryCodesLeft);
    const [setupData, setSetupData] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
    // Códigos em texto só existem aqui, logo depois de gerados; o servidor guarda só o hash.
    const [shownCodes, setShownCodes] = useState<string[] | null>(null);
    const [confirmMode, setConfirmMode] = useState<ConfirmMode | null>(null);
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [isPending, setIsPending] = useState(false);

    const resetFields = () => { setCode(""); setPassword(""); };

    const run = async (action: () => Promise<void>, fallback: string) => {
        setIsPending(true);
        try {
            await action();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, fallback));
        } finally {
            setIsPending(false);
        }
    };

    const handleStartSetup = () => run(async () => setSetupData(await generateTwoFactorSetup().then(unwrap)), "Erro ao gerar configuração de 2FA");

    const handleConfirmEnable = () => run(async () => {
        if (!setupData) return;
        const { recoveryCodes } = await enableTwoFactor({ secret: setupData.secret, code, password }).then(unwrap);
        toast.success("2FA ativado com sucesso!");
        setIsEnabled(true);
        setSetupData(null);
        setShownCodes(recoveryCodes);
        setCodesLeft(recoveryCodes.length);
        resetFields();
    }, "Erro ao ativar 2FA");

    const handleConfirm = () => run(async () => {
        if (confirmMode === "regenerate") {
            const { recoveryCodes } = await regenerateRecoveryCodes({ code, password }).then(unwrap);
            toast.success("Novos códigos gerados. Os antigos não valem mais.");
            setShownCodes(recoveryCodes);
            setCodesLeft(recoveryCodes.length);
        } else {
            await disableTwoFactor({ code, password }).then(unwrap);
            toast.success("2FA desativado.");
            setIsEnabled(false);
            setCodesLeft(0);
        }
        setConfirmMode(null);
        resetFields();
    }, confirmMode === "regenerate" ? "Erro ao gerar novos códigos" : "Erro ao desativar 2FA");

    const codesAsText = () => [
        "Nx Finance — códigos de recuperação do 2FA",
        "Cada código funciona uma única vez.",
        "",
        ...(shownCodes ?? []),
    ].join("\n");

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(codesAsText());
            toast.success("Códigos copiados.");
        } catch {
            toast.error("Não foi possível copiar. Selecione os códigos e copie manualmente.");
        }
    };

    const handleDownload = () => {
        const url = URL.createObjectURL(new Blob([codesAsText()], { type: "text/plain;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = "nx-finance-codigos-de-recuperacao.txt";
        a.click();
        URL.revokeObjectURL(url);
    };

    const passwordField = (
        <div className="space-y-1">
            <Label htmlFor="twofa-password" className={labelClass}>Senha</Label>
            <Input id="twofa-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </div>
    );

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
                {shownCodes ? (
                    <div className="max-w-md space-y-4" role="region" aria-label="Códigos de recuperação">
                        <div className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                            <p>
                                Guarde estes códigos num lugar seguro (um gerenciador de senhas, por exemplo). Se perder o celular, cada um permite entrar <strong>uma vez</strong> no lugar do código do app. <strong>Eles não serão mostrados de novo.</strong>
                            </p>
                        </div>
                        <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
                            {shownCodes.map(c => (
                                <li key={c} className="rounded bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-center tracking-wider select-all">{c}</li>
                            ))}
                        </ul>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={handleCopy}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
                            <Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4" />Baixar .txt</Button>
                            <Button onClick={() => setShownCodes(null)}>Já guardei os códigos</Button>
                        </div>
                    </div>
                ) : isEnabled ? (
                    <div className="max-w-sm space-y-4">
                        <p className="text-sm text-muted-foreground">
                            2FA está <span className="font-semibold text-emerald-600 dark:text-emerald-400">ativado</span>.
                        </p>
                        <p className={codesLeft <= LOW_CODES ? "text-sm font-medium text-amber-700 dark:text-amber-400" : "text-sm text-muted-foreground"}>
                            {codesLeft === 0
                                ? "Nenhum código de recuperação disponível. Gere novos para não ficar sem acesso se perder o celular."
                                : `${codesLeft} ${codesLeft === 1 ? "código de recuperação disponível" : "códigos de recuperação disponíveis"}.${codesLeft <= LOW_CODES ? " Gere novos em breve." : ""}`}
                        </p>
                        {confirmMode ? (
                            <div className="space-y-3 rounded-lg ring-1 ring-slate-200 dark:ring-slate-800 p-3">
                                <p className="text-sm text-muted-foreground">
                                    {confirmMode === "disable"
                                        ? "Para desativar, confirme sua senha e um código do app (ou um código de recuperação)."
                                        : "Para gerar novos códigos, confirme sua senha e um código do app (ou um código de recuperação). Os códigos atuais deixam de valer."}
                                </p>
                                {passwordField}
                                <div className="space-y-1">
                                    <Label htmlFor="twofa-confirm-code" className={labelClass}>Código do app ou de recuperação</Label>
                                    <Input id="twofa-confirm-code" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={12} className={inputClass} />
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => { setConfirmMode(null); resetFields(); }} disabled={isPending}>Cancelar</Button>
                                    <Button
                                        variant={confirmMode === "disable" ? "destructive" : "default"}
                                        onClick={handleConfirm}
                                        disabled={isPending || !password || code.trim().length < 6}
                                    >
                                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {confirmMode === "disable" ? "Desativar 2FA" : "Gerar novos códigos"}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" onClick={() => setConfirmMode("regenerate")}>Gerar novos códigos de recuperação</Button>
                                <Button variant="destructive" onClick={() => setConfirmMode("disable")}>Desativar 2FA</Button>
                            </div>
                        )}
                    </div>
                ) : setupData ? (
                    <div className="max-w-sm space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Escaneie o QR code abaixo com seu aplicativo autenticador e digite o código gerado para confirmar.
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element -- data: URI gerado em runtime, next/image não otimiza esse caso */}
                        <img src={setupData.qrCodeDataUrl} alt="QR code para configurar o 2FA" className="rounded-lg border border-slate-200 dark:border-slate-800 w-44 h-44" />
                        <div className="space-y-1">
                            <p className={labelClass}>Ou digite manualmente</p>
                            <code className="block text-xs bg-slate-50 dark:bg-slate-800 rounded px-2 py-1.5 break-all">{setupData.secret}</code>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="twofa-setup-code" className={labelClass}>Código do app</Label>
                            <Input id="twofa-setup-code" autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6} className={inputClass} />
                        </div>
                        {passwordField}
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => { setSetupData(null); resetFields(); }} disabled={isPending}>
                                Cancelar
                            </Button>
                            <Button onClick={handleConfirmEnable} disabled={isPending || code.length !== 6 || !password}>
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
