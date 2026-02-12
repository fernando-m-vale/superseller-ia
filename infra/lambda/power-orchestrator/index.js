// Power Orchestrator - Liga/Desliga completo do ambiente AWS
// Coordena: App Runner (via Lambdas existentes) + RDS + NAT Gateway (via CodeBuild/Terraform)

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { RDSClient, StartDBInstanceCommand, StopDBInstanceCommand, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const { CodeBuildClient, StartBuildCommand, BatchGetBuildsCommand } = require('@aws-sdk/client-codebuild');

const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-2' });
const rds = new RDSClient({ region: process.env.AWS_REGION || 'us-east-2' });
const codebuild = new CodeBuildClient({ region: process.env.AWS_REGION || 'us-east-2' });

const ACTION_STARTUP = 'STARTUP';
const ACTION_SHUTDOWN = 'SHUTDOWN';

// Helper: Aguardar com polling
async function waitWithPolling(checkFn, maxAttempts = 60, intervalMs = 5000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await checkFn();
    if (result.done) {
      return result;
    }
    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  throw new Error(`Timeout após ${maxAttempts} tentativas`);
}

// Step 1: App Runner (via Lambdas existentes)
async function handleAppRunner(action) {
  const startTime = Date.now();
  const functionName = action === ACTION_STARTUP 
    ? process.env.APPRUNNER_STARTUP_FUNCTION_NAME || 'superseller-power-startup'
    : process.env.APPRUNNER_SHUTDOWN_FUNCTION_NAME || 'superseller-power-shutdown';

  console.log(`[${action}] Step 1: App Runner via ${functionName}`);

  try {
    const invokeCmd = new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'RequestResponse', // Sync para aguardar conclusão
    });

    const response = await lambda.send(invokeCmd);
    const payload = JSON.parse(Buffer.from(response.Payload).toString());

    if (response.StatusCode !== 200 || payload.errorMessage) {
      throw new Error(payload.errorMessage || `Lambda retornou status ${response.StatusCode}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[${action}] App Runner concluído em ${duration}ms`);

    return {
      step: 'apprunner',
      success: true,
      durationMs: duration,
      result: payload,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${action}] Erro no App Runner:`, error.message);
    return {
      step: 'apprunner',
      success: false,
      durationMs: duration,
      error: error.message,
    };
  }
}

// Step 2: RDS
async function handleRDS(action) {
  const startTime = Date.now();
  const dbIdentifier = process.env.DB_INSTANCE_IDENTIFIER || 'superseller-prod-db';

  console.log(`[${action}] Step 2: RDS ${dbIdentifier}`);

  try {
    // Verificar status atual
    const describeCmd = new DescribeDBInstancesCommand({ DBInstanceIdentifier: dbIdentifier });
    const describeResult = await rds.send(describeCmd);
    
    if (!describeResult.DBInstances || describeResult.DBInstances.length === 0) {
      throw new Error(`RDS instance ${dbIdentifier} não encontrada`);
    }

    const dbInstance = describeResult.DBInstances[0];
    const currentStatus = dbInstance.DBInstanceStatus;

    console.log(`[${action}] RDS status atual: ${currentStatus}`);

    // Idempotência: verificar se já está no estado desejado
    const desiredStatus = action === ACTION_STARTUP ? 'available' : 'stopped';
    if (currentStatus === desiredStatus) {
      console.log(`[${action}] RDS já está ${desiredStatus}, pulando...`);
      return {
        step: 'rds',
        success: true,
        durationMs: Date.now() - startTime,
        result: { action: 'already_in_state', currentStatus },
      };
    }

    // Executar ação
    if (action === ACTION_STARTUP) {
      if (currentStatus === 'stopped') {
        console.log(`[${action}] Iniciando RDS...`);
        const startCmd = new StartDBInstanceCommand({ DBInstanceIdentifier: dbIdentifier });
        await rds.send(startCmd);
      } else {
        throw new Error(`RDS está em estado ${currentStatus}, não é possível iniciar`);
      }
    } else {
      if (currentStatus === 'available') {
        console.log(`[${action}] Parando RDS...`);
        const stopCmd = new StopDBInstanceCommand({ DBInstanceIdentifier: dbIdentifier });
        await rds.send(stopCmd);
      } else {
        throw new Error(`RDS está em estado ${currentStatus}, não é possível parar`);
      }
    }

    // Aguardar transição de estado
    console.log(`[${action}] Aguardando RDS ficar ${desiredStatus}...`);
    await waitWithPolling(async () => {
      const checkCmd = new DescribeDBInstancesCommand({ DBInstanceIdentifier: dbIdentifier });
      const checkResult = await rds.send(checkCmd);
      const status = checkResult.DBInstances[0].DBInstanceStatus;
      return {
        done: status === desiredStatus,
        status,
      };
    }, 60, 10000); // 60 tentativas x 10s = 10 minutos máximo

    const duration = Date.now() - startTime;
    console.log(`[${action}] RDS concluído em ${duration}ms`);

    return {
      step: 'rds',
      success: true,
      durationMs: duration,
      result: { action: action.toLowerCase(), finalStatus: desiredStatus },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${action}] Erro no RDS:`, error.message);
    return {
      step: 'rds',
      success: false,
      durationMs: duration,
      error: error.message,
    };
  }
}

