

'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { answerBusinessQuestion } from '@/ai/flows/answer-business-questions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2, Lock } from 'lucide-react';
import type { Product, Service, Customer, Appointment, StockEntry, Sale, PaymentCondition } from '@/lib/types';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

const convertDate = (field: any) => field instanceof Timestamp ? field.toDate() : new Date();

export default function AssistantPage() {
  const { user, currentBranch } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // State for all contexts
  const [productsContext, setProductsContext] = useState('');
  const [servicesContext, setServicesContext] = useState('');
  const [customersContext, setCustomersContext] = useState('');
  const [appointmentsContext, setAppointmentsContext] = useState('');
  const [inventoryContext, setInventoryContext] = useState('');
  const [salesContext, setSalesContext] = useState('');
  const [paymentConditionsContext, setPaymentConditionsContext] = useState('');

  const hasAccess = user?.enabledModules?.assistant?.view ?? false;

  useEffect(() => {
      if (!hasAccess || !currentBranch || !user?.organizationId) return;

      const unsubs: (()=>void)[] = [];
      const orgId = user.organizationId;
      const branchId = currentBranch.id;

      // Products
      unsubs.push(onSnapshot(query(collection(db, 'products'), where('branchId', '==', branchId)), (s) => 
        setProductsContext(JSON.stringify(s.docs.map(d => d.data()).map(({name, category, price}) => ({name, category, price}))))));

      // Services
      unsubs.push(onSnapshot(query(collection(db, 'services'), where('organizationId', '==', orgId)), (s) => 
        setServicesContext(JSON.stringify(s.docs.map(d => d.data()).map(({name, price, duration}) => ({name, price, duration})))))
      );
      
      // Customers
      unsubs.push(onSnapshot(query(collection(db, 'customers'), where('organizationId', '==', orgId)), (s) => 
        setCustomersContext(JSON.stringify(s.docs.map(d => d.data()).map(({name, email, phone}) => ({name, email, phone})))))
      );

      // Appointments
      unsubs.push(onSnapshot(query(collection(db, 'appointments'), where('branchId', '==', branchId)), (s) => {
          const data = s.docs.map(d => ({...d.data(), start: convertDate(d.data().start)}));
          setAppointmentsContext(JSON.stringify(data.map(({customerName, serviceName, professionalName, start, status}) => ({
              cliente: customerName, 
              servico: serviceName,
              professional: professionalName,
              data: format(start, 'dd/MM/yyyy HH:mm'),
              status
          }))));
      }));
      
      // Inventory
      const stockProductsQuery = query(collection(db, 'products'), where('branchId', '==', branchId));
      unsubs.push(onSnapshot(stockProductsQuery, (productsSnapshot) => {
          const productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
          const stockEntriesQuery = query(collection(db, 'stockEntries'), where('branchId', '==', branchId));
          unsubs.push(onSnapshot(stockEntriesQuery, (entriesSnapshot) => {
              const entriesData = entriesSnapshot.docs.map(doc => doc.data() as StockEntry);
              const context = productsData.map(product => {
                  const stock = entriesData
                    .filter(e => e.productId === product.id)
                    .reduce((sum, e) => sum + e.quantity, 0);
                  return `${product.name}: ${stock} unidades`;
              }).join(', ');
              setInventoryContext(context);
          }));
      }));
      
      // Sales
      unsubs.push(onSnapshot(query(collection(db, 'sales'), where('branchId', '==', branchId)), (s) => {
          const data = s.docs.map(d => ({...d.data(), date: convertDate(d.data().date)}));
           setSalesContext(JSON.stringify(data.map(({ cashier, total, date, items, payments }) => ({
               vendedor: cashier,
               total: total,
               data: format(date, 'dd/MM/yyyy HH:mm'),
               itens: items.map((i: any) => i.name).join(', '),
               pagamento: payments.map((p: any) => p.conditionName).join(', ')
           }))));
      }));
      
      // Payment Conditions
      unsubs.push(onSnapshot(query(collection(db, 'paymentConditions'), where('organizationId', '==', orgId)), (s) => {
           setPaymentConditionsContext(JSON.stringify(s.docs.map(d => d.data()).map(({name, type, fee}) => ({name, type, fee}))));
      }));


      setDataLoaded(true);
      return () => unsubs.forEach(unsub => unsub());
  }, [hasAccess, currentBranch, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !hasAccess) return;

    const userMessage: Message = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      const response = await answerBusinessQuestion({ 
        question: currentInput,
        productsContext,
        servicesContext,
        customersContext,
        appointmentsContext,
        inventoryContext,
        salesContext,
        paymentConditionsContext,
      });
      const botMessage: Message = { sender: 'bot', text: response.answer };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("AI Error:", error);
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
                    <p>Você não tem permissão para acessar este módulo.</p>
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
            <CardDescription>Faça perguntas sobre seus produtos, serviços, clientes, agenda, vendas e estoque.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground">
                    <p>Olá! O que você gostaria de saber hoje?</p>
                    <p className="text-xs">Ex: "Qual o produto mais vendido?" ou "Resuma as vendas de ontem".</p>
                </div>
              )}
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
                    className={`max-w-md rounded-lg p-3 text-sm ${
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
                        <AvatarFallback>AI</AvatarFallback>
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
            placeholder="Qual sua pergunta?"
            disabled={loading || !dataLoaded}
          />
          <Button type="submit" disabled={loading || !input.trim() || !dataLoaded}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </Card>
    </div>
  );
}

