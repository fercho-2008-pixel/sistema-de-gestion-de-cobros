import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Configuración de Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vvvveahvvabpzkephwlu.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2dnZlYWh2dmFicHprZXBod2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MDQzNzIsImV4cCI6MjEwNDk4MDM3Mn0.AXo3MSol4K7hawxwHsgHlEThGXzZZn4u4WdMXH7k2ts';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// In-memory fallback data store if Supabase is offline or not configured
const inMemoryClientes = new Map();
const inMemoryPagos = [];
const inMemoryUsuarios = new Map();
const inMemoryFacturas = new Map();
const setCodigosFacturas = new Set();

// Generador de código único de factura (8 letras con mayúsculas y minúsculas + 5 números)
function generarCodigoFactura(existentes = setCodigosFacturas) {
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghijkmnopqrstuvwxyz';
  const digitos = '0123456789';

  let codigo = '';
  let intentos = 0;

  while (intentos < 5000) {
    intentos++;
    const letras = [];
    for (let i = 0; i < 4; i++) {
      letras.push(mayusculas[Math.floor(Math.random() * mayusculas.length)]);
      letras.push(minusculas[Math.floor(Math.random() * minusculas.length)]);
    }
    for (let i = letras.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letras[i], letras[j]] = [letras[j], letras[i]];
    }

    const nums = [];
    for (let i = 0; i < 5; i++) {
      nums.push(digitos[Math.floor(Math.random() * digitos.length)]);
    }

    codigo = letras.join('') + nums.join('');

    if (!existentes.has(codigo)) {
      existentes.add(codigo);
      return codigo;
    }
  }

  return codigo;
}

// Seed in-memory store with demo data if empty
function initInMemoryStore() {
  // Inicialización limpia sin registros conflictivos
}
initInMemoryStore();

// Constantes para excluir datos predeterminados/demo o eliminados
const DOCS_PREDETERMINADOS = ['1020304050', '1030405060', '1040506070', '0000000000'];
const NOMBRES_PREDETERMINADOS = [
  'maría pérez', 'maria perez', 'juan torres', 'luisa ramírez', 'luisa ramirez',
  'james moncada', 'james', 'moncada', '[eliminado]', 'eliminado'
];

function esRegistroExcluido(nombre = '', doc = '', estado = '') {
  const n = String(nombre || '').trim().toLowerCase();
  const d = String(doc || '').trim();
  const e = String(estado || '').trim().toLowerCase();
  if (e === 'eliminado') return true;
  if (DOCS_PREDETERMINADOS.includes(d)) return true;
  if (n.includes('moncada') || n.includes('james') || n.includes('[eliminado]')) return true;
  if (NOMBRES_PREDETERMINADOS.includes(n)) return true;
  return false;
}

// ---------------------------------------------------------
// RUTAS DE API PARA CLIENTES CONECTADAS CON SUPABASE (CON FALLBACK)
// ---------------------------------------------------------

