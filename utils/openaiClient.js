// utils/openaiClient.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

/**
 * Llama a DeepSeek para continuar la conversación.
 */
export async function callAIConversation(userMessage, history = []) {
  const fechaActual = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const systemMsg = {
    role: "system",
    content: `
Eres Gema, asistente virtual. Solo debes devolver el texto limpio que verá el usuario:
- Sin comentarios internos ni guías de desarrollo.
- Sin encabezados de "Reglas aplicadas" ni separadores ("---").
- Responde siempre en una sola burbuja de chat.

INFORMACIÓN IMPORTANTE DEL SISTEMA:
- La fecha de hoy es: ${fechaActual}
- Si el usuario pregunta qué día es hoy, responde con esta fecha exacta.
    `.trim()
  };

  const filteredHistory = history
    .filter((m) => typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }));

  const messages = [
    systemMsg,
    ...filteredHistory,
    { role: "user", content: userMessage },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages,
    });
    const choices = response.data?.choices || response.choices;
    if (!choices) throw new Error("La respuesta de la IA no tiene 'choices'");

    let out = choices[0].message.content.trim();

    if (out.includes("---")) {
      out = out.split("---")[0].trim();
    }
    out = out.split(/Reglas aplicadas/i)[0].trim();

    return out;
  } catch (error) {
    console.error("Error al llamar a la IA:", error);
    return "Lo siento, ocurrió un error en la conversación.";
  }
}

/**
 * Genera un resumen para el usuario con los datos del registro (Excel).
 */
export async function generateUserSummary(registro) {
  const {
    nombre,
    correo,
    telefono,
    cuenta,
    total,
    clabe,
    dia_pago,
    parcialidad_max,
    regulariza,
    quita_max,
  } = registro;

  console.log("📋 Datos obtenidos del Excel:\n" +
    `- nombre: ${nombre}\n` +
    `- correo: ${correo}\n` +
    `- telefono: ${telefono}\n` +
    `- cuenta/crédito: ${cuenta}\n` +
    `- total: $${parseFloat(total || 0).toFixed(2)} MXN\n` +
    `- clabe: ${clabe}\n` +
    `- día de pago: ${dia_pago}\n` +
    `- parcialidades máx: ${parcialidad_max}\n` +
    `- regulariza: $${parseFloat(regulariza || 0).toFixed(2)} MXN\n` +
    `- quita máx: $${parseFloat(quita_max || 0).toFixed(2)} MXN`
  );

  const montoConQuita = parseFloat(total) - parseFloat(quita_max || 0);

  const prompt = `
Genera un mensaje claro, cálido y profesional para el cliente con estos datos:

- Nombre: ${nombre}
- Crédito: ${cuenta}
- Total adeudo: $${parseFloat(total || 0).toFixed(2)} MXN
- Monto con descuento máximo aplicado: $${montoConQuita.toFixed(2)} MXN
- Parcialidades máximas: ${parcialidad_max}
- Monto para regularizar: $${parseFloat(regulariza || 0).toFixed(2)} MXN
- CLABE para pago SPEI: ${clabe}
- Día de pago: ${dia_pago}

Invítalo cordialmente a liquidar su adeudo. Si puede pagar el total, excelente. Si no, ofrécele:
1. Pago con descuento: $${montoConQuita.toFixed(2)} MXN (quita máxima aplicada)
2. Parcialidades: hasta ${parcialidad_max} pagos
3. Regularización: $${parseFloat(regulariza || 0).toFixed(2)} MXN

Los 3 métodos de pago autorizados son (SIEMPRE muestra el número completo en cada método, NUNCA lo omitas ni uses "el mismo número"):
1. Transferencia SPEI a la CLABE: ${clabe}
2. Sucursales Banco Inbursa (08:30 a 17:30 hrs) con el número de crédito: ${cuenta}
3. Módulos Inbursa en Walmart, Sam's Club, Bodega Aurrera y Sanborns (11:30 a 19:00 hrs) con el número de crédito: ${cuenta}
IMPORTANTE: En cada método de pago SIEMPRE escribe el número completo. Tiene 3 horas a partir de este momento para realizar el pago.

Solo responde con el mensaje final, sin encabezados ni comentarios adicionales.
  `.trim();

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "system", content: prompt }],
    });

    const choices = response.data?.choices || response.choices;
    if (!choices) throw new Error("La respuesta de la IA no tiene 'choices'");
    return choices[0].message.content.trim();
  } catch (error) {
    console.error("Error al generar resumen de usuario:", error.message);
    return "No se pudo generar el resumen de tus datos.";
  }
}

/**
 * Clasifica la intención del usuario en el contexto de la negociación.
 * Retorna un objeto JSON con: intent, confidence, extracted_date, summary
 */
