'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { EvolutionApiService } from '@/lib/evolution-api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Search, Send, Paperclip, MoreVertical, AlertCircle, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, query, orderBy, onSnapshot, doc, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ChatPage() {
    const { user } = useAuth();
    const [chats, setChats] = useState<any[]>([]);
    const [activeChat, setActiveChat] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'not_configured'>('checking');
    const [isChecking, setIsChecking] = useState(false);
    const [sending, setSending] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const config = user?.organization?.evolutionApiConfig;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const checkConnection = useCallback(async () => {
        if (!config?.apiUrl || !config?.apiKey || !config?.instanceName) {
            setConnectionStatus('not_configured');
            return false;
        }

        setIsChecking(true);
        try {
            const api = new EvolutionApiService(config as any);
            const result = await api.testConnection();
            const isConnected = result.success && result.state === 'open';
            setConnectionStatus(isConnected ? 'connected' : 'disconnected');
            return isConnected;
        } catch (error) {
            setConnectionStatus('disconnected');
            return false;
        } finally {
            setIsChecking(false);
        }
    }, [config]);

    // Listen to Chats in Firestore (Real-time from Webhook)
    useEffect(() => {
        if (!user?.organizationId) return;

        const chatsRef = collection(db, 'organizations', user.organizationId, 'chats');
        const q = query(chatsRef, orderBy('updatedAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chatsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setChats(chatsData);
            
            // If we have an active chat, update it with new data from snapshot
            if (activeChat) {
                const updatedActive = chatsData.find(c => c.id === activeChat.id);
                if (updatedActive) setActiveChat(updatedActive);
            }
        });

        return () => unsubscribe();
    }, [user?.organizationId, activeChat?.id]);

    // Listen to Messages in Active Chat (Real-time from Webhook)
    useEffect(() => {
        if (!user?.organizationId || !activeChat) {
            setMessages([]);
            return;
        }

        const messagesRef = collection(db, 'organizations', user.organizationId, 'chats', activeChat.id, 'messages');
        const q = query(messagesRef, orderBy('messageTimestamp', 'asc'), limit(50));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const messagesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(messagesData);
            setTimeout(scrollToBottom, 100);
        });

        return () => unsubscribe();
    }, [user?.organizationId, activeChat?.id]);

    useEffect(() => {
        checkConnection();
    }, [checkConnection]);

    const handleSelectChat = (chat: any) => {
        setActiveChat(chat);
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !activeChat || sending) return;

        setSending(true);
        try {
            const api = new EvolutionApiService(config as any);
            const jid = activeChat.id || activeChat.remoteJid;
            const number = jid.split('@')[0];
            
            await api.sendText(number, newMessage);
            setNewMessage('');
            // No need to manually load, Firestore listener will catch the new message
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setSending(false);
        }
    };

    const getDisplayName = (chat: any) => {
        return chat.pushName || chat.name || chat.id?.split('@')[0] || 'Desconhecido';
    };

    const getAvatarUrl = (chat: any) => {
        return chat.profilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(getDisplayName(chat))}&background=random`;
    };

    if (connectionStatus === 'not_configured') {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-10rem)]">
                <Card className="max-w-md w-full">
                    <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                            <AlertCircle className="h-12 w-12 text-yellow-500" />
                        </div>
                        <CardTitle>WhatsApp não configurado</CardTitle>
                        <CardDescription>
                            Para utilizar o chat, você precisa configurar a integração nas configurações do sistema.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Button asChild>
                            <Link href="/dashboard/settings">Ir para Configurações</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-5rem)] bg-white border rounded-lg overflow-hidden">
            {/* Left Panel: Conversations List */}
            <div className="w-1/3 border-r flex flex-col bg-white">
                <div className="p-4 border-b">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold">Mensagens</h2>
                        <div className="flex items-center gap-2">
                            {connectionStatus === 'connected' ? (
                                <div className="flex items-center text-[10px] text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase font-bold">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" /> On-line
                                </div>
                            ) : (
                                <div className="flex items-center text-[10px] text-red-600 bg-red-50 px-2 py-1 rounded-full uppercase font-bold">
                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5" /> Off-line
                                </div>
                            )}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8" 
                                onClick={checkConnection}
                                disabled={isChecking}
                            >
                                <RefreshCw className={cn("h-4 w-4", isChecking && "animate-spin")} />
                            </Button>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar conversas..." className="pl-8" />
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {chats.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            Nenhuma conversa encontrada. Aguarde novas mensagens ou inicie uma pelo celular.
                        </div>
                    ) : (
                        chats.map((chat) => (
                            <div
                                key={chat.id}
                                className={cn(
                                    'flex items-center p-4 cursor-pointer hover:bg-accent transition-colors border-b',
                                    activeChat?.id === chat.id && 'bg-muted border-l-4 border-l-primary'
                                )}
                                onClick={() => handleSelectChat(chat)}
                            >
                                <Avatar className="h-12 w-12 mr-3 border">
                                    <AvatarImage src={getAvatarUrl(chat)} />
                                    <AvatarFallback>{getDisplayName(chat).substring(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="flex-grow min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <p className="font-semibold truncate text-sm">{getDisplayName(chat)}</p>
                                        <span className="text-[10px] text-muted-foreground ml-2">
                                            {chat.updatedAt?.toDate ? format(chat.updatedAt.toDate(), 'HH:mm', { locale: ptBR }) : ''}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate">
                                        {chat.lastMessage?.message?.conversation || 
                                         chat.lastMessage?.message?.extendedTextMessage?.text || 
                                         'Mídia'}
                                    </p>
                                </div>
                                {chat.unreadCount > 0 && (
                                    <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                                        {chat.unreadCount}
                                    </span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel: Active Chat Window */}
            <div className="w-2/3 flex flex-col bg-[#f0f2f5]">
                {activeChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="flex items-center p-3 border-b bg-white shadow-sm z-10">
                            <Avatar className="h-10 w-10 mr-3 border">
                                <AvatarImage src={getAvatarUrl(activeChat)} />
                                <AvatarFallback>{getDisplayName(activeChat).substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-grow">
                                <p className="font-semibold text-base leading-tight">{getDisplayName(activeChat)}</p>
                                <p className="text-[10px] text-muted-foreground">{activeChat.id}</p>
                            </div>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-grow overflow-y-auto p-4 space-y-2 flex flex-col">
                            {messages.map((msg: any, index) => {
                                const isMe = msg.key?.fromMe;
                                const content = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.content;
                                
                                if (!content) return null;

                                return (
                                    <div 
                                        key={msg.id || index} 
                                        className={cn(
                                            'flex flex-col max-w-[75%]',
                                            isMe ? 'self-end items-end' : 'self-start items-start'
                                        )}
                                    >
                                        <div className={cn(
                                            'rounded-lg px-3 py-1.5 shadow-sm text-sm relative',
                                            isMe ? 'bg-[#d9fdd3] text-foreground rounded-tr-none' : 'bg-white text-foreground rounded-tl-none'
                                        )}>
                                            <p className="whitespace-pre-wrap">{content}</p>
                                            <div className="flex items-center justify-end mt-1 gap-1">
                                                <span className="text-[10px] opacity-50">
                                                    {msg.messageTimestamp ? format(new Date(msg.messageTimestamp * 1000), 'HH:mm') : ''}
                                                </span>
                                                {isMe && (
                                                    <CheckCircle2 className="h-3 w-3 text-blue-500 opacity-70" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <div className="p-3 bg-[#f0f2f5] border-t">
                            <div className="flex items-center gap-2 bg-white rounded-lg p-1.5 shadow-sm">
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground">
                                    <Paperclip className="h-5 w-5" />
                                </Button>
                                <Input
                                    placeholder="Digite uma mensagem..."
                                    className="border-none focus-visible:ring-0 bg-transparent text-sm"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    disabled={connectionStatus !== 'connected' || sending}
                                />
                                <Button 
                                    size="icon" 
                                    className="h-10 w-10 shrink-0" 
                                    onClick={handleSendMessage} 
                                    disabled={connectionStatus !== 'connected' || !newMessage.trim() || sending}
                                >
                                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm">
                            <Send className="h-10 w-10 text-primary opacity-20" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">Seus chats do WhatsApp</h3>
                        <p className="max-w-xs text-sm">
                            Selecione uma conversa ao lado para visualizar as mensagens e começar a responder.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
