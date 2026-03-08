"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CategoryChart({ data }: { data: any[] }) {
    if (data.length === 0) {
        return (
            <Card className="col-span-1">
                <CardHeader>
                    <CardTitle className="text-lg">Gastos por Categoria</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground italic">
                    Nenhum dado disponível
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="col-span-1 border-none shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="text-lg font-semibold">Gastos por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                            />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
