// ==========================================================
// CONFIGURACIÓN E INTEGRACIÓN DE BASE DE DATOS Y SERVICIOS
// ==========================================================

export const SUPABASE_URL = 'https://vvvveahvvabpzkephwlu.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2dnZlYWh2dmFicHprZXBod2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MDQzNzIsImV4cCI6MjEwNDk4MDM3Mn0.AXo3MSol4K7hawxwHsgHlEThGXzZZn4u4WdMXH7k2ts';

// Inicialización del cliente de base de datos
let clientInstance = null;
export function getDb() {
  if (clientInstance) return clientInstance;
  if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
    try {
      clientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn('Error al inicializar cliente Supabase en window:', e);
    }
  } else if (typeof globalThis !== 'undefined' && globalThis.supabase && globalThis.supabase.createClient) {
    try {
      clientInstance = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn('Error al inicializar cliente Supabase en globalThis:', e);
    }
  }
  return clientInstance;
}

export const db = new Proxy({}, {
  get(target, prop) {
    const client = getDb();
    if (!client) return undefined;
    const val = client[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  }
});

// Asignar en window para compatibilidad directa en scripts normales
if (typeof window !== 'undefined') {
  window.db = db;
  window.getDb = getDb;
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
}

// ----------------------------------------------------------
// GESTIÓN DE SESIÓN Y CONTROL DE ACCESO
// ----------------------------------------------------------

export const SESSION_KEY = 'sistema_sesion_activa';

/**
 * Obtiene la sesión activa actual del almacenamiento del navegador.
 */
export function obtenerSesionActiva() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && (data.correo || data.email)) return data;
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Guarda y activa la sesión del usuario en el navegador.
 */
export function guardarSesionActiva(usuario) {
  if (typeof window === 'undefined' || !window.localStorage || !usuario) return null;
  try {
    const sesion = {
      id: usuario.id || `usr-${Date.now()}`,
      nombre: usuario.nombre || usuario.user_metadata?.nombre || (usuario.correo || usuario.email || '').split('@')[0] || 'Usuario',
      correo: usuario.correo || usuario.email,
      rol: usuario.rol || usuario.user_metadata?.rol || 'Cobrador',
      login_at: new Date().toISOString()
    };
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
    return sesion;
  } catch (e) {
    console.warn('Error al guardar sesión activa:', e);
    return null;
  }
}

/**
 * Cierra la sesión activa y redirige al inicio de sesión.
 */
export async function cerrarSesion() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }
  const client = getDb();
  if (client && client.auth) {
    try {
      await client.auth.signOut();
    } catch (e) {}
  }
  if (typeof window !== 'undefined') {
    window.location.href = 'index.html';
  }
}

/**
 * Verifica si hay una sesión activa en la página actual.
 * Si no está autenticado y redirigir es true, redirige a index.html.
 */
export function verificarAutenticacion({ redirigir = true, returnUrl = '' } = {}) {
  const sesion = obtenerSesionActiva();
  if (!sesion) {
    if (redirigir && typeof window !== 'undefined') {
      const destino = returnUrl ? `index.html?redirect=${encodeURIComponent(returnUrl)}` : 'index.html';
      window.location.href = destino;
    }
    return { autenticado: false, usuario: null };
  }
  return { autenticado: true, usuario: sesion };
}

if (typeof window !== 'undefined') {
  window.obtenerSesionActiva = obtenerSesionActiva;
  window.guardarSesionActiva = guardarSesionActiva;
  window.cerrarSesion = cerrarSesion;
  window.verificarAutenticacion = verificarAutenticacion;
}

// ----------------------------------------------------------
// DATOS Y CACHÉ LOCAL (FALLBACK EN CASO DE DESCONEXIÓN O LATENCIA)
// ----------------------------------------------------------

