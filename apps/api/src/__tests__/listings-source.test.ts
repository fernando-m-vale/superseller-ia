import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient, Marketplace, ListingStatus } from '@prisma/client';

const prisma = new PrismaClient();

const describeDb = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeDb('Listings Source and Discovery Blocked Fields', () => {
  let testTenantId: string;

  beforeEach(async () => {
    // Criar tenant de teste
    const tenant = await prisma.tenant.create({
      data: { name: 'Test Tenant Source' },
    });
    testTenantId = tenant.id;
  });

  afterEach(async () => {
    // Limpar dados de teste
    await prisma.listing.deleteMany({
      where: { tenant_id: testTenantId },
    });
    await prisma.tenant.delete({
      where: { id: testTenantId },
    });
  });

  it('should create listing with source="discovery" and discovery_blocked=false', async () => {
    const listing = await prisma.listing.create({
      data: {
        tenant_id: testTenantId,
        marketplace: Marketplace.mercadolivre,
        listing_id_ext: 'MLB123456',
        title: 'Test Listing',
        price: 100.0,
        stock: 10,
        status: ListingStatus.active,
        source: 'discovery',
        discovery_blocked: false,
      },
    });

    expect(listing.source).toBe('discovery');
    expect(listing.discovery_blocked).toBe(false);
  });

  it('should create listing with source="orders_fallback" and discovery_blocked=true', async () => {
    const listing = await prisma.listing.create({
      data: {
        tenant_id: testTenantId,
        marketplace: Marketplace.mercadolivre,
        listing_id_ext: 'MLB789012',
        title: 'Test Listing Fallback',
        price: 200.0,
        stock: 5,
        status: ListingStatus.active,
        source: 'orders_fallback',
        discovery_blocked: true,
      },
    });

    expect(listing.source).toBe('orders_fallback');
    expect(listing.discovery_blocked).toBe(true);
  });

  it('should allow null source', async () => {
    const listing = await prisma.listing.create({
      data: {
        tenant_id: testTenantId,
        marketplace: Marketplace.mercadolivre,
        listing_id_ext: 'MLB345678',
        title: 'Test Listing Null Source',
        price: 150.0,
        stock: 8,
        status: ListingStatus.active,
        source: null,
        discovery_blocked: false,
      },
    });

    expect(listing.source).toBeNull();
    expect(listing.discovery_blocked).toBe(false);
  });

  it('should default discovery_blocked to false when not provided', async () => {
    const listing = await prisma.listing.create({
      data: {
        tenant_id: testTenantId,
        marketplace: Marketplace.mercadolivre,
        listing_id_ext: 'MLB901234',
        title: 'Test Listing Default',
        price: 75.0,
        stock: 3,
        status: ListingStatus.active,
        // Não fornecer discovery_blocked - deve usar default
      },
    });

    expect(listing.discovery_blocked).toBe(false);
  });

  it('should update listing source and discovery_blocked', async () => {
    // Criar listing inicial
    const listing = await prisma.listing.create({
      data: {
        tenant_id: testTenantId,
        marketplace: Marketplace.mercadolivre,
        listing_id_ext: 'MLB567890',
        title: 'Test Listing Update',
        price: 120.0,
        stock: 7,
        status: ListingStatus.active,
        source: 'discovery',
        discovery_blocked: false,
      },
    });

    // Atualizar para orders_fallback
    const updated = await prisma.listing.update({
      where: { id: listing.id },
      data: {
        source: 'orders_fallback',
        discovery_blocked: true,
      },
    });

    expect(updated.source).toBe('orders_fallback');
    expect(updated.discovery_blocked).toBe(true);
  });
});

