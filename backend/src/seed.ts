/**
 * Siembra los datos iniciales en DynamoDB.
 *
 *   TABLE_NAME=solutions-machine npm run seed
 *
 * Es idempotente: vuelve a escribir los mismos identificadores, así que puede
 * ejecutarse varias veces sin duplicar registros.
 */
import { hashPin } from './lib/auth.js'
import { TABLE, k, put } from './lib/dynamo.js'
import type { Empresa, Equipo, UsuarioConPin } from './types.js'

const PIN = process.env.SEED_PIN ?? '1234'

const empresas: Empresa[] = [
  {
    id: 'em-01',
    nombre: 'Solutions Machine · Interno',
    nit: '901.234.567-8',
    contacto: 'Valentina Marín',
    telefono: '+57 310 555 0101',
    ciudad: 'Bogotá',
  },
  {
    id: 'em-02',
    nombre: 'Clínica Santa María',
    nit: '890.112.334-5',
    contacto: 'Ricardo Bermúdez',
    telefono: '+57 311 555 0142',
    ciudad: 'Medellín',
  },
  {
    id: 'em-03',
    nombre: 'Logística del Pacífico S.A.S.',
    nit: '900.556.778-1',
    contacto: 'Marcela Duarte',
    telefono: '+57 312 555 0177',
    ciudad: 'Cali',
  },
]

const equipos: Equipo[] = [
  {
    id: 'eq-01',
    empresaId: 'em-02',
    codigo: 'AC-001',
    nombre: 'Chiller Carrier 30XA',
    tipo: 'Chiller',
    marca: 'Carrier',
    modelo: '30XA-502',
    serial: 'CR-30XA-8842A',
    ubicacion: 'Cubierta · Cuarto técnico',
    fechaInstalacion: '2023-04-12',
    estado: 'operativo',
    ultimaRevision: null,
    responsable: 'Carlos Mendoza',
  },
  {
    id: 'eq-02',
    empresaId: 'em-02',
    codigo: 'AC-002',
    nombre: 'Manejadora Trane M-Series',
    tipo: 'Manejadora',
    marca: 'Trane',
    modelo: 'MCCB-12',
    serial: 'TR-MCCB-5521B',
    ubicacion: 'Piso 3 · Cuarto de máquinas',
    fechaInstalacion: '2023-06-20',
    estado: 'mantenimiento',
    ultimaRevision: null,
    responsable: 'Laura Ríos',
  },
  {
    id: 'eq-03',
    empresaId: 'em-03',
    codigo: 'AC-003',
    nombre: 'Mini Split LG Dual Inverter',
    tipo: 'Mini Split',
    marca: 'LG',
    modelo: 'S4-W24K23AE',
    serial: 'LG-S4W-2231C',
    ubicacion: 'Oficina principal',
    fechaInstalacion: '2024-01-15',
    estado: 'operativo',
    ultimaRevision: null,
    responsable: 'Andrés Pineda',
  },
  {
    id: 'eq-04',
    empresaId: 'em-01',
    codigo: 'AC-004',
    nombre: 'Condensadora VRV Daikin',
    tipo: 'Condensadora VRV',
    marca: 'Daikin',
    modelo: 'RXYQ14AYM',
    serial: 'DK-RXYQ-9012D',
    ubicacion: 'Terraza · Zona norte',
    fechaInstalacion: '2022-08-30',
    estado: 'operativo',
    ultimaRevision: null,
    responsable: 'Carlos Mendoza',
  },
]

const usuarios: Array<Omit<UsuarioConPin, 'pinHash'> & { pin: string }> = [
  {
    id: 'us-01',
    nombre: 'Valentina Marín',
    usuario: 'admin',
    email: 'v.marin@solutionsmachine.co',
    rol: 'admin',
    estado: 'activo',
    ultimoAcceso: null,
    pin: PIN,
  },
  {
    id: 'us-02',
    nombre: 'Carlos Mendoza',
    usuario: 'tecnico',
    email: 'c.mendoza@solutionsmachine.co',
    rol: 'tecnico',
    estado: 'activo',
    ultimoAcceso: null,
    pin: PIN,
  },
  {
    id: 'us-03',
    nombre: 'Ricardo Bermúdez',
    usuario: 'cliente',
    email: 'r.bermudez@clinicasantamaria.co',
    rol: 'cliente',
    empresaId: 'em-02',
    estado: 'activo',
    ultimoAcceso: null,
    pin: PIN,
  },
]

async function main() {
  console.log(`Sembrando datos en la tabla "${TABLE}"…`)

  for (const e of empresas) {
    await put({
      ...k.empresa(e.id),
      GSI2PK: 'T#EMPRESA',
      GSI2SK: e.nombre.toLowerCase(),
      ...e,
    })
  }
  console.log(`  ✓ ${empresas.length} empresas`)

  for (const eq of equipos) {
    await put({
      ...k.equipo(eq.id),
      GSI1PK: `EMPRESA#${eq.empresaId}`,
      GSI1SK: `EQUIPO#${eq.codigo}`,
      GSI2PK: 'T#EQUIPO',
      GSI2SK: eq.codigo,
      ...eq,
    })
  }
  console.log(`  ✓ ${equipos.length} equipos`)

  for (const { pin, ...u } of usuarios) {
    await put({
      ...k.usuario(u.id),
      GSI2PK: 'T#USUARIO',
      GSI2SK: u.usuario,
      ...u,
      pinHash: hashPin(pin),
    })
  }
  console.log(`  ✓ ${usuarios.length} usuarios (PIN: ${PIN})`)

  console.log('\nListo. Usuarios de acceso: admin · tecnico · cliente')
}

main().catch((e) => {
  console.error('Falló la siembra:', e)
  process.exit(1)
})