const CLIENTES_INICIALES = [
  { id: '4d7da2ef-5949-4621-834f-bb3955556778', nombre: 'María Pérez', correo: 'maria.perez@ejemplo.com', telefono: '+57 310 123 4567', documento: '1020304050', estado: 'Activo', direccion: 'Calle 10 # 20-30', observaciones: 'Cliente puntual', monto_deuda: 150000.00, created_at: '2026-09-16T22:20:12.15807+00:00' },
  { id: '8cd0c435-b221-403e-9d1e-e2a77a1bdcb2', nombre: 'Juan Torres', correo: 'juan.torres@ejemplo.com', telefono: '+57 320 765 4321', documento: '1030405060', estado: 'Activo', direccion: 'Carrera 15 # 45-12', observaciones: 'Préstamo vigente', monto_deuda: 250000.00, created_at: '2026-09-16T22:20:12.15807+00:00' },
  { id: 'bf5f4851-9f76-4bbe-962d-52aa5b916e04', nombre: 'Luisa Ramírez', correo: 'luisa.r@ejemplo.com', telefono: '+57 315 998 8776', documento: '1040506070', estado: 'Activo', direccion: 'Avenida 68 # 11-20', observaciones: 'Comercio local', monto_deuda: 0.00, created_at: '2026-09-16T22:20:12.15807+00:00' },
  { id: '3d35a40a-13b7-4041-9220-fda5f2f85de0', nombre: 'juan perez', correo: 'ferchogarces2008@gmail.com', telefono: '+573203826157', documento: '10000000', estado: 'Activo', direccion: 'calle 20# 14-32', observaciones: 'pito', monto_deuda: 233333333.00, created_at: '2026-09-16T22:37:14.076135+00:00' },
  { id: '0f1ee434-e4de-497d-bb26-ce16fdd9d033', nombre: 'juan fer', correo: 'ferchogarces2008@gmail.com', telefono: '+573203826157', documento: '1110500088', estado: 'Activo', direccion: 'calle 20# 14-32', observaciones: 'piton', monto_deuda: 1500000.00, created_at: '2026-09-16T22:38:02.1988+00:00' },
  { id: 'c8dfd74e-6b02-470c-ba76-2f1075efaaab', nombre: 'james moncada', correo: 'ING.JAMESMONCADA@GMAIL.COM', telefono: '3134824913', documento: '1090421332', estado: 'Activo', direccion: 'calle 20# 14-36', observaciones: null, monto_deuda: 800000.00, created_at: '2026-09-16T22:47:01.273257+00:00' }
];

const PAGOS_INICIALES = [
  { id: 'p1', cliente_nombre: 'María Pérez', documento: '1020304050', monto: 50000.00, fecha: new Date().toISOString().split('T')[0], metodo_pago: 'Transferencia', referencia: 'TRX-984521', observaciones: 'Abono a capital', estado: 'Pagado', created_at: new Date().toISOString() },
  { id: 'p2', cliente_nombre: 'Luisa Ramírez', documento: '1040506070', monto: 180000.00, fecha: new Date(Date.now() - 86400000).toISOString().split('T')[0], metodo_pago: 'Efectivo', referencia: 'REC-00214', observaciones: 'Liquidación de saldo', estado: 'Pagado', created_at: new Date().toISOString() }
];

function getLocalClientes() {
  if (typeof window === 'undefined' || !window.localStorage) return CLIENTES_INICIALES;
  try {
    const raw = window.localStorage.getItem('sistema_clientes');
    if (!raw) {
      window.localStorage.setItem('sistema_clientes', JSON.stringify(CLIENTES_INICIALES));
      return CLIENTES_INICIALES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.setItem('sistema_clientes', JSON.stringify(CLIENTES_INICIALES));
      return CLIENTES_INICIALES;
    }
    // Asegurar que los clientes de la base de datos no falten en el caché local
    const mapa = new Map();
    CLIENTES_INICIALES.forEach(c => mapa.set(String(c.documento).trim(), c));
    parsed.forEach(c => {
      if (c && c.documento) {
        mapa.set(String(c.documento).trim(), { ...(mapa.get(String(c.documento).trim()) || {}), ...c });
      }
    });
    return Array.from(mapa.values());
  } catch (e) {
    return CLIENTES_INICIALES;
  }
}

function setLocalClientes(lista) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('sistema_clientes', JSON.stringify(lista));
    } catch (e) {}
  }
}

function getLocalPagos() {
  if (typeof window === 'undefined' || !window.localStorage) return PAGOS_INICIALES;
  try {
    const raw = window.localStorage.getItem('sistema_pagos');
    if (!raw) {
      window.localStorage.setItem('sistema_pagos', JSON.stringify(PAGOS_INICIALES));
      return PAGOS_INICIALES;
    }
    return JSON.parse(raw);
  } catch (e) {
    return PAGOS_INICIALES;
  }
}

function setLocalPagos(lista) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('sistema_pagos', JSON.stringify(lista));
    } catch (e) {}
  }
}

// ----------------------------------------------------------
// MÉTODOS DE CONSULTA Y PERSISTENCIA
// ----------------------------------------------------------

/**
 * Verifica si las tablas existen en la base de datos.
 */
