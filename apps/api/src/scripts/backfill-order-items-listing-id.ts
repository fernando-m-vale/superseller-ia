/**
 * Script de backfill para preencher order_items.listing_id
 * 
 * Executa:
 * UPDATE order_items SET listing_id = listings.id 
 * WHERE order_items.listing_id IS NULL 
 * AND order_items.listing_id_ext = listings.listing_id_ext
 * AND listings.marketplace = 'mercadolivre'
 * AND listings.tenant_id = orders.tenant_id (via JOIN)
 * 
 * Uso:
 * pnpm tsx apps/api/src/scripts/backfill-order-items-listing-id.ts [tenantId?]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillOrderItemsListingId(tenantId?: string) {
  console.log('========================================');
  console.log('BACKFILL: order_items.listing_id');
  console.log('========================================\n');

  try {
    // 1. Contar total de order_items sem listing_id
    const whereClause = tenantId 
      ? {
          listing_id: null,
          order: { tenant_id: tenantId },
        }
      : {
          listing_id: null,
        };

    const totalItemsWithoutListingId = await prisma.orderItem.count({
      where: whereClause,
    });

    console.log(`Total de order_items sem listing_id: ${totalItemsWithoutListingId}`);

    if (totalItemsWithoutListingId === 0) {
      console.log('✅ Nenhum item precisa de backfill.');
      return;
    }

    // 2. Buscar order_items sem listing_id com seus listing_id_ext
    const itemsToUpdate = await prisma.orderItem.findMany({
      where: whereClause,
      select: {
        id: true,
        listing_id_ext: true,
        order: {
          select: {
            tenant_id: true,
            marketplace: true,
          },
        },
      },
      take: 10000, // Limite para evitar memória excessiva
    });

    console.log(`Encontrados ${itemsToUpdate.length} items para atualizar`);

    // 3. Agrupar por tenant_id + marketplace + listing_id_ext para buscar listings em batch
    const listingLookupMap = new Map<string, string>(); // key: "tenantId|marketplace|listingIdExt", value: listing.id
    const uniqueKeys = new Set<string>();

    for (const item of itemsToUpdate) {
      const key = `${item.order.tenant_id}|${item.order.marketplace}|${item.listing_id_ext}`;
      uniqueKeys.add(key);
    }

    console.log(`Buscando ${uniqueKeys.size} listings únicos...`);

    // Buscar todos os listings relevantes em batch
    const listings = await prisma.listing.findMany({
      where: {
        OR: Array.from(uniqueKeys).map(key => {
          const [tenantId, marketplace, listingIdExt] = key.split('|');
          return {
            tenant_id: tenantId,
            marketplace: marketplace as any,
            listing_id_ext: listingIdExt,
          };
        }),
      },
      select: {
        id: true,
        tenant_id: true,
        marketplace: true,
        listing_id_ext: true,
      },
    });

    // Criar mapa de lookup
    for (const listing of listings) {
      const key = `${listing.tenant_id}|${listing.marketplace}|${listing.listing_id_ext}`;
      listingLookupMap.set(key, listing.id);
    }

    console.log(`Encontrados ${listings.length} listings correspondentes`);

    // 4. Atualizar order_items em batch
    let updated = 0;
    let notFound = 0;
    const batchSize = 100;

    for (let i = 0; i < itemsToUpdate.length; i += batchSize) {
      const batch = itemsToUpdate.slice(i, i + batchSize);
      const updatePromises = batch.map(async (item) => {
        const key = `${item.order.tenant_id}|${item.order.marketplace}|${item.listing_id_ext}`;
        const listingId = listingLookupMap.get(key);

        if (listingId) {
          await prisma.orderItem.update({
            where: { id: item.id },
            data: { listing_id: listingId },
          });
          updated++;
          return true;
        } else {
          notFound++;
          console.log(`⚠️  Listing não encontrado para order_item ${item.id} (listing_id_ext: ${item.listing_id_ext}, tenant: ${item.order.tenant_id})`);
          return false;
        }
      });

      await Promise.all(updatePromises);
      console.log(`Progresso: ${Math.min(i + batchSize, itemsToUpdate.length)}/${itemsToUpdate.length}`);
    }

    console.log('\n========================================');
    console.log('RESULTADO DO BACKFILL:');
    console.log(`✅ Atualizados: ${updated}`);
    console.log(`⚠️  Não encontrados: ${notFound}`);
    console.log('========================================\n');

    // 5. Validar resultado
    const remainingWithoutListingId = await prisma.orderItem.count({
      where: whereClause,
    });

    console.log(`Items ainda sem listing_id: ${remainingWithoutListingId}`);

    if (remainingWithoutListingId > 0) {
      console.log('\n⚠️  Alguns items ainda não têm listing_id. Possíveis causas:');
      console.log('   - Listing não existe no banco');
      console.log('   - listing_id_ext não corresponde');
      console.log('   - Marketplace diferente');
    }

  } catch (error) {
    console.error('❌ Erro no backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar script
const tenantId = process.argv[2]; // Opcional: passar tenantId como argumento

backfillOrderItemsListingId(tenantId)
  .then(() => {
    console.log('✅ Backfill concluído com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
