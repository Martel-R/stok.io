
'use client';
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = collection(db, 'products');
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsData: Product[] = [];
      querySnapshot.forEach((doc) => {
        productsData.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(productsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getStockStatus = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive">Sem Estoque</Badge>;
    if (stock < 50) return <Badge variant="secondary" className="bg-yellow-400 text-yellow-900">Estoque Baixo</Badge>;
    return <Badge variant="secondary" className="bg-green-400 text-green-900">Em Estoque</Badge>;
  };

  if (loading) {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Situação do Estoque</h1>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Nível do Estoque</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                            <TableCell className="text-center"><Skeleton className="h-5 w-24 mx-auto" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Situação do Estoque</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Nível do Estoque</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.category}</TableCell>
              <TableCell className="text-right">{product.stock}</TableCell>
              <TableCell className="text-center">{getStockStatus(product.stock)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
