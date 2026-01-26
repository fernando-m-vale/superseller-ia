import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { MercadoLivreVisitsService } from '../services/MercadoLivreVisitsService';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    listing: {
      findMany: vi.fn(),
    },
    listingMetricsDaily: {
      upsert: vi.fn(),
    },
    marketplaceConnection: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  })),
  Marketplace: {
    mercadolivre: 'mercadolivre',
  },
  ListingStatus: {
    active: 'active',
  },
}));

describe('MercadoLivreVisitsService.fetchVisitsTimeWindow', () => {
  let service: MercadoLivreVisitsService;
  const mockAccessToken = 'mock-token';
  const mockConnectionId = 'mock-connection-id';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MercadoLivreVisitsService('test-tenant');
    // Mock private properties via any
    (service as any).accessToken = mockAccessToken;
    (service as any).connectionId = mockConnectionId;
    (service as any).executeWithRetryOn401 = async (fn: () => Promise<any>) => fn();
  });

  it('deve retornar ok:true com visits quando API retorna 200 e payload em formato visits', async () => {
    const mockResponse = {
      status: 200,
      data: {
        visits: [
          { date: '2024-01-01', visits: 10 },
          { date: '2024-01-02', visits: 15 },
        ],
      },
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const result = await service.fetchVisitsTimeWindow('MLB123', 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.visits).toHaveLength(2);
      expect(result.visits[0]).toEqual({ date: '2024-01-01', visits: 10 });
      expect(result.visits[1]).toEqual({ date: '2024-01-02', visits: 15 });
      expect(result.rawShape).toBe('visits');
    }
  });

  it('deve retornar ok:true com visits quando API retorna 200 e payload em formato results', async () => {
    const mockResponse = {
      status: 200,
      data: {
        results: [
          { date: '2024-01-01', visits: 5 },
          { date: '2024-01-02', visits: 8 },
        ],
      },
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const result = await service.fetchVisitsTimeWindow('MLB123', 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.visits).toHaveLength(2);
      expect(result.rawShape).toBe('results');
    }
  });

  it('deve retornar ok:false com RATE_LIMIT quando API retorna 429', async () => {
    const mockError = {
      isAxiosError: true,
      response: {
        status: 429,
        data: { message: 'Too many requests' },
      },
      code: undefined,
      message: 'Request failed with status code 429',
    };

    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValueOnce(mockError);

    const result = await service.fetchVisitsTimeWindow('MLB123', 2);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.errorType).toBe('RATE_LIMIT');
      expect(result.message).toContain('429');
    }
  });

  it('deve retornar ok:false com FORBIDDEN quando API retorna 403', async () => {
    const mockError = {
      isAxiosError: true,
      response: {
        status: 403,
        data: { message: 'Forbidden' },
      },
      code: undefined,
      message: 'Request failed with status code 403',
    };

    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValueOnce(mockError);

    const result = await service.fetchVisitsTimeWindow('MLB123', 2);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.errorType).toBe('FORBIDDEN');
      expect(result.message).toContain('403');
    }
  });

  it('deve retornar ok:false com TIMEOUT quando request timeout', async () => {
    const mockError = {
      isAxiosError: true,
      response: undefined,
      code: 'ECONNABORTED',
      message: 'timeout of 5000ms exceeded',
    };

    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValueOnce(mockError);

    const result = await service.fetchVisitsTimeWindow('MLB123', 2);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorType).toBe('TIMEOUT');
      expect(result.message).toContain('Timeout');
    }
  });

  it('deve retornar ok:false com SERVER_ERROR quando API retorna 500', async () => {
    const mockError = {
      isAxiosError: true,
      response: {
        status: 500,
        data: { message: 'Internal server error' },
      },
      code: undefined,
      message: 'Request failed with status code 500',
    };

    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValueOnce(mockError);

    const result = await service.fetchVisitsTimeWindow('MLB123', 2);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.errorType).toBe('SERVER_ERROR');
    }
  });

  it('deve retornar ok:false com UNAUTHORIZED quando API retorna 401 após retry', async () => {
    const mockError = {
      isAxiosError: true,
      response: {
        status: 401,
        data: { message: 'Unauthorized' },
      },
      code: undefined,
      message: 'Request failed with status code 401',
    };

    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.get.mockRejectedValueOnce(mockError);

    // Mock executeWithRetryOn401 para lançar erro após retry
    (service as any).executeWithRetryOn401 = async (fn: () => Promise<any>) => {
      try {
        return await fn();
      } catch (error) {
        throw error; // Propagar erro
      }
    };

    const result = await service.fetchVisitsTimeWindow('MLB123', 2);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.errorType).toBe('UNAUTHORIZED');
    }
  });

  it('deve retornar ok:true quando API retorna 200 e payload em formato array direto', async () => {
    const mockResponse = {
      status: 200,
      data: [
        { date: '2024-01-01', visits: 3 },
        { date: '2024-01-02', visits: 7 },
      ],
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const result = await service.fetchVisitsTimeWindow('MLB123', 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.visits).toHaveLength(2);
      expect(result.rawShape).toBe('array');
    }
  });

  it('deve retornar ok:true e extrair visitas do formato real do ML (results com total e visits_detail)', async () => {
    const mockResponse = {
      status: 200,
      data: {
        results: [
          { 
            date: '2026-01-22T00:00:00Z', 
            total: 28, 
            visits_detail: [{ company: 'mercadolibre', quantity: 28 }] 
          },
          { 
            date: '2026-01-21T00:00:00Z', 
            total: 12, 
            visits_detail: [{ company: 'mercadolibre', quantity: 12 }] 
          },
          { 
            date: '2026-01-20T00:00:00Z', 
            total: 0, 
            visits_detail: [] 
          },
        ],
      },
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const result = await service.fetchVisitsTimeWindow('MLB123', 3);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe(200);
      expect(result.visits).toHaveLength(3);
      expect(result.rawShape).toBe('results');
      
      // Validar valores numéricos corretos (não zero)
      expect(result.visits[0].visits).toBe(28);
      expect(result.visits[1].visits).toBe(12);
      expect(result.visits[2].visits).toBe(0); // total=0 é válido
      
      // Validar normalização de datas para YYYY-MM-DD
      expect(result.visits[0].date).toBe('2026-01-22');
      expect(result.visits[1].date).toBe('2026-01-21');
      expect(result.visits[2].date).toBe('2026-01-20');
    }
  });

  it('deve usar entry.visits quando disponível (prioridade sobre total)', async () => {
    const mockResponse = {
      status: 200,
      data: {
        results: [
          { 
            date: '2026-01-22T00:00:00Z', 
            visits: 50, // Prioridade 1
            total: 28, 
            visits_detail: [{ company: 'mercadolibre', quantity: 28 }] 
          },
        ],
      },
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const result = await service.fetchVisitsTimeWindow('MLB123', 1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.visits[0].visits).toBe(50); // Deve usar visits, não total
    }
  });

  it('deve somar visits_detail.quantity quando total não existe', async () => {
    const mockResponse = {
      status: 200,
      data: {
        results: [
          { 
            date: '2026-01-22T00:00:00Z', 
            visits_detail: [
              { company: 'mercadolibre', quantity: 15 },
              { company: 'mercadolivre', quantity: 13 },
            ] 
          },
        ],
      },
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const result = await service.fetchVisitsTimeWindow('MLB123', 1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.visits[0].visits).toBe(28); // 15 + 13
    }
  });

  it('deve ignorar items sem visits, total ou visits_detail válidos', async () => {
    const mockResponse = {
      status: 200,
      data: {
        results: [
          { 
            date: '2026-01-22T00:00:00Z', 
            total: 28, 
            visits_detail: [{ company: 'mercadolibre', quantity: 28 }] 
          },
          { 
            date: '2026-01-21T00:00:00Z', 
            // Sem visits, total ou visits_detail válidos
          },
          { 
            date: '2026-01-20T00:00:00Z', 
            total: 12, 
            visits_detail: [{ company: 'mercadolibre', quantity: 12 }] 
          },
        ],
      },
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const result = await service.fetchVisitsTimeWindow('MLB123', 3);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // Deve ter apenas 2 items (o item sem dados válidos foi ignorado)
      expect(result.visits).toHaveLength(2);
      expect(result.visits[0].visits).toBe(28);
      expect(result.visits[1].visits).toBe(12);
    }
  });

  it('deve normalizar datas ISO para YYYY-MM-DD UTC antes de salvar no map', async () => {
    const mockResponse = {
      status: 200,
      data: {
        results: [
          { 
            date: '2026-01-18T00:00:00Z', 
            total: 25, 
            visits_detail: [{ company: 'mercadolibre', quantity: 25 }] 
          },
          { 
            date: '2026-01-19T12:34:56.789Z', 
            total: 30, 
            visits_detail: [{ company: 'mercadolivre', quantity: 30 }] 
          },
        ],
      },
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const result = await service.fetchVisitsTimeWindow('MLB123', 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.visits).toHaveLength(2);
      
      // Validar que datas foram normalizadas para YYYY-MM-DD (não ISO completo)
      expect(result.visits[0].date).toBe('2026-01-18');
      expect(result.visits[1].date).toBe('2026-01-19');
      
      // Validar que valores foram extraídos corretamente
      expect(result.visits[0].visits).toBe(25);
      expect(result.visits[1].visits).toBe(30);
      
      // Validar que a chave no map seria "2026-01-18" e não "2026-01-18T00:00:00Z"
      // Isso é validado indiretamente pela normalização acima
    }
  });
});
