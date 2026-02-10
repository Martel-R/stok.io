'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Send, Paperclip, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock Data - Replace with real data later
const conversations = [
    { id: 1, name: 'Ana Silva', lastMessage: 'Ok, obrigada!', time: '10:45', unread: 2, avatar: 'https://placehold.co/100x100.png?text=AS' },
    { id: 2, name: 'Carlos Souza', lastMessage: 'Qual o valor?', time: '10:30', unread: 0, avatar: 'https://placehold.co/100x100.png?text=CS' },
    { id: 3, name: 'Mariana Costa', lastMessage: 'Até amanhã.', time: 'Ontem', unread: 0, avatar: 'https://placehold.co/100x100.png?text=MC' },
];

const messages = {
    1: [
        { id: 1, text: 'Olá, gostaria de marcar um horário.', sender: 'customer', time: '10:40' },
        { id: 2, text: 'Claro, Ana! Para qual serviço seria?', sender: 'agent', time: '10:41' },
        { id: 3, text: 'Massagem relaxante.', sender: 'customer', time: '10:42' },
        { id: 4, text: 'Temos horário amanhã às 14h. Pode ser?', sender: 'agent', time: '10:43' },
        { id: 5, text: 'Pode sim, confirmado!', sender: 'customer', time: '10:44' },
        { id: 6, text: 'Ok, obrigada!', sender: 'customer', time: '10:45' },
    ],
    2: [
        { id: 1, text: 'Oi, tudo bem? Vi um produto no site.', sender: 'customer', time: '10:29' },
        { id: 2, text: 'Qual o valor?', sender: 'customer', time: '10:30' },
    ],
    3: [],
};

export default function ChatPage() {
    const [activeChat, setActiveChat] = useState(conversations[0]);
    const [newMessage, setNewMessage] = useState('');

    const handleSendMessage = () => {
        if (newMessage.trim()) {
            console.log(`Sending to ${activeChat.id}: ${newMessage}`);
            // Logic to send message will be added here
            setNewMessage('');
        }
    };

    return (
        <div className="flex h-[calc(100vh-5rem)]">
            {/* Left Panel: Conversations List */}
            <div className="w-1/3 border-r flex flex-col">
                <div className="p-4 border-b">
                    <h2 className="text-2xl font-bold">Conversas</h2>
                    <div className="relative mt-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Pesquisar conversas..." className="pl-8" />
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {conversations.map((convo) => (
                        <div
                            key={convo.id}
                            className={cn(
                                'flex items-center p-4 cursor-pointer hover:bg-accent',
                                activeChat.id === convo.id && 'bg-muted'
                            )}
                            onClick={() => setActiveChat(convo)}
                        >
                            <Avatar className="h-10 w-10 mr-4">
                                <AvatarImage src={convo.avatar} />
                                <AvatarFallback>{convo.name.substring(0, 2)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-grow">
                                <p className="font-semibold">{convo.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{convo.lastMessage}</p>
                            </div>
                            <div className="flex flex-col items-end text-xs text-muted-foreground">
                                <span>{convo.time}</span>
                                {convo.unread > 0 && (
                                    <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                                        {convo.unread}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel: Active Chat Window */}
            <div className="w-2/3 flex flex-col">
                {/* Chat Header */}
                <div className="flex items-center p-4 border-b">
                    <Avatar className="h-10 w-10 mr-4">
                        <AvatarImage src={activeChat.avatar} />
                        <AvatarFallback>{activeChat.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-grow">
                        <p className="font-semibold text-lg">{activeChat.name}</p>
                        <p className="text-sm text-green-500">Online</p>
                    </div>
                    <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                </div>

                {/* Messages Area */}
                <div className="flex-grow overflow-y-auto p-6 bg-gray-50 space-y-6">
                    {(messages as any)[activeChat.id].map((msg: any) => (
                        <div key={msg.id} className={cn('flex', msg.sender === 'agent' ? 'justify-end' : 'justify-start')}>
                            <div className={cn(
                                'rounded-lg px-4 py-2 max-w-md',
                                msg.sender === 'agent' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            )}>
                                <p>{msg.text}</p>
                                <p className="text-xs text-right mt-1 opacity-70">{msg.time}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Message Input */}
                <div className="p-4 border-t bg-background">
                    <div className="relative">
                        <Input
                            placeholder="Digite uma mensagem..."
                            className="pr-24"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <div className="absolute top-1/2 right-2 -translate-y-1/2 flex items-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Paperclip className="h-4 w-4" /></Button>
                            <Button size="sm" onClick={handleSendMessage}>Enviar <Send className="h-4 w-4 ml-2" /></Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