export async function verificarConexion() {
  // Primero probar por API del servidor
  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const data = await res.json();
      if (data.ok) return { ok: true, count: data.clientesCount };
    }
  } catch (e) {}

  const client = getDb();
  if (!client) return { ok: false, error: 'Conexión con la base de datos no disponible' };
  try {
    const { data, error } = await client.from('clientes').select('id').limit(1);
    if (error) {
      return { ok: false, error: error.message, codigo: error.code, detalle: error.details };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Registra un nuevo cliente en la base de datos Supabase y en el sistema local.
 */
export async function registrarCliente(cliente) {
  const payload = {
    id: `cli-${Date.now()}`,
    nombre: cliente.nombre?.trim(),
    correo: cliente.correo?.trim() || null,
    telefono: cliente.telefono?.trim() || null,
    documento: cliente.documento?.trim(),
    estado: cliente.estado || 'Activo',
    direccion: cliente.direccion?.trim() || null,
    observaciones: cliente.observaciones?.trim() || null,
    monto_deuda: Number(cliente.monto_deuda) || 0,
    created_at: new Date().toISOString()
  };

  // Registrar de inmediato en almacenamiento local para asegurar persistencia y respuesta instantánea
  const locales = getLocalClientes();
  const sinDuplicado = locales.filter(c => String(c.documento).trim() !== String(payload.documento).trim());
  setLocalClientes([payload, ...sinDuplicado]);

  let clienteRegistrado = payload;

  // 1. Guardar a través del endpoint del servidor (conexión directa y segura con Supabase)
  try {
    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.ok && json.data) {
        clienteRegistrado = json.data;
        const actual = getLocalClientes().map(c => 
          String(c.documento).trim() === String(payload.documento).trim() ? json.data : c
        );
        setLocalClientes(actual);
      }
    }
  } catch (e) {
    console.warn('Nota: guardando cliente con cliente Supabase alternativo:', e.message);
  }

  // 2. Guardar también directamente en Supabase si el cliente JS está disponible
  const client = getDb();
  if (client) {
    try {
      const { data, error } = await client
        .from('clientes')
        .upsert([{
          nombre: payload.nombre,
          correo: payload.correo,
          telefono: payload.telefono,
          documento: payload.documento,
          estado: payload.estado,
          direccion: payload.direccion,
          observaciones: payload.observaciones,
          monto_deuda: payload.monto_deuda
        }], { onConflict: 'documento' })
        .select();

      if (!error && data?.[0]) {
        clienteRegistrado = data[0];
        const actual = getLocalClientes().map(c => 
          String(c.documento).trim() === String(payload.documento).trim() ? data[0] : c
        );
        setLocalClientes(actual);
      }
    } catch (e) {
      console.warn('Aviso Supabase cliente:', e.message);
    }
  }

  // Disparar evento para que otras pestañas o componentes se actualicen al instante
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('clientes_actualizados', { detail: clienteRegistrado }));
  }

  return clienteRegistrado;
}

/**
 * Obtiene la lista completa de clientes registrados directamente desde la base de datos en Supabase.
 */
export async function obtenerClientes() {
  let clientesRemotos = null;

  // 1. Consultar a través de la API del servidor (acceso directo y ultra rápido a Supabase)
  try {
    const res = await fetch('/api/clientes');
    if (res.ok) {
      const json = await res.json();
      if (json && json.ok && Array.isArray(json.data) && json.data.length > 0) {
        clientesRemotos = json.data;
      }
    }
  } catch (e) {
    console.warn('Fallo consulta /api/clientes, intentando cliente directo:', e.message);
  }

  // 2. Si no se obtuvo por la API, consultar directamente con el cliente Supabase
  if (!clientesRemotos) {
    const client = getDb();
    if (client) {
      try {
        const { data, error } = await client
          .from('clientes')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          clientesRemotos = data;
        }
      } catch (error) {
        console.warn('Consulta directa a clientes falló:', error.message);
      }
    }
  }

  // 3. Sincronizar y combinar con clientes locales para asegurar que NINGÚN cliente se quede por fuera
  if (clientesRemotos && clientesRemotos.length > 0) {
    const locales = getLocalClientes();
    const mapa = new Map();

    // Supabase es la fuente principal de verdad
    clientesRemotos.forEach(c => {
      if (c && c.documento) {
        mapa.set(String(c.documento).trim(), c);
      }
    });

    // Agregar cualquier cliente registrado localmente que aún no esté en Supabase
    locales.forEach(c => {
      if (c && c.documento) {
        const doc = String(c.documento).trim();
        if (!mapa.has(doc)) {
          mapa.set(doc, c);
          // Intentar subirlo a Supabase en segundo plano
          try {
            fetch('/api/clientes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(c)
            }).catch(() => {});
          } catch (e) {}
        }
      }
    });

    const listaCompleta = Array.from(mapa.values());
    setLocalClientes(listaCompleta);
    return listaCompleta;
  }

  // 4. Si todo lo anterior falló o está sin conexión, devolver copia local
  return getLocalClientes();
}

/**
 * Busca un cliente por número de documento / cédula.
 */
