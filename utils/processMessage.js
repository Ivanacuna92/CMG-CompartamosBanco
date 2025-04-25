// utils/processMessage.js
import {
  callAIConversation,
  generateUserSummary,
  solicitarDatoAdicional
} from "./openaiClient.js";
import { dbUsers } from "./dbUsers.js";

/**
 * Normaliza texto: elimina acentos, múltiples espacios y convierte a mayúsculas
 */
function normalizeText(str) {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const telefonoRegex = /^\d{10}$/;
const correoRegex   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function processMessage(session, userMessage) {
  // Guardar siempre el mensaje del usuario
  session.messages.push({ role: "user", content: userMessage });

  // Normalizar posibles inputs de nombre
  const cleaned = userMessage.replace(/^(?:es\s+|soy\s+|me llamo\s+)/i, "");
  const nombreInput = normalizeText(cleaned);
  const words = nombreInput.split(" ").filter(Boolean);

  // Match exacto de nombre completo
  const matches = dbUsers.filter(r => {
    const nombreNorm = normalizeText(r.nombre);
    return words.length >= 2 && nombreNorm === nombreInput;
  });

  // 1) Inicio: saludo o salto si ya dio nombre completo
  if (!session.phase || session.phase === "inicio") {
    if (matches.length) {
      // Salto directo a validación
      session.registro = matches[0];
      session.phase = "elegir_validacion";
      const interactive = {
        type: "interactive",
        interactive: {
          type: "button",
          body: {
            text: `Gracias ${session.registro.nombre}. ¿Cómo prefieres validar tu información?`
          },
          action: {
            buttons: [
              { type: "reply", reply: { id: "TELEFONO", title: "Teléfono" } },
              { type: "reply", reply: { id: "CORREO",   title: "Correo electrónico" } }
            ]
          }
        }
      };
      session.messages.push({ role: "assistant", content: interactive });
      return interactive;
    }
    // Pido nombre con IA
    const prompt = `El usuario escribió: "${userMessage}". Necesitamos tu nombre completo para continuar (Ej: JUAN PÉREZ LÓPEZ). Por favor, indícalo.`;
    const iaResp = await callAIConversation(prompt, session.messages);
    session.phase = "esperando_nombre";
    session.messages.push({ role: "assistant", content: iaResp });
    return iaResp;
  }

  // 2) Fase ESPERANDO_NOMBRE: validar nombre
  if (session.phase === "esperando_nombre") {
    if (matches.length) {
      session.registro = matches[0];
      session.phase = "elegir_validacion";
      const interactive = {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: `Gracias ${session.registro.nombre}. ¿Cómo prefieres validar tu información?` },
          action: { buttons: [
              { type: "reply", reply: { id: "TELEFONO", title: "Teléfono" } },
              { type: "reply", reply: { id: "CORREO",   title: "Correo electrónico" } }
            ] }
        }
      };
      session.messages.push({ role: "assistant", content: interactive });
      return interactive;
    }
    // Nombre inválido → IA repite petición
    const prompt = `El usuario escribió: "${userMessage}". Necesitamos tu nombre completo como está en tu registro (Ej: JUAN PÉREZ LÓPEZ). Por favor, indícalo.`;
    const iaResp = await callAIConversation(prompt, session.messages);
    session.messages.push({ role: "assistant", content: iaResp });
    return iaResp;
  }

  // 3) Fase ELEGIR_VALIDACION: botones
  if (session.phase === "elegir_validacion") {
    const txt = userMessage.trim().toLowerCase();
    if (txt === "teléfono" || userMessage === "TELEFONO") {
      session.phase = "esperando_telefono";
      const reply = "Por favor, ingresa tu número de teléfono de 10 dígitos.";
      session.messages.push({ role: "assistant", content: reply });
      return reply;
    }
    if (txt === "correo electrónico" || userMessage === "CORREO") {
      session.phase = "esperando_correo";
      const reply = "Por favor, ingresa tu correo electrónico.";
      session.messages.push({ role: "assistant", content: reply });
      return reply;
    }
    const prompt = `El usuario ingresó: "${userMessage}". Debe elegir entre Teléfono o Correo electrónico.`;
    const iaResp = await callAIConversation(prompt, session.messages);
    session.messages.push({ role: "assistant", content: iaResp });
    return iaResp;
  }

  // 4) Fase ESPERANDO_TELEFONO: validar y summary IA
  if (session.phase === "esperando_telefono") {
    const num = userMessage.trim();
    if (!telefonoRegex.test(num) || num !== session.registro.telefono) {
      const iaResp = await solicitarDatoAdicional(session.registro, userMessage);
      session.messages.push({ role: "assistant", content: iaResp });
      return iaResp;
    }
    session.phase = "conversacion_general";
    const summary = await generateUserSummary(session.registro);
    session.messages.push({ role: "assistant", content: summary });
    return summary;
  }

  // 5) Fase ESPERANDO_CORREO: validar y summary IA
  if (session.phase === "esperando_correo") {
    const mail = userMessage.trim().toLowerCase();
    if (!correoRegex.test(mail) || mail !== session.registro.correo.toLowerCase()) {
      const iaResp = await solicitarDatoAdicional(session.registro, userMessage);
      session.messages.push({ role: "assistant", content: iaResp });
      return iaResp;
    }
    session.phase = "conversacion_general";
    const summary = await generateUserSummary(session.registro);
    session.messages.push({ role: "assistant", content: summary });
    return summary;
  }

  // 6) Fase conversacion_general: IA responde normalmente
  const normalReply = await callAIConversation(userMessage, session.messages);
  session.messages.push({ role: "assistant", content: normalReply });
  return normalReply;
}
