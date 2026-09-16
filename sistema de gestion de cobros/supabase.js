// ==========================================================
// CONFIGURACIÓN E INTEGRACIÓN DE SUPABASE
// ==========================================================

export const SUPABASE_URL = 'https://vvvveahvvabpzkephwlu.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2dnZlYWh2dmFicHprZXBod2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MDQzNzIsImV4cCI6MjEwNDk4MDM3Mn0.AXo3MSol4K7hawxwHsgHlEThGXzZZn4u4WdMXH7k2ts';

// Inicialización del cliente Supabase
let clientInstance = null;
if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
  clientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else if (typeof globalThis !== 'undefined' && globalThis.supabase && globalThis.supabase.createClient) {
  clientInstance = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export const db = clientInstance;

// Asignar en window para compatibilidad directa en scripts normales
if (typeof window !== 'undefined') {
  window.db = db;
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
}

// ----------------------------------------------------------
// MÉTODOS DE CONSULTA Y PERSISTENCIA
// ----------------------------------------------------------

/**
 * Verifica si las tablas existen en la base de datos de Supabase.
 */
export async function verificarConexion() {
  if (!db) return { ok: false, error: 'Librería Supabase no inicializada' };
  try {
    const { data, error } = await db.from('clientes').select('id').limit(1);
    if (error) {
      return { ok: false, error: error.message, codigo: error.code, detalle: error.details };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Registra un nuevo cliente en la tabla 'clientes' de Supabase.
 */
export async function registrarCliente(cliente) {
  if (!db) throw new Error('Cliente Supabase no disponible');
  
  const payload = {
    nombre: cliente.nombre?.trim(),
    correo: cliente.correo?.trim() || null,
    telefono: cliente.telefono?.trim() || null,
    documento: cliente.documento?.trim(),
    estado: cliente.estado || 'Activo',
    direccion: cliente.direccion?.trim() || null,
    observaciones: cliente.observaciones?.trim() || null,
    monto_deuda: Number(cliente.monto_deuda) || 0
  };

  const { data, error } = await db
    .from('clientes')
    .insert([payload])
    .select();

  if (error) throw error;
  return data?.[0] || payload;
}

/**
 * Obtiene la lista completa de clientes.
 */
export async function obtenerClientes() {
  if (!db) return [];
  const { data, error } = await db
    .from('clientes')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) {
    console.warn('Error al obtener clientes:', error.message);
    throw error;
  }
  return data || [];
}

/**
 * Busca un cliente por número de documento / cédula.
 */
export async function buscarClientePorDocumento(documento) {
  if (!db) throw new Error('Cliente Supabase no disponible');

  const doc = String(documento).trim();

  // Buscar cliente
  const { data: cliente, error } = await db
    .from('clientes')
    .select('*')
    .eq('documento', doc)
    .maybeSingle();

  if (error) throw error;
  if (!cliente) return null;

  // Buscar pagos asociados a este documento
  try {
    const { data: pagos } = await db
      .from('pagos')
      .select('*')
      .eq('documento', doc)
      .order('created_at', { ascending: false })
      .limit(5);

    cliente.ultimos_pagos = pagos || [];
  } catch (e) {
    cliente.ultimos_pagos = [];
  }

  return cliente;
}

/**
 * Registra un pago y actualiza el saldo del cliente en Supabase.
 */
export async function registrarPago(pago) {
  if (!db) throw new Error('Cliente Supabase no disponible');

  const monto = Number(pago.monto) || 0;
  const payload = {
    cliente_id: pago.cliente_id || null,
    cliente_nombre: pago.cliente_nombre?.trim(),
    documento: pago.documento?.trim() || null,
    monto: monto,
    fecha: pago.fecha || new Date().toISOString().split('T')[0],
    metodo_pago: pago.metodo_pago || 'Efectivo',
    referencia: pago.referencia?.trim() || null,
    observaciones: pago.observaciones?.trim() || null,
    estado: pago.estado || 'Pagado'
  };

  // 1. Insertar el pago
  const { data: pagoGuardado, error: errPago } = await db
    .from('pagos')
    .insert([payload])
    .select();

  if (errPago) throw errPago;

  // 2. Si hay cliente_id o documento, actualizar la deuda del cliente
  if (pago.documento) {
    try {
      const { data: cli } = await db
        .from('clientes')
        .select('id, monto_deuda')
        .eq('documento', pago.documento.trim())
        .maybeSingle();

      if (cli) {
        const nuevaDeuda = Math.max(0, (Number(cli.monto_deuda) || 0) - monto);
        await db
          .from('clientes')
          .update({ monto_deuda: nuevaDeuda })
          .eq('id', cli.id);
      }
    } catch (e) {
      console.warn('Aviso: no se pudo actualizar saldo del cliente:', e.message);
    }
  }

  return pagoGuardado?.[0] || payload;
}

/**
 * Obtiene métricas en vivo para el panel principal (dashboard).
 */
export async function obtenerResumenDashboard() {
  if (!db) {
    return {
      totalClientes: 0,
      prestamosActivos: 0,
      pagosDelDia: 0,
      montoPagosHoy: 0,
      saldoPendiente: 0,
      ultimosMovimientos: []
    };
  }

  let totalClientes = 0;
  let prestamosActivos = 0;
  let pagosDelDia = 0;
  let montoPagosHoy = 0;
  let saldoPendiente = 0;
  let ultimosMovimientos = [];

  const hoyStr = new Date().toISOString().split('T')[0];

  try {
    // 1. Clientes
    const { data: clientes, count: cCount, error: errCli } = await db
      .from('clientes')
      .select('id, estado, monto_deuda', { count: 'exact' });

    if (!errCli && clientes) {
      totalClientes = cCount ?? clientes.length;
      saldoPendiente = clientes.reduce((acc, c) => acc + (Number(c.monto_deuda) || 0), 0);
      prestamosActivos = clientes.filter(c => Number(c.monto_deuda) > 0 || c.estado === 'Activo').length;
    }
  } catch (e) {
    console.warn('Error clientes dashboard:', e.message);
  }

  try {
    // 2. Pagos de hoy
    const { data: pagosHoy } = await db
      .from('pagos')
      .select('monto')
      .eq('fecha', hoyStr);

    if (pagosHoy) {
      pagosDelDia = pagosHoy.length;
      montoPagosHoy = pagosHoy.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
    }
  } catch (e) {
    console.warn('Error pagos hoy:', e.message);
  }

  try {
    // 3. Últimos movimientos (de pagos)
    const { data: movimientos } = await db
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
    console.warn('Error movimientos:', e.message);
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
 * Registra un nuevo usuario en Supabase Auth y en la tabla 'usuarios'.
 */
export async function registrarUsuario({ nombre, correo, password, rol = 'Cobrador' }) {
  if (!db) throw new Error('Cliente Supabase no disponible');

  const emailClean = correo.trim().toLowerCase();
  const nombreClean = nombre.trim();
  const rolClean = rol.trim();

  // 1. Registro en Supabase Auth
  const { data: authData, error: authError } = await db.auth.signUp({
    email: emailClean,
    password: password,
    options: {
      data: {
        nombre: nombreClean,
        rol: rolClean
      }
    }
  });

  if (authError) {
    throw authError;
  }

  const user = authData?.user;

  // 2. Registro en tabla pública de usuarios (para listados y gestión)
  let tablaRegistrada = false;
  try {
    const payload = {
      correo: emailClean,
      nombre: nombreClean,
      rol: rolClean
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

  // Guardar copia de respaldo en almacenamiento local para asegurar visualización inmediata
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const guardados = JSON.parse(window.localStorage.getItem('sistema_usuarios_registrados') || '[]');
      const usuarioLocal = {
        id: user?.id || `usr-${Date.now()}`,
        nombre: nombreClean,
        correo: emailClean,
        rol: rolClean,
        created_at: new Date().toISOString()
      };
      const actualizados = [usuarioLocal, ...guardados.filter(u => u.correo !== emailClean)];
      window.localStorage.setItem('sistema_usuarios_registrados', JSON.stringify(actualizados));
    } catch (e) {
      console.warn('Error al guardar en cache local de usuarios:', e);
    }
  }

  return {
    ok: true,
    user,
    session: authData?.session,
    tablaRegistrada
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
        .select('id, nombre, correo, rol');

      if (!error && data) {
        usuariosRemotos = data;
      } else if (error) {
        console.warn('Consulta a tabla usuarios:', error.message);
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
        created_at: new Date().toISOString()
      }
    ];
  }

  // Combinar sin duplicar correos
  const mapa = new Map();
  usuariosRemotos.forEach(u => {
    if (u.correo) mapa.set(u.correo.toLowerCase(), { ...u, created_at: u.created_at || new Date().toISOString() });
  });
  usuariosLocales.forEach(u => {
    if (u.correo && !mapa.has(u.correo.toLowerCase())) {
      mapa.set(u.correo.toLowerCase(), u);
    }
  });

  return Array.from(mapa.values());
}

/**
 * Elimina un usuario de la tabla 'usuarios'.
 */
export async function eliminarUsuario(id) {
  if (!db) throw new Error('Cliente Supabase no disponible');
  const { data, error } = await db
    .from('usuarios')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return data;
}
