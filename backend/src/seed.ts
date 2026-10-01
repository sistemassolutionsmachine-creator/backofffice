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

/* Muestra tomada del cuadro de equipos real del cliente. */
const equipos: Equipo[] = [
  {
    id: 'eq-01',
    empresaId: 'em-02',
    contratoId: null,
    codigo: 'AC-001',
    sistema: 'VRFSamsung',
    tipo: 'UCO Refrigerante Variable',
    nombre: '',
    serial: 'B512P3GNC00010V',
    ubicacion: 'Terraza Chiller',
    zona: 'Sistema 2 · AHU 08',
    marca: 'Samsung',
    modelo: 'AM120JXVAFH',
    caudal: '',
    capacidad: '120000',
    tension: '208/3/60',
    corriente: '',
    estado: 'operativo',
    ultimaRevision: null,
  },
  {
    id: 'eq-02',
    empresaId: 'em-02',
    contratoId: null,
    codigo: 'AC-002',
    sistema: 'VRFSamsung',
    tipo: 'UMA',
    nombre: 'AHU-08',
    serial: 'GX14-20030111-80',
    ubicacion: 'Terraza Chiller',
    zona: 'Sistema 2 · AHU 08',
    marca: 'Samsung',
    modelo: 'Geniox 14.07',
    caudal: '4902',
    capacidad: '',
    tension: '208/3/60',
    corriente: '',
    estado: 'mantenimiento',
    ultimaRevision: null,
  },
  {
    id: 'eq-03',
    empresaId: 'em-03',
    contratoId: null,
    codigo: 'AC-003',
    sistema: 'Vent. Mecanica',
    tipo: 'Unid. Extracción',
    nombre: '',
    serial: 'SP-TD-1100',
    ubicacion: 'Pasarela Técnica Oriental',
    zona: 'Extracción baños piso 2',
    marca: 'Soler & Palau',
    modelo: 'TD-1100/250',
    caudal: '1100',
    capacidad: '',
    tension: '208/1/60',
    corriente: '',
    estado: 'operativo',
    ultimaRevision: null,
  },
  {
    id: 'eq-04',
    empresaId: 'em-01',
    contratoId: null,
    codigo: 'AC-004',
    sistema: 'CHWS',
    tipo: 'Unid. Hidr. Fancoil Desnudo',
    nombre: 'FC-12',
    serial: 'MD-FC-9012D',
    ubicacion: 'Laboratorio QA-06',
    zona: 'Anillo hidráulico norte',
    marca: 'MIDEA',
    modelo: 'MKT3-V600',
    caudal: '600',
    capacidad: '',
    tension: '208/1/60',
    corriente: '',
    estado: 'operativo',
    ultimaRevision: null,
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
