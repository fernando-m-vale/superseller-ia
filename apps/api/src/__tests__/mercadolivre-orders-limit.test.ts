import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { MercadoLivreOrdersService } from '../services/MercadoLivreOrdersService';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    orderItem: {
      create: vi.fn(),
    },
    listing: {
      findMany: vi.fn(() => Promise.resolve([])),
    },
    marketplaceConnection: {
      findFirst: vi.fn(() => Promise.resolve({
        id: 'mock-connection-id',
        access_token: 'mock-token',
        provider_account_id: '123456',
        refresh_token: 'mock-refresh-token',
        status: 'active',
        expires_at: new Date(Date.now() + 3600000),
      })),
      findUnique: vi.fn(() => Promise.resolve({
        id: 'mock-connection-id',
        access_token: 'mock-token',
        provider_account_id: '123456',
        refresh_token: 'mock-refresh-token',
        status: 'active',
        expires_at: new Date(Date.now() + 3600000),
      })),
      update: vi.fn(),
    },
  })),
  Marketplace: {
    mercadolivre: 'mercadolivre',
  },
  ConnectionStatus: {
    active: 'active',
  },
  OrderStatus: {
    pending: 'pending',
    paid: 'paid',
    shipped: 'shipped',
    delivered: 'delivered',
    cancelled: 'cancelled',
  },
}));

describe('MercadoLivreOrdersService - Limit Clamp', () => {
  let service: MercadoLivreOrdersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MercadoLivreOrdersService('test-tenant');
  });

  it('deve garantir que fetchOrdersFallback com limit=100 usa limit=51 no request', async () => {
    const mockResponse = {
      status: 200,
      data: {
        results: [],
        paging: {
          total: 0,
          offset: 0,
          limit: 51,
        },
      },
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);
    mockedAxios.isAxiosError = vi.fn(() => false);

    // Mock private methods
    (service as any).accessToken = 'mock-token';
    (service as any).connectionId = 'mock-connection-id';
    (service as any).providerAccountId = '123456';
    (service as any).sellerId = '123456';
    (service as any).executeWithRetryOn401 = async (fn: () => Promise<any>) => fn();

    // Chamar fetchOrdersFallback diretamente com limit=100
    await (service as any).fetchOrdersFallback(100);

    // Verificar que a chamada axios.get usou limit=51 (não 100)
    expect(mockedAxios.get).toHaveBeenCalled();
    const axiosCalls = mockedAxios.get.mock.calls;
    expect(axiosCalls.length).toBeGreaterThan(0);
    
    const lastCall = axiosCalls[axiosCalls.length - 1];
    expect(lastCall).toBeDefined();
    expect(lastCall[1]).toBeDefined();
    expect(lastCall[1].params).toBeDefined();
    expect(lastCall[1].params.limit).toBe(51); // Deve ser 51, não 100
  });

  it('deve garantir que fetchOrders usa limit <= 51', async () => {
    const mockResponse = {
      status: 200,
      data: {
        results: [],
        paging: {
          total: 0,
          offset: 0,
          limit: 50,
        },
      },
    };

    mockedAxios.get.mockResolvedValue(mockResponse);
    mockedAxios.isAxiosError = vi.fn(() => false);

    // Mock private methods
    (service as any).accessToken = 'mock-token';
    (service as any).connectionId = 'mock-connection-id';
    (service as any).providerAccountId = '123456';
    (service as any).sellerId = '123456';
    (service as any).executeWithRetryOn401 = async (fn: () => Promise<any>) => fn();
    (service as any).loadConnection = async () => {};
    (service as any).ensureValidToken = async () => {};
    (service as any).fetchMe = async () => ({ id: 123456, nickname: 'test', site_id: 'MLB' });

    // Executar syncOrdersByRange (que chama fetchOrders internamente)
    const dateFrom = new Date('2024-01-01');
    const dateTo = new Date('2024-01-31');
    
    await service.syncOrdersByRange(dateFrom, dateTo);

    // Verificar que todas as chamadas axios.get usaram limit <= 51
    const axiosCalls = mockedAxios.get.mock.calls;
    expect(axiosCalls.length).toBeGreaterThan(0);
    
    for (const call of axiosCalls) {
      if (call[1] && call[1].params && call[1].params.limit !== undefined) {
        expect(call[1].params.limit).toBeLessThanOrEqual(51);
      }
    }
  });
});
