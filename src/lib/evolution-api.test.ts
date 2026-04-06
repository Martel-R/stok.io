import { EvolutionApiService } from './evolution-api';
import { EvolutionApiConfig } from './types';

// Mock fetch globally
global.fetch = jest.fn();

describe('EvolutionApiService', () => {
    const mockConfig: EvolutionApiConfig = {
        enabled: true,
        apiUrl: 'https://api.test.com/',
        apiKey: 'test-api-key',
        instanceName: 'test-instance'
    };

    let service: EvolutionApiService;

    beforeEach(() => {
        service = new EvolutionApiService(mockConfig);
        (global.fetch as jest.Mock).mockClear();
    });

    it('should test connection successfully', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ instance: { state: 'open' } })
        });

        const result = await service.testConnection();
        
        expect(result.success).toBe(true);
        expect(result.state).toBe('open');
        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.test.com/instance/connectionState/test-instance',
            expect.objectContaining({
                method: 'GET',
                headers: expect.objectContaining({
                    'apikey': 'test-api-key'
                })
            })
        );
    });

    it('should create an instance', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true })
        });

        const result = await service.createInstance('new-instance');
        
        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.test.com/instance/create',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    instanceName: 'new-instance',
                    number: undefined,
                    qrcode: true,
                    integration: "WHATSAPP-BAILEYS"
                })
            })
        );
    });

    it('should set webhook successfully', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true })
        });

        const result = await service.setWebhook('https://webhook.com');
        
        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.test.com/webhook/set/test-instance',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('https://webhook.com')
            })
        );
    });

    it('should send a text message', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ key: { id: 'msg-id' } })
        });

        const result = await service.sendText('5511999999999', 'Hello');
        
        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledWith(
            'https://api.test.com/message/sendText/test-instance',
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('5511999999999')
            })
        );
    });
});
