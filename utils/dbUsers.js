import { clientePool } from "../db/configs.js";
import { normalizeText } from "./processMessage.js";

/**
 * Función helper para reintentar queries con backoff exponencial
 */
async function retryQuery(queryFn, maxRetries = 3, initialDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 [retryQuery] Intento ${attempt} de ${maxRetries}`);
      return await queryFn();
    } catch (error) {
      lastError = error;
      console.error(`❌ [retryQuery] Error en intento ${attempt}:`, error.message);

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ [retryQuery] Reintentando en ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Verifica si existe un cliente con el teléfono o correo proporcionado
 * Retorna true si existe, false si no existe
 */
export async function checkContactExists(method, contact) {
  try {
    const isTelefono = method === "telefono";
    const campo = isTelefono ? "telefono" : "LOWER(correo)";
    const valor = contact.trim().toLowerCase();

    console.log("🔍 [checkContactExists] Verificando existencia de:");
    console.log("   - Método:", method);
    console.log("   - Contacto:", valor);

    const [rows] = await retryQuery(async () => {
      return await clientePool.query(
        `SELECT COUNT(*) as total FROM datos WHERE ${campo} = ?`,
        [valor]
      );
    });

    const existe = rows[0].total > 0;
    console.log(`${existe ? "✅" : "❌"} [checkContactExists] Contacto ${existe ? "encontrado" : "NO encontrado"}`);

    return existe;
  } catch (err) {
    console.error("❌ Error en checkContactExists:", err.message);
    return false;
  }
}

/**
 * Busca un cliente en la tabla `datos` por teléfono o correo y nombre ya normalizado
 */
export async function getUserByValidation(method, contact, nombreNormalizado) {
  try {
    const isTelefono = method === "telefono";
    const campo = isTelefono ? "telefono" : "LOWER(correo)";
    const valor = contact.trim().toLowerCase();

    console.log("🔍 [getUserByValidation] Buscando con:");
    console.log("   - Método:", method);
    console.log("   - Contacto:", valor);
    console.log("   - Nombre normalizado:", nombreNormalizado);

    const [rows] = await retryQuery(async () => {
      return await clientePool.query(
        `SELECT * FROM datos WHERE ${campo} = ?`,
        [valor]
      );
    });

    console.log(`📊 [getUserByValidation] Se encontraron ${rows.length} registros con ese ${method}`);

    const resultado = rows.find((row, index) => {
      const nombreDBOriginal = row.nombre || "";
      const nombreDBNormalizado = normalizeText(nombreDBOriginal);
      console.log(`   🔎 Comparando registro ${index + 1}:`);
      console.log(`      - Nombre en DB (original): "${nombreDBOriginal}"`);
      console.log(`      - Nombre en DB (normalizado): "${nombreDBNormalizado}"`);
      console.log(`      - Nombre buscado: "${nombreNormalizado}"`);
      console.log(`      - Coincide: ${nombreDBNormalizado === nombreNormalizado}`);
      return nombreDBNormalizado === nombreNormalizado;
    }) || null;

    if (resultado) {
      console.log("✅ [getUserByValidation] Usuario encontrado:", resultado.nombre);
    } else {
      console.log("❌ [getUserByValidation] No se encontró ningún usuario con ese nombre");
    }

    return resultado;

  } catch (err) {
    console.error("❌ Error en getUserByValidation:", err.message);
    return null;
  }
}

/**
 * Busca un cliente en la tabla `datos` por número de cuenta
 */
export async function getUserByCredito(credito) {
  try {
    const [rows] = await retryQuery(async () => {
      return await clientePool.query(
        `SELECT * FROM datos WHERE cuenta = ?`,
        [credito]
      );
    });
    return rows[0] || null;
  } catch (error) {
    console.error("❌ Error al obtener cliente por cuenta:", error);
    return null;
  }
}
