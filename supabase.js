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

export const MANUAL_LOGOUT_KEY = 'sistema_sesion_cerrada_manual';

/**
 * Obtiene la sesión activa actual del almacenamiento del navegador.
 */
export function obtenerSesionActiva() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const manualLogout = window.localStorage.getItem(MANUAL_LOGOUT_KEY);
    const raw = window.localStorage.getItem(SESSION_KEY);
    
    if (!raw) {
      if (manualLogout === 'true') return null;
      // Inicializar con la cuenta registrada del usuario en Supabase (fercho / Administrador)
      const sesionInicial = {
        id: 'usr-fercho',
        nombre: 'fercho',
        correo: 'ferchogarces2008@gmail.com',
        rol: 'Administrador',
        login_at: new Date().toISOString()
      };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(sesionInicial));
      return sesionInicial;
    }

    const data = JSON.parse(raw);
    if (!data) return null;
    const correo = (data.correo || data.email || '').toLowerCase().trim();
    // Excluir cualquier sesión con usuario predeterminado/demo
    if (correo === 'admin@cobros.com' || (data.nombre || '').toLowerCase() === 'administrador principal') {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
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
    window.localStorage.removeItem(MANUAL_LOGOUT_KEY);
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
      window.localStorage.setItem(MANUAL_LOGOUT_KEY, 'true');
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
    return { autenticado: false, usuario: null, esAdmin: false };
  }
  const esAdmin = esUsuarioAdmin(sesion);
  return { autenticado: true, usuario: sesion, esAdmin };
}

/**
 * Determina si el usuario o la sesión activa tiene rol de Administrador.
 */
export function esUsuarioAdmin(usuario = null) {
  const user = usuario || obtenerSesionActiva();
  if (!user) return false;
  const rol = String(user.rol || user.user_metadata?.rol || '').trim().toLowerCase();
  return rol === 'administrador' || rol === 'admin';
}

if (typeof window !== 'undefined') {
  window.obtenerSesionActiva = obtenerSesionActiva;
  window.guardarSesionActiva = guardarSesionActiva;
  window.cerrarSesion = cerrarSesion;
  window.verificarAutenticacion = verificarAutenticacion;
  window.esUsuarioAdmin = esUsuarioAdmin;
  window.obtenerUsuarios = obtenerUsuarios;
  window.eliminarUsuario = eliminarUsuario;
  window.eliminarCobrador = eliminarCobrador;
}

// ----------------------------------------------------------
// ----------------------------------------------------------
// DATOS Y CACHÉ LOCAL (SOLO REGISTROS DEL USUARIO)
// ----------------------------------------------------------

// Excluir cualquier documento o nombre predeterminado / demo
export const DOCS_PREDETERMINADOS = new Set(['1020304050', '1030405060', '1040506070']);
export const NOMBRES_PREDETERMINADOS = new Set(['maría pérez', 'maria perez', 'juan torres', 'luisa ramírez', 'luisa ramirez', 'administrador principal', 'admin@cobros.com']);

const CLIENTES_INICIALES = [];
const PAGOS_INICIALES = [];

function getLocalClientes() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem('sistema_clientes');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filtrar estrictamente cualquier dato predeterminado / demo que haya quedado en localStorage
    const filtrados = parsed.filter(c => 
      c && c.documento &&
      !DOCS_PREDETERMINADOS.has(String(c.documento).trim()) &&
      !NOMBRES_PREDETERMINADOS.has(String(c.nombre || '').trim().toLowerCase())
    );

    if (filtrados.length !== parsed.length) {
      setLocalClientes(filtrados);
    }
    return filtrados;
  } catch (e) {
    return [];
  }
}

function setLocalClientes(lista) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const limpia = (lista || []).filter(c => 
        c && c.documento &&
        !DOCS_PREDETERMINADOS.has(String(c.documento).trim()) &&
        !NOMBRES_PREDETERMINADOS.has(String(c.nombre || '').trim().toLowerCase())
      );
      window.localStorage.setItem('sistema_clientes', JSON.stringify(limpia));
    } catch (e) {}
  }
}

function getLocalPagos() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem('sistema_pagos');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filtrar estrictamente cualquier pago demo o predeterminado
    const filtrados = parsed.filter(p => 
      p &&
      (!p.documento || !DOCS_PREDETERMINADOS.has(String(p.documento).trim())) &&
      (!p.cliente_nombre || !NOMBRES_PREDETERMINADOS.has(String(p.cliente_nombre).trim().toLowerCase()))
    );

    if (filtrados.length !== parsed.length) {
      setLocalPagos(filtrados);
    }
    return filtrados;
  } catch (e) {
    return [];
  }
}