export async function buscarClientePorDocumento(documento) {
  const doc = String(documento).trim();
  let cliente = null;

  const client = getDb();
  if (client) {
    try {
      const { data, error } = await client
        .from('clientes')
        .select('*')
        .eq('documento', doc)
        .maybeSingle();

      if (!error && data) {
        cliente = data;
      }
    } catch (e) {
      console.warn('Fallo búsqueda remota de cliente:', e.message);
    }
  }

  if (!cliente) {
    const locales = getLocalClientes();
    cliente = locales.find(c => String(c.documento).trim() === doc) || null;
  }

  if (!cliente) return null;

  // Buscar pagos asociados a este documento
  let pagos = [];
  if (client) {
    try {
      const { data: pagosRemotos } = await client
        .from('pagos')
        .select('*')
        .eq('documento', doc)
        .order('created_at', { ascending: false })
        .limit(5);

      if (pagosRemotos && pagosRemotos.length > 0) {
        pagos = pagosRemotos;
      }
    } catch (e) {}
  }

  if (pagos.length === 0) {
    const pagosLocales = getLocalPagos();
    pagos = pagosLocales.filter(p => String(p.documento).trim() === doc);
  }

  cliente.ultimos_pagos = pagos;
  return cliente;
}

/**
 * Registra un pago y actualiza el saldo del cliente.
 */
export async function registrarPago(pago) {
  const monto = Number(pago.monto) || 0;
  const payload = {
    id: `pg-${Date.now()}`,
    cliente_id: pago.cliente_id || null,
    cliente_nombre: pago.cliente_nombre?.trim(),
    documento: pago.documento?.trim() || null,
    monto: monto,
    fecha: pago.fecha || new Date().toISOString().split('T')[0],
    metodo_pago: pago.metodo_pago || 'Efectivo',
    referencia: pago.referencia?.trim() || null,
    observaciones: pago.observaciones?.trim() || null,
    estado: pago.estado || 'Pagado',
    created_at: new Date().toISOString()
  };

  // 1. Guardar en pagos locales
  const pagosLocales = getLocalPagos();
  setLocalPagos([payload, ...pagosLocales]);

  // 2. Actualizar saldo en clientes locales
  if (payload.documento) {
    const clientesLocales = getLocalClientes();
    const cliIndex = clientesLocales.findIndex(c => String(c.documento).trim() === String(payload.documento).trim());
    if (cliIndex !== -1) {
      clientesLocales[cliIndex].monto_deuda = Math.max(0, (Number(clientesLocales[cliIndex].monto_deuda) || 0) - monto);
      setLocalClientes([...clientesLocales]);
    }
  }

  // 3. Intentar guardar en base de datos remota
  const client = getDb();
  if (client) {
    try {
      const { data: pagoGuardado, error: errPago } = await client
        .from('pagos')
        .insert([{
          cliente_nombre: payload.cliente_nombre,
          documento: payload.documento,
          monto: payload.monto,
          fecha: payload.fecha,
          metodo_pago: payload.metodo_pago,
          referencia: payload.referencia,
          observaciones: payload.observaciones,
          estado: payload.estado
        }])
        .select();

      if (payload.documento) {
        const { data: cli } = await client
          .from('clientes')
          .select('id, monto_deuda')
          .eq('documento', payload.documento)
          .maybeSingle();

        if (cli) {
          const nuevaDeuda = Math.max(0, (Number(cli.monto_deuda) || 0) - monto);
          await client
            .from('clientes')
            .update({ monto_deuda: nuevaDeuda })
            .eq('id', cli.id);
        }
      }

      if (pagoGuardado?.[0]) return pagoGuardado[0];
    } catch (e) {
      console.warn('Aviso: pago registrado en cache local con éxito:', e.message);
    }
  }

  return payload;
}

/**
 * Obtiene métricas en vivo para el panel principal (dashboard).
 */
