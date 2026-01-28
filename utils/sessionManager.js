// utils/sessionManager.js
import sqlite3 from "sqlite3";
import { readFileSync, existsSync, accessSync, constants, unlinkSync } from "fs";
import path from "path";

// Determinar la ruta de la base de datos
// Prioridad: variable de entorno > /tmp (más seguro en contenedores) > directorio actual
function getDbPath() {
  if (process.env.SESSIONS_DB_PATH) {
    return process.env.SESSIONS_DB_PATH;
  }

  // En contenedores, /tmp siempre tiene permisos de escritura
  const tmpPath = "/tmp/sessions.db";
  const localPath = "./sessions.db";

  // Si ya existe en local y es escribible, usarlo
  if (existsSync(localPath)) {
    try {
      accessSync(localPath, constants.W_OK);
      return localPath;
    } catch {
      console.warn("⚠️ sessions.db existe pero no es escribible, usando /tmp");
      return tmpPath;
    }
  }

  // Si no existe, intentar crear en local, si falla usar /tmp
  try {
    accessSync(".", constants.W_OK);
    return localPath;
  } catch {
    console.warn("⚠️ Directorio actual no es escribible, usando /tmp");
    return tmpPath;
  }
}

const DB_PATH = getDbPath();
console.log(`📁 Base de datos SQLite: ${DB_PATH}`);

// Inicializar SQLite
const sqlite = sqlite3.verbose();
const sessionsDB = new sqlite.Database(DB_PATH, (err) => {
  if (err) {
    console.error("❌ Error conectando a SQLite:", err);
    // Si falla por permisos, intentar eliminar y recrear
    if (err.code === "SQLITE_READONLY" || err.code === "SQLITE_CANTOPEN") {
      try {
        if (existsSync(DB_PATH)) {
          unlinkSync(DB_PATH);
          console.log("🔄 Archivo corrupto eliminado, reinicia la aplicación");
        }
      } catch (e) {
        console.error("❌ No se pudo eliminar el archivo:", e.message);
      }
    }
  } else {
    console.log("✅ SQLite conectado correctamente");
  }
});

// Crear tabla de sesiones (si no existe)
sessionsDB.run(
  `CREATE TABLE IF NOT EXISTS sessions (
      userId TEXT PRIMARY KEY,
      conversation TEXT,
      lastUpdated INTEGER
  )`
);

// Genera un ID de usuario (formato FXTori-XXXXXXXX)
export function generateUserId() {
  const randHex = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, "0")
    .toUpperCase();
  return `FXTori-${randHex}`;
}

// Inicializa el estado de la conversación; se utiliza el prompt base (prompt.txt)
export function initConversation() {
  const promptBase = readFileSync("prompt.txt", "utf-8");
  return {
    phase: "inicio", // Fases: inicio, conversacion_general, esperando_validacion, datos_validos
    registro: null,
    messages: [
      { role: "system", content: promptBase }
    ],
  };
}

// Obtiene la sesión almacenada para un usuario
export function getSession(userId) {
  return new Promise((resolve, reject) => {
    sessionsDB.get(
      "SELECT * FROM sessions WHERE userId = ?",
      [userId],
      (err, row) => {
        if (err) return reject(err);
        if (row) {
          const now = Date.now();
          // Si la sesión expira (más de 1 hora de inactividad)
          if (now - row.lastUpdated > 3600000) {
            sessionsDB.run("DELETE FROM sessions WHERE userId = ?", [userId]);
            return resolve(null);
          }
          return resolve(JSON.parse(row.conversation));
        }
        resolve(null);
      }
    );
  });
}

// Guarda o actualiza la sesión en la base de datos
export function saveSession(userId, conversationObj) {
  return new Promise((resolve, reject) => {
    const convStr = JSON.stringify(conversationObj);
    const now = Date.now();
    sessionsDB.run(
      `INSERT INTO sessions(userId, conversation, lastUpdated)
       VALUES (?, ?, ?)
       ON CONFLICT(userId) DO UPDATE SET conversation = excluded.conversation, lastUpdated = excluded.lastUpdated`,
      [userId, convStr, now],
      (err) => {
        if (err) {
          // Si es error de solo lectura, loguear pero no tronar la app
          if (err.code === "SQLITE_READONLY") {
            console.error("⚠️ SQLite en modo solo lectura, sesión no guardada:", userId);
            // Resolver de todos modos para que el chat siga funcionando
            return resolve();
          }
          return reject(err);
        }
        resolve();
      }
    );
  });
}

// Elimina la sesión
export function deleteSession(userId) {
  return new Promise((resolve, reject) => {
    sessionsDB.run("DELETE FROM sessions WHERE userId = ?", [userId], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}
