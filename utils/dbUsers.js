import { clientePool } from "../db/configs.js";

/**
 * Busca un cliente en la tabla `datos` por teléfono o correo y nombre ya normalizado
 */
export async function getUserByValidation(method, contact, nombreNormalizado) {
  try {
    const isTelefono = method === "telefono";
    const campo = isTelefono ? "telefono" : "LOWER(correo)";
    const valor = contact.trim().toLowerCase();

    const [rows] = await clientePool.query(
      `SELECT * FROM datos WHERE ${campo} = ?`,
      [valor]
    );

    return rows.find(row => {
      const nombreDB = (row.nombre || "").toUpperCase().trim();
      return nombreDB === nombreNormalizado;
    }) || null;

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
