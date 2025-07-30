
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

export default function AppointmentsPage() {

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Calendar className="h-10 w-10 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold">Agendamentos</h1>
                    <p className="text-muted-foreground">
                        Visualize e gerencie seus agendamentos.
                    </p>
                </div>
            </div>

             <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Em Breve</CardTitle>
                    <CardDescription>
                        O módulo de agendamentos está em desenvolvimento.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Aqui você poderá visualizar os agendamentos em um calendário, criar novos agendamentos e gerenciar a disponibilidade.</p>
                </CardContent>
            </Card>

        </div>
    )
}
