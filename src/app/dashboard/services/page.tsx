
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Briefcase } from "lucide-react";

export default function ServicesPage() {

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Briefcase className="h-10 w-10 text-primary" />
                <div>
                    <h1 className="text-3xl font-bold">Serviços</h1>
                    <p className="text-muted-foreground">
                        Cadastre e gerencie os serviços oferecidos.
                    </p>
                </div>
            </div>

             <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Em Breve</CardTitle>
                    <CardDescription>
                        O módulo de gestão de serviços está em desenvolvimento.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Aqui você poderá cadastrar os serviços, definir preços, duração e associar profissionais.</p>
                </CardContent>
            </Card>

        </div>
    )
}
