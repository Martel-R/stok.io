
'use client';
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Product, Sale } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, X, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';


interface CartItem extends Product {
  quantity: number;
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { toast } = useToast();
  const { user, currentBranch, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !currentBranch) {
        setProducts([]);
        setLoading(true);
        return;
    }

    const q = query(collection(db, 'products'), where('branchId', '==', currentBranch.id));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const productsData: Product[] = [];
      querySnapshot.forEach((doc) => {
        productsData.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(productsData);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching products for POS: ", error);
        toast({ title: "Erro ao carregar produtos", variant: "destructive"});
        setLoading(false);
    });

    return () => unsubscribe();
  }, [currentBranch, authLoading, toast]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
        toast({ title: 'Fora de estoque', description: `${product.name} não está disponível.`, variant: 'destructive'});
        return;
    }
    setCart((prev) => {
      const existingItem = prev.find((item) => item.id === product.id);
      if (existingItem) {
        if (existingItem.quantity >= product.stock) {
            toast({ title: 'Limite de estoque atingido', description: `Você não pode adicionar mais de ${product.stock} unidades de ${product.name}.`, variant: 'destructive'});
            return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };
  
  const removeFromCart = (productId: string) => {
      setCart(cart => cart.filter(item => item.id !== productId));
  }

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const tax = total * 0.08;
  const grandTotal = total + tax;
  
  const handleCheckout = async () => {
      if (cart.length === 0) {
          toast({ title: 'Carrinho Vazio', description: 'Adicione itens ao carrinho antes de finalizar.', variant: 'destructive'});
          return;
      }
      if (!currentBranch || !user) {
          toast({ title: 'Erro de sessão', description: 'Usuário ou filial não encontrados. Faça login novamente.', variant: 'destructive'});
          return;
      }

      setIsCheckingOut(true);

      try {
        const batch = writeBatch(db);
        
        // Prepare sales and update stock
        for (const item of cart) {
            const saleData: Omit<Sale, 'id'> = {
                productName: item.name,
                quantity: item.quantity,
                total: item.price * item.quantity,
                date: new Date(),
                cashier: user.name,
                branchId: currentBranch.id,
            };
            const saleRef = doc(collection(db, "sales"));
            batch.set(saleRef, saleData);

            const productRef = doc(db, "products", item.id);
            const newStock = item.stock - item.quantity;
            batch.update(productRef, { stock: newStock });
        }
        
        await batch.commit();

        toast({ title: 'Compra finalizada com sucesso!', description: `Total: R$${grandTotal.toFixed(2).replace('.', ',')}`});
        setCart([]);

      } catch (error) {
          console.error("Checkout error: ", error);
          toast({ title: 'Erro ao finalizar a compra', description: 'Ocorreu um erro ao atualizar o estoque ou salvar a venda.', variant: 'destructive'});
      } finally {
          setIsCheckingOut(false);
      }
  }

  if (!currentBranch && !authLoading) {
    return (
        <Card className="m-auto">
            <CardHeader>
                <CardTitle>Nenhuma Filial Selecionada</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Por favor, selecione uma filial no topo da página para usar o PDV.</p>
                 <p className="mt-2 text-sm text-muted-foreground">Se você não tiver nenhuma filial, pode criar uma em <Link href="/dashboard/settings?tab=branches" className="underline">Configurações</Link>.</p>
            </CardContent>
        </Card>
    )
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] md:grid-cols-3 gap-8">
      <div className="md:col-span-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Produtos</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Card key={i}>
                       <CardContent className="p-2 flex flex-col items-center justify-center">
                          <Skeleton className="h-[100px] w-[100px] rounded-md" />
                          <Skeleton className="h-4 w-24 mt-2"/>
                          <Skeleton className="h-3 w-16 mt-1"/>
                       </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {products.map((product) => (
                    <Card 
                      key={product.id} 
                      onClick={() => addToCart(product)} 
                      className="cursor-pointer hover:shadow-lg transition-shadow relative"
                    >
                      {product.stock === 0 && <Badge variant="destructive" className="absolute top-1 right-1">Esgotado</Badge>}
                      <CardContent className="p-2 flex flex-col items-center justify-center">
                         <Image src={product.imageUrl} alt={product.name} width={100} height={100} className="rounded-md object-cover aspect-square" data-ai-hint="product image"/>
                        <p className="font-semibold text-sm mt-2 text-center">{product.name}</p>
                        <p className="text-xs text-muted-foreground">R${product.price.toFixed(2).replace('.', ',')}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      
      <div className="md:col-span-1">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Carrinho</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <ScrollArea className="h-[calc(100vh-25rem)]">
                {cart.length === 0 ? (
                    <p className="text-muted-foreground text-center">O carrinho está vazio</p>
                ) : (
                    <div className="space-y-4">
                        {cart.map(item => (
                            <div key={item.id} className="flex justify-between items-center">
                                <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">R${item.price.toFixed(2).replace('.', ',')} x {item.quantity}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold">R${(item.price * item.quantity).toFixed(2).replace('.', ',')}</p>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFromCart(item.id)}>
                                        <X className="h-4 w-4"/>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex-col !p-6 border-t">
             <div className="w-full space-y-2">
                 <div className="flex justify-between"><p>Subtotal</p><p>R${total.toFixed(2).replace('.', ',')}</p></div>
                 <div className="flex justify-between"><p>Imposto (8%)</p><p>R${tax.toFixed(2).replace('.', ',')}</p></div>
                 <Separator />
                 <div className="flex justify-between font-bold text-lg"><p>Total</p><p>R${grandTotal.toFixed(2).replace('.', ',')}</p></div>
             </div>
             <Button className="w-full mt-4" size="lg" onClick={handleCheckout} disabled={isCheckingOut}>
                 {isCheckingOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                 Finalizar Compra
             </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
