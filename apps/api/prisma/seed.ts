import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.log('Seed script is disabled in production');
    return;
  }

  console.log('Starting seed...');

  const tenantId = 'demo-tenant';
  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: 'Demo Tenant',
    },
  });
  console.log('✓ Created tenant:', tenant.name);

  const user = await prisma.user.upsert({
    where: { email: 'owner@demo.com' },
    update: {},
    create: {
      tenant_id: tenant.id,
      email: 'owner@demo.com',
      role: 'owner',
    },
  });
  console.log('✓ Created user:', user.email);

  const listingsData = [
    {
      listing_id_ext: 'SHOP-001',
      title: 'iPhone 15 Pro Max 256GB',
      marketplace: 'shopee' as const,
      price: 8999.99,
      stock: 5,
      status: 'active' as const,
      category: 'Eletrônicos',
    },
    {
      listing_id_ext: 'ML-001',
      title: 'Notebook Gamer RTX 4060',
      marketplace: 'mercadolivre' as const,
      price: 4599.00,
      stock: 12,
      status: 'active' as const,
      category: 'Informática',
    },
    {
      listing_id_ext: 'SHOP-002',
      title: 'Tênis Nike Air Max',
      marketplace: 'shopee' as const,
      price: 299.90,
      stock: 0,
      status: 'active' as const,
      category: 'Calçados',
    },
    {
      listing_id_ext: 'ML-002',
      title: 'Smart TV 55" 4K Samsung',
      marketplace: 'mercadolivre' as const,
      price: 2199.99,
      stock: 8,
      status: 'active' as const,
      category: 'Eletrônicos',
    },
    {
      listing_id_ext: 'SHOP-003',
      title: 'Fone Bluetooth JBL',
      marketplace: 'shopee' as const,
      price: 149.99,
      stock: 25,
      status: 'active' as const,
      category: 'Áudio',
    },
    {
      listing_id_ext: 'ML-003',
      title: 'Cadeira Gamer RGB',
      marketplace: 'mercadolivre' as const,
      price: 899.90,
      stock: 15,
      status: 'active' as const,
      category: 'Móveis',
    },
  ];

  const listings = [];
  for (const data of listingsData) {
    const listing = await prisma.listing.upsert({
      where: {
        tenant_id_marketplace_listing_id_ext: {
          tenant_id: tenant.id,
          marketplace: data.marketplace,
          listing_id_ext: data.listing_id_ext,
        },
      },
      update: {},
      create: {
        tenant_id: tenant.id,
        ...data,
      },
    });
    listings.push(listing);
    console.log(`✓ Created listing: ${listing.title}`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const listing of listings) {
    for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
      const date = new Date(today);
      date.setDate(date.getDate() - daysAgo);

      const baseImpressions = 1000 + Math.floor(Math.random() * 500);
      const baseVisits = Math.floor(baseImpressions * (0.08 + Math.random() * 0.04));
      const baseOrders = Math.floor(baseVisits * (0.08 + Math.random() * 0.04));
      const baseRevenue = baseOrders * Number(listing.price);

      const clicks = baseVisits;
      const ctr = baseImpressions > 0 ? clicks / baseImpressions : 0;
      const conversion = baseVisits > 0 ? baseOrders / baseVisits : 0;

      await prisma.listingMetricsDaily.upsert({
        where: {
          tenant_id_listing_id_date: {
            tenant_id: tenant.id,
            listing_id: listing.id,
            date,
          },
        },
        update: {},
        create: {
          tenant_id: tenant.id,
          listing_id: listing.id,
          date,
          impressions: baseImpressions,
          clicks,
          ctr,
          visits: baseVisits,
          conversion,
          orders: baseOrders,
          gmv: baseRevenue,
        },
      });
    }
    console.log(`✓ Created 7 days of metrics for: ${listing.title}`);
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
