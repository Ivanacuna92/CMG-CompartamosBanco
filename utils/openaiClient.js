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
 * Si es el primer mensaje o está vacío, devuelve un saludo inicial fijo.
 * Filtra el historial para enviar únicamente mensajes con contenido de tipo string.
 */
export async function callAIConversation(userMessage, history = []) {
  // Saludo inicial si no hay entrada del usuario
  if (!userMessage || userMessage.trim() === "") {
    return (
      "Hola, soy Tori, tu asistente virtual.\n" +
      "Por favor, ingresa tu nombre completo (Ejemplo: JUAN PÉREZ MONTARE)"
    );
  }

  // Preparamos sólo los mensajes de texto previos
  const filteredHistory = history
    .filter((m) => typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }));

  const messages = [
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
    return choices[0].message.content.trim();
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

Nombre: ${registro.nombre}
Correo: ${registro.correo}
Teléfono: ${registro.telefono}
Producto: ${registro.producto}
Días: ${registro.dias}
Total a pagar: ${registro.total}
CLABE: ${registro.clabe}
Plan 4 Exhibiciones: ${registro.plan_4_exhibiciones}
Plan 2 Exhibiciones: ${registro.plan_2_exhibiciones}

Invita al cliente a comprometerse con el pago en las próximas 24 horas.
`.trim();

  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt }
      ],
    });
    const choices = response.data?.choices || response.choices;
    return choices[0].message.content.trim();
  } catch (error) {
    console.error("Error al generar resumen de usuario:", error.message);
    return "No se pudo generar el resumen de tus datos.";
  }
}

/**
 * Solicita un dato adicional (por ejemplo, teléfono o correo) según el registro.
 */
export async function solicitarDatoAdicional(registro, userInput) {
  // Determinamos tipo según fase previa (teléfono o correo)
  const tipoDato = /^\d{10}$/.test(userInput)
    ? "un número de teléfono válido"
    : "un correo electrónico válido";
  const prompt = `El usuario escribió: "${userInput}". Necesita proporcionar ${tipoDato} para continuar. Por favor, indícale que lo ingrese nuevamente.`;
  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: prompt }
      ],
    });
    const choices = response.data?.choices || response.choices;
    return choices[0].message.content.trim();
  } catch (error) {
    console.error("Error en solicitarDatoAdicional:", error.message);
    return `Por favor, proporciona ${tipoDato} para continuar.`;
  }
}
