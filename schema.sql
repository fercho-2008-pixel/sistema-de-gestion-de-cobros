-- ==========================================================
-- ESQUEMA SQL - SISTEMA DE GESTIÓN DE COBROS
-- Copia y ejecuta este script en el editor SQL de tu base de datos
-- ==========================================================

-- 1. Habilitar extensión para UUIDs (si no está activa)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre TEXT NOT NULL,
    primer_nombre TEXT,
    segundo_nombre TEXT,
    primer_apellido TEXT,
    segundo_apellido TEXT,
    correo TEXT,
    telefono TEXT,
    documento TEXT NOT NULL UNIQUE,
    estado TEXT DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo')),
    situacion_laboral TEXT,
    tasa_interes NUMERIC(5, 2) DEFAULT 0,
    monto_capital NUMERIC(14, 2) DEFAULT 0.00,
    monto_interes NUMERIC(14, 2) DEFAULT 0.00,
    direccion TEXT,
    observaciones TEXT,
    monto_deuda NUMERIC(14, 2) DEFAULT 0.00,
    numero_factura TEXT UNIQUE,
    registrado_por_nombre TEXT,
    registrado_por_telefono TEXT,
    registrado_por_correo TEXT,
    registrado_por_rol TEXT,
    registrado_por_cedula TEXT,
    cobrador_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar columnas si la tabla ya existía previamente
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS numero_factura TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS registrado_por_nombre TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS registrado_por_telefono TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS registrado_por_correo TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS registrado_por_rol TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS registrado_por_cedula TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cobrador_id TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS situacion_laboral TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tasa_interes NUMERIC(5, 2) DEFAULT 0;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS monto_capital NUMERIC(14, 2) DEFAULT 0.00;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS monto_interes NUMERIC(14, 2) DEFAULT 0.00;

-- 2.1 TABLA HISTÓRICA DE FACTURAS (IRREPETIBLE E INALTERABLE)
CREATE TABLE IF NOT EXISTS public.facturas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo_factura TEXT NOT NULL UNIQUE,
    numero_factura TEXT NOT NULL UNIQUE,
    cliente_documento TEXT NOT NULL,
    cliente_nombre TEXT NOT NULL,
    cliente_telefono TEXT,
    cliente_correo TEXT,
    cliente_direccion TEXT,
    situacion_laboral TEXT,
    monto_capital NUMERIC(14, 2) DEFAULT 0.00,
    tasa_interes NUMERIC(5, 2) DEFAULT 0,
    monto_interes NUMERIC(14, 2) DEFAULT 0.00,
    monto_deuda NUMERIC(14, 2) DEFAULT 0.00,
    observaciones TEXT,
    registrado_por_nombre TEXT,
    registrado_por_telefono TEXT,
    registrado_por_correo TEXT,
    registrado_por_rol TEXT,
    fecha_emision TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
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
    primer_nombre TEXT,
    segundo_nombre TEXT,
    primer_apellido TEXT,
    segundo_apellido TEXT,
    telefono TEXT,
    cedula TEXT,
    rol TEXT DEFAULT 'Administrador',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar columnas si la tabla ya existía previamente
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS primer_nombre TEXT;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS segundo_nombre TEXT;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS primer_apellido TEXT;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS segundo_apellido TEXT;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS cedula TEXT;

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

DROP POLICY IF EXISTS "Permitir eliminacion general de prestamos" ON public.prestamos;
CREATE POLICY "Permitir eliminacion general de prestamos" ON public.prestamos FOR DELETE USING (true);

-- Pagos
DROP POLICY IF EXISTS "Permitir lectura general de pagos" ON public.pagos;
CREATE POLICY "Permitir lectura general de pagos" ON public.pagos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion general de pagos" ON public.pagos;
CREATE POLICY "Permitir insercion general de pagos" ON public.pagos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion general de pagos" ON public.pagos;
CREATE POLICY "Permitir actualizacion general de pagos" ON public.pagos FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion general de pagos" ON public.pagos;
CREATE POLICY "Permitir eliminacion general de pagos" ON public.pagos FOR DELETE USING (true);

-- Usuarios
DROP POLICY IF EXISTS "Permitir lectura general de usuarios" ON public.usuarios;
CREATE POLICY "Permitir lectura general de usuarios" ON public.usuarios FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion general de usuarios" ON public.usuarios;
CREATE POLICY "Permitir insercion general de usuarios" ON public.usuarios FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion general de usuarios" ON public.usuarios;
CREATE POLICY "Permitir actualizacion general de usuarios" ON public.usuarios FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Permitir eliminacion general de usuarios" ON public.usuarios;
CREATE POLICY "Permitir eliminacion general de usuarios" ON public.usuarios FOR DELETE USING (true);

-- Trigger opcional para sincronizar automáticamente usuarios de auth.users a public.usuarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (id, correo, nombre, rol)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'rol', 'Cobrador')
  )
  ON CONFLICT (id) DO UPDATE
    SET nombre = EXCLUDED.nombre,
        rol = EXCLUDED.rol;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

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
