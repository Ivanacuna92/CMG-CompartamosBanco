// utils/processMessage.js
import { callAIConversation } from "./openaiClient.js";
import { getUserByValidation, checkContactExists } from "./dbUsers.js";
import { processNegotiationStep, initNegotiation } from "./negotiationEngine.js";
import { getTemplate } from "./negotiationTemplates.js";
import { S } from "./negotiationStates.js";

/**
 * Normaliza texto: elimina acentos, múltiples espacios y convierte a mayúsculas
 * IMPORTANTE: También convierte Ñ -> N para comparaciones
 */
export function normalizeText(str) {
  const step1 = str.normalize("NFD");
  const step2 = step1.replace(/[\u0300-\u036f]/g, "");
  const step3 = step2.replace(/[^a-zA-ZÑñ\s]/g, "");
  const step4 = step3.replace(/[Ññ]/g, "N");
  return step4.replace(/\s+/g, " ").trim().toUpperCase();
}

const telefonoRegex = /^\d{10}$/;
const correoRegex   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Detecta si el usuario indica que NO es el titular de la cuenta
 */
function detectarNoTitular(mensaje) {
  const m = mensaje.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const patrones = [
    /soy\s+(la\s+)?(mama|madre|mami)/i,
    /soy\s+(el\s+)?(papa|padre|papi)/i,
    /soy\s+(el\s+|la\s+)?(esposo|esposa|marido|mujer)/i,
    /soy\s+(el\s+|la\s+)?(hermano|hermana)/i,
    /soy\s+(el\s+|la\s+)?(hijo|hija)/i,
    /soy\s+(el\s+|la\s+)?(tio|tia|primo|prima)/i,
    /soy\s+(el\s+|la\s+)?(abuelo|abuela)/i,
    /soy\s+(un\s+|una\s+)?familiar/i,
    /soy\s+(el\s+|la\s+)?pariente/i,
    /no\s+soy\s+(el\s+|la\s+)?titular/i,
    /hablo\s+en\s+nombre\s+de/i,
    /llamo\s+por\s+(mi\s+)?(mama|papa|esposo|esposa|hijo|hija|hermano|hermana)/i,
    /me\s+hare\s+cargo\s+del\s+(adeudo|pago|credito)/i,
    /yo\s+(me\s+)?hare\s+cargo/i,
    /pagare\s+(el\s+adeudo\s+)?por\s+(el|ella|mi)/i,
    /vengo\s+de\s+parte\s+de/i,
    /represento\s+a/i,
    /(el|la)\s+titular\s+(no\s+puede|no\s+esta|fallecio|murio)/i
  ];

  return patrones.some(p => p.test(m));
}

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
        body: { text: "Para brindarte los beneficios, ¿cómo deseas identificarte? Teléfono o Correo?" },
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

  // 2) esperando_metodo
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

  // 3) esperando_contacto: validar formato y existencia
  if (session.phase === "esperando_contacto") {
    let contactoNormalizado = "";

    if (session.method === "telefono") {
      if (!telefonoRegex.test(userMessage.trim())) {
        const prompt = `El usuario ingresó: "${userMessage}". Recuerda que tu número de teléfono debe tener 10 dígitos.`;
        const iaResp = await callAIConversation(prompt, session.messages);
        session.messages.push({ role: "assistant", content: iaResp });
        return iaResp;
      }
      contactoNormalizado = userMessage.trim();
    } else {
      if (!correoRegex.test(userMessage.trim())) {
        const prompt = `El usuario ingresó: "${userMessage}". Recuerda que necesitamos un correo electrónico válido.`;
        const iaResp = await callAIConversation(prompt, session.messages);
        session.messages.push({ role: "assistant", content: iaResp });
        return iaResp;
      }
      contactoNormalizado = userMessage.trim().toLowerCase();
    }

    const existeEnBD = await checkContactExists(session.method, contactoNormalizado);

    if (!existeEnBD) {
      const tipoContacto = session.method === "telefono" ? "número de teléfono" : "correo electrónico";
      const errorMsg = `El ${tipoContacto} "${contactoNormalizado}" no se encuentra registrado en nuestro sistema. Por favor, verifica e ingresa un ${tipoContacto} válido.`;
      session.messages.push({ role: "assistant", content: errorMsg });
      return errorMsg;
    }

    session.contact = contactoNormalizado;
    session.phase = "esperando_nombre";
    const askName = "Gracias. Ahora, por favor ingresa tu nombre completo tal como aparece en tu cuenta (iniciando por apellidos).";
    session.messages.push({ role: "assistant", content: askName });
    return askName;
  }

  // 4) esperando_nombre
  if (session.phase === "esperando_nombre") {
    if (detectarNoTitular(txtLower)) {
      const msg = "Entendemos tu situación, sin embargo por políticas de protección de datos solo podemos proporcionar información y gestionar la cuenta directamente con el titular. Te sugerimos que el titular se comunique con nosotros para poder ayudarle.";
      session.phase = "bloqueado_no_titular";
      session.messages.push({ role: "assistant", content: msg });
      return msg;
    }

    const registro = await getUserByValidation(session.method, session.contact, nombreNorm);
    if (!registro) {
      const prompt = `El usuario escribió: "${userMessage}". No encontré un registro con esa información. Por favor, ingresa tu nombre completo tal como aparece en tu cuenta (iniciando por apellidos). Ejemplo: PÉREZ LÓPEZ JUAN CARLOS.`;
      const iaResp = await callAIConversation(prompt, session.messages);
      session.messages.push({ role: "assistant", content: iaResp });
      return iaResp;
    }

    // Usuario validado: iniciar escalera de negociación
    session.registro = registro;
    session.phase = "negociacion";
    session.negotiation = initNegotiation(registro);

    console.log("📋 Datos del cliente:\n" +
      `- nombre: ${registro.nombre}\n` +
      `- cuenta/crédito: ${registro.cuenta}\n` +
      `- total: $${parseFloat(registro.total || 0).toFixed(2)} MXN\n` +
      `- clabe: ${registro.clabe}\n` +
      `- día de pago: ${registro.dia_pago}\n` +
      `- regulariza: $${parseFloat(registro.regulariza || 0).toFixed(2)} MXN\n` +
      `- quita máx: $${parseFloat(registro.quita_max || 0).toFixed(2)} MXN\n` +
      `- mensualidad: $${parseFloat(registro.mensualidad || 0).toFixed(2)} MXN\n` +
      `- mora: ${registro.mora}`
    );

    // Saludo inicial + primera oferta de la escalera
    const saludo = `Hola ${registro.nombre}, espero que te encuentres bien. ` +
      `Te contacto respecto a tu crédito personal Inbursa *${registro.cuenta}*.\n\n`;
    const primeraOferta = getTemplate(session.negotiation.state, registro);
    const reply = saludo + primeraOferta;

    session.messages.push({ role: "assistant", content: reply });
    return reply;
  }

  // Bloqueo no titular
  if (session.phase === "bloqueado_no_titular") {
    const msg = "Por políticas de protección de datos, solo podemos atender al titular de la cuenta. Si el titular desea comunicarse con nosotros, con gusto le atenderemos.";
    session.messages.push({ role: "assistant", content: msg });
    return msg;
  }

  // 5) negociacion: Escalera de Negociación CPI-IA
  if (session.phase === "negociacion") {
    // Detectar no titular en cualquier momento
    if (detectarNoTitular(txtLower)) {
      const msg = "Entendemos tu situación, sin embargo por políticas de protección de datos solo podemos proporcionar información y gestionar la cuenta directamente con el titular. Te sugerimos que el titular se comunique con nosotros para poder ayudarle.";
      session.registro = null;
      session.negotiation = null;
      session.phase = "bloqueado_no_titular";
      session.messages.push({ role: "assistant", content: msg });
      return msg;
    }

    const reply = await processNegotiationStep(session, userMessage);
    session.messages.push({ role: "assistant", content: reply });

    // Si llegó a estado terminal, cambiar fase
    if (session.negotiation.state === S.COMPLETED || session.negotiation.state === S.FINAL_REFERRAL) {
      session.phase = "negociacion_terminada";
    }

    return reply;
  }

  // 6) negociacion_terminada: post-negociación
  if (session.phase === "negociacion_terminada") {
    // Si el usuario quiere reconsiderar después del FINAL_REFERRAL
    const quiereReconiderar = /si|quiero|acepto|pagar|reconsidera|dale|va|ok/i.test(txtLower);
    if (quiereReconiderar && session.registro) {
      session.phase = "negociacion";
      session.negotiation = initNegotiation(session.registro);
      const reply = getTemplate(session.negotiation.state, session.registro);
      session.messages.push({ role: "assistant", content: reply });
      return reply;
    }

    const reply = getTemplate(S.COMPLETED, session.registro || { nombre: "" });
    session.messages.push({ role: "assistant", content: reply });
    return reply;
  }

  // Fallback: si por alguna razón no se detectó la fase
  const fallbackReply = await callAIConversation(userMessage, session.messages);
  session.messages.push({ role: "assistant", content: fallbackReply });
  return fallbackReply;
}
