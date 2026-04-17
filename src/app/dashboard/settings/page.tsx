import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { TopNav } from "@/components/layout/top-nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategorySettings, InstitutionSettings, PaymentMethodSettings } from "@/components/dashboard/settings-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        redirect("/auth/login");
    }

    const userId = session.user.id;

    const [categories, institutions, paymentMethods] = await Promise.all([
        db.category.findMany({ where: { userId }, orderBy: { nome: "asc" } }),
        db.financialInstitution.findMany({ where: { userId }, orderBy: { nome: "asc" } }),
        db.paymentMethod.findMany({ where: { userId }, orderBy: { nome: "asc" } }),
    ]);

    return (
        <>
            <TopNav />
            <div className="px-8 pb-8 pt-4 space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto">
                <div className="flex flex-col gap-1">
                    <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-slate-100 italic">Configurações</h1>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Gerencie suas categorias, instituições e meios de pagamento.</p>
                </div>

                <Card className="border-none shadow-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800">
                    <CardHeader className="pb-3 text-center md:text-left">
                        <CardTitle className="text-xl font-bold tracking-tight">Personalização</CardTitle>
                        <CardDescription>Ajuste os detalhes dos seus cadastros auxiliares.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="institutions" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 mb-8 bg-slate-100 dark:bg-slate-800 p-1">
                                <TabsTrigger value="institutions" className="font-bold tracking-tight py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">Instituições</TabsTrigger>
                                <TabsTrigger value="categories" className="font-bold tracking-tight py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">Categorias</TabsTrigger>
                                <TabsTrigger value="payments" className="font-bold tracking-tight py-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:shadow-sm">Meios de Pagamento</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="institutions" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                                <InstitutionSettings institutions={institutions} />
                            </TabsContent>
                            
                            <TabsContent value="categories" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                                <CategorySettings categories={categories} />
                            </TabsContent>
                            
                            <TabsContent value="payments" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                                <PaymentMethodSettings paymentMethods={paymentMethods} />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
