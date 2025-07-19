'use client';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function InventoryPage() {
  const getStockStatus = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (stock < 50) return <Badge variant="secondary" className="bg-yellow-400 text-yellow-900">Low Stock</Badge>;
    return <Badge variant="secondary" className="bg-green-400 text-green-900">In Stock</Badge>;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Inventory Status</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Stock Level</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MOCK_PRODUCTS.map((product) => (
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
