// controllers/chatControllerSQLite.js
import sqlite3 from "sqlite3";
import { processMessage } from "../utils/processMessage.js";
import {
  generateUserId,
  getSession,
  initConversation,
  saveSession,
  deleteSession
} from "../utils/sessionManager.js";

const db = new sqlite3.Database("./esac.db", (err) => {
  if (err) console.error("❌ Error al conectar SQLite:", err);
  else console.log("✅ Conectado a esac.db");
});

db.run(`
  CREATE TABLE IF NOT EXISTS inbursa_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT,
    message TEXT,
    role TEXT,
    contract TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

export async function processChatMessageSQLite(req, res) {
  try {
    let { userId, message } = req.body;
    if (!message) return res.status(400).json({ error: "No message sent." });

    // 1) Obtener o inicializar sesión
    let session;
    if (!userId) {
      userId = generateUserId();
      session = initConversation();
    } else {
      session = (await getSession(userId)) || initConversation();
      if (!session) userId = generateUserId();
    }

    // 2) Insertar mensaje del cliente
    db.run(
      `INSERT INTO inbursa_messages (uuid, message, role, contract)
       VALUES (?, ?, 'Cliente', NULL)`,
      [userId, message],
      (err) => {
        if (err) console.error("❌ Error insertando mensaje cliente:", err);
      }
    );

    // 3) Procesar lógica de conversación
    const reply = await processMessage(session, message);

    // 4) Actualizar contrato si ya se capturó la cuenta
    if (session.registro?.cuenta) {
      db.run(
        `UPDATE inbursa_messages
         SET contract = ?
         WHERE uuid = ? AND contract IS NULL`,
        [session.registro.cuenta, userId],
        (err) => {
          if (err) console.error("❌ Error actualizando contrato:", err);
        }
      );
    }

    // 5) Insertar respuesta del asistente
    const content = typeof reply === "object"
      ? JSON.stringify(reply)
      : reply;

    db.run(
      `INSERT INTO inbursa_messages (uuid, message, role, contract)
       VALUES (?, ?, 'Tori', ?)`,
      [userId, content, session.registro?.cuenta || null],
      (err) => {
        if (err) console.error("❌ Error insertando respuesta IA:", err);
      }
    );

    // 6) Guardar estado de la sesión
    await saveSession(userId, session);

    // 7) Responder
    res.json({ userId, response: reply });

  } catch (err) {
    console.error("❌ Error en /chat (SQLite):", err);
    res.status(500).json({ error: "Internal error" });
  }
}

export async function newChatSessionSQLite(req, res) {
  try {
    const { userId: oldId } = req.body;
    if (oldId) {
      await deleteSession(oldId);
      db.run(`DELETE FROM inbursa_messages WHERE uuid = ?`, [oldId], (err) => {
        if (err) console.error("❌ Error al borrar mensajes:", err);
      });
    }

    const newUserId = generateUserId();
    const session = initConversation();
    await saveSession(newUserId, session);

    const welcome =
      "Hola, soy Tori, tu asistente virtual.\n" +
      "Estoy aquí para ayudarte para la liquidación de tu adeudo.";

    res.json({ userId: newUserId, response: welcome });
  } catch (err) {
    console.error("❌ Error en /new (SQLite):", err);
    res.status(500).json({ error: "Internal error" });
  }
}
