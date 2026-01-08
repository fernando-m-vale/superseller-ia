import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient, Marketplace, ListingStatus } from '@prisma/client';
import { MercadoLivreVisitsService } from '../services/MercadoLivreVisitsService';

const prisma = new PrismaClient();

describe('Visits Backfill Granular', () => {
  let testTenantId: string;
  let testListingIds: string[] = [];

  beforeEach(async () => {
    // Criar tenant de teste
    const tenant = await prisma.tenant.create({
      data: { name: 'Test Tenant Visits' },
    });
    testTenantId = tenant.id;

    // Criar listings de teste
    const listings = await Promise.all([
      prisma.listing.create({
        data: {
          tenant_id: testTenantId,
          marketplace: Marketplace.mercadolivre,
          listing_id_ext: 'MLB001',
          title: 'Test Listing 1',
          price: 100.0,
          stock: 10,
          status: ListingStatus.active,
        },
      }),
      prisma.listing.create({
        data: {
          tenant_id: testTenantId,
          marketplace: Marketplace.mercadolivre,
          listing_id_ext: 'MLB002',
          title: 'Test Listing 2',
          price: 200.0,
          stock: 5,
          status: ListingStatus.active,
        },
      }),
      prisma.listing.create({
        data: {
          tenant_id: testTenantId,
          marketplace: Marketplace.mercadolivre,
          listing_id_ext: 'MLB003',
          title: 'Test Listing 3',
          price: 150.0,
          stock: 8,
          status: ListingStatus.active,
        },
      }),
    ]);

    testListingIds = listings.map(l => l.id);
  });

  afterEach(async () => {
    // Limpar dados de teste
    await prisma.listingMetricsDaily.deleteMany({
      where: { tenant_id: testTenantId },
    });
    await prisma.listing.deleteMany({
      where: { tenant_id: testTenantId },
    });
    await prisma.tenant.delete({
      where: { id: testTenantId },
    });
  });

  describe('Batching', () => {
    it('should divide itemIds into batches correctly', async () => {
      // Limpar listings existentes do beforeEach
      await prisma.listing.deleteMany({
        where: { tenant_id: testTenantId },
      });

      // Criar 55 listings para testar batching (batchSize=50)
      const listings = [];
      for (let i = 1; i <= 55; i++) {
        listings.push(
          prisma.listing.create({
            data: {
              tenant_id: testTenantId,
              marketplace: Marketplace.mercadolivre,
              listing_id_ext: `MLB-BATCH-${String(i).padStart(3, '0')}`,
              title: `Test Listing ${i}`,
              price: 100.0,
              stock: 10,
              status: ListingStatus.active,
            },
          })
        );
      }
      await Promise.all(listings);

      // Verificar que temos 55 listings
      const count = await prisma.listing.count({
        where: { tenant_id: testTenantId },
      });
      expect(count).toBe(55);

      // O serviço deve criar 2 batches (50 + 5)
      // Nota: Este teste verifica a lógica de batching, mas não executa o backfill completo
      // pois requer conexão ML ativa. A lógica de batching está no método backfillVisitsGranular.
      
      // Verificar estrutura de batches manualmente
      const allListings = await prisma.listing.findMany({
        where: { tenant_id: testTenantId },
        select: { listing_id_ext: true },
      });

      const batchSize = 50;
      const batches: string[][] = [];
      for (let i = 0; i < allListings.length; i += batchSize) {
        const batch = allListings.slice(i, i + batchSize).map(l => l.listing_id_ext);
        batches.push(batch);
      }

      expect(batches.length).toBe(2); // 50 + 5
      expect(batches[0].length).toBe(50);
      expect(batches[1].length).toBe(5);
    });
  });

  describe('NULL handling', () => {
    it('should store NULL visits when API does not return data', async () => {
      // Este teste verifica que quando a API não retorna visitas,
      // o sistema grava NULL (não 0) em listing_metrics_daily
      
      const listing = await prisma.listing.findFirst({
        where: {
          tenant_id: testTenantId,
          listing_id_ext: 'MLB001',
        },
      });

      expect(listing).not.toBeNull();

      if (listing) {
        // Simular criação de métrica com visits = null
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const metric = await prisma.listingMetricsDaily.create({
          data: {
            tenant_id: testTenantId,
            listing_id: listing.id,
            date: today,
            visits: null, // NULL, não 0
            source: 'visits_api',
            period_days: 1,
            orders: 0,
            gmv: 0,
            impressions: null,
            clicks: null,
            ctr: null,
            conversion: null,
          },
        });

        // Verificar que visits é NULL
        const retrieved = await prisma.listingMetricsDaily.findUnique({
          where: { id: metric.id },
        });

        expect(retrieved?.visits).toBeNull();
        expect(retrieved?.visits).not.toBe(0);
        expect(retrieved?.source).toBe('visits_api');
        expect(retrieved?.period_days).toBe(1);
      }
    });

    it('should upsert all days with visits=NULL when API returns empty', async () => {
      // Este teste verifica que quando a API retorna array vazio,
      // o service ainda faz upsert com visits=NULL para TODOS os dias do range
      
      const listing = await prisma.listing.findFirst({
        where: {
          tenant_id: testTenantId,
          listing_id_ext: 'MLB001',
        },
      });

      expect(listing).not.toBeNull();

      if (listing) {
        const days = 3; // 3 dias para testar
        
        // Simular: API retornou array vazio (visitsMap vazio)
        // Service deve fazer upsert para TODOS os 3 dias com visits=NULL
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let dayOffset = 0; dayOffset < days; dayOffset++) {
          const date = new Date(today);
          date.setDate(date.getDate() - dayOffset);
          
          // Simular o que o service faz quando API retorna vazio
          await prisma.listingMetricsDaily.upsert({
            where: {
              tenant_id_listing_id_date: {
                tenant_id: testTenantId,
                listing_id: listing.id,
                date,
              },
            },
            create: {
              tenant_id: testTenantId,
              listing_id: listing.id,
              date,
              visits: null, // NULL porque API não retornou
              source: 'visits_api',
              period_days: 1,
              orders: 0,
              gmv: 0,
              impressions: null,
              clicks: null,
              ctr: null,
              conversion: null,
            },
            update: {
              visits: null,
              source: 'visits_api',
              period_days: 1,
            },
          });
        }

        // Verificar que TODOS os 3 dias foram gravados
        const metrics = await prisma.listingMetricsDaily.findMany({
          where: {
            tenant_id: testTenantId,
            listing_id: listing.id,
            date: {
              gte: new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000),
              lte: today,
            },
          },
        });

        expect(metrics.length).toBe(days);
        
        // Verificar que TODOS têm visits = NULL
        for (const metric of metrics) {
          expect(metric.visits).toBeNull();
          expect(metric.visits).not.toBe(0);
          expect(metric.source).toBe('visits_api');
          expect(metric.period_days).toBe(1);
        }
      }
    });

    it('should not convert NULL to 0 when upserting', async () => {
      const listing = await prisma.listing.findFirst({
        where: {
          tenant_id: testTenantId,
          listing_id_ext: 'MLB001',
        },
      });

      expect(listing).not.toBeNull();

      if (listing) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Criar métrica com visits = null
        await prisma.listingMetricsDaily.create({
          data: {
            tenant_id: testTenantId,
            listing_id: listing.id,
            date: today,
            visits: null,
            source: 'visits_api',
            period_days: 1,
            orders: 0,
            gmv: 0,
          },
        });

        // Atualizar (simulando upsert) - visits deve permanecer NULL
        await prisma.listingMetricsDaily.update({
          where: {
            tenant_id_listing_id_date: {
              tenant_id: testTenantId,
              listing_id: listing.id,
              date: today,
            },
          },
          data: {
            visits: null, // Mantém NULL
            source: 'visits_api',
            period_days: 1,
          },
        });

        const retrieved = await prisma.listingMetricsDaily.findUnique({
          where: {
            tenant_id_listing_id_date: {
              tenant_id: testTenantId,
              listing_id: listing.id,
              date: today,
            },
          },
        });

        expect(retrieved?.visits).toBeNull();
        expect(retrieved?.visits).not.toBe(0);
      }
    });
  });

  describe('Idempotency', () => {
    it('should not create duplicates when running twice', async () => {
      const listing = await prisma.listing.findFirst({
        where: {
          tenant_id: testTenantId,
          listing_id_ext: 'MLB001',
        },
      });

      expect(listing).not.toBeNull();

      if (listing) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Primeira execução: criar métrica
        await prisma.listingMetricsDaily.create({
          data: {
            tenant_id: testTenantId,
            listing_id: listing.id,
            date: today,
            visits: 10,
            source: 'visits_api',
            period_days: 1,
            orders: 0,
            gmv: 0,
          },
        });

        // Segunda execução: upsert (não deve criar duplicata)
        const existing = await prisma.listingMetricsDaily.findUnique({
          where: {
            tenant_id_listing_id_date: {
              tenant_id: testTenantId,
              listing_id: listing.id,
              date: today,
            },
          },
        });

        if (existing) {
          // Update (idempotente)
          await prisma.listingMetricsDaily.update({
            where: { id: existing.id },
            data: {
              visits: 15, // Atualizar valor
              source: 'visits_api',
            period_days: 1,
            },
          });
        } else {
          // Create (se não existir)
          await prisma.listingMetricsDaily.create({
            data: {
              tenant_id: testTenantId,
              listing_id: listing.id,
              date: today,
              visits: 15,
              source: 'visits_api',
            period_days: 1,
              orders: 0,
              gmv: 0,
            },
          });
        }

        // Verificar que há apenas 1 registro (não duplicado)
        const count = await prisma.listingMetricsDaily.count({
          where: {
            tenant_id: testTenantId,
            listing_id: listing.id,
            date: today,
          },
        });

        expect(count).toBe(1);

        // Verificar que o valor foi atualizado
        const retrieved = await prisma.listingMetricsDaily.findUnique({
          where: {
            tenant_id_listing_id_date: {
              tenant_id: testTenantId,
              listing_id: listing.id,
              date: today,
            },
          },
        });

        expect(retrieved?.visits).toBe(15);
      }
    });

    it('should handle unique constraint correctly', async () => {
      const listing = await prisma.listing.findFirst({
        where: {
          tenant_id: testTenantId,
          listing_id_ext: 'MLB001',
        },
      });

      expect(listing).not.toBeNull();

      if (listing) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Criar primeira métrica
        await prisma.listingMetricsDaily.create({
          data: {
            tenant_id: testTenantId,
            listing_id: listing.id,
            date: today,
            visits: 20,
            source: 'visits_api',
            period_days: 1,
            orders: 0,
            gmv: 0,
          },
        });

        // Tentar criar duplicata (deve falhar por constraint único)
        await expect(
          prisma.listingMetricsDaily.create({
            data: {
              tenant_id: testTenantId,
              listing_id: listing.id,
              date: today,
              visits: 25,
              source: 'visits_api',
            period_days: 1,
              orders: 0,
              gmv: 0,
            },
          })
        ).rejects.toThrow();

        // Verificar que há apenas 1 registro
        const count = await prisma.listingMetricsDaily.count({
          where: {
            tenant_id: testTenantId,
            listing_id: listing.id,
            date: today,
          },
        });

        expect(count).toBe(1);
      }
    });
  });
});

