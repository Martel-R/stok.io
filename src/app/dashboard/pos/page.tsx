'use client';
import { useState } from 'react';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import type { Product } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, X } from 'lucide-react';
import Image from 'next/image';

interface CartItem extends Product {
  quantity: number;
}

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existingItem = prev.find((item) => item.id === product.id);
      if (existingItem) {
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
  
  const handleCheckout = () => {
      if (cart.length === 0) {
          toast({ title: 'Empty Cart', description: 'Please add items to the cart before checkout.', variant: 'destructive'});
          return;
      }
      toast({ title: 'Checkout Successful!', description: `Total: $${grandTotal.toFixed(2)}`});
      setCart([]);
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] md:grid-cols-3 gap-8">
      <div className="md:col-span-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Products</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-16rem)]">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {MOCK_PRODUCTS.map((product) => (
                  <Card key={product.id} onClick={() => addToCart(product)} className="cursor-pointer hover:shadow-lg transition-shadow">
                    <CardContent className="p-2 flex flex-col items-center justify-center">
                       <Image src={product.imageUrl} alt={product.name} width={150} height={150} className="rounded-md" data-ai-hint="product image"/>
                      <p className="font-semibold text-sm mt-2 text-center">{product.name}</p>
                      <p className="text-xs text-muted-foreground">${product.price.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      
      <div className="md:col-span-1">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Cart</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <ScrollArea className="h-[calc(100vh-25rem)]">
                {cart.length === 0 ? (
                    <p className="text-muted-foreground text-center">Cart is empty</p>
                ) : (
                    <div className="space-y-4">
                        {cart.map(item => (
                            <div key={item.id} className="flex justify-between items-center">
                                <div>
                                    <p className="font-medium">{item.name}</p>
                                    <p className="text-sm text-muted-foreground">${item.price.toFixed(2)} x {item.quantity}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold">${(item.price * item.quantity).toFixed(2)}</p>
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
          <CardFooter className="flex-col !p-6">
             <div className="w-full space-y-2">
                 <div className="flex justify-between"><p>Subtotal</p><p>${total.toFixed(2)}</p></div>
                 <div className="flex justify-between"><p>Tax (8%)</p><p>${tax.toFixed(2)}</p></div>
                 <Separator />
                 <div className="flex justify-between font-bold text-lg"><p>Total</p><p>${grandTotal.toFixed(2)}</p></div>
             </div>
             <Button className="w-full mt-4" size="lg" onClick={handleCheckout}>
                 <CreditCard className="mr-2 h-4 w-4" /> Checkout
             </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
