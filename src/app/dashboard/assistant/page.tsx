

'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { answerBusinessQuestion, AnswerBusinessQuestionOutput } from '@/ai/flows/answer-business-questions';
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
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import ReactMarkdown from 'react-markdown';

interface Message {
  sender: 'user' | 'bot';
  text: string;
  chart?: AnswerBusinessQuestionOutput['chart'];
}

const convertDate = (field: any) => field instanceof Timestamp ? field.toDate() : new Date();

function BotMessage({ message }: { message: Message }) {
    if (!message.text) return null;
    return (
        <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8">
                <AvatarFallback>AI</AvatarFallback>
            </Avatar>
            <div className="max-w-xl rounded-lg p-3 bg-muted space-y-4">
                <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{message.text}</ReactMarkdown>
                </div>
                {message.chart && message.chart.data && message.chart.data.length > 0 && (
                     <div className="h-64 w-full">
                        <h4 className="text-sm font-semibold text-center mb-2">{message.chart.title}</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={message.chart.data}>
                                <XAxis dataKey={message.chart.nameKey} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <Tooltip
                                    cursor={{fill: 'hsl(var(--muted))'}}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        borderColor: 'hsl(var(--border))',
                                    }}
                                />
                                <Bar dataKey={message.chart.dataKey} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}

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
      const productsQuery = query(collection(db, 'products'), where('branchId', '==', branchId));
      unsubs.push(onSnapshot(productsQuery, (s) => 
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
      let productsData: Product[] = [];
      let entriesData: StockEntry[] = [];

      const generateInventoryContext = () => {
          if (productsData.length === 0) return;
          const context = productsData.map(product => {
              const stock = entriesData
                .filter(e => e.productId === product.id)
                .reduce((sum, e) => sum + e.quantity, 0);
              return `${product.name}: ${stock} unidades`;
          }).join(', ');
          setInventoryContext(context);
      };

      const stockEntriesQuery = query(collection(db, 'stockEntries'), where('branchId', '==', branchId));
      const unsubEntries = onSnapshot(stockEntriesQuery, (entriesSnapshot) => {
          entriesData = entriesSnapshot.docs.map(doc => doc.data() as StockEntry);
          generateInventoryContext();
      });

      const unsubStockProducts = onSnapshot(stockProductsQuery, (productsSnapshot) => {
          productsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
          generateInventoryContext();
      });
      
      unsubs.push(unsubStockProducts);
      unsubs.push(unsubEntries);
      
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
        currentDate: format(new Date(), 'dd/MM/yyyy'),
        productsContext,
        servicesContext,
        customersContext,
        appointmentsContext,
        inventoryContext,
        salesContext,
        paymentConditionsContext,
      });
      const botMessage: Message = { sender: 'bot', text: response.answer, chart: response.chart };
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
                <div key={index}>
                    {message.sender === 'user' ? (
                         <div className="flex items-start gap-3 justify-end">
                            <div className="max-w-md rounded-lg p-3 text-sm bg-primary text-primary-foreground">
                                {message.text}
                            </div>
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={user?.avatar} />
                                <AvatarFallback>{user?.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                        </div>
                    ) : (
                       <BotMessage message={message} />
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
