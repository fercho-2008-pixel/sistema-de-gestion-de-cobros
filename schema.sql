-- ==========================================================
-- ESQUEMA SQL PARA SUPABASE - SISTEMA DE GESTIÓN DE COBROS
-- Copia y pega este script en: Supabase > SQL Editor > Run
-- ==========================================================

-- 1. Habilitar extensión para UUIDs (si no está activa)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    correo TEXT,
    telefono TEXT,
    documento TEXT NOT NULL UNIQUE,
    estado TEXT DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo')),
    direccion TEXT,
    observaciones TEXT,
    monto_deuda NUMERIC(14, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA DE PRÉSTAMOS
CREATE TABLE IF NOT EXISTS public.prestamos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    documento TEXT,
    cliente_nombre TEXT,
    monto NUMERIC(14, 2) NOT NULL,
    saldo_restante NUMERIC(14, 2) NOT NULL,
    tasa_interes NUMERIC(5, 2) DEFAULT 0,
    plazo_dias INT DEFAULT 30,
    fecha_inicio DATE DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    estado TEXT DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Pagado', 'Vencido')),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA DE PAGOS
CREATE TABLE IF NOT EXISTS public.pagos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    prestamo_id UUID REFERENCES public.prestamos(id) ON DELETE SET NULL,
    cliente_nombre TEXT NOT NULL,
    documento TEXT,
    monto NUMERIC(14, 2) NOT NULL,
    fecha DATE DEFAULT CURRENT_DATE,
    metodo_pago TEXT DEFAULT 'Efectivo',
    referencia TEXT,
    observaciones TEXT,
    estado TEXT DEFAULT 'Pagado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABLA DE USUARIOS (si no existe)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    correo TEXT UNIQUE,
    nombre TEXT,
    rol TEXT DEFAULT 'Administrador',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- 7. POLÍTICAS DE ACCESO PÚBLICO / ANÓNIMO PARA EL SISTEMA
-- Clientes
DROP POLICY IF EXISTS "Permitir lectura general de clientes" ON public.clientes;
CREATE POLICY "Permitir lectura general de clientes" ON public.clientes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion general de clientes" ON public.clientes;
CREATE POLICY "Permitir insercion general de clientes" ON public.clientes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion general de clientes" ON public.clientes;
CREATE POLICY "Permitir actualizacion general de clientes" ON public.clientes FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion general de clientes" ON public.clientes;
CREATE POLICY "Permitir eliminacion general de clientes" ON public.clientes FOR DELETE USING (true);

-- Préstamos
DROP POLICY IF EXISTS "Permitir lectura general de prestamos" ON public.prestamos;
CREATE POLICY "Permitir lectura general de prestamos" ON public.prestamos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion general de prestamos" ON public.prestamos;
CREATE POLICY "Permitir insercion general de prestamos" ON public.prestamos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion general de prestamos" ON public.prestamos;
CREATE POLICY "Permitir actualizacion general de prestamos" ON public.prestamos FOR UPDATE USING (true);

-- Pagos
DROP POLICY IF EXISTS "Permitir lectura general de pagos" ON public.pagos;
CREATE POLICY "Permitir lectura general de pagos" ON public.pagos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion general de pagos" ON public.pagos;
CREATE POLICY "Permitir insercion general de pagos" ON public.pagos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion general de pagos" ON public.pagos;
CREATE POLICY "Permitir actualizacion general de pagos" ON public.pagos FOR UPDATE USING (true);

-- Usuarios
DROP POLICY IF EXISTS "Permitir lectura general de usuarios" ON public.usuarios;
CREATE POLICY "Permitir lectura general de usuarios" ON public.usuarios FOR SELECT USING (true);

-- 8. DATOS INICIALES DE DEMOSTRACIÓN (OPCIONALES)
INSERT INTO public.clientes (nombre, correo, telefono, documento, estado, direccion, observaciones, monto_deuda)
VALUES 
  ('María Pérez', 'maria.perez@ejemplo.com', '+57 310 123 4567', '1020304050', 'Activo', 'Calle 10 # 20-30', 'Cliente puntual', 150000.00),
  ('Juan Torres', 'juan.torres@ejemplo.com', '+57 320 765 4321', '1030405060', 'Activo', 'Carrera 15 # 45-12', 'Préstamo vigente', 250000.00),
  ('Luisa Ramírez', 'luisa.r@ejemplo.com', '+57 315 998 8776', '1040506070', 'Activo', 'Avenida 68 # 11-20', 'Comercio local', 0.00)
ON CONFLICT (documento) DO NOTHING;

INSERT INTO public.pagos (cliente_nombre, documento, monto, fecha, metodo_pago, referencia, observaciones, estado)
VALUES
  ('María Pérez', '1020304050', 50000.00, CURRENT_DATE, 'Transferencia', 'TRX-984521', 'Abono a capital', 'Pagado'),
  ('Luisa Ramírez', '1040506070', 180000.00, CURRENT_DATE - INTERVAL '1 day', 'Efectivo', 'REC-00214', 'Liquidación de saldo', 'Pagado')
ON CONFLICT DO NOTHING;
