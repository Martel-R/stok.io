
'use client';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, Sale } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { format, startOfDay } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface StockMovement {
  date: string;
  productId: string;
  productName: string;
  category: string;
  initialStock: number;
  sales: number;
  finalStock: number;
}

export default function InventoryPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentBranch, loading: authLoading } = useAuth();
  const [lowStockThreshold, setLowStockThreshold] = useState(50);

  useEffect(() => {
    // In a real app, this value would be fetched from a global settings context or Firestore.
    // For now, we read from localStorage to make the setting work.
    const storedThreshold = localStorage.getItem('lowStockThreshold');
    if (storedThreshold) {
      setLowStockThreshold(parseInt(storedThreshold, 10));
    }
  }, []);

  useEffect(() => {
    if (authLoading || !currentBranch) {
      setLoading(true);
      return;
    }

    const productsQuery = query(collection(db, 'products'), where('branchId', '==', currentBranch.id));
    const salesQuery = query(collection(db, 'sales'), where('branchId', '==', currentBranch.id));

    const unsubscribeProducts = onSnapshot(productsQuery, (productsSnapshot) => {
      const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

      const unsubscribeSales = onSnapshot(salesQuery, (salesSnapshot) => {
        const salesData = salesSnapshot.docs.map(doc => {
            const data = doc.data();
            const date = data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date);
            return { id: doc.id, ...data, date } as Sale;
        });

        const processedMovements = processStockMovements(productsData, salesData);
        setMovements(processedMovements);
        setLoading(false);
      });

      return () => unsubscribeSales();
    });

    return () => unsubscribeProducts();

  }, [currentBranch, authLoading]);

  const processStockMovements = (products: Product[], sales: Sale[]): StockMovement[] => {
    const salesByProductAndDate: Record<string, Record<string, number>> = {};

    sales.forEach(sale => {
      const dateStr = format(startOfDay(sale.date), 'yyyy-MM-dd');
      const product = products.find(p => p.name === sale.productName); // Linking by name, not ideal but works for now
      if (product) {
        if (!salesByProductAndDate[product.id]) {
          salesByProductAndDate[product.id] = {};
        }
        if (!salesByProductAndDate[product.id][dateStr]) {
          salesByProductAndDate[product.id][dateStr] = 0;
        }
        salesByProductAndDate[product.id][dateStr] += sale.quantity;
      }
    });

    const allMovements: StockMovement[] = [];
    Object.entries(salesByProductAndDate).forEach(([productId, salesByDate]) => {
      const product = products.find(p => p.id === productId);
      if (product) {
        Object.entries(salesByDate).forEach(([dateStr, totalSales]) => {
          // This is a simplified logic. A real implementation would need historical stock entries.
          // For now, initial stock is current stock + sales for that day.
          const finalStock = product.stock; 
          const initialStock = finalStock + totalSales;

          allMovements.push({
            date: format(new Date(dateStr), 'dd/MM/yyyy'),
            productId: product.id,
            productName: product.name,
            category: product.category,
            initialStock: initialStock,
            sales: totalSales,
            finalStock: finalStock,
          });
        });
      }
    });

    // Sort by date descending
    return allMovements.sort((a, b) => new Date(b.date.split('/').reverse().join('-')).getTime() - new Date(a.date.split('/').reverse().join('-')).getTime());
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive">Sem Estoque</Badge>;
    if (stock <= lowStockThreshold) return <Badge variant="secondary" className="bg-yellow-400 text-yellow-900">Estoque Baixo</Badge>;
    return <Badge variant="secondary" className="bg-green-400 text-green-900">Em Estoque</Badge>;
  };
  
  if (!currentBranch && !authLoading) {
    return (
        <Card className="m-auto">
            <CardHeader>
                <CardTitle>Nenhuma Filial Selecionada</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Por favor, selecione uma filial no topo da página para ver o relatório de estoque.</p>
                <p className="mt-2 text-sm text-muted-foreground">Se você não tiver nenhuma filial, pode criar uma em <Link href="/dashboard/settings?tab=branches" className="underline">Configurações</Link>.</p>
            </CardContent>
        </Card>
    )
  }


  if (loading || authLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Relatório de Movimentação de Estoque</h1>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Qtd. Inicial</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Qtd. Final</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Relatório de Movimentação de Estoque</h1>
      {movements.length > 0 ? (
        <Table>
            <TableHeader>
            <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Qtd. Inicial</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Qtd. Final</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {movements.map((item, index) => (
                <TableRow key={`${item.productId}-${item.date}-${index}`}>
                <TableCell>{item.date}</TableCell>
                <TableCell className="font-medium">{item.productName}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell>{getStockStatus(item.finalStock)}</TableCell>
                <TableCell className="text-right">{item.initialStock}</TableCell>
                <TableCell className="text-right text-red-500">-{item.sales}</TableCell>
                <TableCell className="text-right font-semibold">{item.finalStock}</TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
      ) : (
         <Card>
            <CardContent className="p-6 text-center">
                 <p className="text-muted-foreground">Nenhuma movimentação de estoque registrada para esta filial ainda.</p>
                 <p className="text-sm text-muted-foreground mt-1">Realize vendas no PDV para ver os dados aqui.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

