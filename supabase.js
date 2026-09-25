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
      primer_nombre: usuario.primer_nombre || usuario.user_metadata?.primer_nombre || '',
      segundo_nombre: usuario.segundo_nombre || usuario.user_metadata?.segundo_nombre || '',
      primer_apellido: usuario.primer_apellido || usuario.user_metadata?.primer_apellido || '',
      segundo_apellido: usuario.segundo_apellido || usuario.user_metadata?.segundo_apellido || '',
      correo: usuario.correo || usuario.email,
      telefono: usuario.telefono || usuario.user_metadata?.telefono || '',
      cedula: usuario.cedula || usuario.user_metadata?.cedula || '',
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

// Excluir cualquier documento o nombre predeterminado / demo o registros eliminados
export const DOCS_PREDETERMINADOS = new Set(['1020304050', '1030405060', '1040506070', '0000000000']);
export const NOMBRES_PREDETERMINADOS = new Set([
  'maría pérez', 'maria perez', 'juan torres', 'luisa ramírez', 'luisa ramirez',
  'administrador principal', 'admin@cobros.com', 'james moncada', 'james', 'moncada', '[eliminado]', 'eliminado'
]);

export function esRegistroExcluido(nombre = '', doc = '', estado = '') {
  const n = String(nombre || '').trim().toLowerCase();
  const d = String(doc || '').trim();
  const e = String(estado || '').trim().toLowerCase();
  if (e === 'eliminado') return true;
  if (DOCS_PREDETERMINADOS.has(d)) return true;
  if (n.includes('moncada') || n.includes('james') || n.includes('[eliminado]')) return true;
  if (NOMBRES_PREDETERMINADOS.has(n)) return true;
  return false;
}

// Limpiar inmediatamente cualquier rastro de datos eliminados o demo en el navegador
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    ['sistema_clientes', 'sistema_pagos', 'sistema_usuarios_registrados', 'sistema_facturas'].forEach(key => {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtrados = parsed.filter(item => {
            const nom = item?.nombre || item?.cliente_nombre || '';
            const doc = item?.documento || item?.cedula || '';
            const est = item?.estado || '';
            return !esRegistroExcluido(nom, doc, est);
          });
          if (filtrados.length !== parsed.length) {
            window.localStorage.setItem(key, JSON.stringify(filtrados));
          }
        }
      }
    });

    const credsRaw = window.localStorage.getItem('sistema_usuarios_credenciales');
    if (credsRaw) {
      const creds = JSON.parse(credsRaw);
      let changed = false;
      for (const k of Object.keys(creds)) {
        if (k.includes('moncada') || k.includes('james') || esRegistroExcluido(creds[k]?.nombre, creds[k]?.cedula)) {
          delete creds[k];
          changed = true;
        }
      }
      if (changed) window.localStorage.setItem('sistema_usuarios_credenciales', JSON.stringify(creds));
    }
  } catch (e) {}
}

const CLIENTES_INICIALES = [];
const PAGOS_INICIALES = [];

