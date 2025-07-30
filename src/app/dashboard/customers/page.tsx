
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function CustomersPage() {

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Users className="h-10 w-10 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold">Clientes</h1>
                    <p className="text-muted-foreground">
                        Gerencie seus clientes e o acesso deles ao sistema.
                    </p>
                </div>
            </div>

             <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Em Breve</CardTitle>
                    <CardDescription>
                        O módulo de gestão de clientes está em desenvolvimento.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Aqui você poderá cadastrar, pesquisar, editar e gerenciar todos os seus clientes.</p>
                </CardContent>
            </Card>

        </div>
    )
}
