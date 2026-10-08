#!/usr/bin/env node
import { App } from 'aws-cdk-lib'
import { SolutionsStack } from '../lib/solutions-stack'

const app = new App()

new SolutionsStack(app, 'SolutionsMachine', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    // us-east-1 es la región más económica y la de menor latencia a Colombia.
    region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1',
  },
  emailAlertas: process.env.EMAIL_ALERTAS,
  presupuestoUsd: Number(process.env.PRESUPUESTO_USD ?? 5),
  dominio: process.env.DOMINIO ?? 'solutionsmachine.com.co',
  certificadoArn:
    process.env.CERTIFICADO_ARN ??
    'arn:aws:acm:us-east-1:391016433609:certificate/c0c351d6-c1fe-4daf-97d8-3eb492f64b44',
  tags: {
    Proyecto: 'SolutionsMachine',
    Entorno: 'produccion',
  },
})
