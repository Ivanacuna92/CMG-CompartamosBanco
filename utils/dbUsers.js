// utils/dbUsers.js
import { clientePool } from "../db/configs.js";

/**
 * Busca un cliente en la tabla `datos` por teléfono o correo y nombre ya normalizado
 * @param {"telefono" | "correo"} method
 * @param {string} contact - número o correo ya validado
 * @param {string} nombreNormalizado - nombre ya normalizado desde el código principal
 * @returns {object|null}
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
