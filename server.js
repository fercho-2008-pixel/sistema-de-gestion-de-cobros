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

// Seed in-memory store with demo data if empty
function initInMemoryStore() {
  if (inMemoryClientes.size === 0) {
    const demoClientes = [
      {
        id: 'cli-1',
        nombre: 'Carlos Mendoza',
        correo: 'carlos.mendoza@ejemplo.com',
        telefono: '+57 311 456 7890',
        documento: '1090421332',
        estado: 'Activo',
        direccion: 'Calle 45 # 12-30',
        observaciones: 'Pago puntual, historial excelente',
        monto_deuda: 350000,
        created_at: new Date().toISOString()
      },
      {
        id: 'cli-2',
        nombre: 'Andrea Gómez',
        correo: 'andrea.gomez@ejemplo.com',
        telefono: '+57 320 890 1234',
        documento: '1110500088',
        estado: 'Activo',
        direccion: 'Carrera 7 # 85-14',
        observaciones: 'Cuota quincenal',
        monto_deuda: 520000,
        created_at: new Date().toISOString()
      }
    ];
    for (const c of demoClientes) {
      inMemoryClientes.set(c.documento, c);
    }
  }

  if (inMemoryPagos.length === 0) {
    inMemoryPagos.push({
      id: 'pg-1',
      cliente_nombre: 'Carlos Mendoza',
      documento: '1090421332',
      monto: 50000,
      fecha: new Date().toISOString().split('T')[0],
      metodo_pago: 'Efectivo',
      referencia: 'TRX-1001',
      observaciones: 'Abono cuota mensual',
      estado: 'Pagado',
      created_at: new Date().toISOString()
    });
  }

  if (inMemoryUsuarios.size === 0) {
    const demoUsuarios = [
      {
        id: 'usr-admin-1',
        nombre: 'Administrador General',
        correo: 'admin@cobros.com',
        rol: 'Administrador',
        cedula: '1090421332',
        created_at: new Date().toISOString()
      },
      {
        id: 'usr-cob-1',
        nombre: 'Santiago Gómez',
        correo: 'santiago.cobrador@cobros.com',
        rol: 'Cobrador',
        cedula: '1110500088',
        created_at: new Date().toISOString()
      }
    ];
    for (const u of demoUsuarios) {
      inMemoryUsuarios.set(u.correo.toLowerCase(), u);
    }
  }
}
initInMemoryStore();

// Constantes para excluir datos predeterminados/demo
const DOCS_PREDETERMINADOS = ['1020304050', '1030405060', '1040506070'];
const NOMBRES_PREDETERMINADOS = ['maría pérez', 'maria perez', 'juan torres', 'luisa ramírez', 'luisa ramirez'];

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
          c && c.documento &&
          !DOCS_PREDETERMINADOS.includes(String(c.documento).trim()) &&
          !NOMBRES_PREDETERMINADOS.includes(String(c.nombre || '').trim().toLowerCase())
        );
        // Sincronizar en memoria
        for (const c of clientes) {
          inMemoryClientes.set(String(c.documento).trim(), c);
        }
      } else if (error) {
        console.warn('Supabase /api/clientes notice:', error.message);
      }
    } catch (e) {
      console.warn('Supabase offline or unreachable, using in-memory store for clientes:', e.message);
    }

    if (!fromDb) {
      clientes = Array.from(inMemoryClientes.values()).filter(c =>
        c && c.documento &&
        !DOCS_PREDETERMINADOS.includes(String(c.documento).trim()) &&
        !NOMBRES_PREDETERMINADOS.includes(String(c.nombre || '').trim().toLowerCase())
      );
    }

    return res.json({ ok: true, data: clientes, source: fromDb ? 'supabase' : 'in-memory' });
  } catch (err) {
    console.error('Error servidor GET /api/clientes:', err);
    const fallbackList = Array.from(inMemoryClientes.values());
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
          p &&
          (!p.documento || !DOCS_PREDETERMINADOS.includes(String(p.documento).trim())) &&
          (!p.cliente_nombre || !NOMBRES_PREDETERMINADOS.includes(String(p.cliente_nombre).trim().toLowerCase()))
        );
      } else if (error) {
        console.warn('Supabase /api/pagos notice:', error.message);
      }
    } catch (e) {
      console.warn('Supabase offline or unreachable, using in-memory store for pagos:', e.message);
    }

    if (!fromDb) {
      pagos = inMemoryPagos.filter(p =>
        p &&
        (!p.documento || !DOCS_PREDETERMINADOS.includes(String(p.documento).trim())) &&
        (!p.cliente_nombre || !NOMBRES_PREDETERMINADOS.includes(String(p.cliente_nombre).trim().toLowerCase()))
      );
    }

    return res.json({ ok: true, data: pagos, source: fromDb ? 'supabase' : 'in-memory' });
  } catch (err) {
    return res.json({ ok: true, data: inMemoryPagos, source: 'in-memory-fallback' });
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
    const { nombre, correo, telefono, documento, estado, direccion, observaciones, monto_deuda } = req.body;

    if (!nombre || !documento) {
      return res.status(400).json({ ok: false, error: 'Nombre y documento son obligatorios.' });
    }

    const payload = {
      id: `cli-${Date.now()}`,
      nombre: String(nombre).trim(),
      correo: correo ? String(correo).trim() : null,
      telefono: telefono ? String(telefono).trim() : null,
      documento: String(documento).trim(),
      estado: estado || 'Activo',
      direccion: direccion ? String(direccion).trim() : null,
      observaciones: observaciones ? String(observaciones).trim() : null,
      monto_deuda: Number(monto_deuda) || 0,
      created_at: new Date().toISOString()
    };

    // Actualizar en memoria inmediatamente
    inMemoryClientes.set(payload.documento, payload);

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
        savedData = data[0];
        inMemoryClientes.set(payload.documento, data[0]);
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
        usuarios = data.filter(u => u && u.correo && u.correo.toLowerCase() !== 'admin@cobros.com');
        for (const u of usuarios) {
          if (u.correo) inMemoryUsuarios.set(u.correo.toLowerCase(), u);
        }
      }
    } catch (e) {
      console.warn('Supabase usuarios notice:', e.message);
    }

    if (!fromDb) {
      usuarios = Array.from(inMemoryUsuarios.values()).filter(u => u && u.correo && u.correo.toLowerCase() !== 'admin@cobros.com');
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
    const { nombre, correo, rol, cedula } = req.body;
    if (!correo) {
      return res.status(400).json({ ok: false, error: 'Correo es obligatorio.' });
    }

    const emailClean = String(correo).trim().toLowerCase();
    const payload = {
      id: `usr-${Date.now()}`,
      nombre: String(nombre || emailClean.split('@')[0]).trim(),
      correo: emailClean,
      rol: String(rol || 'Cobrador').trim(),
      cedula: cedula ? String(cedula).trim() : '',
      created_at: new Date().toISOString()
    };

    inMemoryUsuarios.set(emailClean, payload);

    try {
      const { data, error } = await supabase
        .from('usuarios')
        .upsert([{
          correo: payload.correo,
          nombre: payload.nombre,
          rol: payload.rol,
          cedula: payload.cedula
        }], { onConflict: 'correo' })
        .select();

      if (!error && data?.[0]) {
        payload.id = data[0].id || payload.id;
        inMemoryUsuarios.set(emailClean, data[0]);
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