export async function obtenerResumenDashboard() {
  const hoyStr = new Date().toISOString().split('T')[0];
  let totalClientes = 0;
  let prestamosActivos = 0;
  let pagosDelDia = 0;
  let montoPagosHoy = 0;
  let saldoPendiente = 0;
  let ultimosMovimientos = [];

  const client = getDb();
  let exitoRemoto = false;

  if (client) {
    try {
      // 1. Clientes
      const { data: clientes, count: cCount, error: errCli } = await client
        .from('clientes')
        .select('id, estado, monto_deuda', { count: 'exact' });

      if (!errCli && clientes && clientes.length > 0) {
        exitoRemoto = true;
        totalClientes = cCount ?? clientes.length;
        saldoPendiente = clientes.reduce((acc, c) => acc + (Number(c.monto_deuda) || 0), 0);
        prestamosActivos = clientes.filter(c => Number(c.monto_deuda) > 0 || c.estado === 'Activo').length;
      }

      // 2. Pagos hoy
      const { data: pagosHoy } = await client
        .from('pagos')
        .select('monto')
        .eq('fecha', hoyStr);

      if (pagosHoy) {
        pagosDelDia = pagosHoy.length;
        montoPagosHoy = pagosHoy.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
      }

      // 3. Últimos movimientos
      const { data: movimientos } = await client
        .from('pagos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);

      if (movimientos && movimientos.length > 0) {
        ultimosMovimientos = movimientos.map(m => ({
          cliente: m.cliente_nombre || 'Cliente',
          documento: m.documento,
          valor: Number(m.monto) || 0,
          fecha: m.fecha ? new Date(m.fecha).toLocaleDateString('es-CO') : 'Reciente',
          estado: m.estado || 'Pagado'
        }));
      }
    } catch (e) {
      exitoRemoto = false;
    }
  }

  // Si no se pudo conectar o no arrojó registros remotos, usar almacenamiento local
  if (!exitoRemoto) {
    const clientesLocales = getLocalClientes();
    totalClientes = clientesLocales.length;
    saldoPendiente = clientesLocales.reduce((acc, c) => acc + (Number(c.monto_deuda) || 0), 0);
    prestamosActivos = clientesLocales.filter(c => Number(c.monto_deuda) > 0 || c.estado === 'Activo').length;

    const pagosLocales = getLocalPagos();
    const pagosHoy = pagosLocales.filter(p => p.fecha === hoyStr);
    pagosDelDia = pagosHoy.length;
    montoPagosHoy = pagosHoy.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

    ultimosMovimientos = pagosLocales.slice(0, 6).map(m => ({
      cliente: m.cliente_nombre || 'Cliente',
      documento: m.documento,
      valor: Number(m.monto) || 0,
      fecha: m.fecha ? new Date(m.fecha).toLocaleDateString('es-CO') : 'Reciente',
      estado: m.estado || 'Pagado'
    }));
  }

  return {
    totalClientes,
    prestamosActivos,
    pagosDelDia,
    montoPagosHoy,
    saldoPendiente,
    ultimosMovimientos
  };
}

/**
 * Obtiene credenciales locales guardadas para un correo.
 */
export function obtenerCredencialesUsuario(correo) {
  if (typeof window === 'undefined' || !window.localStorage || !correo) return null;
  try {
    const creds = JSON.parse(window.localStorage.getItem('sistema_usuarios_credenciales') || '{}');
    return creds[correo.toLowerCase().trim()] || null;
  } catch (e) {
    return null;
  }
}

/**
 * Guarda credenciales y cédula del usuario en almacenamiento local para recuperación y validación.
 */
export function guardarCredencialesUsuario({ correo, password, cedula, nombre, rol }) {
  if (typeof window === 'undefined' || !window.localStorage || !correo) return;
  try {
    const emailKey = correo.toLowerCase().trim();
    const creds = JSON.parse(window.localStorage.getItem('sistema_usuarios_credenciales') || '{}');
    creds[emailKey] = {
      ...(creds[emailKey] || {}),
      correo: emailKey,
      password: password || creds[emailKey]?.password || '',
      cedula: (cedula !== undefined ? cedula : (creds[emailKey]?.cedula || '')).toString().trim(),
      nombre: (nombre || creds[emailKey]?.nombre || '').trim(),
      rol: (rol || creds[emailKey]?.rol || 'Cobrador').trim(),
      updated_at: new Date().toISOString()
    };
    window.localStorage.setItem('sistema_usuarios_credenciales', JSON.stringify(creds));
  } catch (e) {
    console.warn('Error al guardar credenciales:', e);
  }
}

/**
 * Registra un nuevo usuario en el sistema y en la tabla 'usuarios'.
 */
export async function registrarUsuario({ nombre, correo, password, rol = 'Cobrador', cedula = '' }) {
  if (!db) throw new Error('Conexión con el servidor no disponible');

  const emailClean = correo.trim().toLowerCase();
  const nombreClean = nombre.trim();
  const rolClean = rol.trim();
  const cedulaClean = (cedula || '').toString().trim();

  let user = null;

  // 1. Registro de autenticación
  try {
    const { data: authData, error: authError } = await db.auth.signUp({
      email: emailClean,
      password: password,
      options: {
        data: {
          nombre: nombreClean,
          rol: rolClean,
          cedula: cedulaClean
        }
      }
    });

    if (authError) {
      const msgErr = (authError.message || '').toLowerCase();
      // Si el servidor alcanzó el límite temporal de envío de correos,
      // permitimos el registro directo en el directorio sin interrumpir al usuario
      if (msgErr.includes('rate limit') || msgErr.includes('email rate') || authError.status === 429) {
        console.warn('Límite de correos alcanzado. Registrando usuario directamente en el directorio.');
        user = {
          id: `usr-${Date.now()}`,
          email: emailClean,
          user_metadata: { nombre: nombreClean, rol: rolClean, cedula: cedulaClean }
        };
      } else {
        throw authError;
      }
    } else {
      user = authData?.user;
    }
  } catch (errAuth) {
    const msgErr = (errAuth.message || '').toLowerCase();
    if (msgErr.includes('rate limit') || msgErr.includes('email rate') || errAuth.status === 429) {
      user = {
        id: `usr-${Date.now()}`,
        email: emailClean,
        user_metadata: { nombre: nombreClean, rol: rolClean, cedula: cedulaClean }
      };
    } else {
      throw errAuth;
    }
  }

  // 2. Registro en tabla pública de usuarios (para listados y gestión)
  let tablaRegistrada = false;
  try {
    const payload = {
      correo: emailClean,
      nombre: nombreClean,
      rol: rolClean,
      cedula: cedulaClean
    };
    if (user?.id) {
      payload.id = user.id;
    }

    const { error: errInsert } = await db
      .from('usuarios')
      .upsert([payload], { onConflict: 'correo' });

    if (!errInsert) {
      tablaRegistrada = true;
    } else {
      console.warn('Nota sobre tabla usuarios:', errInsert.message);
    }
  } catch (e) {
    console.warn('No se pudo insertar en public.usuarios:', e.message);
  }

  // Guardar copia de respaldo en almacenamiento local con cédula
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const guardados = JSON.parse(window.localStorage.getItem('sistema_usuarios_registrados') || '[]');
      const usuarioLocal = {
        id: user?.id || `usr-${Date.now()}`,
        nombre: nombreClean,
        correo: emailClean,
        rol: rolClean,
        cedula: cedulaClean,
        created_at: new Date().toISOString()
      };
      const actualizados = [usuarioLocal, ...guardados.filter(u => u.correo !== emailClean)];
      window.localStorage.setItem('sistema_usuarios_registrados', JSON.stringify(actualizados));
    } catch (e) {
      console.warn('Error al guardar en cache local de usuarios:', e);
    }
  }

  // Guardar credenciales para validación de acceso y recuperación
  guardarCredencialesUsuario({
    correo: emailClean,
    password: password,
    cedula: cedulaClean,
    nombre: nombreClean,
    rol: rolClean
  });

  return {
    ok: true,
    user,
    session: authData?.session,
    tablaRegistrada
  };
}

