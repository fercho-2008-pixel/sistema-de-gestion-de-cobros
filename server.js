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

// Constantes para excluir datos predeterminados/demo
const DOCS_PREDETERMINADOS = ['1020304050', '1030405060', '1040506070'];
const NOMBRES_PREDETERMINADOS = ['maría pérez', 'maria perez', 'juan torres', 'luisa ramírez', 'luisa ramirez'];

// ---------------------------------------------------------
// RUTAS DE API PARA CLIENTES CONECTADAS CON SUPABASE
// ---------------------------------------------------------

// Obtener todos los clientes registrados en Supabase (solo los registrados por el usuario)
app.get('/api/clientes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error al consultar clientes en Supabase:', error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    const filtrados = (data || []).filter(c => 
      c && c.documento &&
      !DOCS_PREDETERMINADOS.includes(String(c.documento).trim()) &&
      !NOMBRES_PREDETERMINADOS.includes(String(c.nombre || '').trim().toLowerCase())
    );

    return res.json({ ok: true, data: filtrados });
  } catch (err) {
    console.error('Error servidor GET /api/clientes:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Obtener pagos registrados en Supabase (solo los registrados por el usuario)
app.get('/api/pagos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    const filtrados = (data || []).filter(p => 
      p &&
      (!p.documento || !DOCS_PREDETERMINADOS.includes(String(p.documento).trim())) &&
      (!p.cliente_nombre || !NOMBRES_PREDETERMINADOS.includes(String(p.cliente_nombre).trim().toLowerCase()))
    );

    return res.json({ ok: true, data: filtrados });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Registrar o actualizar un cliente en Supabase
app.post('/api/clientes', async (req, res) => {
  try {
    const { nombre, correo, telefono, documento, estado, direccion, observaciones, monto_deuda } = req.body;

    if (!nombre || !documento) {
      return res.status(400).json({ ok: false, error: 'Nombre y documento son obligatorios.' });
    }

    const payload = {
      nombre: String(nombre).trim(),
      correo: correo ? String(correo).trim() : null,
      telefono: telefono ? String(telefono).trim() : null,
      documento: String(documento).trim(),
      estado: estado || 'Activo',
      direccion: direccion ? String(direccion).trim() : null,
      observaciones: observaciones ? String(observaciones).trim() : null,
      monto_deuda: Number(monto_deuda) || 0
    };

    const { data, error } = await supabase
      .from('clientes')
      .upsert([payload], { onConflict: 'documento' })
      .select();

    if (error) {
      console.warn('Error al insertar cliente en Supabase:', error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, data: data?.[0] || payload });
  } catch (err) {
    console.error('Error servidor POST /api/clientes:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Eliminar un cliente en Supabase por documento
app.delete('/api/clientes/:documento', async (req, res) => {
  try {
    const doc = String(req.params.documento).trim();
    if (!doc) {
      return res.status(400).json({ ok: false, error: 'Documento no especificado.' });
    }

    // Eliminar pagos asociados primero
    await supabase.from('pagos').delete().eq('documento', doc);

    // Eliminar cliente
    const { error } = await supabase.from('clientes').delete().eq('documento', doc);

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.json({ ok: true, mensaje: 'Cliente eliminado correctamente en Supabase.' });
  } catch (err) {
    console.error('Error servidor DELETE /api/clientes:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Estado de conexión con Supabase
app.get('/api/status', async (req, res) => {
  try {
    const { count, error } = await supabase.from('clientes').select('id', { count: 'exact', head: true });
    return res.json({
      ok: !error,
      supabaseConnected: !error,
      clientesCount: count ?? 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.json({ ok: false, supabaseConnected: false, error: err.message });
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