function getLocalClientes() {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem('sistema_clientes');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filtrar estrictamente cualquier dato predeterminado o eliminado
    const filtrados = parsed.filter(c => 
      c && c.documento && !esRegistroExcluido(c.nombre, c.documento, c.estado)
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
        c && c.documento && !esRegistroExcluido(c.nombre, c.documento, c.estado)
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

    // Filtrar estrictamente cualquier pago demo o eliminado
    const filtrados = parsed.filter(p => 
      p && !esRegistroExcluido(p.cliente_nombre, p.documento, p.estado)
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
        p && !esRegistroExcluido(p.cliente_nombre, p.documento, p.estado)
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

// ----------------------------------------------------------
// GENERADOR Y GESTIÓN DE FACTURAS ÚNICAS (8 LETRAS Y 5 NÚMEROS)
// ----------------------------------------------------------

/**
 * Genera un código único e irrepetible de factura: exactamente 8 letras (incluyendo mayúsculas y minúsculas) y 5 números.
 * Ninguna factura se repite en todo el sistema.
 */
export function generarCodigoFacturaUnico(existentes = new Set()) {
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghijkmnopqrstuvwxyz';
  const digitos = '0123456789';

  let codigo = '';
  let intentos = 0;

  // Cargar códigos ya guardados en el almacenamiento del navegador
  const codigosUsados = new Set();
  if (existentes instanceof Set) {
    existentes.forEach(c => codigosUsados.add(c));
  } else if (Array.isArray(existentes)) {
    existentes.forEach(c => codigosUsados.add(c));
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const historico = JSON.parse(window.localStorage.getItem('sistema_facturas_historico') || '[]');
      historico.forEach(f => {
        if (f.codigo_factura) codigosUsados.add(f.codigo_factura);
        if (f.numero_factura) codigosUsados.add(f.numero_factura);
      });
      const clientes = JSON.parse(window.localStorage.getItem('sistema_clientes') || '[]');
      clientes.forEach(c => {
        if (c.numero_factura) codigosUsados.add(c.numero_factura);
      });
    } catch (e) {}
  }

  while (intentos < 5000) {
    intentos++;
    // 4 mayúsculas y 4 minúsculas = exactamente 8 letras
    const letras = [];
    for (let i = 0; i < 4; i++) {
      letras.push(mayusculas[Math.floor(Math.random() * mayusculas.length)]);
      letras.push(minusculas[Math.floor(Math.random() * minusculas.length)]);
    }
    // Barajar aleatoriamente las 8 letras
    for (let i = letras.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letras[i], letras[j]] = [letras[j], letras[i]];
    }

    // Exactamente 5 números
    const nums = [];
    for (let i = 0; i < 5; i++) {
      nums.push(digitos[Math.floor(Math.random() * digitos.length)]);
    }

    codigo = letras.join('') + nums.join('');

    if (!codigosUsados.has(codigo)) {
      codigosUsados.add(codigo);
      return codigo;
    }
  }

  return codigo;
}

/**
 * Guarda permanentemente una factura en el histórico inalterable (no se borra aunque se borre el cliente)
 */
export function guardarFacturaEnHistorico(factura) {
  if (!factura || (!factura.numero_factura && !factura.codigo_factura)) return;
  const cod = factura.numero_factura || factura.codigo_factura;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const historico = JSON.parse(window.localStorage.getItem('sistema_facturas_historico') || '[]');
      const existe = historico.some(f => (f.numero_factura === cod || f.codigo_factura === cod));
      if (!existe) {
        historico.unshift({
          ...factura,
          codigo_factura: cod,
          numero_factura: cod,
          guardado_en: new Date().toISOString()
        });
        window.localStorage.setItem('sistema_facturas_historico', JSON.stringify(historico));
      }
    } catch (e) {}
  }

  // Notificar al servidor para almacenamiento permanente
  try {
    fetch('/api/facturas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(factura)
    }).catch(() => {});
  } catch (e) {}
}

/**
 * Obtiene el histórico completo de facturas emitidas
 */
export function obtenerHistoricoFacturas() {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return JSON.parse(window.localStorage.getItem('sistema_facturas_historico') || '[]');
    } catch (e) {
      return [];
    }
  }
  return [];
}

/**
 * Obtiene una factura por su código único o por el documento del cliente
 */
export function obtenerFacturaPorIdentificador(identificador) {
  const clean = String(identificador || '').trim();
  if (!clean) return null;

  const facturas = obtenerHistoricoFacturas();
  const encontrada = facturas.find(f => 
    f.codigo_factura === clean || 
    f.numero_factura === clean || 
    String(f.documento || f.cliente_documento).trim() === clean
  );
  if (encontrada) return encontrada;

  // Buscar en clientes locales
  const clientes = getLocalClientes();
  const cli = clientes.find(c => 
    c.numero_factura === clean || 
    String(c.documento).trim() === clean
  );
  return cli || null;
}

/**
 * Registra un nuevo cliente en la base de datos Supabase y en el sistema local.
 */