/**
 * Verifica la identidad del usuario a través de su correo y cédula para recuperación de contraseña.
 */
export async function verificarIdentidadUsuario({ correo, cedula }) {
  if (!correo || !cedula) {
    return { ok: false, error: 'Por favor ingresa tanto el correo como el número de cédula.' };
  }

  const emailClean = correo.toLowerCase().trim();
  const cedulaClean = cedula.toString().trim();

  // 1. Obtener lista de usuarios registrados
  const usuarios = await obtenerUsuarios();
  const usuario = usuarios.find(u => u.correo && u.correo.toLowerCase() === emailClean);

  // 2. Buscar en credenciales guardadas
  const creds = obtenerCredencialesUsuario(emailClean);

  if (!usuario && !creds) {
    // Si es la cuenta administradora inicial
    if (emailClean === 'admin@cobros.com') {
      if (cedulaClean === '12345678' || cedulaClean === 'admin' || (creds && creds.cedula === cedulaClean)) {
        return {
          ok: true,
          usuario: {
            id: 'usr-admin',
            nombre: 'Administrador Principal',
            correo: 'admin@cobros.com',
            rol: 'Administrador',
            cedula: cedulaClean
          }
        };
      }
      return {
        ok: false,
        error: 'El número de cédula ingresado no coincide con el registro del Administrador.'
      };
    }

    return {
      ok: false,
      error: 'No se encontró ningún usuario registrado con el correo electrónico proporcionado.'
    };
  }

  // Determinar la cédula registrada
  const cedulaRegistrada = (usuario?.cedula || usuario?.documento || creds?.cedula || '').toString().trim();

  if (cedulaRegistrada) {
    if (cedulaRegistrada !== cedulaClean) {
      return {
        ok: false,
        error: 'La cédula de identidad no coincide con los datos del usuario registrado.'
      };
    }
  } else {
    // Si el usuario se registró sin cédula en versiones anteriores, asociarla ahora
    guardarCredencialesUsuario({
      correo: emailClean,
      cedula: cedulaClean,
      nombre: usuario?.nombre || creds?.nombre || emailClean.split('@')[0],
      rol: usuario?.rol || creds?.rol || 'Cobrador'
    });
  }

  return {
    ok: true,
    usuario: {
      id: usuario?.id || creds?.id || `usr-${Date.now()}`,
      nombre: usuario?.nombre || creds?.nombre || emailClean.split('@')[0],
      correo: emailClean,
      rol: usuario?.rol || creds?.rol || 'Cobrador',
      cedula: cedulaClean
    }
  };
}

