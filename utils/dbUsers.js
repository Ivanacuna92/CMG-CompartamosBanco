import { clientePool } from "../db/configs.js";
import { normalizeText } from "./processMessage.js";

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

    const [rows] = await clientePool.query(
      `SELECT * FROM datos WHERE ${campo} = ?`,
      [valor]
    );

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
    const [rows] = await clientePool.query(
      `SELECT * FROM datos WHERE cuenta = ?`,
      [credito]
    );
    return rows[0] || null;
  } catch (error) {
    console.error("❌ Error al obtener cliente por cuenta:", error);
    return null;
  }
}
