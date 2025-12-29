// utils/processMessage.js
import { callAIConversation, generateUserSummary, generateNextNegotiationPlan, generateQuincenalPlan } from "./openaiClient.js";
import { getUserByValidation, checkContactExists } from "./dbUsers.js"; // <-- se usa BD real

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

  /**
   * Función para detectar si el usuario indica que NO es el titular de la cuenta
   * Detecta frases como "soy la mamá", "soy el papá", "soy familiar", etc.
   */
  function detectarNoTitular(mensaje) {
    const mensajeNormalizado = mensaje.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const patronesNoTitular = [
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

    return patronesNoTitular.some(patron => patron.test(mensajeNormalizado));
  }

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

  // 3) esperando_contacto: validar formato Y existencia en BD
  if (session.phase === "esperando_contacto") {
    let contactoValido = false;
    let contactoNormalizado = "";

    if (session.method === "telefono") {
      if (!telefonoRegex.test(userMessage.trim())) {
        const prompt = `El usuario ingresó: "${userMessage}". Recuerda que tu número de teléfono debe tener 10 dígitos.`;
        const iaResp = await callAIConversation(prompt, session.messages);
        session.messages.push({ role: "assistant", content: iaResp });
        return iaResp;
      }
      contactoNormalizado = userMessage.trim();
      contactoValido = true;
    } else {
      if (!correoRegex.test(userMessage.trim())) {
        const prompt = `El usuario ingresó: "${userMessage}". Recuerda que necesitamos un correo electrónico válido.`;
        const iaResp = await callAIConversation(prompt, session.messages);
        session.messages.push({ role: "assistant", content: iaResp });
        return iaResp;
      }
      contactoNormalizado = userMessage.trim().toLowerCase();
      contactoValido = true;
    }

    // Verificar si el contacto existe en la base de datos ANTES de pedir el nombre
    if (contactoValido) {
      const existeEnBD = await checkContactExists(session.method, contactoNormalizado);

      if (!existeEnBD) {
        const tipoContacto = session.method === "telefono" ? "número de teléfono" : "correo electrónico";
        const errorMsg = `El ${tipoContacto} "${contactoNormalizado}" no se encuentra registrado en nuestro sistema. Por favor, verifica e ingresa un ${tipoContacto} válido.`;
        session.messages.push({ role: "assistant", content: errorMsg });
        return errorMsg;
      }

      // Si existe, guardamos el contacto y pasamos a pedir el nombre
      session.contact = contactoNormalizado;
      session.phase = "esperando_nombre";
      const askName = "Gracias. Ahora, por favor ingresa tu nombre completo.";
      session.messages.push({ role: "assistant", content: askName });
      return askName;
    }
  }

  // 4) esperando_nombre: validar en base de datos real
  if (session.phase === "esperando_nombre") {
    // Verificar si indica que no es el titular ANTES de validar
    if (detectarNoTitular(txtLower)) {
      console.log("🚫 [processMessage] Detectado en fase nombre: usuario indica que NO es el titular");

      const mensajeNoTitular = "Entendemos tu situación, sin embargo por políticas de protección de datos solo podemos proporcionar información y gestionar la cuenta directamente con el titular. Te sugerimos que el titular se comunique con nosotros para poder ayudarle.";

      session.phase = "bloqueado_no_titular";
      session.messages.push({ role: "assistant", content: mensajeNoTitular });
      return mensajeNoTitular;
    }

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

  // 5) conversacion_general: detectar si el cliente solicita más opciones de pago (NEGOCIACIÓN GRADUAL)

  /**
   * Función mejorada para detectar si el cliente prefiere pago quincenal
   * Usa detección más robusta con patrones y normalización
   */
  function detectarPreferenciaQuincenal(mensaje) {
    const mensajeNormalizado = mensaje.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
      .replace(/\s+/g, " ") // Normalizar espacios
      .trim();

    // Patrones más flexibles para detectar preferencia quincenal
    const patronesQuincenal = [
      /no\s+puedo\s+(pagar\s+)?(semanal(mente|es)?|por\s+semana)/i,
      /no\s+puedo\s+(con\s+)?(el\s+)?(pago\s+)?semanal/i,
      /prefiero\s+(pago\s+)?quincenal/i,
      /quiero\s+(pago\s+)?quincenal/i,
      /mejor\s+(pago\s+)?quincenal/i,
      /cada\s+(15|quince)\s+(dias|días)/i,
      /de\s+15\s+en\s+15/i,
      /quincenalmente/i,
      /(pago|pagos)\s+quincenal(es)?/i,
      /cada\s+quincena/i,
      /por\s+quincena/i
    ];

    // Verificar si algún patrón coincide
    return patronesQuincenal.some(patron => patron.test(mensajeNormalizado));
  }

  /**
   * Función mejorada para detectar si el cliente necesita negociación (planes semanales)
   * Solo activa si NO es una solicitud de pago quincenal
   */
  function detectarNecesidadNegociacion(mensaje, esQuincenal) {
    // Si ya detectamos que prefiere quincenal, no activar negociación semanal
    if (esQuincenal) {
      return false;
    }

    const mensajeNormalizado = mensaje.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const patronesNegociacion = [
      /no\s+puedo/i,
      /(muy|demasiado)\s+(alto|caro)/i,
      /mucho\s+dinero/i,
      /(otras|mas|más)\s+opciones/i,
      /algo\s+(mas|más)\s+(bajo|barato)/i,
      /(mas|más)\s+(plazo|tiempo)/i,
      /(menos|menor)\s+pago/i,
      /no\s+me\s+alcanza/i,
      /no\s+tengo(\s+(tanto|suficiente))?/i,
      /(todavia|todavía|aun|aún)\s+es\s+(alto|caro|mucho)/i,
      /algo\s+menor/i,
      /es\s+mucho\s+para\s+(mi|mí)/i
    ];

    return patronesNegociacion.some(patron => patron.test(mensajeNormalizado));
  }

  const mensajeLower = txtLower.toLowerCase();
  const esNoTitular = detectarNoTitular(mensajeLower);
  const prefiereQuincenal = detectarPreferenciaQuincenal(mensajeLower);
  const necesitaNegociacion = detectarNecesidadNegociacion(mensajeLower, prefiereQuincenal);

  // VALIDACIÓN DE NO TITULAR - Bloquear si detectamos que no es el titular
  if (session.phase === "conversacion_general" && esNoTitular) {
    console.log("🚫 [processMessage] Detectado: usuario indica que NO es el titular");

    const mensajeNoTitular = "Entendemos tu situación, sin embargo por políticas de protección de datos solo podemos proporcionar información y gestionar la cuenta directamente con el titular. Te sugerimos que el titular se comunique con nosotros para poder ayudarle.";

    // Limpiar datos sensibles de la sesión
    session.registro = null;
    session.phase = "bloqueado_no_titular";

    session.messages.push({ role: "assistant", content: mensajeNoTitular });
    return mensajeNoTitular;
  }

  // Si ya está bloqueado por no ser titular, mantener el bloqueo
  if (session.phase === "bloqueado_no_titular") {
    const mensajeBloqueo = "Por políticas de protección de datos, solo podemos atender al titular de la cuenta. Si el titular desea comunicarse con nosotros, con gusto le atenderemos.";
    session.messages.push({ role: "assistant", content: mensajeBloqueo });
    return mensajeBloqueo;
  }

  // Si el cliente prefiere pago quincenal (FLUJO ESPECIAL QUINCENAL)
  if (session.phase === "conversacion_general" && session.registro && prefiereQuincenal) {
    console.log("💳 [processMessage] Cliente prefiere pago quincenal");

    // Inicializar el nivel de negociación quincenal si no existe
    if (!session.nivelQuincenal) {
      session.nivelQuincenal = 1;
    }

    // Generar el siguiente plan quincenal disponible
    const resultado = generateQuincenalPlan(session.registro, session.nivelQuincenal);

    // Actualizar el nivel para la próxima negociación quincenal
    if (resultado.hayMasPlanes) {
      session.nivelQuincenal = resultado.siguienteNivel;
      console.log(`📊 [processMessage] Nivel quincenal actualizado a: ${session.nivelQuincenal}`);
    } else {
      console.log(`⚠️ [processMessage] No hay más planes quincenales disponibles`);
    }

    session.messages.push({ role: "assistant", content: resultado.mensaje });
    return resultado.mensaje;
  }

  // Si está en conversacion_general y tiene registro, verificar si necesita negociación (PLANES SEMANALES)
  if (session.phase === "conversacion_general" && session.registro && necesitaNegociacion) {
    console.log("🔄 [processMessage] Cliente solicita opciones adicionales de pago");

    // Inicializar el nivel de negociación si no existe
    if (!session.nivelNegociacion) {
      session.nivelNegociacion = 1;
    }

    // Generar el siguiente plan disponible
    const resultado = generateNextNegotiationPlan(session.registro, session.nivelNegociacion);

    // Actualizar el nivel para la próxima negociación
    if (resultado.hayMasPlanes) {
      session.nivelNegociacion = resultado.siguienteNivel;
      console.log(`📊 [processMessage] Nivel de negociación actualizado a: ${session.nivelNegociacion}`);
    } else {
      console.log(`⚠️ [processMessage] No hay más planes disponibles`);
    }

    session.messages.push({ role: "assistant", content: resultado.mensaje });
    return resultado.mensaje;
  }

  // 6) conversacion_general: IA normal
  const normalReply = await callAIConversation(userMessage, session.messages);
  session.messages.push({ role: "assistant", content: normalReply });
  return normalReply;
}