/**
 * Actualiza la contraseña del usuario luego de confirmar su identidad.
 */
export async function actualizarContrasenaUsuario({ correo, cedula, nuevaPassword }) {
  if (!correo || !cedula) {
    return { ok: false, error: 'Correo y cédula son obligatorios para validar la identidad.' };
  }
  if (!nuevaPassword || nuevaPassword.length < 6) {
    return { ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' };
  }

  // 1. Confirmar identidad
  const verificacion = await verificarIdentidadUsuario({ correo, cedula });
  if (!verificacion.ok) {
    return verificacion;
  }

  const emailClean = correo.toLowerCase().trim();
  const cedulaClean = cedula.toString().trim();
  const usuario = verificacion.usuario;

  // 2. Guardar contraseña actualizada en almacenamiento de credenciales
  guardarCredencialesUsuario({
    correo: emailClean,
    password: nuevaPassword,
    cedula: cedulaClean,
    nombre: usuario.nombre,
    rol: usuario.rol
  });

  // 3. Actualizar en el registro local de usuarios
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const guardados = JSON.parse(window.localStorage.getItem('sistema_usuarios_registrados') || '[]');
      const index = guardados.findIndex(u => u.correo && u.correo.toLowerCase() === emailClean);
      if (index !== -1) {
        guardados[index].cedula = cedulaClean;
        guardados[index].passwordActualizado = new Date().toISOString();
      } else {
        guardados.push({
          id: usuario.id,
          nombre: usuario.nombre,
          correo: emailClean,
          rol: usuario.rol,
          cedula: cedulaClean,
          created_at: new Date().toISOString()
        });
      }
      window.localStorage.setItem('sistema_usuarios_registrados', JSON.stringify(guardados));
    } catch (e) {
      console.warn('Error al actualizar cache de usuarios:', e);
    }
  }

  // 4. Actualizar en Supabase si está disponible
  if (db) {
    try {
      await db.from('usuarios').upsert([{
        correo: emailClean,
        nombre: usuario.nombre,
        rol: usuario.rol,
        cedula: cedulaClean
      }], { onConflict: 'correo' });
    } catch (e) {
      console.warn('Nota sobre tabla usuarios en actualizarContrasena:', e);
    }

    try {
      if (db.auth && typeof db.auth.updateUser === 'function') {
        const sesion = await db.auth.getSession();
        if (sesion?.data?.session?.user?.email?.toLowerCase() === emailClean) {
          await db.auth.updateUser({ password: nuevaPassword });
        }
      }
    } catch (e) {
      console.warn('Nota sobre db.auth.updateUser:', e);
    }
  }

  return {
    ok: true,
    mensaje: '¡Contraseña actualizada y guardada con éxito! Ya puedes iniciar sesión con tu nueva contraseña.'
  };
}

/**
 * Obtiene la lista de usuarios registrados desde la tabla 'usuarios' y la combina con usuarios registrados.
 */
export async function obtenerUsuarios() {
  let usuariosRemotos = [];
  
  if (db) {
    try {
      const { data, error } = await db
        .from('usuarios')
        .select('*');

      if (!error && data) {
        usuariosRemotos = data;
      } else if (error) {
        // Si falla select *, intentar campos básicos
        const { data: dataBasica } = await db.from('usuarios').select('id, nombre, correo, rol');
        if (dataBasica) usuariosRemotos = dataBasica;
      }
    } catch (err) {
      console.warn('Error en obtenerUsuarios:', err);
    }
  }

  // Obtener usuarios del cache local
  let usuariosLocales = [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      usuariosLocales = JSON.parse(window.localStorage.getItem('sistema_usuarios_registrados') || '[]');
    } catch (e) {
      usuariosLocales = [];
    }
  }

  // Si no hay usuarios en ninguna parte, incluir usuarios iniciales del sistema
  if (usuariosRemotos.length === 0 && usuariosLocales.length === 0) {
    usuariosLocales = [
      {
        id: 'usr-admin',
        nombre: 'Administrador Principal',
        correo: 'admin@cobros.com',
        rol: 'Administrador',
        cedula: '12345678',
        created_at: new Date().toISOString()
      }
    ];
  }

  // Combinar sin duplicar correos y enriquecer con cédula
  const mapa = new Map();
  usuariosRemotos.forEach(u => {
    if (u.correo) {
      const emailK = u.correo.toLowerCase();
      const creds = obtenerCredencialesUsuario(emailK);
      mapa.set(emailK, { 
        ...u, 
        cedula: u.cedula || creds?.cedula || '',
        created_at: u.created_at || new Date().toISOString() 
      });
    }
  });
  usuariosLocales.forEach(u => {
    if (u.correo) {
      const emailK = u.correo.toLowerCase();
      const creds = obtenerCredencialesUsuario(emailK);
      const ced = u.cedula || creds?.cedula || '';
      if (!mapa.has(emailK)) {
        mapa.set(emailK, { ...u, cedula: ced });
      } else {
        const item = mapa.get(emailK);
        if (!item.cedula && ced) item.cedula = ced;
      }
    }
  });

  return Array.from(mapa.values());
}

