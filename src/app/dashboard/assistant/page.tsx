'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { answerInventoryQuestion } from '@/ai/flows/answer-inventory-questions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2, Lock } from 'lucide-react';
import { MOCK_PRODUCTS } from '@/lib/mock-data';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

export default function AssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const hasAccess = user?.role === 'admin' || user?.role === 'manager';

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !hasAccess) return;

    const userMessage: Message = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // In a real app, you would dynamically provide context based on the question.
      // Here, we provide a summary of all products as context.
      const inventoryContext = MOCK_PRODUCTS.map(p => `${p.name}: ${p.stock} units`).join(', ');
      const fullQuestion = `Given the inventory context: [${inventoryContext}], answer the following question: ${input}`;

      const response = await answerInventoryQuestion({ question: fullQuestion });
      const botMessage: Message = { sender: 'bot', text: response.answer };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        sender: 'bot',
        text: 'Sorry, I encountered an error. Please try again.',
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
                    <CardTitle className="flex items-center justify-center gap-2"><Lock /> Access Denied</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>This feature is only available to Admin and Manager roles.</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <Card className="flex-grow flex flex-col">
        <CardHeader>
            <CardTitle>AI Assistant</CardTitle>
            <CardDescription>Ask questions about your inventory.</CardDescription>
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
            placeholder="e.g., How many Quantum Laptops are in stock?"
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
