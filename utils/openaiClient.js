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
Eres Tori, asistente virtual. Solo debes devolver el texto limpio que verá el usuario:
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

El método de pago es ÚNICAMENTE por depósito vía SPEI a la CLABE ${clabe}.
Tiene 3 horas a partir de este momento para realizar el pago.

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
