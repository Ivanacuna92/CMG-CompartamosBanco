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
 * Filtra el historial para enviar únicamente mensajes de texto y
 * fuerza a la IA a no exponer sus reglas internas.
 */
export async function callAIConversation(userMessage, history = []) {
  // 1) Mensaje system para prohibir mostrar reglas o metadatos
  const systemMsg = {
    role: "system",
    content: `
Eres Tori, asistente virtual. Solo debes devolver el texto limpio que verá el usuario:
- Sin comentarios internos ni guías de desarrollo.
- Sin encabezados de “Reglas aplicadas” ni separadores (“---”).
- Responde siempre en una sola burbuja de chat.
`.trim()
  };

  // 2) Filtrar el historial para quedarnos solo con contenido string
  const filteredHistory = history
    .filter((m) => typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }));

  // 3) Construir el array de mensajes
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

    // 4) Limpiar cualquier resto de separadores o títulos internos
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
 * Genera un resumen para el usuario con los campos de registro actuales.
 */
export async function generateUserSummary(registro) {
  const systemPrompt = `
Genera un mensaje claro con esta información del cliente:
- Nombre: ${registro.nombre}
- Correo: ${registro.correo}
- Teléfono: ${registro.telefono}
- Producto: ${registro.producto}
- Días: ${registro.dias}
- Total a pagar: ${registro.total}
- CLABE: ${registro.clabe}
- Plan 4 Exhibiciones: ${registro.plan_4_exhibiciones}
- Plan 2 Exhibiciones: ${registro.plan_2_exhibiciones}

Por favor, invita al cliente a comprometerse con el pago en las próximas 24 horas de forma amable y profesional.

Ejemplo:
Hola Yolanda,

Esperamos que estés muy bien. Solo queríamos recordarte amablemente que tu pago por STORICORE está pendiente. A continuación, te compartimos los detalles de tu cuenta para facilitar el proceso:

- Producto: STORICORE
- Días restantes: 119
- Total a pagar: $1,097.27 MXN
- Plan 2 Exhibiciones: $549.00

Para evitar interrupciones en tu servicio, te invitamos a completar el pago en las próximas 24 horas. Si ya realizaste el depósito, por favor envíanos el comprobante a este correo o al WhatsApp +52 733 101 3612 para actualizar tu estatus.

Siempre respone con el mensaje final solamente
`.trim();

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "system", content: systemPrompt }],
    });
    const choices = response.data?.choices || response.choices;
    return choices[0].message.content.trim();
  } catch (error) {
    console.error("Error al generar resumen de usuario:", error.message);
    return "No se pudo generar el resumen de tus datos.";
  }
}