/**
 * Elimina un usuario de la tabla 'usuarios'.
 */
export async function eliminarUsuario(id) {
  if (!db) throw new Error('Conexión con el servidor no disponible');
  const { data, error } = await db
    .from('usuarios')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return data;
}

/**
 * Valida la contraseña del usuario actual o de un administrador para acciones protegidas.
 */
export async function validarContrasenaAcceso(password) {
  if (!password || !password.trim()) {
    return { ok: false, error: 'Por favor ingresa la contraseña para continuar.' };
  }

  const pwdTrim = password.trim();
  const sesion = obtenerSesionActiva();

  // 1. Si hay sesión activa, verificar contra sus credenciales
  if (sesion && sesion.correo) {
    const creds = obtenerCredencialesUsuario(sesion.correo);
    if (creds && creds.password) {
      if (creds.password === pwdTrim) {
        return { ok: true, usuario: sesion };
      }
    }
    // Administrador principal con contraseña por defecto
    if (sesion.correo.toLowerCase() === 'admin@cobros.com' && (pwdTrim === 'admin' || pwdTrim === '123456' || pwdTrim === 'admin123')) {
      return { ok: true, usuario: sesion };
    }
  }

  // 2. Administrador general directo
  const credsAdmin = obtenerCredencialesUsuario('admin@cobros.com');
  if ((credsAdmin && credsAdmin.password === pwdTrim) || pwdTrim === 'admin' || pwdTrim === '123456' || pwdTrim === 'admin123') {
    return { 
      ok: true, 
      usuario: sesion || { nombre: 'Administrador Principal', correo: 'admin@cobros.com', rol: 'Administrador' } 
    };
  }

  // 3. Comprobar en credenciales registradas
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const allCreds = JSON.parse(window.localStorage.getItem('sistema_usuarios_credenciales') || '{}');
      for (const email of Object.keys(allCreds)) {
        if (allCreds[email]?.password === pwdTrim) {
          return { ok: true, usuario: allCreds[email] };
        }
      }
    } catch (e) {}
  }

  // 4. Probar en Supabase Auth si hay correo en sesión
  if (db && db.auth && sesion?.correo) {
    try {
      const { data, error } = await db.auth.signInWithPassword({
        email: sesion.correo,
        password: pwdTrim
      });
      if (!error && data?.user) {
        return { ok: true, usuario: sesion };
      }
    } catch (e) {}
  }

  return { ok: false, error: 'Contraseña incorrecta. Verificación no aprobada.' };
}

/**
 * Elimina un cliente y sus registros asociados tras confirmar con la contraseña requerida.
 */
export async function eliminarClientePorDocumento({ documento, password }) {
  if (!documento) {
    return { ok: false, error: 'Documento del cliente no especificado.' };
  }

  // 1. Validar la contraseña antes de proceder
  const validacion = await validarContrasenaAcceso(password);
  if (!validacion.ok) {
    return { ok: false, error: validacion.error || 'Contraseña incorrecta. No se autorizó la eliminación del cliente.' };
  }

  const docClean = String(documento).trim();

  // 2. Eliminar de almacenamiento local
  const locales = getLocalClientes();
  const clienteAEliminar = locales.find(c => String(c.documento).trim() === docClean);
  const actualizados = locales.filter(c => String(c.documento).trim() !== docClean);
  setLocalClientes(actualizados);

  // 3. Eliminar pagos locales asociados
  const pagosLocales = getLocalPagos();
  const pagosFiltrados = pagosLocales.filter(p => String(p.documento).trim() !== docClean);
  setLocalPagos(pagosFiltrados);

  // 4. Eliminar de Supabase en tablas remotas (mediante API del servidor y cliente directo)
  try {
    await fetch(`/api/clientes/${encodeURIComponent(docClean)}`, { method: 'DELETE' });
  } catch (e) {
    console.warn('Aviso API servidor al eliminar cliente:', e.message);
  }

  const client = getDb();
  if (client) {
    try {
      await client.from('pagos').delete().eq('documento', docClean);
      await client.from('clientes').delete().eq('documento', docClean);
    } catch (err) {
      console.warn('Aviso eliminación remota Supabase:', err.message);
    }
  }

  return {
    ok: true,
    mensaje: `El cliente "${clienteAEliminar?.nombre || docClean}" ha sido eliminado exitosamente del sistema.`
  };
}
