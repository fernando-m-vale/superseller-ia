// Desliga apenas os serviços ECS (desiredCount = 0)

const AWS = require('aws-sdk');

const ecs = new AWS.ECS({ region: process.env.AWS_REGION || 'us-east-2' });

exports.handler = async () => {
  const cluster = process.env.CLUSTER_NAME;
  const servicesJson = process.env.ECS_SERVICES || '[]';

  if (!cluster) {
    throw new Error('CLUSTER_NAME não definido nas variáveis de ambiente da Lambda');
  }

  let services;
  try {
    services = JSON.parse(servicesJson);
  } catch (e) {
    throw new Error(`ECS_SERVICES inválido (não é JSON válido): ${servicesJson}`);
  }

  console.log('Iniciando shutdown do ambiente...');
  console.log('Cluster:', cluster);
  console.log('Serviços ECS:', services);

  // Zerar desiredCount dos serviços ECS
  for (const service of services) {
    console.log(`Atualizando serviço ECS ${service} para desiredCount=0...`);
    await ecs.updateService({
      cluster,
      service,
      desiredCount: 0,
    }).promise();
  }

  console.log('Shutdown concluído com sucesso.');

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'shutdown_completed',
      cluster,
      services,
    }),
  };
};
