# Guía de Despliegue en Vercel 🚀

Este proyecto está completamente configurado y listo para ser desplegado en **Vercel** combinando archivos estáticos de alto rendimiento servidos en el CDN global de Vercel y funciones Serverless en Node.js para las rutas de API (`/api/*`).

---

## 📁 Archivos de Configuración Generados

1. **`vercel.json`**: Configura las reglas de enrutamiento para que todas las peticiones a `/api/*` se dirijan a la función serverless en `api/index.js`, mientras que las páginas HTML, estilos CSS y scripts cliente se sirven de forma estática ultrarrápida.
2. **`api/index.js`**: Punto de entrada Serverless que exporta la aplicación Express (`server.js`) adaptada para la arquitectura sin servidor de Vercel.
3. **`.vercelignore`**: Excluye archivos locales y de caché que no deben subirse a producción.
4. **`.env.example`**: Lista de variables de entorno requeridas para producción.

---

## 🛠️ Método 1: Despliegue Directo desde GitHub (Recomendado)

1. **Subir tu proyecto a un repositorio de GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Configuración para despliegue en Vercel"
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```

2. **Importar el proyecto en Vercel**:
   - Ingresa a [https://vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
   - Haz clic en el botón **"Add New..."** -> **"Project"**.
   - Selecciona tu repositorio y haz clic en **"Import"**.

3. **Configurar las Variables de Entorno (Environment Variables)**:
   - En la pantalla de configuración antes de desplegar, expande la sección **Environment Variables**.
   - Agrega las siguientes dos variables:
     - `SUPABASE_URL`: `https://vvvveahvvabpzkephwlu.supabase.co`
     - `SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2dnZlYWh2dmFicHprZXBod2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MDQzNzIsImV4cCI6MjEwNDk4MDM3Mn0.AXo3MSol4K7hawxwHsgHlEThGXzZZn4u4WdMXH7k2ts`
   *(Si tienes tus propias credenciales de Supabase, puedes reemplazarlas aquí).*

4. **Desplegar**:
   - Deja el Framework Preset como **Other**.
   - Haz clic en **"Deploy"**.
   - En cuestión de segundos, Vercel te entregará una URL pública (ejemplo: `https://tu-proyecto.vercel.app`).

---

## 💻 Método 2: Despliegue mediante Vercel CLI

Si prefieres desplegar desde la terminal:

1. **Instalar Vercel CLI globalmente**:
   ```bash
   npm install -g vercel
   ```

2. **Iniciar sesión en Vercel**:
   ```bash
   vercel login
   ```

3. **Desplegar a producción**:
   ```bash
   vercel --prod
   ```

4. Sigue las instrucciones interactivas en pantalla (acepta los valores por defecto).

---

## 🔍 Verificación Post-Despliegue

Una vez completado el despliegue, podrás verificar:
- **Página de Inicio / Login**: `https://tu-proyecto.vercel.app/` o `https://tu-proyecto.vercel.app/index.html`
- **Panel Principal**: `https://tu-proyecto.vercel.app/menu2.html`
- **Endpoint de Estado de la API**: `https://tu-proyecto.vercel.app/api/status`
- **Directorio de Clientes**: `https://tu-proyecto.vercel.app/clientes.html`
