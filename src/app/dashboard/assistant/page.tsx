
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { answerInventoryQuestion } from '@/ai/flows/answer-inventory-questions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2, Lock } from 'lucide-react';
import type { Product, Sale, StockEntry } from '@/lib/types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

export default function AssistantPage() {
  const { user, currentBranch } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [inventoryContext, setInventoryContext] = useState('');

  const hasAccess = user?.role === 'admin' || user?.role === 'manager';

  useEffect(() => {
      if (!hasAccess || !currentBranch) return;

      const productsQuery = query(collection(db, 'products'), where('branchId', '==', currentBranch.id));
      const salesQuery = query(collection(db, 'sales'), where('branchId', '==', currentBranch.id));
      const stockEntriesQuery = query(collection(db, 'stockEntries'), where('branchId', '==', currentBranch.id));

      const unsubProducts = onSnapshot(productsQuery, (productsSnapshot) => {
          const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
          
          const unsubSales = onSnapshot(salesQuery, (salesSnapshot) => {
              const salesData = salesSnapshot.docs.map(doc => doc.data() as Sale);
              
              const unsubEntries = onSnapshot(stockEntriesQuery, (entriesSnapshot) => {
                  const entriesData = entriesSnapshot.docs.map(doc => doc.data() as StockEntry);

                  const context = productsData.map(product => {
                      const totalEntries = entriesData.filter(e => e.productId === product.id).reduce((sum, e) => sum + e.quantityAdded, 0);
                      const totalSales = salesData.filter(s => s.productId === product.id).reduce((sum, s) => sum + s.quantity, 0);
                      const stock = totalEntries - totalSales;
                      return `${product.name}: ${stock} unidades`;
                  }).join(', ');
                  setInventoryContext(context);
              });
              return unsubEntries;
          });
          return unsubSales;
      });
      return () => unsubProducts();
  }, [hasAccess, currentBranch]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !hasAccess) return;

    const userMessage: Message = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const fullQuestion = `Dado o contexto do estoque: [${inventoryContext}], responda à seguinte pergunta: ${input}`;

      const response = await answerInventoryQuestion({ question: fullQuestion });
      const botMessage: Message = { sender: 'bot', text: response.answer };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        sender: 'bot',
        text: 'Desculpe, encontrei um erro. Por favor, tente novamente.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
        <div className="flex h-full items-center justify-center">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2"><Lock /> Acesso Negado</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Este recurso está disponível apenas para as funções de Administrador e Gerente.</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <Card className="flex-grow flex flex-col">
        <CardHeader>
            <CardTitle>Oráculo AI</CardTitle>
            <CardDescription>Faça perguntas sobre seu estoque.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 ${message.sender === 'user' ? 'justify-end' : ''}`}
                >
                  {message.sender === 'bot' && (
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`max-w-xs rounded-lg p-3 text-sm ${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {message.text}
                  </div>
                   {message.sender === 'user' && (
                    <Avatar className="h-8 w-8">
                       <AvatarImage src={user?.avatar} />
                       <AvatarFallback>{user?.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>IA</AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg p-3 flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin"/>
                    </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
        <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2 p-4 border-t">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: Quantos Laptops Quânticos há em estoque?"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </Card>
    </div>
  );
}
