import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from 'aws-cdk-lib'
import * as budgets from 'aws-cdk-lib/aws-budgets'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import type { Construct } from 'constructs'
import * as path from 'node:path'

export interface SolutionsStackProps extends StackProps {
  /** Correo que recibe la alerta si el gasto se dispara. */
  emailAlertas?: string
  /** Tope mensual en USD para la alerta de presupuesto. */
  presupuestoUsd?: number
}

/**
 * Arquitectura serverless de Solutions Machine.
 *
 * Decisiones tomadas para minimizar el costo:
 *
 *  - CloudFront sirve el frontend y la API bajo el mismo dominio. Evita
 *    API Gateway (1 USD por millón) y elimina el CORS.
 *  - Lambda Function URL en vez de API Gateway: no tiene costo propio.
 *  - DynamoDB bajo demanda: 25 GB gratis de forma permanente.
 *  - Sin VPC y, por tanto, sin NAT Gateway (que costaría 32 USD al mes).
 *  - Lambda sobre arm64 (Graviton): ~20 % más barato que x86.
 *  - Retención de logs acotada: CloudWatch no crece sin control.
 */
export class SolutionsStack extends Stack {
  constructor(scope: Construct, id: string, props: SolutionsStackProps = {}) {
    super(scope, id, props)

    const { emailAlertas, presupuestoUsd = 5 } = props

    /* ---------------- Datos ---------------- */

    const tabla = new dynamodb.TableV2(this, 'Tabla', {
      tableName: 'solutions-machine',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      // Bajo demanda: se paga por petición, sin capacidad reservada ociosa.
      billing: dynamodb.Billing.onDemand(),
      // Protege ante un borrado accidental de datos productivos.
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          // Hijos de una empresa: sus equipos y sus revisiones.
          indexName: 'GSI1',
          partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
        },
        {
          // Listados por tipo y búsquedas por clave única (código QR, usuario).
          indexName: 'GSI2',
          partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
        },
      ],
    })

    /* ---------------- Almacenamiento de reportes ---------------- */

    const bucketReportes = new s3.Bucket(this, 'BucketReportes', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          // Tras 90 días las evidencias casi no se consultan: a clase fría.
          id: 'archivar-evidencias-antiguas',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL,
              transitionAfter: Duration.days(365),
            },
          ],
        },
        {
          id: 'limpiar-subidas-incompletas',
          abortIncompleteMultipartUploadAfter: Duration.days(7),
        },
      ],
      cors: [
        {
          // Necesario para que el navegador suba las fotos con URL prefirmada.
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    })

    /* ---------------- API ---------------- */

    // Grupo de logs explícito: sin él, CloudWatch retendría todo para siempre.
    const logsApi = new logs.LogGroup(this, 'LogsApi', {
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: RemovalPolicy.DESTROY,
    })

    const api = new NodejsFunction(this, 'Api', {
      entry: path.join(__dirname, '../../backend/src/handler.ts'),
      // El código vive en backend/, fuera de infra/: hay que ampliar la raíz.
      projectRoot: path.join(__dirname, '../..'),
      depsLockFilePath: path.join(__dirname, '../../backend/package-lock.json'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      // Graviton: mismo rendimiento, ~20 % menos costo por GB-segundo.
      architecture: lambda.Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(20),
      logGroup: logsApi,
      environment: {
        TABLE_NAME: tabla.tableName,
        BUCKET_REPORTES: bucketReportes.bucketName,
        JWT_SECRET: process.env.JWT_SECRET ?? 'cambiar-en-produccion',
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node22',
      },
    })

    tabla.grantReadWriteData(api)
    bucketReportes.grantReadWrite(api)

    const apiUrl = api.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
    })

    /* ---------------- Frontend ---------------- */

    const bucketWeb = new s3.Bucket(this, 'BucketWeb', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })

    const distribucion = new cloudfront.Distribution(this, 'Cdn', {
      comment: 'Solutions Machine · portal y API',
      defaultRootObject: 'index.html',
      // La clase 100 usa solo las ubicaciones más baratas (NA y Europa).
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucketWeb),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      additionalBehaviors: {
        // Mismo dominio para la API: sin CORS y sin costo de API Gateway.
        '/api/*': {
          origin: origins.FunctionUrlOrigin.withOriginAccessControl(apiUrl),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      errorResponses: [
        // React Router resuelve las rutas en el navegador.
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
      ],
    })

    // Publica el build de Vite e invalida la caché en cada despliegue.
    new s3deploy.BucketDeployment(this, 'DesplegarWeb', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../frontend/dist'))],
      destinationBucket: bucketWeb,
      distribution: distribucion,
      distributionPaths: ['/*'],
      prune: true,
    })

    /* ---------------- Control de gasto ---------------- */

    if (emailAlertas) {
      new budgets.CfnBudget(this, 'Presupuesto', {
        budget: {
          budgetName: 'solutions-machine-mensual',
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: { amount: presupuestoUsd, unit: 'USD' },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              notificationType: 'ACTUAL',
              comparisonOperator: 'GREATER_THAN',
              threshold: 80,
              thresholdType: 'PERCENTAGE',
            },
            subscribers: [{ subscriptionType: 'EMAIL', address: emailAlertas }],
          },
          {
            notification: {
              notificationType: 'FORECASTED',
              comparisonOperator: 'GREATER_THAN',
              threshold: 100,
              thresholdType: 'PERCENTAGE',
            },
            subscribers: [{ subscriptionType: 'EMAIL', address: emailAlertas }],
          },
        ],
      })
    }

    /* ---------------- Salidas ---------------- */

    new CfnOutput(this, 'UrlPortal', {
      value: `https://${distribucion.distributionDomainName}`,
      description: 'URL pública del portal',
    })
    new CfnOutput(this, 'NombreTabla', { value: tabla.tableName })
    new CfnOutput(this, 'BucketReportesNombre', {
      value: bucketReportes.bucketName,
    })
    new CfnOutput(this, 'IdDistribucion', {
      value: distribucion.distributionId,
    })
  }
}
