import { EvolutionApiConfig } from './types';

export class EvolutionApiService {
    private config: EvolutionApiConfig;

    constructor(config: EvolutionApiConfig) {
        this.config = config;
    }

    private get headers() {
        return {
            'Content-Type': 'application/json',
            'apikey': this.config.apiKey
        };
    }

    private get baseUrl() {
        return this.config.apiUrl.replace(/\/$/, '');
    }

    async testConnection(): Promise<{ success: boolean; state?: string; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/instance/connectionState/${this.config.instanceName}`, {
                method: 'GET',
                headers: this.headers,
            });

            const data = await response.json();

            if (response.ok) {
                return { 
                    success: true, 
                    state: data.instance?.state || 'UNKNOWN' 
                };
            } else {
                return { 
                    success: false, 
                    error: data.message || 'Instância não encontrada ou erro na API' 
                };
            }
        } catch (error: any) {
            console.error('Evolution API Connection Error:', error);
            return { 
                success: false, 
                error: error.message || 'Erro de rede ou URL inválida' 
            };
        }
    }

    async fetchChats(): Promise<any[]> {
        try {
            const response = await fetch(`${this.baseUrl}/chat/fetchChats/${this.config.instanceName}`, {
                method: 'GET',
                headers: this.headers,
            });
            const data = await response.json();
            return Array.isArray(data) ? data : (data.chats || []);
        } catch (error) {
            console.error('Error fetching chats:', error);
            return [];
        }
    }

    async fetchMessages(remoteJid: string): Promise<any[]> {
        try {
            const response = await fetch(`${this.baseUrl}/chat/fetchMessages/${this.config.instanceName}?remoteJid=${remoteJid}`, {
                method: 'GET',
                headers: this.headers,
            });
            const data = await response.json();
            return Array.isArray(data) ? data : (data.messages?.all || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    }

    async sendText(number: string, text: string): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/message/sendText/${this.config.instanceName}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    number: number,
                    options: {
                        delay: 1200,
                        presence: 'composing',
                        linkPreview: false
                    },
                    textMessage: {
                        text: text
                    }
                })
            });
            const data = await response.json();
            if (response.ok) {
                return { success: true, data };
            } else {
                return { success: false, error: data.message || 'Erro ao enviar mensagem' };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async createInstance(instanceName: string, number?: string): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/instance/create`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    instanceName: instanceName,
                    number: number,
                    qrcode: true,
                    integration: "WHATSAPP-BAILEYS"
                })
            });

            const data = await response.json();
            if (response.ok) {
                return { success: true, data };
            } else {
                return { success: false, error: data.message || 'Erro ao criar instância' };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async connectInstance(instanceName: string): Promise<{ success: boolean; base64?: string; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/instance/connect/${instanceName}`, {
                method: 'GET',
                headers: this.headers,
            });

            const data = await response.json();
            if (response.ok) {
                return { success: true, base64: data.base64 };
            } else {
                return { success: false, error: data.message || 'Erro ao conectar/gerar QR Code' };
            }
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async setWebhook(webhookUrl: string): Promise<{ success: boolean; error?: string; raw?: any }> {
        try {
            console.log(`Configurando Webhook na Evolution para: ${webhookUrl}`);
            const response = await fetch(`${this.baseUrl}/webhook/set/${this.config.instanceName}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    url: webhookUrl,
                    enabled: true,
                    webhookByEvents: true,
                    events: [
                        "MESSAGES_UPSERT",
                        "MESSAGES_UPDATE",
                        "MESSAGES_DELETE",
                        "SEND_MESSAGE",
                        "CONNECTION_UPDATE"
                    ]
                })
            });

            const data = await response.json();
            if (response.ok) {
                console.log('Webhook configurado com sucesso:', data);
                return { success: true, raw: data };
            } else {
                console.error('Erro na resposta da Evolution ao setar Webhook:', data);
                return { success: false, error: data.message || 'Erro ao configurar webhook', raw: data };
            }
        } catch (error: any) {
            console.error('Erro de rede ao setar Webhook:', error);
            return { success: false, error: error.message };
        }
    }

    async logoutInstance(instanceName: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/instance/logout/${instanceName}`, {
                method: 'DELETE',
                headers: this.headers,
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async deleteInstance(instanceName: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/instance/delete/${instanceName}`, {
                method: 'DELETE',
                headers: this.headers,
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
