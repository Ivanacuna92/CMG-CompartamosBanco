// utils/dbUsers.js
import { clientePool } from "../db/configs.js";
import { normalizeText } from "./processMessage.js";

// Genera las condiciones OR para buscar en TELEFONO1..TELEFONO13
const PHONE_COLUMNS = Array.from({ length: 13 }, (_, i) => `TELEFONO${i + 1}`);
const PHONE_WHERE = PHONE_COLUMNS.map(col => `\`${col}\` = ?`).join(" OR ");

/**
 * Convierte una fila de la BD al formato de registro que usa el resto de la app
 */
function rowToRegistro(row) {
  return {
    nombre:          String(row.NOMBRE || "").trim(),
    correo:          String(row.CORREO || "").trim(),
    telefono:        String(row.TELEFONO1 || "").trim(),
    cuenta:          String(row.CREDITO || "").trim(),
    total:           parseFloat(row.TOTAL) || 0,
    clabe:           String(row.CLABE || "").trim(),
    dia_pago:        String(row["DIA PAGO"] || "").trim(),
    parcialidad_max: parseInt(row["PARCIALID MAX"]) || 0,
    regulariza:      parseFloat(row.REGULARIZA) || 0,
    quita_max:       parseFloat(row["QUITA MAX"]) || 0,
    mensualidad:     parseFloat(row.MENSUALIDAD) || 0,
    mora:            String(row.MORA || "").trim(),
  };
}

/**
 * Verifica si existe un cliente con el teléfono o correo proporcionado
 */
export async function checkContactExists(method, contact) {
  const valor = contact.trim().toLowerCase();
  console.log("🔍 [checkContactExists] Verificando:", method, valor);

  try {
    let rows;
    if (method === "telefono") {
      const phone = valor.replace(/\D/g, "");
      const params = Array(13).fill(phone);
      [rows] = await clientePool.query(
        `SELECT 1 FROM cpi_pv WHERE ${PHONE_WHERE} LIMIT 1`,
        params
      );
    } else {
      [rows] = await clientePool.query(
        `SELECT 1 FROM cpi_pv WHERE CORREO = ? LIMIT 1`,
        [valor]
      );
    }

    const existe = rows.length > 0;
    console.log(`${existe ? "✅" : "❌"} [checkContactExists] ${method === "telefono" ? "Teléfono" : "Correo"} ${existe ? "encontrado" : "NO encontrado"}`);
    return existe;
  } catch (err) {
    console.error("❌ [checkContactExists] Error en consulta:", err.message);
    return false;
  }
}

/**
 * Busca un cliente por teléfono/correo y nombre normalizado
 */
export async function getUserByValidation(method, contact, nombreNormalizado) {
  const valor = contact.trim().toLowerCase();
  console.log("🔍 [getUserByValidation] Buscando:", method, valor, "nombre:", nombreNormalizado);

  try {
    let rows;
    if (method === "telefono") {
      const phone = valor.replace(/\D/g, "");
      const params = Array(13).fill(phone);
      [rows] = await clientePool.query(
        `SELECT * FROM cpi_pv WHERE ${PHONE_WHERE}`,
        params
      );
    } else {
      [rows] = await clientePool.query(
        `SELECT * FROM cpi_pv WHERE CORREO = ?`,
        [valor]
      );
    }

    console.log(`📊 [getUserByValidation] ${rows.length} registros con ese ${method}`);

    for (const row of rows) {
      const nombreDB = normalizeText(String(row.NOMBRE || "").trim());

      // Comparar por conjunto de palabras (sin importar orden)
      const wordsDB = nombreDB.split(" ").filter(w => w).sort().join(" ");
      const wordsUser = nombreNormalizado.split(" ").filter(w => w).sort().join(" ");

      console.log(`   🔎 Comparando: "${nombreDB}" vs "${nombreNormalizado}" (palabras: "${wordsDB}" vs "${wordsUser}") → ${wordsDB === wordsUser}`);
      if (wordsDB === wordsUser) {
        console.log("✅ [getUserByValidation] Usuario encontrado:", row.NOMBRE);
        return rowToRegistro(row);
      }
    }

    console.log("❌ [getUserByValidation] No se encontró usuario con ese nombre");
    return null;
  } catch (err) {
    console.error("❌ [getUserByValidation] Error en consulta:", err.message);
    return null;
  }
}

/**
 * Busca un cliente por número de crédito
 */
export async function getUserByCredito(credito) {
  try {
    const [rows] = await clientePool.query(
      `SELECT * FROM cpi_pv WHERE CREDITO = ? LIMIT 1`,
      [String(credito).trim()]
    );
    return rows.length > 0 ? rowToRegistro(rows[0]) : null;
  } catch (err) {
    console.error("❌ [getUserByCredito] Error en consulta:", err.message);
    return null;
  }
}
