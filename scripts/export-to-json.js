/* scripts/export-to-json.js */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración para cargar el .env manualmente
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
    const match = envContent.match(new RegExp(`${key}=(.*)`));
    return match ? match[1].trim() : null;
};

const supabaseUrl = getEnv('PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getEnv('PUBLIC_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ No se encontraron las credenciales en el .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function exportData() {
    console.log("📡 Conectando con Supabase...");

    // 1. Traer todos los templates con sus opciones incorporadas
    const { data: combinedData, error } = await supabase
        .from('templates')
        .select(`
            *,
            options:template_options(*)
        `);

    if (error) {
        console.error("❌ Error al obtener datos:", error.message);
        throw error;
    }

    // Ordenar opciones por fecha de creación dentro de cada template (opcional pero recomendado)
    combinedData.forEach(template => {
        if (template.options) {
            template.options.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }
    });

    console.log(`✅ Recuperados ${combinedData.length} templates con sus respectivas opciones.`);

    // 4. Guardar en src/data/templates.json
    const outputDir = path.resolve(__dirname, '../src/data');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'templates.json');
    fs.writeFileSync(outputPath, JSON.stringify(combinedData, null, 2));

    console.log(`🚀 ¡Éxito! Datos guardados en: ${outputPath}`);
}

exportData().catch(err => {
    console.error("❌ Error durante la exportación:", err.message);
});