export async function classifyUserIntent(userMessage, currentState, registro) {
  const fechaActual = new Date().toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const systemPrompt = `Eres un clasificador de intenciones para un chatbot de cobranza bancaria.
Tu ÚNICA tarea es clasificar el mensaje del usuario en UNA de estas categorías.
Responde SOLO con un objeto JSON válido, sin texto adicional, sin markdown, sin backticks.

Contexto:
- El usuario está en el paso "${currentState}" de una negociación de deuda.
- Su adeudo total es $${registro.total}.
- La fecha de hoy es: ${fechaActual}

Categorías disponibles:
- "accept": El usuario acepta la oferta, dice sí, está de acuerdo, quiere pagar, acepta el plan, dice "ok", "dale", "va", "lo hago", "sí puedo", "perfecto", "de acuerdo"
- "reject": El usuario rechaza, dice no, no puede, no quiere, no le conviene, dice "no puedo", "no tengo", "no me es posible", "no gracias"
- "objection": El usuario pone una excusa o explica por qué no puede pagar (no tengo dinero, estoy desempleado, es mucho, me quede sin trabajo, etc.)
- "question": El usuario pregunta algo sobre su deuda, el proceso, las opciones, horarios, ubicaciones, etc.
- "already_paid": El usuario dice que ya pagó, ya hizo el depósito, ya transfirió, ya fue al banco
- "schedule_date": El usuario proporciona o confirma una fecha de pago (ej: "el viernes", "mañana", "el lunes", "el 28")
- "installment_weekly": El usuario elige plan semanal o dice "semanal", "cada semana", "opción 1", "la primera"
- "installment_biweekly": El usuario elige plan quincenal o dice "quincenal", "cada quincena", "opción 2", "la segunda"
- "off_topic": El usuario habla de algo completamente no relacionado con la deuda o cobranza
- "greeting": El usuario solo saluda o se despide sin dar información relevante

Si el usuario menciona una fecha, extráela en formato YYYY-MM-DD. Si dice "mañana", calcula la fecha a partir de hoy (${fechaActual}). Si dice "el viernes", calcula el próximo viernes. Si dice "el 28", usa el día 28 del mes en curso.

Formato de respuesta obligatorio (JSON puro, sin backticks):
{"intent": "<categoría>", "confidence": <0.0-1.0>, "extracted_date": "<YYYY-MM-DD o null>", "summary": "<resumen breve en español>"}`;

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
    });

    const choices = response.data?.choices || response.choices;
    if (!choices) throw new Error("Sin choices en respuesta");

    let raw = choices[0].message.content.trim();
    // Limpiar posibles backticks markdown
    raw = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");

    const parsed = JSON.parse(raw);
    console.log(`🧠 [classifyUserIntent] "${userMessage}" → ${parsed.intent} (${parsed.confidence})`);
    return {
      intent: parsed.intent || "question",
      confidence: parsed.confidence || 0.5,
      extracted_date: parsed.extracted_date || null,
      summary: parsed.summary || "",
    };
  } catch (error) {
    console.error("❌ [classifyUserIntent] Error:", error.message);
    return {
      intent: "objection",
      confidence: 0.3,
      extracted_date: null,
      summary: "No se pudo clasificar",
    };
  }
}

/**
 * Genera una respuesta breve a una pregunta del usuario dentro del contexto de negociación.
 * NO negocia ni hace ofertas, solo responde la pregunta.
 */
export async function generateContextualAnswer(userMessage, currentState, registro) {
  const prompt = `Eres Gema, asistente de cobranza de Inbursa Card.
El cliente ${registro.nombre} tiene crédito ${registro.cuenta} con adeudo de $${registro.total} MXN.
CLABE para SPEI: ${registro.clabe}

El cliente pregunta: "${userMessage}"

REGLAS:
- Responde BREVEMENTE (máximo 2-3 líneas)
- Solo usa información que tengas disponible
- NO inventes datos
- NO hagas ofertas ni negocies
- NO menciones descuentos ni parcialidades
- Si no sabes la respuesta, sugiere contactar al 5595470785 o WhatsApp 5635519617
- Los métodos de pago son: SPEI a CLABE ${registro.clabe}, Sucursales Banco Inbursa (08:30-17:30) y Módulos Inbursa en Walmart/Sam's/Bodega Aurrera/Sanborns (11:30-19:00) con crédito ${registro.cuenta}
- Solo responde con el texto para el usuario, sin comentarios internos`;

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.3,
    });

    const choices = response.data?.choices || response.choices;
    if (!choices) throw new Error("Sin choices");
    return choices[0].message.content.trim();
  } catch (error) {
    console.error("❌ [generateContextualAnswer] Error:", error.message);
    return "Para mayor información, te sugiero contactar a un ejecutivo al 5595470785 o vía WhatsApp al 5635519617.";
  }
}
