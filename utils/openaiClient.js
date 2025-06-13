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
  const systemMsg = {
    role: "system",
    content: `
Eres Tori, asistente virtual. Solo debes devolver el texto limpio que verá el usuario:
- Sin comentarios internos ni guías de desarrollo.
- Sin encabezados de “Reglas aplicadas” ni separadores (“---”).
- Responde siempre en una sola burbuja de chat.
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
 * Genera un resumen para el usuario con los campos de registro actuales.
 */
export async function generateUserSummary(registro) {
  const {
    nombre,
    correo,
    telefono,
    producto,
    dias,
    total,
    clabe,
    plan_2_exhibiciones,
    plan_4_exhibiciones
  } = registro;

  const prompt = `
Genera un mensaje claro, cálido y profesional para el cliente con estos datos:

- Nombre: ${nombre}
- Correo: ${correo}
- Teléfono: ${telefono}
- Producto: ${producto}
- Días vencidos: ${dias}
- Total a pagar: $${parseFloat(total || 0).toFixed(2)} MXN
- CLABE: ${clabe}
- Plan 4 Exhibiciones: $${parseFloat(plan_2_exhibiciones || 0).toFixed(2)}
- Plan 6 Exhibiciones: $${parseFloat(plan_4_exhibiciones || 0).toFixed(2)}

Invítalo cordialmente a realizar el pago dentro de las próximas 24 horas para evitar problemas con su cuenta. Si ya pagó, puede enviar su comprobante a soporte.

Solo responde con el mensaje final, sin encabezados ni comentarios adicionales.
`.trim();

console.log("Datos Opteniedos de la Bd" + `
- nombre: ${nombre}
- correo: ${correo}
- telefono: ${telefono}
- producto: ${producto}
- dias: ${dias}
- total: $${parseFloat(total || 0).toFixed(2)} MXN
- clabe: ${clabe}
- plan_2_exhibiciones: $${parseFloat(plan_2_exhibiciones || 0).toFixed(2)}
- plan_4_exhibiciones: $${parseFloat(plan_4_exhibiciones || 0).toFixed(2)}
`)
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
