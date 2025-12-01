// Pausa os serviços App Runner para reduzir custos

const { AppRunnerClient, PauseServiceCommand, DescribeServiceCommand } = require('@aws-sdk/client-apprunner');

const apprunner = new AppRunnerClient({ region: process.env.AWS_REGION || 'us-east-2' });

exports.handler = async () => {
  const serviceArnsJson = process.env.APPRUNNER_SERVICE_ARNS || '[]';

  let serviceArns;
  try {
    serviceArns = JSON.parse(serviceArnsJson);
  } catch (e) {
    throw new Error(`APPRUNNER_SERVICE_ARNS inválido (não é JSON válido): ${serviceArnsJson}`);
  }

  if (serviceArns.length === 0) {
    throw new Error('APPRUNNER_SERVICE_ARNS está vazio');
  }

  console.log('Iniciando shutdown do ambiente...');
  console.log('Serviços App Runner:', serviceArns);

  const results = [];

  for (const serviceArn of serviceArns) {
    try {
      // Verifica status atual do serviço
      const describeCmd = new DescribeServiceCommand({ ServiceArn: serviceArn });
      const describeResult = await apprunner.send(describeCmd);
      const currentStatus = describeResult.Service.Status;

      console.log(`Serviço ${serviceArn} - Status atual: ${currentStatus}`);

      // Só pausa se estiver RUNNING
      if (currentStatus === 'RUNNING') {
        console.log(`Pausando serviço ${serviceArn}...`);
        const pauseCmd = new PauseServiceCommand({ ServiceArn: serviceArn });
        await apprunner.send(pauseCmd);
        results.push({ serviceArn, action: 'paused', previousStatus: currentStatus });
      } else if (currentStatus === 'PAUSED') {
        console.log(`Serviço ${serviceArn} já está pausado.`);
        results.push({ serviceArn, action: 'already_paused', previousStatus: currentStatus });
      } else {
        console.log(`Serviço ${serviceArn} está em estado ${currentStatus}, não é possível pausar.`);
        results.push({ serviceArn, action: 'skipped', previousStatus: currentStatus });
      }
    } catch (error) {
      console.error(`Erro ao pausar serviço ${serviceArn}:`, error.message);
      results.push({ serviceArn, action: 'error', error: error.message });
    }
  }

  console.log('Shutdown concluído.');

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'shutdown_completed',
      results,
    }),
  };
};
