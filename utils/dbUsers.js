// utils/dbUsers.js
// Mientras no haya acceso a la BD del cliente, leemos de un JSON mock.
import { readFileSync } from "fs";
import path from "path";
import { normalizeText } from "./processMessage.js";

const MOCK_PATH = path.join(process.cwd(), "data", "clientes.mock.json");
const clientes = JSON.parse(readFileSync(MOCK_PATH, "utf-8"));
console.log(`📁 Catálogo de clientes (mock): ${clientes.length} registros cargados desde ${MOCK_PATH}`);

function matchPhone(row, phone) {
  for (let i = 1; i <= 13; i++) {
    const v = String(row[`TELEFONO${i}`] || "").replace(/\D/g, "");
    if (v && v === phone) return true;
  }
  return false;
}

function rowToRegistro(row) {
  return {
    nombre:          String(row.NOMBRE || "").trim(),
    correo:          String(row.CORREO || "").trim(),
    telefono:        String(row.TELEFONO1 || "").trim(),
    cuenta:          String(row.CREDITO || "").trim(),
    total:           parseFloat(row.TOTAL) || 0,
    clabe:           String(row.CLABE || "").trim(),
    dia_pago:        String(row.DIA_PAGO || "").trim(),
    parcialidad_max: parseInt(row.PARCIALID_MAX) || 0,
    regulariza:      parseFloat(row.REGULARIZA) || 0,
    quita_max:       parseFloat(row.QUITA_MAX) || 0,
    mensualidad:     parseFloat(row.MENSUALIDAD) || 0,
    mora:            String(row.MORA || "").trim(),
  };
}

export async function checkContactExists(method, contact) {
  const valor = contact.trim().toLowerCase();
  console.log("🔍 [checkContactExists] Verificando:", method, valor);

  let existe;
  if (method === "telefono") {
    const phone = valor.replace(/\D/g, "");
    existe = clientes.some(r => matchPhone(r, phone));
  } else {
    existe = clientes.some(r => String(r.CORREO || "").trim().toLowerCase() === valor);
  }

  console.log(`${existe ? "✅" : "❌"} [checkContactExists] ${method === "telefono" ? "Teléfono" : "Correo"} ${existe ? "encontrado" : "NO encontrado"}`);
  return existe;
}

export async function getUserByValidation(method, contact, nombreNormalizado) {
  const valor = contact.trim().toLowerCase();
  console.log("🔍 [getUserByValidation] Buscando:", method, valor, "nombre:", nombreNormalizado);

  let candidatos;
  if (method === "telefono") {
    const phone = valor.replace(/\D/g, "");
    candidatos = clientes.filter(r => matchPhone(r, phone));
  } else {
    candidatos = clientes.filter(r => String(r.CORREO || "").trim().toLowerCase() === valor);
  }

  console.log(`📊 [getUserByValidation] ${candidatos.length} registros con ese ${method}`);

  for (const row of candidatos) {
    const nombreDB = normalizeText(String(row.NOMBRE || "").trim());
    const wordsDB = nombreDB.split(" ").filter(w => w).sort().join(" ");
    const wordsUser = nombreNormalizado.split(" ").filter(w => w).sort().join(" ");
    console.log(`   🔎 Comparando: "${nombreDB}" vs "${nombreNormalizado}" → ${wordsDB === wordsUser}`);
    if (wordsDB === wordsUser) {
      console.log("✅ [getUserByValidation] Usuario encontrado:", row.NOMBRE);
      return rowToRegistro(row);
    }
  }

  console.log("❌ [getUserByValidation] No se encontró usuario con ese nombre");
  return null;
}

export async function getUserByCredito(credito) {
  const target = String(credito).trim();
  const row = clientes.find(r => String(r.CREDITO || "").trim() === target);
  return row ? rowToRegistro(row) : null;
}
