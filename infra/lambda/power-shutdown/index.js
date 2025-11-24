// Desliga ECS (desiredCount=0) e para o RDS
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

  console.log('Iniciando shutdown do ambiente...');
  console.log('Cluster:', cluster);
  console.log('Serviços ECS:', services);
  console.log('RDS Instance:', rdsInstanceId);

  // 1) Zerar desiredCount dos serviços ECS
  for (const service of services) {
    console.log(`Atualizando serviço ECS ${service} para desiredCount=0...`);
    await ecs.updateService({
      cluster,
      service,
      desiredCount: 0
    }).promise();
  }

  // 2) Parar instância RDS
  console.log(`Parando instância RDS ${rdsInstanceId}...`);
  await rds.stopDBInstance({
    DBInstanceIdentifier: rdsInstanceId
  }).promise();

  console.log('Shutdown disparado com sucesso.');
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'shutdown_initiated',
      cluster,
      services,
      rdsInstanceId
    })
  };
};