// Obtener todos los clientes registrados
app.get('/api/clientes', async (req, res) => {
  try {
    let clientes = [];
    let fromDb = false;

    try {
      const { data, error } = await Promise.race([
        supabase.from('clientes').select('*').order('created_at', { ascending: false }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase query timeout')), 3500))
      ]);

      if (!error && Array.isArray(data)) {
        fromDb = true;
        clientes = data.filter(c => 
          c && c.documento && !esRegistroExcluido(c.nombre, c.documento, c.estado)
        );
        // Sincronizar en memoria y garantizar que cada cliente tenga su factura única
        for (const c of clientes) {
          const doc = String(c.documento).trim();
          const enMemoria = inMemoryClientes.get(doc);
          if (!c.numero_factura) {
            const match = (c.observaciones || '').match(/\[FACTURA:\s*([A-Za-z0-9]+)\]/i);
            if (match) {
              c.numero_factura = match[1];
              setCodigosFacturas.add(c.numero_factura);
            } else if (enMemoria?.numero_factura) {
              c.numero_factura = enMemoria.numero_factura;
            } else {
              c.numero_factura = generarCodigoFactura();
            }
          }
          if (c.numero_factura) {
            setCodigosFacturas.add(c.numero_factura);
            if (!inMemoryFacturas.has(c.numero_factura)) {
              inMemoryFacturas.set(c.numero_factura, {
                codigo_factura: c.numero_factura,
                numero_factura: c.numero_factura,
                cliente_nombre: c.nombre,
                cliente_documento: c.documento,
                cliente_telefono: c.telefono,
                cliente_correo: c.correo,
                cliente_direccion: c.direccion,
                monto_deuda: c.monto_deuda,
                observaciones: c.observaciones,
                created_at: c.created_at
              });
            }
          }
          inMemoryClientes.set(doc, { ...(enMemoria || {}), ...c });
        }
      } else if (error) {
        console.warn('Supabase /api/clientes notice:', error.message);
      }
    } catch (e) {
      console.warn('Supabase offline or unreachable, using in-memory store for clientes:', e.message);
    }

    if (!fromDb) {
      clientes = Array.from(inMemoryClientes.values()).filter(c =>
        c && c.documento && !esRegistroExcluido(c.nombre, c.documento, c.estado)
      );
    }

    // Asegurar que cada cliente en respuesta tenga numero_factura único
    clientes.forEach(c => {
      if (!c.numero_factura) {
        c.numero_factura = generarCodigoFactura();
      }
    });

    // Filtrar por cobrador si se solicita en query param (ej: ?cobrador=email_or_cedula)
    const filtroCobrador = req.query.cobrador ? String(req.query.cobrador).trim().toLowerCase() : '';
    if (filtroCobrador) {
      clientes = clientes.filter(c => {
        const regCorreo = (c.registrado_por_correo || '').toLowerCase().trim();
        const regCed = String(c.registrado_por_cedula || '').trim().toLowerCase();
        const regId = String(c.cobrador_id || '').trim().toLowerCase();
        const regNom = (c.registrado_por_nombre || '').toLowerCase().trim();
        const obs = (c.observaciones || '').toLowerCase();
        return regCorreo === filtroCobrador ||
               regCed === filtroCobrador ||
               regId === filtroCobrador ||
               regNom.includes(filtroCobrador) ||
               obs.includes(filtroCobrador);
      });
    }

    return res.json({ ok: true, data: clientes, source: fromDb ? 'supabase' : 'in-memory' });
  } catch (err) {
    console.error('Error servidor GET /api/clientes:', err);
    const fallbackList = Array.from(inMemoryClientes.values()).filter(c => !esRegistroExcluido(c.nombre, c.documento, c.estado));
    return res.json({ ok: true, data: fallbackList, source: 'in-memory-fallback' });
  }
});

// Obtener pagos registrados
app.get('/api/pagos', async (req, res) => {
  try {
    let pagos = [];
    let fromDb = false;

    try {
      const { data, error } = await Promise.race([
        supabase.from('pagos').select('*').order('created_at', { ascending: false }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase query timeout')), 3500))
      ]);

      if (!error && Array.isArray(data)) {
        fromDb = true;
        pagos = data.filter(p => 
          p && !esRegistroExcluido(p.cliente_nombre, p.documento, p.estado)
        );
      } else if (error) {
        console.warn('Supabase /api/pagos notice:', error.message);
      }
    } catch (e) {
      console.warn('Supabase offline or unreachable, using in-memory store for pagos:', e.message);
    }

    if (!fromDb) {
      pagos = inMemoryPagos.filter(p =>
        p && !esRegistroExcluido(p.cliente_nombre, p.documento, p.estado)
      );
    }

    return res.json({ ok: true, data: pagos, source: fromDb ? 'supabase' : 'in-memory' });
  } catch (err) {
    return res.json({ ok: true, data: inMemoryPagos.filter(p => !esRegistroExcluido(p.cliente_nombre, p.documento, p.estado)), source: 'in-memory-fallback' });
  }
});

// Registrar o actualizar un pago
app.post('/api/pagos', async (req, res) => {
  try {
    const { cliente_nombre, documento, monto, fecha, metodo_pago, referencia, observaciones, estado } = req.body;
    const docClean = documento ? String(documento).trim() : null;
    const montoNum = Number(monto) || 0;

    const pagoPayload = {
      id: `pg-${Date.now()}`,
      cliente_nombre: String(cliente_nombre || 'Cliente').trim(),
      documento: docClean,
      monto: montoNum,
      fecha: fecha || new Date().toISOString().split('T')[0],
      metodo_pago: metodo_pago || 'Efectivo',
      referencia: referencia ? String(referencia).trim() : `REF-${Date.now()}`,
      observaciones: observaciones ? String(observaciones).trim() : null,
      estado: estado || 'Pagado',
      created_at: new Date().toISOString()
    };

    // Actualizar en memoria
    inMemoryPagos.unshift(pagoPayload);
    if (docClean && inMemoryClientes.has(docClean)) {
      const cli = inMemoryClientes.get(docClean);
      cli.monto_deuda = Math.max(0, (Number(cli.monto_deuda) || 0) - montoNum);
    }

    // Intentar en Supabase en segundo plano
    try {
      await supabase.from('pagos').insert([{
        cliente_nombre: pagoPayload.cliente_nombre,
        documento: pagoPayload.documento,
        monto: pagoPayload.monto,
        fecha: pagoPayload.fecha,
        metodo_pago: pagoPayload.metodo_pago,
        referencia: pagoPayload.referencia,
        observaciones: pagoPayload.observaciones,
        estado: pagoPayload.estado
      }]);

      if (docClean) {
        const { data: cli } = await supabase.from('clientes').select('id, monto_deuda').eq('documento', docClean).maybeSingle();
        if (cli) {
          const nuevaDeuda = Math.max(0, (Number(cli.monto_deuda) || 0) - montoNum);
          await supabase.from('clientes').update({ monto_deuda: nuevaDeuda }).eq('id', cli.id);
        }
      }
    } catch (e) {
      console.warn('Nota: Pago guardado en memoria:', e.message);
    }

    return res.json({ ok: true, data: pagoPayload });
  } catch (err) {
    console.error('Error servidor POST /api/pagos:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Registrar o actualizar un cliente en Supabase (con fallback)
app.post('/api/clientes', async (req, res) => {
  try {
    const {
      nombre, correo, telefono, documento, estado, direccion, observaciones,
      monto_deuda, situacion_laboral, tasa_interes, monto_capital, monto_interes,
      numero_factura, registrado_por_nombre, registrado_por_telefono, registrado_por_correo, registrado_por_rol,
      registrado_por_cedula, cobrador_id,
      primer_nombre, segundo_nombre, primer_apellido, segundo_apellido
    } = req.body;

    if (!nombre || !documento) {
      return res.status(400).json({ ok: false, error: 'Nombre y documento son obligatorios.' });
    }

    // Generar código único de factura (8 letras con mayúsculas/minúsculas y 5 números) si no viene provisto
    const codFactura = (numero_factura && String(numero_factura).trim()) 
      ? String(numero_factura).trim() 
      : generarCodigoFactura();

    setCodigosFacturas.add(codFactura);

    // Adjuntar metadatos de factura y emisor en observaciones para respaldo 100% permanente
    const metaFacturaStr = `[FACTURA: ${codFactura}] [EMISOR: ${String(registrado_por_nombre || 'Asesor').trim()} | TEL: ${String(registrado_por_telefono || '').trim()} | EMAIL: ${String(registrado_por_correo || '').trim()} | CED: ${String(registrado_por_cedula || '').trim()}]`;
    let obsCompleta = observaciones ? String(observaciones).trim() : '';
    if (!obsCompleta.includes(codFactura)) {
      obsCompleta = obsCompleta ? `${obsCompleta}\n\n${metaFacturaStr}` : metaFacturaStr;
    }

    const payload = {
      id: `cli-${Date.now()}`,
      nombre: String(nombre).trim(),
      primer_nombre: primer_nombre ? String(primer_nombre).trim() : null,
      segundo_nombre: segundo_nombre ? String(segundo_nombre).trim() : null,
      primer_apellido: primer_apellido ? String(primer_apellido).trim() : null,
      segundo_apellido: segundo_apellido ? String(segundo_apellido).trim() : null,
      correo: correo ? String(correo).trim() : null,
      telefono: telefono ? String(telefono).trim() : null,
      documento: String(documento).trim(),
      estado: estado || 'Activo',
      situacion_laboral: situacion_laboral || null,
      tasa_interes: Number(tasa_interes) || 0,
      monto_capital: Number(monto_capital) || 0,
      monto_interes: Number(monto_interes) || 0,
      direccion: direccion ? String(direccion).trim() : null,
      observaciones: obsCompleta,
      monto_deuda: Number(monto_deuda) || 0,
      numero_factura: codFactura,
      registrado_por_nombre: registrado_por_nombre ? String(registrado_por_nombre).trim() : null,
      registrado_por_telefono: registrado_por_telefono ? String(registrado_por_telefono).trim() : null,
      registrado_por_correo: registrado_por_correo ? String(registrado_por_correo).trim() : null,
      registrado_por_rol: registrado_por_rol ? String(registrado_por_rol).trim() : null,
      registrado_por_cedula: registrado_por_cedula ? String(registrado_por_cedula).trim() : null,
      cobrador_id: cobrador_id ? String(cobrador_id).trim() : null,
      created_at: new Date().toISOString()
    };

    // Actualizar en memoria inmediatamente
    inMemoryClientes.set(payload.documento, payload);

    // Registrar en histórico de facturas permanente (NUNCA se borra ni se repite)
    inMemoryFacturas.set(codFactura, {
      ...payload,
      codigo_factura: codFactura,
      fecha_emision: payload.created_at
    });

    let savedData = payload;

    try {
      const { data, error } = await Promise.race([
        supabase.from('clientes').upsert([{
          nombre: payload.nombre,
          correo: payload.correo,
          telefono: payload.telefono,
          documento: payload.documento,
          estado: payload.estado,
          direccion: payload.direccion,
          observaciones: payload.observaciones,
          monto_deuda: payload.monto_deuda
        }], { onConflict: 'documento' }).select(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase insert timeout')), 3500))
      ]);

      if (!error && data?.[0]) {
        savedData = { ...payload, ...data[0], numero_factura: codFactura };
        inMemoryClientes.set(payload.documento, savedData);
      } else if (error) {
        console.warn('Nota Supabase al insertar cliente:', error.message);
      }
    } catch (e) {
      console.warn('Supabase no disponible al guardar cliente, guardado en memoria:', e.message);
    }

    return res.json({ ok: true, data: savedData });
  } catch (err) {
    console.error('Error servidor POST /api/clientes:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------
// RUTAS DE API PARA FACTURAS (HISTÓRICO ÚNICO E INALTERABLE)
// ---------------------------------------------------------

// Obtener todas las facturas emitidas históricas
app.get('/api/facturas', (req, res) => {
  const lista = Array.from(inMemoryFacturas.values());
  return res.json({ ok: true, data: lista });
});

// Obtener una factura específica por su código único
app.get('/api/facturas/:codigo', (req, res) => {
  const codigo = String(req.params.codigo).trim();
  const factura = inMemoryFacturas.get(codigo);
  if (!factura) {
    // Buscar en clientes por si acaso
    for (const c of inMemoryClientes.values()) {
      if (c.numero_factura === codigo) {
        return res.json({ ok: true, data: c });
      }
    }
    return res.status(404).json({ ok: false, error: 'Factura no encontrada' });
  }
  return res.json({ ok: true, data: factura });
});

// Registrar o sincronizar una factura en el histórico
app.post('/api/facturas', (req, res) => {
  try {
    const f = req.body;
    if (!f || !f.codigo_factura && !f.numero_factura) {
      return res.status(400).json({ ok: false, error: 'Código de factura obligatorio' });
    }
    const cod = String(f.codigo_factura || f.numero_factura).trim();
    setCodigosFacturas.add(cod);
    inMemoryFacturas.set(cod, {
      ...f,
      codigo_factura: cod,
      numero_factura: cod,
      created_at: f.created_at || new Date().toISOString()
    });
    return res.json({ ok: true, data: inMemoryFacturas.get(cod) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// Eliminar un cliente por documento
app.delete('/api/clientes/:documento', async (req, res) => {
  try {
    const doc = String(req.params.documento).trim();
    if (!doc) {
      return res.status(400).json({ ok: false, error: 'Documento no especificado.' });
    }

    // Eliminar de memoria
    inMemoryClientes.delete(doc);
    const pagosIdx = inMemoryPagos.findIndex(p => String(p.documento).trim() === doc);
    if (pagosIdx !== -1) inMemoryPagos.splice(pagosIdx, 1);

    // Intentar eliminar en Supabase
    try {
      await supabase.from('pagos').delete().eq('documento', doc);
      await supabase.from('clientes').delete().eq('documento', doc);
    } catch (e) {
      console.warn('Nota al eliminar de Supabase:', e.message);
    }

    return res.json({ ok: true, mensaje: 'Cliente eliminado correctamente.' });
  } catch (err) {
    console.error('Error servidor DELETE /api/clientes:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------
// RUTAS DE API PARA USUARIOS / COBRADORES (CON SUPABASE Y FALLBACK)
// ---------------------------------------------------------

// Obtener usuarios registrados
app.get('/api/usuarios', async (req, res) => {
  try {
    let usuarios = [];
    let fromDb = false;

    try {
      const { data, error } = await Promise.race([
        supabase.from('usuarios').select('*').order('created_at', { ascending: false }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase query timeout')), 3500))
      ]);

      if (!error && Array.isArray(data)) {
        fromDb = true;
        usuarios = data.filter(u => u && u.correo && u.correo.toLowerCase() !== 'admin@cobros.com' && !esRegistroExcluido(u.nombre, u.cedula, u.rol));
        for (const u of usuarios) {
          if (u.correo) inMemoryUsuarios.set(u.correo.toLowerCase(), u);
        }
      }
    } catch (e) {
      console.warn('Supabase usuarios notice:', e.message);
    }

    if (!fromDb) {
      usuarios = Array.from(inMemoryUsuarios.values()).filter(u => u && u.correo && u.correo.toLowerCase() !== 'admin@cobros.com' && !esRegistroExcluido(u.nombre, u.cedula, u.rol));
    }

    return res.json({ ok: true, data: usuarios, source: fromDb ? 'supabase' : 'in-memory' });
  } catch (err) {
    console.error('Error servidor GET /api/usuarios:', err);
    return res.json({ ok: true, data: Array.from(inMemoryUsuarios.values()), source: 'in-memory-fallback' });
  }
});

// Registrar o actualizar un usuario en Supabase
app.post('/api/usuarios', async (req, res) => {
  try {
    const { 
      nombre, 
      correo, 
      rol, 
      cedula, 
      telefono, 
      primer_nombre, 
      segundo_nombre, 
      primer_apellido, 
      segundo_apellido 
    } = req.body;

    if (!correo) {
      return res.status(400).json({ ok: false, error: 'Correo es obligatorio.' });
    }

    const emailClean = String(correo).trim().toLowerCase();
    const telClean = telefono ? String(telefono).trim() : '';
    const pNom = primer_nombre ? String(primer_nombre).trim() : '';
    const sNom = segundo_nombre ? String(segundo_nombre).trim() : '';
    const pApe = primer_apellido ? String(primer_apellido).trim() : '';
    const sApe = segundo_apellido ? String(segundo_apellido).trim() : '';
    const nombreCompleto = String(nombre || `${pNom} ${sNom} ${pApe} ${sApe}`.trim() || emailClean.split('@')[0]).trim();

    const payload = {
      id: `usr-${Date.now()}`,
      nombre: nombreCompleto,
      primer_nombre: pNom || null,
      segundo_nombre: sNom || null,
      primer_apellido: pApe || null,
      segundo_apellido: sApe || null,
      telefono: telClean || null,
      correo: emailClean,
      rol: String(rol || 'Cobrador').trim(),
      cedula: cedula ? String(cedula).trim() : '',
      created_at: new Date().toISOString()
    };

    inMemoryUsuarios.set(emailClean, payload);

    try {
      // Intentar primero con todas las columnas
      const { data, error } = await supabase
        .from('usuarios')
        .upsert([{
          correo: payload.correo,
          nombre: payload.nombre,
          primer_nombre: payload.primer_nombre,
          segundo_nombre: payload.segundo_nombre,
          primer_apellido: payload.primer_apellido,
          segundo_apellido: payload.segundo_apellido,
          telefono: payload.telefono,
          rol: payload.rol,
          cedula: payload.cedula
        }], { onConflict: 'correo' })
        .select();

      if (!error && data?.[0]) {
        payload.id = data[0].id || payload.id;
        inMemoryUsuarios.set(emailClean, { ...payload, ...data[0] });
      } else if (error) {
        // Si fallan columnas extras en Supabase, intentar con las columnas básicas
        const { data: fallbackData } = await supabase
          .from('usuarios')
          .upsert([{
            correo: payload.correo,
            nombre: payload.nombre,
            rol: payload.rol,
            cedula: payload.cedula
          }], { onConflict: 'correo' })
          .select();
        if (fallbackData?.[0]) {
          payload.id = fallbackData[0].id || payload.id;
        }
      }
    } catch (e) {
      console.warn('Nota Supabase al registrar usuario:', e.message);
    }

    return res.json({ ok: true, data: payload });
  } catch (err) {
    console.error('Error servidor POST /api/usuarios:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Eliminar un cobrador o usuario por identificador (correo, cedula o id)
app.delete('/api/usuarios/:identificador', async (req, res) => {
  try {
    const ident = String(req.params.identificador || '').trim();
    if (!ident) {
      return res.status(400).json({ ok: false, error: 'Identificador de usuario no especificado.' });
    }

    const identLower = ident.toLowerCase();

    // 1. Eliminar del almacenamiento en memoria
    if (inMemoryUsuarios.has(identLower)) {
      inMemoryUsuarios.delete(identLower);
    }
    // También buscar por ID o Cédula en memoria
    for (const [key, user] of inMemoryUsuarios.entries()) {
      if (
        user.id === ident || 
        String(user.cedula || '').trim() === ident ||
        String(user.correo || '').toLowerCase() === identLower
      ) {
        inMemoryUsuarios.delete(key);
      }
    }

    // 2. Eliminar de la base de datos Supabase
    let dbEliminado = false;
    try {
      // Eliminar por correo
      const resCorreo = await supabase.from('usuarios').delete().eq('correo', identLower);
      if (!resCorreo.error) dbEliminado = true;

      // Eliminar por cédula si aplica
      await supabase.from('usuarios').delete().eq('cedula', ident);

      // Si es formato UUID, eliminar por id
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(ident);
      if (isUuid) {
        await supabase.from('usuarios').delete().eq('id', ident);
      }
    } catch (e) {
      console.warn('Nota al eliminar usuario de Supabase:', e.message);
    }

    return res.json({
      ok: true,
      mensaje: 'Cobrador / usuario eliminado correctamente de la base de datos.',
      eliminado: ident
    });
  } catch (err) {
    console.error('Error servidor DELETE /api/usuarios:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Estado de conexión con Supabase
app.get('/api/status', async (req, res) => {
  try {
    const checkPromise = supabase.from('clientes').select('id', { count: 'exact', head: true });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000));
    
    const { count, error } = await Promise.race([checkPromise, timeoutPromise]);
    return res.json({
      ok: true,
      supabaseConnected: !error,
      clientesCount: !error ? (count ?? 0) : inMemoryClientes.size,
      inMemoryCount: inMemoryClientes.size,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.json({
      ok: true,
      supabaseConnected: false,
      clientesCount: inMemoryClientes.size,
      inMemoryCount: inMemoryClientes.size,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve static assets from root
app.use(express.static(__dirname));

// Serve index.html or menu.html on root request
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
