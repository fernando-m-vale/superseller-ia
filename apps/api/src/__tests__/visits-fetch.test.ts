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
});
