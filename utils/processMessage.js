// utils/processMessage.js
import { callAIConversation, generateUserSummary, generateNegotiationPlans } from "./openaiClient.js";
import { getUserByValidation } from "./dbUsers.js"; // <-- se usa BD real

/**
 * Normaliza texto: elimina acentos, múltiples espacios y convierte a mayúsculas
 * IMPORTANTE: También convierte Ñ -> N para comparaciones
 */
export function normalizeText(str) {
  console.log("🔍 [normalizeText] Texto original:", str);

  const step1 = str.normalize("NFD");
  console.log("📝 [normalizeText] Después de NFD:", step1);

  const step2 = step1.replace(/[\u0300-\u036f]/g, ""); // Elimina solo los acentos diacríticos
  console.log("📝 [normalizeText] Después de eliminar acentos:", step2);

  const step3 = step2.replace(/[^a-zA-ZÑñ\s]/g, ""); // Preserva letras (incluyendo Ñ) y espacios
  console.log("📝 [normalizeText] Después de filtrar caracteres:", step3);

  const step4 = step3.replace(/[Ññ]/g, "N"); // Convierte Ñ/ñ a N para comparación
  console.log("📝 [normalizeText] Después de convertir Ñ->N:", step4);

  const result = step4.replace(/\s+/g, " ").trim().toUpperCase();
  console.log("✅ [normalizeText] Resultado final:", result);

  return result;
}

const telefonoRegex = /^\d{10}$/;
const correoRegex   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
        body: { text: "¿Para brindarte los beneficios ¿Cómo deseas identificarte? Teléfono o Correo?", },
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

  // 4) esperando_nombre: validar en base de datos real
  if (session.phase === "esperando_nombre") {
    const registro = await getUserByValidation(session.method, session.contact, nombreNorm);
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

  // 5) conversacion_general: detectar si el cliente solicita más opciones de pago
  // Palabras clave que indican que el cliente necesita planes adicionales
  const keywordsNegociacion = [
    "no puedo",
    "muy alto",
    "muy caro",
    "mucho dinero",
    "otras opciones",
    "más opciones",
    "algo más bajo",
    "algo más barato",
    "más plazo",
    "más tiempo",
    "menos pago",
    "menor pago",
    "no me alcanza",
    "no tengo",
    "todavía es alto",
    "todavía es caro",
    "todavía es mucho",
    "algo menor"
  ];

  const mensajeLower = txtLower.toLowerCase();
  const necesitaNegociacion = keywordsNegociacion.some(keyword => mensajeLower.includes(keyword));

  // Si está en conversacion_general y tiene registro, verificar si necesita negociación
  if (session.phase === "conversacion_general" && session.registro && necesitaNegociacion) {
    console.log("🔄 [processMessage] Cliente solicita opciones adicionales de pago");

    // Marcar que ya se ofrecieron planes adicionales para no repetirlos
    if (!session.planesAdicionalesOfrecidos) {
      session.planesAdicionalesOfrecidos = true;
      const planesAdicionales = await generateNegotiationPlans(session.registro);
      session.messages.push({ role: "assistant", content: planesAdicionales });
      return planesAdicionales;
    }
  }

  // 6) conversacion_general: IA normal
  const normalReply = await callAIConversation(userMessage, session.messages);
  session.messages.push({ role: "assistant", content: normalReply });
  return normalReply;
}
