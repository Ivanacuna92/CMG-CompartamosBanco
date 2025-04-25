// utils/sessionManager.js
import sqlite3 from "sqlite3";
import { readFileSync } from "fs";

// Inicializar SQLite (se guarda en sessions.db)
const sqlite = sqlite3.verbose();
const sessionsDB = new sqlite.Database("./sessions.db", (err) => {
  if (err) console.error("Error conectando a SQLite:", err);
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
        if (err) return reject(err);
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
