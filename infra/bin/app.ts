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
  tags: {
    Proyecto: 'SolutionsMachine',
    Entorno: 'produccion',
  },
})
