// Liga o RDS, espera ficar disponível e volta desiredCount=1 nos ECS
const AWS = require('aws-sdk');

const ecs = new AWS.ECS({ region: process.env.AWS_REGION || 'us-east-2' });
const rds = new AWS.RDS({ region: process.env.AWS_REGION || 'us-east-2' });

exports.handler = async () => {
  const cluster = process.env.CLUSTER_NAME;
  const servicesJson = process.env.ECS_SERVICES || '[]';
  const rdsInstanceId = process.env.RDS_INSTANCE_ID;

  if (!cluster) throw new Error('CLUSTER_NAME não definido');
  if (!rdsInstanceId) throw new Error('RDS_INSTANCE_ID não definido');

  let services;
  try {
    services = JSON.parse(servicesJson);
  } catch (e) {
    throw new Error(`ECS_SERVICES inválido (não é JSON): ${servicesJson}`);
  }

  console.log('Iniciando startup do ambiente...');
  console.log('Cluster:', cluster);
  console.log('Serviços ECS:', services);
  console.log('RDS Instance:', rdsInstanceId);

  // 1) Ligar RDS
  console.log(`Iniciando instância RDS ${rdsInstanceId}...`);
  await rds.startDBInstance({
    DBInstanceIdentifier: rdsInstanceId
  }).promise();

  // 2) Esperar ficar disponível
  console.log('Aguardando RDS ficar disponível...');
  await rds.waitFor('dBInstanceAvailable', {
    DBInstanceIdentifier: rdsInstanceId
  }).promise();

  console.log('RDS disponível. Atualizando serviços ECS para desiredCount=1...');

  // 3) Subir serviços ECS
  for (const service of services) {
    console.log(`Atualizando serviço ECS ${service} para desiredCount=1...`);
    await ecs.updateService({
      cluster,
      service,
      desiredCount: 1
    }).promise();
  }

  console.log('Startup concluído com sucesso.');
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'startup_completed',
      cluster,
      services,
      rdsInstanceId
    })
  };
};
