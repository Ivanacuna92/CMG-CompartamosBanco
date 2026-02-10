// utils/dbUsers.js
import XLSX from "xlsx";
import path from "path";
import { normalizeText } from "./processMessage.js";

// --- Carga del Excel una sola vez al iniciar ---
const EXCEL_PATH = path.join(process.cwd(), "data", "BASE IA CPI-PV Febrero 2026.xlsx");

let allRows = [];
let phoneMap = new Map(); // telefono -> [indices de allRows]
let emailMap = new Map(); // correo  -> [indices de allRows]

function loadExcelData() {
  console.log("📊 [Excel] Cargando datos desde:", EXCEL_PATH);

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  // Limpiar nombres de columnas (quitar espacios)
  allRows = rawRows.map(row => {
    const cleaned = {};
    for (const [key, value] of Object.entries(row)) {
      cleaned[key.trim()] = value;
    }
    return cleaned;
  });

  // Construir mapa de teléfonos (TELEFONO1 a TELEFONO13)
  phoneMap = new Map();
  emailMap = new Map();

  allRows.forEach((row, index) => {
    for (let i = 1; i <= 13; i++) {
      const raw = String(row[`TELEFONO${i}`] || "").trim();
      if (raw && raw !== "0" && raw.length >= 10) {
        const phone = raw.replace(/\D/g, "");
        if (!phoneMap.has(phone)) phoneMap.set(phone, []);
        phoneMap.get(phone).push(index);
      }
    }

    const email = String(row["CORREO"] || "").trim().toLowerCase();
    if (email && email !== "0") {
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email).push(index);
    }
  });

  console.log(`✅ [Excel] ${allRows.length} registros cargados`);
  console.log(`📞 [Excel] ${phoneMap.size} teléfonos únicos indexados`);
  console.log(`📧 [Excel] ${emailMap.size} correos únicos indexados`);
}

// Cargar al importar el módulo
loadExcelData();

/**
 * Convierte una fila del Excel al formato de registro que usa el resto de la app
 */
function rowToRegistro(row) {
  return {
    nombre: String(row["NOMBRE"] || "").trim(),
    correo: String(row["CORREO"] || "").trim(),
    telefono: String(row["TELEFONO1"] || "").trim(),
    cuenta: String(row["CREDITO"] || "").trim(),
    total: parseFloat(row["TOTAL"]) || 0,
    clabe: String(row["CLABE"] || "").trim(),
    dia_pago: String(row["DIA PAGO"] || "").trim(),
    parcialidad_max: parseInt(row["PARCIALID MAX"]) || 0,
    regulariza: parseFloat(row["REGULARIZA"]) || 0,
    quita_max: parseFloat(row["QUITA MAX"]) || 0,
  };
}

/**
 * Verifica si existe un cliente con el teléfono o correo proporcionado
 */
export async function checkContactExists(method, contact) {
  const valor = contact.trim().toLowerCase();

  console.log("🔍 [checkContactExists] Verificando:", method, valor);

  if (method === "telefono") {
    const phone = valor.replace(/\D/g, "");
    const existe = phoneMap.has(phone);
    console.log(`${existe ? "✅" : "❌"} [checkContactExists] Teléfono ${existe ? "encontrado" : "NO encontrado"}`);
    return existe;
  }

  const existe = emailMap.has(valor);
  console.log(`${existe ? "✅" : "❌"} [checkContactExists] Correo ${existe ? "encontrado" : "NO encontrado"}`);
  return existe;
}

/**
 * Busca un cliente por teléfono/correo y nombre normalizado
 */
export async function getUserByValidation(method, contact, nombreNormalizado) {
  const valor = contact.trim().toLowerCase();

  console.log("🔍 [getUserByValidation] Buscando:", method, valor, "nombre:", nombreNormalizado);

  let indices = [];
  if (method === "telefono") {
    const phone = valor.replace(/\D/g, "");
    indices = phoneMap.get(phone) || [];
  } else {
    indices = emailMap.get(valor) || [];
  }

  console.log(`📊 [getUserByValidation] ${indices.length} registros con ese ${method}`);

  for (const idx of indices) {
    const row = allRows[idx];
    const nombreDB = normalizeText(String(row["NOMBRE"] || "").trim());
    console.log(`   🔎 Comparando: "${nombreDB}" vs "${nombreNormalizado}" → ${nombreDB === nombreNormalizado}`);
    if (nombreDB === nombreNormalizado) {
      console.log("✅ [getUserByValidation] Usuario encontrado:", row["NOMBRE"]);
      return rowToRegistro(row);
    }
  }

  console.log("❌ [getUserByValidation] No se encontró usuario con ese nombre");
  return null;
}

/**
 * Busca un cliente por número de crédito
 */
export async function getUserByCredito(credito) {
  const row = allRows.find(r => String(r["CREDITO"]).trim() === String(credito).trim());
  return row ? rowToRegistro(row) : null;
}

/**
 * Permite recargar los datos del Excel en caliente (por si se actualiza el archivo)
 */
export function reloadExcelData() {
  loadExcelData();
}