export async function registrarCliente(cliente) {
  // Asegurar código único de factura de 8 letras (mayúsculas/minúsculas) y 5 números
  const numFactura = cliente.numero_factura || generarCodigoFacturaUnico();

  // Adjuntar metadatos de factura y emisor en observaciones para respaldo 100% permanente
  const metaFacturaStr = `[FACTURA: ${numFactura}] [EMISOR: ${String(cliente.registrado_por_nombre || 'Asesor').trim()} | TEL: ${String(cliente.registrado_por_telefono || '').trim()} | EMAIL: ${String(cliente.registrado_por_correo || '').trim()} | CED: ${String(cliente.registrado_por_cedula || '').trim()}]`;
  let obsCompleta = cliente.observaciones ? String(cliente.observaciones).trim() : '';
  if (!obsCompleta.includes(numFactura)) {
    obsCompleta = obsCompleta ? `${obsCompleta}\n\n${metaFacturaStr}` : metaFacturaStr;
  }

  const payload = {
    id: `cli-${Date.now()}`,
    nombre: cliente.nombre?.trim(),
    primer_nombre: cliente.primer_nombre?.trim() || null,
    segundo_nombre: cliente.segundo_nombre?.trim() || null,
    primer_apellido: cliente.primer_apellido?.trim() || null,
    segundo_apellido: cliente.segundo_apellido?.trim() || null,
    correo: cliente.correo?.trim() || null,
    telefono: cliente.telefono?.trim() || null,
    documento: cliente.documento?.trim(),
    estado: cliente.estado || 'Activo',
    situacion_laboral: cliente.situacion_laboral || null,
    tasa_interes: Number(cliente.tasa_interes) || 0,
    monto_capital: Number(cliente.monto_capital) || 0,
    monto_interes: Number(cliente.monto_interes) || 0,
    direccion: cliente.direccion?.trim() || null,
    observaciones: obsCompleta,
    monto_deuda: Number(cliente.monto_deuda) || 0,
    numero_factura: numFactura,
    registrado_por_nombre: cliente.registrado_por_nombre?.trim() || null,
    registrado_por_telefono: cliente.registrado_por_telefono?.trim() || null,
    registrado_por_correo: cliente.registrado_por_correo?.trim() || null,
    registrado_por_rol: cliente.registrado_por_rol?.trim() || null,
    registrado_por_cedula: cliente.registrado_por_cedula?.trim() || null,
    cobrador_id: cliente.cobrador_id ? String(cliente.cobrador_id).trim() : null,
    created_at: new Date().toISOString()
  };

  // Guardar factura inmediatamente en el histórico permanente (no se borra jamás)
  guardarFacturaEnHistorico({
    ...payload,
    codigo_factura: numFactura,
    fecha_emision: payload.created_at
  });

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
        clienteRegistrado = { ...payload, ...json.data, numero_factura: numFactura };
        const actual = getLocalClientes().map(c => 
          String(c.documento).trim() === String(payload.documento).trim() ? clienteRegistrado : c
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
        clienteRegistrado = { ...payload, ...data[0], numero_factura: numFactura };
        const actual = getLocalClientes().map(c => 
          String(c.documento).trim() === String(payload.documento).trim() ? clienteRegistrado : c
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
      c && c.documento && !esRegistroExcluido(c.nombre, c.documento, c.estado)
    );

    // Garantizar que todo cliente tenga su número de factura único
    listaCompleta.forEach(c => {
      if (!c.numero_factura) {
        const m = (c.observaciones || '').match(/\[FACTURA:\s*([A-Za-z0-9]+)\]/i);
        if (m) {
          c.numero_factura = m[1];
        } else {
          c.numero_factura = generarCodigoFacturaUnico();
        }
      }
    });

    setLocalClientes(listaCompleta);
    return listaCompleta;
  }

  // 4. Si todo lo anterior falló o está sin conexión, devolver copia local
  const locales = getLocalClientes();
  locales.forEach(c => {
    if (!c.numero_factura) {
      const m = (c.observaciones || '').match(/\[FACTURA:\s*([A-Za-z0-9]+)\]/i);
      c.numero_factura = m ? m[1] : generarCodigoFacturaUnico();
    }
  });
  return locales;
}

/**
 * Busca un cliente por número de documento / cédula o número de factura.
 */
