"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../../components/ui/card";
import { Alert, AlertDescription } from "../../../components/ui/alert";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [show2FA, setShow2FA] = useState(false);
    const [formData, setFormData] = useState({ email: "", password: "", code: "" });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await signIn("credentials", {
                redirect: false,
                email: formData.email,
                password: formData.password,
                code: formData.code,
            });

            if (res?.error) {
                if (res.error === "2FA_REQUIRED") {
                    setShow2FA(true);
                } else {
                    setError(res.error);
                }
            } else {
                router.push("/");
            }
        } catch (err: any) {
            setError("Erro ao autenticar. Verifique suas credenciais.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
            <Card className="w-full max-w-md border-none shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-bold tracking-tight">Nx Finance</CardTitle>
                    <CardDescription>
                        {show2FA ? "Insira o código enviado por e-mail" : "Entre com sua conta para continuar"}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        {!show2FA ? (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="email">E-mail</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="m@example.com"
                                        required
                                        value={formData.email}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Senha</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        required
                                        value={formData.password}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="code">Código de Verificação</Label>
                                <Input
                                    id="code"
                                    placeholder="000000"
                                    required
                                    maxLength={6}
                                    value={formData.code}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, code: e.target.value })}
                                />
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button className="w-full" type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {show2FA ? "Verificar Código" : "Entrar"}
                        </Button>
                        {!show2FA && (
                            <p className="text-center text-sm text-muted-foreground">
                                Não tem uma conta? <a href="/auth/register" className="text-primary hover:underline font-medium">Cadastre-se</a>
                            </p>
                        )}
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
