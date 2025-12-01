// Resume os serviços App Runner pausados

const { AppRunnerClient, ResumeServiceCommand, DescribeServiceCommand } = require('@aws-sdk/client-apprunner');

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

  console.log('Iniciando startup do ambiente...');
  console.log('Serviços App Runner:', serviceArns);

  const results = [];

  for (const serviceArn of serviceArns) {
    try {
      // Verifica status atual do serviço
      const describeCmd = new DescribeServiceCommand({ ServiceArn: serviceArn });
      const describeResult = await apprunner.send(describeCmd);
      const currentStatus = describeResult.Service.Status;

      console.log(`Serviço ${serviceArn} - Status atual: ${currentStatus}`);

      // Só resume se estiver PAUSED
      if (currentStatus === 'PAUSED') {
        console.log(`Resumindo serviço ${serviceArn}...`);
        const resumeCmd = new ResumeServiceCommand({ ServiceArn: serviceArn });
        await apprunner.send(resumeCmd);
        results.push({ serviceArn, action: 'resumed', previousStatus: currentStatus });
      } else if (currentStatus === 'RUNNING') {
        console.log(`Serviço ${serviceArn} já está em execução.`);
        results.push({ serviceArn, action: 'already_running', previousStatus: currentStatus });
      } else {
        console.log(`Serviço ${serviceArn} está em estado ${currentStatus}, não é possível resumir.`);
        results.push({ serviceArn, action: 'skipped', previousStatus: currentStatus });
      }
    } catch (error) {
      console.error(`Erro ao resumir serviço ${serviceArn}:`, error.message);
      results.push({ serviceArn, action: 'error', error: error.message });
    }
  }

  console.log('Startup concluído.');

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'startup_completed',
      results,
    }),
  };
};