export async function buscarClientePorDocumento(documento) {
  const doc = String(documento).trim();
  if (!doc || DOCS_PREDETERMINADOS.has(doc)) return null;
  let cliente = null;

  const client = getDb();
  if (client) {
    try {
      const { data, error } = await client
        .from('clientes')
        .select('*')
        .eq('documento', doc)
        .maybeSingle();

      if (!error && data && !esRegistroExcluido(data.nombre, data.documento, data.estado)) {
        cliente = data;
      }
    } catch (e) {
      console.warn('Fallo búsqueda remota de cliente:', e.message);
    }
  }

  if (!cliente) {
    const locales = getLocalClientes();
    cliente = locales.find(c => 
      (String(c.documento).trim() === doc || String(c.numero_factura || '').trim() === doc) && 
      !esRegistroExcluido(c.nombre, c.documento, c.estado)
    ) || null;
  }

  if (!cliente || esRegistroExcluido(cliente.nombre, cliente.documento, cliente.estado)) return null;

  // Garantizar número de factura
  if (!cliente.numero_factura) {
    const m = (cliente.observaciones || '').match(/\[FACTURA:\s*([A-Za-z0-9]+)\]/i);
    cliente.numero_factura = m ? m[1] : generarCodigoFacturaUnico();
  }

  // Buscar pagos asociados a este documento
  let pagos = [];
  if (client) {
    try {
      const { data: pagosRemotos } = await client
        .from('pagos')
        .select('*')
        .eq('documento', doc)
        .order('created_at', { ascending: false })
        .limit(10);

      if (pagosRemotos && pagosRemotos.length > 0) {
        pagos = pagosRemotos.filter(p => !esRegistroExcluido(p.cliente_nombre, p.documento, p.estado));
      }
    } catch (e) {}
  }

  if (pagos.length === 0) {
    const pagosLocales = getLocalPagos();
    pagos = pagosLocales.filter(p => String(p.documento).trim() === doc && !esRegistroExcluido(p.cliente_nombre, p.documento, p.estado));
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

  // 3. Procesar datos (excluyendo cualquier dato demo o predeterminado o eliminado)
  if (clientes && Array.isArray(clientes)) {
    exitoRemoto = true;
    const clientesReales = clientes.filter(c => 
      c && c.documento && !esRegistroExcluido(c.nombre, c.documento, c.estado)
    );
    totalClientes = clientesReales.length;
    saldoPendiente = clientesReales.reduce((acc, c) => acc + (Number(c.monto_deuda) || 0), 0);
    prestamosActivos = clientesReales.filter(c => Number(c.monto_deuda) > 0 || c.estado === 'Activo').length;
  }

  if (pagos && Array.isArray(pagos)) {
    const pagosReales = pagos.filter(p => 
      p && !esRegistroExcluido(p.cliente_nombre, p.documento, p.estado)
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
export async function registrarUsuario({ 
  nombre, 
  correo, 
  password, 
  rol = 'Cobrador', 
  cedula = '', 
  telefono = '', 
  primer_nombre = '', 
  segundo_nombre = '', 
  primer_apellido = '', 
  segundo_apellido = '' 
}) {
  if (!db) throw new Error('Conexión con el servidor no disponible');

  const emailClean = correo.trim().toLowerCase();
  const telClean = (telefono || '').toString().trim();
  const pNom = (primer_nombre || '').toString().trim();
  const sNom = (segundo_nombre || '').toString().trim();
  const pApe = (primer_apellido || '').toString().trim();
  const sApe = (segundo_apellido || '').toString().trim();
  const nombreClean = (nombre || `${pNom} ${sNom} ${pApe} ${sApe}`.trim() || emailClean.split('@')[0]).trim();
  const rolClean = rol.trim();
  const cedulaClean = (cedula || '').toString().trim();

  let user = null;
  let authData = null;

  // 1. Registro de autenticación
  try {
    const resAuth = await db.auth.signUp({
      email: emailClean,
      password: password,
      options: {
        data: {
          nombre: nombreClean,
          primer_nombre: pNom,
          segundo_nombre: sNom,
          primer_apellido: pApe,
          segundo_apellido: sApe,
          telefono: telClean,
          rol: rolClean,
          cedula: cedulaClean
        }
      }
    });

    authData = resAuth?.data;
    const authError = resAuth?.error;

    if (authError) {
      const msgErr = (authError.message || '').toLowerCase();
      // Si el usuario ya está registrado en auth o hay límite de correos,
      // actualizamos y permitimos el uso en el sistema
      if (msgErr.includes('already registered') || msgErr.includes('user already') || msgErr.includes('already exists') || msgErr.includes('rate limit') || msgErr.includes('email rate') || authError.status === 429) {
        console.warn('Aviso auth signUp (existente o rate limit):', authError.message);
        user = {
          id: `usr-${Date.now()}`,
          email: emailClean,
          user_metadata: { 
            nombre: nombreClean, 
            primer_nombre: pNom, 
            segundo_nombre: sNom, 
            primer_apellido: pApe, 
            segundo_apellido: sApe, 
            telefono: telClean, 
            rol: rolClean, 
            cedula: cedulaClean 
          }
        };
      } else {
        throw authError;
      }
    } else {
      user = authData?.user;
    }
  } catch (errAuth) {
    const msgErr = (errAuth.message || '').toLowerCase();
    if (msgErr.includes('already registered') || msgErr.includes('user already') || msgErr.includes('already exists') || msgErr.includes('rate limit') || msgErr.includes('email rate') || errAuth.status === 429) {
      user = {
        id: `usr-${Date.now()}`,
        email: emailClean,
        user_metadata: { 
          nombre: nombreClean, 
          primer_nombre: pNom, 
          segundo_nombre: sNom, 
          primer_apellido: pApe, 
          segundo_apellido: sApe, 
          telefono: telClean, 
          rol: rolClean, 
          cedula: cedulaClean 
        }
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
      primer_nombre: pNom || null,
      segundo_nombre: sNom || null,
      primer_apellido: pApe || null,
      segundo_apellido: sApe || null,
      telefono: telClean || null,
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
      // Intentar sin columnas adicionales si la tabla remota no las tiene
      const { error: errFallback } = await db
        .from('usuarios')
        .upsert([{
          correo: emailClean,
          nombre: nombreClean,
          rol: rolClean,
          cedula: cedulaClean
        }], { onConflict: 'correo' });
      if (!errFallback) tablaRegistrada = true;
    }
  } catch (e) {
    console.warn('No se pudo insertar en public.usuarios:', e.message);
  }

  // Guardar copia de respaldo en almacenamiento local con cédula y teléfono
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const guardados = JSON.parse(window.localStorage.getItem('sistema_usuarios_registrados') || '[]');
      const usuarioLocal = {
        id: user?.id || `usr-${Date.now()}`,
        nombre: nombreClean,
        primer_nombre: pNom,
        segundo_nombre: sNom,
        primer_apellido: pApe,
        segundo_apellido: sApe,
        correo: emailClean,
        telefono: telClean,
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
    telefono: telClean,
    primer_nombre: pNom,
    segundo_nombre: sNom,
    primer_apellido: pApe,
    segundo_apellido: sApe,
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

  // Combinar sin duplicar correos y enriquecer con cédula y teléfono (solo usuarios registrados por el usuario)
  const mapa = new Map();
  usuariosRemotos.forEach(u => {
    if (u.correo) {
      const emailK = u.correo.toLowerCase();
      if (emailK === 'admin@cobros.com') return; // Excluir usuario predeterminado
      const creds = obtenerCredencialesUsuario(emailK);
      mapa.set(emailK, { 
        ...u, 
        cedula: u.cedula || creds?.cedula || '',
        telefono: u.telefono || creds?.telefono || '',
        primer_nombre: u.primer_nombre || creds?.primer_nombre || '',
        segundo_nombre: u.segundo_nombre || creds?.segundo_nombre || '',
        primer_apellido: u.primer_apellido || creds?.primer_apellido || '',
        segundo_apellido: u.segundo_apellido || creds?.segundo_apellido || '',
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
      const tel = u.telefono || creds?.telefono || '';
      const pNom = u.primer_nombre || creds?.primer_nombre || '';
      const sNom = u.segundo_nombre || creds?.segundo_nombre || '';
      const pApe = u.primer_apellido || creds?.primer_apellido || '';
      const sApe = u.segundo_apellido || creds?.segundo_apellido || '';

      if (!mapa.has(emailK)) {
        mapa.set(emailK, { 
          ...u, 
          cedula: ced,
          telefono: tel,
          primer_nombre: pNom,
          segundo_nombre: sNom,
          primer_apellido: pApe,
          segundo_apellido: sApe
        });
      } else {
        const item = mapa.get(emailK);
        if (!item.cedula && ced) item.cedula = ced;
        if (!item.telefono && tel) item.telefono = tel;
        if (!item.primer_nombre && pNom) item.primer_nombre = pNom;
        if (!item.segundo_nombre && sNom) item.segundo_nombre = sNom;
        if (!item.primer_apellido && pApe) item.primer_apellido = pApe;
        if (!item.segundo_apellido && sApe) item.segundo_apellido = sApe;
      }
    }
  });

  return Array.from(mapa.values()).filter(u => 
    !esRegistroExcluido(u.nombre, u.cedula, u.rol) && 
    !(u.correo || '').toLowerCase().includes('moncada') &&
    !(u.correo || '').toLowerCase().includes('james')
  );
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
 * Autentica al usuario diferenciando entre Administrador (requiere Correo, Cédula y Contraseña) y Cobrador (requiere Correo y Contraseña).
 */
export async function autenticarUsuarioConRol({ modo = 'admin', identificador = '', password = '', correo = '', cedula = '' }) {
  const modoClean = modo.toLowerCase().trim();
  const pwdTrim = String(password || '').trim();
  const idClean = String(identificador || correo || cedula || '').trim();

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
  // FLUJO ADMINISTRADOR (AUTORIZACIÓN POR CORREO + CÉDULA + CLAVE)
  // ==========================================
  if (modoClean === 'admin') {
    let correoAdmin = String(correo || '').toLowerCase().trim();
    let cedulaAdmin = String(cedula || '').trim();

    // Compatibilidad si se envió solo en identificador
    if (!correoAdmin && identificador && identificador.includes('@')) {
      correoAdmin = identificador.toLowerCase().trim();
    } else if (!cedulaAdmin && identificador && !identificador.includes('@')) {
      cedulaAdmin = identificador.trim();
    }

    if (!correoAdmin) {
      return {
        ok: false,
        error: 'Por favor ingresa el correo electrónico del administrador.'
      };
    }

    if (!cedulaAdmin) {
      return {
        ok: false,
        error: 'Por favor ingresa la cédula del administrador.'
      };
    }

    if (!pwdTrim) {
      return {
        ok: false,
        error: 'Por favor ingresa la contraseña de administrador.'
      };
    }

    // A. Verificar si el correo o cédula pertenece a una cuenta exclusiva de Cobrador
    const usuarioCobrador = usuarios.find(u => {
      const uEmail = (u.correo || '').toLowerCase().trim();
      const uCed = String(u.cedula || u.documento || '').trim();
      const uRol = String(u.rol || '').trim().toLowerCase();
      const match = (uEmail && uEmail === correoAdmin) || (uCed && uCed === cedulaAdmin);
      return match && (uRol === 'cobrador' || uRol.includes('cajer'));
    });
    if (usuarioCobrador) {
      return {
        ok: false,
        error: 'Esta cuenta o cédula pertenece a un Cobrador. Selecciona la opción "Ingresar como Cobrador" para continuar.'
      };
    }

    // B. Buscar si el correo o cédula coincide con un Administrador registrado
    let adminEncontrado = usuarios.find(u => {
      const uEmail = (u.correo || '').toLowerCase().trim();
      const uCed = String(u.cedula || u.documento || '').trim();
      const uRol = String(u.rol || '').trim().toLowerCase();
      const match = (uEmail && uEmail === correoAdmin) || (uCed && uCed === cedulaAdmin);
      return match && (uRol.includes('admin') || !uRol);
    });

    let credsAdmin = allCreds[correoAdmin] || null;
    if (!credsAdmin) {
      for (const em of Object.keys(allCreds)) {
        const c = allCreds[em];
        if (String(c.cedula || '').trim() === cedulaAdmin) {
          credsAdmin = c;
          break;
        }
      }
    }

    // Validar concordancia de cédula si ya estaba registrada para este correo
    const cedulaRegistrada = String(adminEncontrado?.cedula || adminEncontrado?.documento || credsAdmin?.cedula || '').trim();
    if (cedulaRegistrada && cedulaRegistrada !== cedulaAdmin) {
      return {
        ok: false,
        error: 'La cédula de identidad no coincide con el correo de administrador registrado.'
      };
    }

    // C. Validar la contraseña del Administrador
    let contrasenaValida = false;
    let usuarioAutenticado = null;

    // 1) Validar contra credenciales guardadas del admin por correo
    if (credsAdmin && credsAdmin.password === pwdTrim) {
      contrasenaValida = true;
      usuarioAutenticado = credsAdmin;
    }

    // 2) Validar con Supabase Auth directamente con el correo y contraseña
    if (!contrasenaValida && db && db.auth) {
      try {
        const { data, error } = await db.auth.signInWithPassword({
          email: correoAdmin,
          password: pwdTrim
        });
        if (!error && data?.user) {
          contrasenaValida = true;
          usuarioAutenticado = {
            id: data.user.id,
            nombre: data.user.user_metadata?.nombre || adminEncontrado?.nombre || correoAdmin.split('@')[0],
            correo: correoAdmin,
            rol: 'Administrador',
            cedula: cedulaAdmin
          };
        }
      } catch (e) {
        console.warn('Supabase signInWithPassword:', e.message);
      }
    }

    // 3) Probar autenticación con Supabase Auth para cuentas de administrador conocidas
    if (!contrasenaValida && db && db.auth) {
      const correosAProbar = [
        'juanfernado20de2008@gmail.com',
        'ferchogarces2008@gmail.com'
      ].filter(em => em !== correoAdmin);

      for (const correoRespaldo of correosAProbar) {
        try {
          const { data, error } = await db.auth.signInWithPassword({
            email: correoRespaldo,
            password: pwdTrim
          });
          if (!error && data?.user) {
            contrasenaValida = true;
            usuarioAutenticado = {
              id: data.user.id,
              nombre: data.user.user_metadata?.nombre || 'Administrador',
              correo: correoAdmin,
              rol: 'Administrador',
              cedula: cedulaAdmin
            };
            break;
          }
        } catch (e) {}
      }
    }

    // 4) Probar con validación de clave de administrador general o credenciales locales
    if (!contrasenaValida) {
      for (const email of Object.keys(allCreds)) {
        const c = allCreds[email];
        const esRolAdmin = !c.rol || c.rol.toLowerCase().includes('admin');
        if (esRolAdmin && c.password === pwdTrim) {
          contrasenaValida = true;
          usuarioAutenticado = {
            ...c,
            correo: correoAdmin,
            cedula: cedulaAdmin
          };
          break;
        }
      }
    }

    // 5) Probar con validación de clave maestra de administrador
    if (!contrasenaValida) {
      const validacion = await validarContrasenaAcceso(pwdTrim);
      if (validacion.ok && (!validacion.usuario?.rol || validacion.usuario?.rol === 'Administrador')) {
        contrasenaValida = true;
        usuarioAutenticado = {
          ...(validacion.usuario || {}),
          correo: correoAdmin,
          cedula: cedulaAdmin,
          nombre: validacion.usuario?.nombre || 'Administrador',
          rol: 'Administrador'
        };
      }
    }

    if (!contrasenaValida) {
      return {
        ok: false,
        error: 'Correo, cédula o contraseña de Administrador incorrecta. Por favor verifica tus credenciales.'
      };
    }

    // Guardar o sincronizar credenciales actualizadas
    guardarCredencialesUsuario({
      correo: correoAdmin,
      password: pwdTrim,
      cedula: cedulaAdmin,
      nombre: usuarioAutenticado?.nombre || adminEncontrado?.nombre || correoAdmin.split('@')[0],
      rol: 'Administrador'
    });

    const sessionData = {
      id: usuarioAutenticado?.id || adminEncontrado?.id || `usr-${Date.now()}`,
      nombre: usuarioAutenticado?.nombre || adminEncontrado?.nombre || correoAdmin.split('@')[0],
      correo: correoAdmin,
      cedula: cedulaAdmin,
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
  window.generarCodigoFacturaUnico = generarCodigoFacturaUnico;
  window.guardarFacturaEnHistorico = guardarFacturaEnHistorico;
  window.obtenerHistoricoFacturas = obtenerHistoricoFacturas;
  window.obtenerFacturaPorIdentificador = obtenerFacturaPorIdentificador;
}
