// controllers/chatController.js
import { pool } from "../utils/dbClient.js";
import { processMessage } from "../utils/processMessage.js";
import {
  generateUserId,
  getSession,
  initConversation,
  saveSession,
  deleteSession
} from "../utils/sessionManager.js";

export async function processChatMessage(req, res) {
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

    // 2) Guardar mensaje del cliente
    await pool.execute(
      `INSERT INTO compartamos_messages (uuid, message, role, contract)
       VALUES (?, ?, 'Cliente', NULL)`,
      [userId, message]
    );

    // 3) Procesar lógica de conversación
    const reply = await processMessage(session, message);

    // 4) Actualizar contract si ya se capturó la cuenta
    if (session.registro?.cuenta) {
      await pool.execute(
        `UPDATE compartamos_messages
           SET contract = ?
         WHERE uuid = ?
           AND contract IS NULL`,
        [session.registro.cuenta, userId]
      );
    }

    // 5) Insertar respuesta del asistente
    const content = typeof reply === "object"
      ? JSON.stringify(reply)
      : reply;
    await pool.execute(
      `INSERT INTO compartamos_messages (uuid, message, role, contract)
       VALUES (?, ?, 'Gema', ?)`,
      [userId, content, session.registro?.cuenta || null]
    );

    // 6) Guardar estado de la sesión
    await saveSession(userId, session);

    // 7) Devolver la respuesta
    if (typeof reply === "object") {
      res.json({ userId, response: reply });
    } else {
      res.json({ userId, response: reply });
    }
  } catch (err) {
    console.error("Error in /chat:", err);
    res.status(500).json({ error: "Internal error" });
  }
}

export async function newChatSession(req, res) {
  try {
    const { userId: oldId } = req.body;
    if (oldId) {
      await deleteSession(oldId);
      await pool.execute(`DELETE FROM compartamos_messages WHERE uuid = ?`, [oldId]);
    }

    // Crear nueva sesión
    const newUserId = generateUserId();
    const session = initConversation();
    await saveSession(newUserId, session);

    // Saludo inicial fijo
    const welcome =
      "Hola, soy Gema, tu asistente virtual.\n" +
      "Estoy aquí para ayudarte en lo que necesites";

    res.json({ userId: newUserId, response: welcome });
  } catch (err) {
    console.error("Error in /new:", err);
    res.status(500).json({ error: "Internal error" });
  }
}
