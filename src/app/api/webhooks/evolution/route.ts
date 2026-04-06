import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { event, instance, data } = body;

        // O nome da instância segue o padrão: organizacao-unidade
        const instanceName = instance;
        
        // Vamos extrair o ID da organização do nome da instância (se possível)
        // Ou buscar qual organização tem essa instância configurada
        const orgsRef = collection(db, 'organizations');
        const q = query(orgsRef, where('evolutionApiConfig.instanceName', '==', instanceName));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return NextResponse.json({ error: 'Organization not found for this instance' }, { status: 404 });
        }

        const orgDoc = querySnapshot.docs[0];
        const organizationId = orgDoc.id;

        // Tratar eventos de mensagens
        if (event === 'messages.upsert' || event === 'messages.update') {
            const message = data.message || data;
            const remoteJid = message.key?.remoteJid;
            
            if (!remoteJid) return NextResponse.json({ ok: true });

            // Referência para a conversa no Firestore
            // Caminho: organizations/{orgId}/chats/{jid}
            const chatRef = doc(db, 'organizations', organizationId, 'chats', remoteJid);
            
            // Atualiza ou cria a conversa com a última mensagem
            await setDoc(chatRef, {
                lastMessage: message,
                updatedAt: serverTimestamp(),
                remoteJid: remoteJid,
                pushName: message.pushName || 'Desconhecido',
                unreadCount: event === 'messages.upsert' && !message.key.fromMe ? 1 : 0
            }, { merge: true });

            // Salva a mensagem na sub-coleção de mensagens para histórico
            const messageRef = doc(collection(db, 'organizations', organizationId, 'chats', remoteJid, 'messages'), message.key.id);
            await setDoc(messageRef, {
                ...message,
                timestamp: serverTimestamp(),
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('Webhook Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