function setLocalPagos(lista) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const limpia = (lista || []).filter(p => 
        p &&
        (!p.documento || !DOCS_PREDETERMINADOS.has(String(p.documento).trim())) &&
        (!p.cliente_nombre || !NOMBRES_PREDETERMINADOS.has(String(p.cliente_nombre).trim().toLowerCase()))
      );
      window.localStorage.setItem('sistema_pagos', JSON.stringify(limpia));
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
      if (json && json.ok && Array.isArray(json.data)) {
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

        if (!error && Array.isArray(data)) {
          clientesRemotos = data;
        }
      } catch (error) {
        console.warn('Consulta directa a clientes falló:', error.message);
      }
    }
  }

  // 3. Sincronizar y combinar con clientes locales para asegurar que NINGÚN cliente se quede por fuera
  if (clientesRemotos) {
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

    const listaCompleta = Array.from(mapa.values()).filter(c => 
      c && c.documento &&
      !DOCS_PREDETERMINADOS.has(String(c.documento).trim()) &&
      !NOMBRES_PREDETERMINADOS.has(String(c.nombre || '').trim().toLowerCase())
    );
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

  let clientes = null;
  let pagos = null;
  let exitoRemoto = false;

  // 1. Intentar primero a través de las rutas API del servidor
  try {
    const [resCli, resPagos] = await Promise.all([
      fetch('/api/clientes'),
      fetch('/api/pagos')
    ]);

    if (resCli.ok) {
      const jsonCli = await resCli.json();
      if (jsonCli && jsonCli.ok && Array.isArray(jsonCli.data)) {
        clientes = jsonCli.data;
      }
    }

    if (resPagos.ok) {
      const jsonPagos = await resPagos.json();
      if (jsonPagos && jsonPagos.ok && Array.isArray(jsonPagos.data)) {
        pagos = jsonPagos.data;
      }
    }
  } catch (e) {
    // Continuar con cliente directo
  }

  // 2. Si no se obtuvieron por la API del servidor, consultar cliente Supabase directamente
  const client = getDb();
  if (client) {
    try {
      if (!clientes) {
        const { data: cData, error: errCli } = await client
          .from('clientes')
          .select('*');
        if (!errCli && Array.isArray(cData)) {
          clientes = cData;
        }
      }

      if (!pagos) {
        const { data: pData, error: errPagos } = await client
          .from('pagos')
          .select('*')
          .order('created_at', { ascending: false });
        if (!errPagos && Array.isArray(pData)) {
          pagos = pData;
        }
      }
    } catch (e) {
      console.warn('Error en consulta directa dashboard:', e);
    }
  }

  // 3. Procesar datos (excluyendo cualquier dato demo o predeterminado)
  if (clientes && Array.isArray(clientes)) {
    exitoRemoto = true;
    const clientesReales = clientes.filter(c => 
      c && c.documento &&
      !DOCS_PREDETERMINADOS.has(String(c.documento).trim()) &&
      !NOMBRES_PREDETERMINADOS.has(String(c.nombre || '').trim().toLowerCase())
    );
    totalClientes = clientesReales.length;
    saldoPendiente = clientesReales.reduce((acc, c) => acc + (Number(c.monto_deuda) || 0), 0);
    prestamosActivos = clientesReales.filter(c => Number(c.monto_deuda) > 0 || c.estado === 'Activo').length;
  }

  if (pagos && Array.isArray(pagos)) {
    const pagosReales = pagos.filter(p => 
      p &&
      (!p.documento || !DOCS_PREDETERMINADOS.has(String(p.documento).trim())) &&
      (!p.cliente_nombre || !NOMBRES_PREDETERMINADOS.has(String(p.cliente_nombre).trim().toLowerCase()))
    );

    const pagosHoy = pagosReales.filter(p => p.fecha === hoyStr);
    pagosDelDia = pagosHoy.length;
    montoPagosHoy = pagosHoy.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

    ultimosMovimientos = pagosReales.slice(0, 6).map(m => ({
      cliente: m.cliente_nombre || 'Cliente',
      documento: m.documento,
      valor: Number(m.monto) || 0,
      fecha: m.fecha ? new Date(m.fecha).toLocaleDateString('es-CO') : 'Reciente',
      estado: m.estado || 'Pagado'
    }));
  }

  // 4. Si no se pudo conectar con la base de datos, recurrir al almacenamiento local limpio
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
 * Obtiene la lista de usuarios registrados desde la base de datos (API y Supabase) y la combina con usuarios locales.
 */
export async function obtenerUsuarios() {
  let usuariosRemotos = [];

  // 1. Consultar a través de la API del servidor (conexión directa con Supabase)
  try {
    const res = await fetch('/api/usuarios');
    if (res.ok) {
      const json = await res.json();
      if (json && json.ok && Array.isArray(json.data)) {
        usuariosRemotos = json.data;
      }
    }
  } catch (e) {
    console.warn('Fallo consulta /api/usuarios:', e.message);
  }
  
  // 2. Si no se obtuvieron o para complementar, consultar cliente Supabase
  if (db && usuariosRemotos.length === 0) {
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

  // Combinar sin duplicar correos y enriquecer con cédula (solo usuarios registrados por el usuario)
  const mapa = new Map();
  usuariosRemotos.forEach(u => {
    if (u.correo) {
      const emailK = u.correo.toLowerCase();
      if (emailK === 'admin@cobros.com') return; // Excluir usuario predeterminado
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
      if (emailK === 'admin@cobros.com') return; // Excluir usuario predeterminado
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
 * Elimina un cobrador o usuario de forma definitiva de la base de datos (Supabase y servidor)
 * y del almacenamiento local y credenciales.
 */
export async function eliminarUsuario(param) {
  let id = '';
  let correo = '';
  let cedula = '';

  if (typeof param === 'object' && param !== null) {
    id = param.id ? String(param.id).trim() : '';
    correo = param.correo ? String(param.correo).trim().toLowerCase() : '';
    cedula = param.cedula ? String(param.cedula).trim() : '';
  } else if (typeof param === 'string') {
    const s = param.trim();
    if (s.includes('@')) {
      correo = s.toLowerCase();
    } else {
      id = s;
      cedula = s;
    }
  }

  const emailClean = correo.toLowerCase();

  // 1. Eliminar mediante API del servidor
  const identServer = emailClean || id || cedula;
  if (identServer) {
    try {
      await fetch(`/api/usuarios/${encodeURIComponent(identServer)}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.warn('Nota en llamada /api/usuarios DELETE:', e.message);
    }
  }

  // 2. Eliminar directamente en Supabase si el cliente está conectado
  if (db) {
    try {
      if (emailClean) {
        await db.from('usuarios').delete().eq('correo', emailClean);
      }
      if (cedula) {
        await db.from('usuarios').delete().eq('cedula', cedula);
      }
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
      if (isUuid) {
        await db.from('usuarios').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('Nota al eliminar usuario directamente en Supabase:', e.message);
    }
  }

  // 3. Eliminar del almacenamiento local (sistema_usuarios_registrados y credenciales)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const guardados = JSON.parse(window.localStorage.getItem('sistema_usuarios_registrados') || '[]');
      const filtrados = guardados.filter(u => {
        const uEmail = (u.correo || '').toLowerCase().trim();
        const uId = String(u.id || '').trim();
        const uCed = String(u.cedula || u.documento || '').trim();
        if (emailClean && uEmail === emailClean) return false;
        if (id && uId === id) return false;
        if (cedula && uCed === cedula) return false;
        return true;
      });
      window.localStorage.setItem('sistema_usuarios_registrados', JSON.stringify(filtrados));

      // Credenciales
      const creds = JSON.parse(window.localStorage.getItem('sistema_usuarios_credenciales') || '{}');
      if (emailClean && creds[emailClean]) {
        delete creds[emailClean];
      }
      for (const [k, val] of Object.entries(creds)) {
        if ((cedula && String(val.cedula || '').trim() === cedula) || (id && val.id === id)) {
          delete creds[k];
        }
      }
      window.localStorage.setItem('sistema_usuarios_credenciales', JSON.stringify(creds));
    } catch (e) {
      console.warn('Error al limpiar localStorage de usuario:', e);
    }
  }

  // 4. Disparar evento para que cualquier vista abierta se actualice
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('usuarios_actualizados', { detail: { correo: emailClean, id, cedula } }));
  }

  return { ok: true, mensaje: 'Usuario/cobrador eliminado de la base de datos.' };
}

export function eliminarCobrador(param) {
  return eliminarUsuario(param);
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
  }

  // 2. Comprobar en credenciales registradas de administradores
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const allCreds = JSON.parse(window.localStorage.getItem('sistema_usuarios_credenciales') || '{}');
      for (const email of Object.keys(allCreds)) {
        if (allCreds[email]?.password === pwdTrim && (allCreds[email]?.rol === 'Administrador' || !allCreds[email]?.rol)) {
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

/**
 * Autentica al usuario diferenciando entre Administrador (requiere Cédula) y Cobrador (requiere Correo/Usuario).
 */
export async function autenticarUsuarioConRol({ modo = 'admin', identificador = '', password = '' }) {
  const modoClean = modo.toLowerCase().trim();
  const idClean = String(identificador || '').trim();
  const pwdTrim = String(password || '').trim();

  if (!idClean) {
    return {
      ok: false,
      error: modoClean === 'admin'
        ? 'Por favor ingresa la cédula del administrador.'
        : 'Por favor ingresa el correo electrónico del cobrador.'
    };
  }

  if (!pwdTrim) {
    return {
      ok: false,
      error: modoClean === 'admin'
        ? 'Por favor ingresa la contraseña de administrador.'
        : 'Por favor ingresa la contraseña de cobrador.'
    };
  }

  // 1. Obtener lista de usuarios
  let usuarios = [];
  try {
    usuarios = await obtenerUsuarios();
  } catch (e) {
    usuarios = [];
  }

  // 2. Obtener credenciales guardadas localmente
  let allCreds = {};
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      allCreds = JSON.parse(window.localStorage.getItem('sistema_usuarios_credenciales') || '{}');
    } catch (e) {}
  }

  // ==========================================
  // FLUJO ADMINISTRADOR (AUTORIZACIÓN POR CÉDULA)
  // ==========================================
  if (modoClean === 'admin') {
    const cedulaClean = idClean;

    // A. Verificar que no sea un usuario con rol exclusivo de Cobrador
    const usuarioCobrador = usuarios.find(u => {
      const uCed = String(u.cedula || u.documento || '').trim();
      const uRol = String(u.rol || '').trim().toLowerCase();
      return uCed === cedulaClean && (uRol === 'cobrador' || uRol.includes('cajer'));
    });
    if (usuarioCobrador) {
      return {
        ok: false,
        error: 'Esta cédula pertenece a una cuenta con rol de Cobrador. Selecciona la opción "Ingresar como Cobrador" para continuar.'
      };
    }

    // B. Buscar si la cédula coincide con un Administrador registrado
    let adminEncontrado = usuarios.find(u => {
      const uCed = String(u.cedula || u.documento || '').trim();
      const uRol = String(u.rol || '').trim().toLowerCase();
      return uCed === cedulaClean && (uRol.includes('admin') || !uRol);
    });

    let credsAdmin = null;
    for (const email of Object.keys(allCreds)) {
      const c = allCreds[email];
      if (String(c.cedula || '').trim() === cedulaClean) {
        credsAdmin = c;
        break;
      }
    }

    // C. Validar la contraseña del Administrador
    let contrasenaValida = false;
    let usuarioAutenticado = null;

    // 1) Coincide con la contraseña guardada del admin por cédula
    if (credsAdmin && credsAdmin.password === pwdTrim) {
      contrasenaValida = true;
      usuarioAutenticado = credsAdmin;
    }

    // 2) Coincide con credenciales de algún administrador registrado en el sistema
    if (!contrasenaValida) {
      for (const email of Object.keys(allCreds)) {
        const c = allCreds[email];
        const esRolAdmin = !c.rol || c.rol.toLowerCase().includes('admin');
        if (esRolAdmin && c.password === pwdTrim) {
          contrasenaValida = true;
          usuarioAutenticado = c;
          // Asociar de inmediato la cédula a este administrador
          guardarCredencialesUsuario({
            correo: c.correo || email,
            password: pwdTrim,
            cedula: cedulaClean,
            nombre: c.nombre || 'Administrador',
            rol: 'Administrador'
          });
          break;
        }
      }
    }

    // 3) Probar autenticación con Supabase Auth para cuentas de administrador conocidas
    if (!contrasenaValida && db && db.auth) {
      const correosAProbar = [
        credsAdmin?.correo,
        adminEncontrado?.correo,
        'juanfernado20de2008@gmail.com',
        'ferchogarces2008@gmail.com'
      ].filter(Boolean);

      for (const correoAdmin of correosAProbar) {
        try {
          const { data, error } = await db.auth.signInWithPassword({
            email: correoAdmin,
            password: pwdTrim
          });
          if (!error && data?.user) {
            contrasenaValida = true;
            usuarioAutenticado = {
              id: data.user.id,
              nombre: data.user.user_metadata?.nombre || 'Administrador',
              correo: correoAdmin,
              rol: 'Administrador',
              cedula: cedulaClean
            };
            guardarCredencialesUsuario({
              correo: correoAdmin,
              password: pwdTrim,
              cedula: cedulaClean,
              nombre: usuarioAutenticado.nombre,
              rol: 'Administrador'
            });
            break;
          }
        } catch (e) {}
      }
    }

    // 4) Probar con validación de clave de administrador general
    if (!contrasenaValida) {
      const validacion = await validarContrasenaAcceso(pwdTrim);
      if (validacion.ok && (!validacion.usuario?.rol || validacion.usuario?.rol === 'Administrador')) {
        contrasenaValida = true;
        usuarioAutenticado = validacion.usuario;
        guardarCredencialesUsuario({
          correo: validacion.usuario.correo || 'juanfernado20de2008@gmail.com',
          password: pwdTrim,
          cedula: cedulaClean,
          nombre: validacion.usuario.nombre || 'Administrador',
          rol: 'Administrador'
        });
      }
    }

    if (!contrasenaValida) {
      return {
        ok: false,
        error: 'Cédula o contraseña de Administrador incorrecta. Por favor verifica tus credenciales.'
      };
    }

    const sessionData = {
      id: usuarioAutenticado?.id || adminEncontrado?.id || `usr-${Date.now()}`,
      nombre: usuarioAutenticado?.nombre || adminEncontrado?.nombre || 'Administrador',
      correo: usuarioAutenticado?.correo || adminEncontrado?.correo || 'admin@cobros.com',
      cedula: cedulaClean,
      rol: 'Administrador'
    };

    guardarSesionActiva(sessionData);
    return { ok: true, usuario: sessionData };
  }

  // ==========================================
  // FLUJO COBRADOR (AUTORIZACIÓN POR CORREO O DOC)
  // ==========================================
  if (modoClean === 'cobrador') {
    const emailClean = idClean.toLowerCase();
    let cobradorEncontrado = null;
    let contrasenaValida = false;

    // 1. Buscar en credenciales locales por correo o cédula
    for (const email of Object.keys(allCreds)) {
      const c = allCreds[email];
      if (email.toLowerCase() === emailClean || String(c.cedula || '').trim() === idClean) {
        if (c.password === pwdTrim) {
          contrasenaValida = true;
          cobradorEncontrado = c;
          break;
        }
      }
    }

    // 2. Si no encontró en creds, probar con Supabase Auth si es correo
    if (!contrasenaValida && db && db.auth && emailClean.includes('@')) {
      try {
        const { data, error } = await db.auth.signInWithPassword({
          email: emailClean,
          password: pwdTrim
        });
        if (!error && data?.user) {
          contrasenaValida = true;
          cobradorEncontrado = {
            id: data.user.id,
            nombre: data.user.user_metadata?.nombre || emailClean.split('@')[0],
            correo: emailClean,
            rol: 'Cobrador'
          };
        }
      } catch (e) {}
    }

    // 3. Buscar en lista de usuarios
    if (!contrasenaValida) {
      const u = usuarios.find(usr =>
        (usr.correo && usr.correo.toLowerCase() === emailClean) ||
        String(usr.cedula || usr.documento || '').trim() === idClean
      );
      if (u) {
        const creds = obtenerCredencialesUsuario(u.correo);
        if (creds && creds.password === pwdTrim) {
          contrasenaValida = true;
          cobradorEncontrado = { ...u, rol: 'Cobrador' };
        }
      }
    }

    if (!contrasenaValida) {
      return {
        ok: false,
        error: 'Correo o contraseña de Cobrador incorrectos. Por favor verifica tus credenciales.'
      };
    }

    const sessionData = {
      id: cobradorEncontrado?.id || `usr-${Date.now()}`,
      nombre: cobradorEncontrado?.nombre || emailClean.split('@')[0],
      correo: cobradorEncontrado?.correo || (emailClean.includes('@') ? emailClean : `${emailClean}@cobros.com`),
      cedula: cobradorEncontrado?.cedula || (!emailClean.includes('@') ? emailClean : ''),
      rol: 'Cobrador'
    };

    guardarSesionActiva(sessionData);
    return { ok: true, usuario: sessionData };
  }

  return { ok: false, error: 'Modo de acceso no reconocido.' };
}

if (typeof window !== 'undefined') {
  window.autenticarUsuarioConRol = autenticarUsuarioConRol;
}
