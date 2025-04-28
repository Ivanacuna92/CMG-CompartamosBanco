// utils/processMessage.js
import { callAIConversation, generateUserSummary } from "./openaiClient.js";
import { dbUsers } from "./dbUsers.js";

/**
 * Normaliza texto: elimina acentos, múltiples espacios y convierte a mayúsculas
 */
function normalizeText(str) {
  return str
    .normalize("NFD")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const telefonoRegex = /^\d{10}$/;
const correoRegex   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Flujo de validación de usuario:
 * 1) inicio: seleccionar método (Teléfono/Correo)
 * 2) esperando_metodo: espera selección, IA si texto libre
 * 3) esperando_contacto: validar formato, IA si erróneo
 * 4) esperando_nombre: validar contra la DB
 * 5) conversacion_general: IA normal
 */
export async function processMessage(session, userMessage) {
  session.messages.push({ role: "user", content: userMessage });

  const txtLower = userMessage.trim().toLowerCase();
  const nombreNorm = normalizeText(userMessage);

  // 1) inicio: mostrar botones
  if (!session.phase || session.phase === "inicio") {
    const interactive = {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "¿Cómo prefieres validar tu información?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "METODO_TELEFONO", title: "Teléfono" } },
            { type: "reply", reply: { id: "METODO_CORREO",   title: "Correo" } }
          ]
        }
      }
    };
    session.phase = "esperando_metodo";
    session.messages.push({ role: "assistant", content: interactive });
    return interactive;
  }

  // 2) esperando_metodo: IA si texto libre
  if (session.phase === "esperando_metodo") {
    if (userMessage === "METODO_TELEFONO" || txtLower === "telefono" || txtLower === "teléfono") {
      session.method = "telefono";
      session.phase = "esperando_contacto";
      const reply = "Por favor, ingresa tu número de teléfono (10 dígitos).";
      session.messages.push({ role: "assistant", content: reply });
      return reply;
    }
    if (userMessage === "METODO_CORREO" || txtLower === "correo") {
      session.method = "correo";
      session.phase = "esperando_contacto";
      const reply = "Por favor, ingresa tu correo electrónico.";
      session.messages.push({ role: "assistant", content: reply });
      return reply;
    }
    // Texto libre: pedir con IA que use botones
    const prompt = `El usuario escribió: "${userMessage}". Por favor, selecciona un método de validación pulsando uno de los botones: Teléfono o Correo.`;
    const iaResp = await callAIConversation(prompt, session.messages);
    session.messages.push({ role: "assistant", content: iaResp });
    return iaResp;
  }

  // 3) esperando_contacto: validar formato
  if (session.phase === "esperando_contacto") {
    if (session.method === "telefono") {
      if (!telefonoRegex.test(userMessage.trim())) {
        const prompt = `El usuario ingresó: "${userMessage}". Recuerda que tu número de teléfono debe tener 10 dígitos.`;
        const iaResp = await callAIConversation(prompt, session.messages);
        session.messages.push({ role: "assistant", content: iaResp });
        return iaResp;
      }
      session.contact = userMessage.trim();
    } else {
      if (!correoRegex.test(userMessage.trim())) {
        const prompt = `El usuario ingresó: "${userMessage}". Recuerda que necesitamos un correo electrónico válido.`;
        const iaResp = await callAIConversation(prompt, session.messages);
        session.messages.push({ role: "assistant", content: iaResp });
        return iaResp;
      }
      session.contact = userMessage.trim().toLowerCase();
    }
    session.phase = "esperando_nombre";
    const askName = "Gracias. Ahora, por favor ingresa tu nombre completo.";
    session.messages.push({ role: "assistant", content: askName });
    return askName;
  }

  // 4) esperando_nombre: validar en DB
  if (session.phase === "esperando_nombre") {
    const registro = dbUsers.find(r => {
      const nombreDB = normalizeText(r.nombre);
      const contactMatch = session.method === "telefono"
        ? r.telefono === session.contact
        : r.correo.toLowerCase() === session.contact;
      return contactMatch && nombreDB === nombreNorm;
    });
    if (!registro) {
      const prompt = `El usuario escribió: "${userMessage}". No encontré un registro con esa información. Por favor, ingresa tu nombre completo como aparece en tu cuenta.`;
      const iaResp = await callAIConversation(prompt, session.messages);
      session.messages.push({ role: "assistant", content: iaResp });
      return iaResp;
    }
    session.registro = registro;
    session.phase = "conversacion_general";
    const summary = await generateUserSummary(registro);
    session.messages.push({ role: "assistant", content: summary });
    return summary;
  }

  // 5) conversacion_general: IA normal
  const normalReply = await callAIConversation(userMessage, session.messages);
  session.messages.push({ role: "assistant", content: normalReply });
  return normalReply;
}