// Step 3: NAT Gateway (via CodeBuild/Terraform)
async function handleNAT(action) {
  const startTime = Date.now();
  const projectName = action === ACTION_STARTUP
    ? process.env.CODEBUILD_NAT_ENABLE_PROJECT || 'superseller-terraform-nat-enable'
    : process.env.CODEBUILD_NAT_DISABLE_PROJECT || 'superseller-terraform-nat-disable';

  console.log(`[${action}] Step 3: NAT Gateway via CodeBuild ${projectName}`);

  try {
    // Iniciar build
    const startBuildCmd = new StartBuildCommand({
      projectName,
    });

    const buildResponse = await codebuild.send(startBuildCmd);
    const buildId = buildResponse.build.id;

    console.log(`[${action}] CodeBuild iniciado: ${buildId}`);

    // Aguardar conclusão
    console.log(`[${action}] Aguardando conclusão do CodeBuild...`);
    const buildResult = await waitWithPolling(async () => {
      const batchCmd = new BatchGetBuildsCommand({ ids: [buildId] });
      const batchResult = await codebuild.send(batchCmd);
      const build = batchResult.builds[0];

      if (!build) {
        throw new Error(`Build ${buildId} não encontrado`);
      }

      const status = build.buildStatus;
      const done = status === 'SUCCEEDED' || status === 'FAILED' || status === 'FAULT' || status === 'TIMED_OUT' || status === 'CANCELLED';

      return {
        done,
        status,
        build,
      };
    }, 120, 10000); // 120 tentativas x 10s = 20 minutos máximo

    const duration = Date.now() - startTime;
    const buildStatus = buildResult.build.buildStatus;

    if (buildStatus !== 'SUCCEEDED') {
      throw new Error(`CodeBuild falhou com status ${buildStatus}. Logs: ${buildResult.build.logs?.deepLink || 'N/A'}`);
    }

    console.log(`[${action}] NAT Gateway concluído em ${duration}ms`);

    return {
      step: 'nat',
      success: true,
      durationMs: duration,
      result: {
        buildId,
        buildStatus,
        logsLink: buildResult.build.logs?.deepLink,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${action}] Erro no NAT Gateway:`, error.message);
    return {
      step: 'nat',
      success: false,
      durationMs: duration,
      error: error.message,
    };
  }
}

// Handler principal
exports.handler = async (event) => {
  const action = event.action || event.pathParameters?.action || event.queryStringParameters?.action;
  
  if (!action || (action !== ACTION_STARTUP && action !== ACTION_SHUTDOWN)) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: 'Invalid action',
        message: 'Action deve ser STARTUP ou SHUTDOWN',
      }),
    };
  }

  const overallStartTime = Date.now();
  const steps = [];
  let overallSuccess = true;

  console.log(`========================================`);
  console.log(`Power ${action} iniciado`);
  console.log(`========================================`);

  try {
    // Step 1: App Runner
    const appRunnerResult = await handleAppRunner(action);
    steps.push(appRunnerResult);
    if (!appRunnerResult.success) {
      overallSuccess = false;
      // Continuar mesmo se App Runner falhar (pode estar já no estado desejado)
      console.warn(`[${action}] App Runner falhou, mas continuando...`);
    }

    // Step 2: RDS
    const rdsResult = await handleRDS(action);
    steps.push(rdsResult);
    if (!rdsResult.success) {
      overallSuccess = false;
      // RDS é crítico, mas não abortar (pode estar em manutenção)
      console.warn(`[${action}] RDS falhou, mas continuando...`);
    }

    // Step 3: NAT Gateway
    const natResult = await handleNAT(action);
    steps.push(natResult);
    if (!natResult.success) {
      overallSuccess = false;
      // NAT é crítico para App Runner funcionar
      console.error(`[${action}] NAT Gateway falhou - isso pode afetar App Runner`);
    }

    const overallDuration = Date.now() - overallStartTime;

    console.log(`========================================`);
    console.log(`Power ${action} concluído em ${overallDuration}ms`);
    console.log(`Sucesso geral: ${overallSuccess}`);
    console.log(`========================================`);

    return {
      statusCode: overallSuccess ? 200 : 207, // 207 = Multi-Status (alguns steps falharam)
      body: JSON.stringify({
        action,
        success: overallSuccess,
        durationMs: overallDuration,
        steps,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    const overallDuration = Date.now() - overallStartTime;
    console.error(`[${action}] Erro fatal:`, error.message);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        action,
        success: false,
        durationMs: overallDuration,
        error: error.message,
        steps,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
