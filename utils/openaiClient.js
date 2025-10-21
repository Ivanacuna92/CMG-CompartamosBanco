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
- Sin encabezados de "Reglas aplicadas" ni separadores ("---").
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
 * Genera un mensaje con las opciones adicionales de planes cuando el cliente
 * no puede pagar con los planes iniciales (7 o 5 exhibiciones)
 */
export async function generateNegotiationPlans(registro) {
  const {
    nombre,
    plan_10_exhibiciones_semanales,
    plan_9_exhibiciones_semanales,
    plan_8_exhibiciones_semanales,
    plan_6_exhibiciones_quincenales
  } = registro;

  // Validar si los planes adicionales tienen datos válidos
  const plan10Valido = plan_10_exhibiciones_semanales && parseFloat(plan_10_exhibiciones_semanales) > 0;
  const plan9Valido = plan_9_exhibiciones_semanales && parseFloat(plan_9_exhibiciones_semanales) > 0;
  const plan8Valido = plan_8_exhibiciones_semanales && parseFloat(plan_8_exhibiciones_semanales) > 0;
  const plan6Valido = plan_6_exhibiciones_quincenales && parseFloat(plan_6_exhibiciones_quincenales) > 0;

  console.log("📋 [generateNegotiationPlans] Planes adicionales disponibles:");
  console.log(`   - plan_10_exhibiciones_semanales: $${parseFloat(plan_10_exhibiciones_semanales || 0).toFixed(2)} ${plan10Valido ? '✅' : '❌'}`);
  console.log(`   - plan_9_exhibiciones_semanales: $${parseFloat(plan_9_exhibiciones_semanales || 0).toFixed(2)} ${plan9Valido ? '✅' : '❌'}`);
  console.log(`   - plan_8_exhibiciones_semanales: $${parseFloat(plan_8_exhibiciones_semanales || 0).toFixed(2)} ${plan8Valido ? '✅' : '❌'}`);
  console.log(`   - plan_6_exhibiciones_quincenales: $${parseFloat(plan_6_exhibiciones_quincenales || 0).toFixed(2)} ${plan6Valido ? '✅' : '❌'}`);

  // Si no hay planes adicionales válidos, retornar mensaje de error
  if (!plan10Valido && !plan9Valido && !plan8Valido && !plan6Valido) {
    console.log("⚠️ [generateNegotiationPlans] No hay planes adicionales disponibles");
    return `${nombre}, lamentablemente no tengo opciones adicionales disponibles en este momento. Te recomiendo contactar directamente a Stori:
📱 WhatsApp: 5648615858
📞 Teléfono: 5598161281

Ellos podrán revisar tu caso y ofrecerte alternativas personalizadas.`;
  }

  // Construir el mensaje con los planes disponibles
  let planesSemanales = [];
  if (plan10Valido) planesSemanales.push(`• 10 pagos semanales de $${parseFloat(plan_10_exhibiciones_semanales).toFixed(2)} MXN`);
  if (plan9Valido) planesSemanales.push(`• 9 pagos semanales de $${parseFloat(plan_9_exhibiciones_semanales).toFixed(2)} MXN`);
  if (plan8Valido) planesSemanales.push(`• 8 pagos semanales de $${parseFloat(plan_8_exhibiciones_semanales).toFixed(2)} MXN`);

  let planesQuincenales = [];
  if (plan6Valido) planesQuincenales.push(`• 6 pagos quincenales de $${parseFloat(plan_6_exhibiciones_quincenales).toFixed(2)} MXN`);

  let mensaje = `Entiendo ${nombre}, quiero ayudarte a encontrar una solución. Déjame ofrecerte otras opciones:\n\n`;

  if (planesSemanales.length > 0) {
    mensaje += `Planes Semanales:\n${planesSemanales.join('\n')}\n\n`;
  }

  if (planesQuincenales.length > 0) {
    mensaje += `Planes Quincenales:\n${planesQuincenales.join('\n')}\n\n`;
  }

  mensaje += `Todos empiezan hoy y tienes 3 horas para el primer pago. ¿Alguno de estos te funciona mejor?`;

  return mensaje;
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
    plan_7_exhibiciones_semanales,
    plan_5_exhibiciones_quincenales,
    plan_10_exhibiciones_semanales,
    plan_9_exhibiciones_semanales,
    plan_8_exhibiciones_semanales,
    plan_6_exhibiciones_quincenales
  } = registro;

  // Validar si los planes de exhibiciones tienen datos válidos
  const plan7Valido = plan_7_exhibiciones_semanales && parseFloat(plan_7_exhibiciones_semanales) > 0;
  const plan5Valido = plan_5_exhibiciones_quincenales && parseFloat(plan_5_exhibiciones_quincenales) > 0;
  const plan10Valido = plan_10_exhibiciones_semanales && parseFloat(plan_10_exhibiciones_semanales) > 0;
  const plan9Valido = plan_9_exhibiciones_semanales && parseFloat(plan_9_exhibiciones_semanales) > 0;
  const plan8Valido = plan_8_exhibiciones_semanales && parseFloat(plan_8_exhibiciones_semanales) > 0;
  const plan6Valido = plan_6_exhibiciones_quincenales && parseFloat(plan_6_exhibiciones_quincenales) > 0;

  console.log("Datos Obtenidos de la BD" + `
- nombre: ${nombre}
- correo: ${correo}
- telefono: ${telefono}
- producto: ${producto}
- dias: ${dias}
- total: $${parseFloat(total || 0).toFixed(2)} MXN
- clabe: ${clabe}
- plan_7_exhibiciones_semanales: $${parseFloat(plan_7_exhibiciones_semanales || 0).toFixed(2)} ${plan7Valido ? '✅' : '❌'}
- plan_5_exhibiciones_quincenales: $${parseFloat(plan_5_exhibiciones_quincenales || 0).toFixed(2)} ${plan5Valido ? '✅' : '❌'}
- plan_10_exhibiciones_semanales: $${parseFloat(plan_10_exhibiciones_semanales || 0).toFixed(2)} ${plan10Valido ? '✅' : '❌'}
- plan_9_exhibiciones_semanales: $${parseFloat(plan_9_exhibiciones_semanales || 0).toFixed(2)} ${plan9Valido ? '✅' : '❌'}
- plan_8_exhibiciones_semanales: $${parseFloat(plan_8_exhibiciones_semanales || 0).toFixed(2)} ${plan8Valido ? '✅' : '❌'}
- plan_6_exhibiciones_quincenales: $${parseFloat(plan_6_exhibiciones_quincenales || 0).toFixed(2)} ${plan6Valido ? '✅' : '❌'}
`);

  // Si todos los planes son inválidos, retornar mensaje de error
  if (!plan7Valido && !plan5Valido && !plan10Valido && !plan9Valido && !plan8Valido && !plan6Valido) {
    console.log("⚠️ [generateUserSummary] Planes de exhibiciones inválidos o en 0/null");
    return `Hola ${nombre}, hemos encontrado tu información pero algo salió mal al obtener los datos de los planes de exhibiciones desde la base de datos.

Por favor, contacta directamente a Stori para obtener ayuda:
📱 WhatsApp: 5648615858
📞 Teléfono: 5598161281

Ellos podrán ayudarte con tu cuenta y proporcionarte los detalles de los planes de pago disponibles.`;
  }

  const prompt = `
Genera un mensaje claro, cálido y profesional para el cliente con estos datos:

- Nombre: ${nombre}
- Correo: ${correo}
- Teléfono: ${telefono}
- Producto: ${producto}
- Días vencidos: ${dias}
- Total a pagar: $${parseFloat(total || 0).toFixed(2)} MXN
- CLABE: ${clabe}
- Plan 7 Exhibiciones Semanales: $${parseFloat(plan_7_exhibiciones_semanales || 0).toFixed(2)}
- Plan 5 Exhibiciones Quincenales: $${parseFloat(plan_5_exhibiciones_quincenales || 0).toFixed(2)}

Invítalo cordialmente a realizar el pago dentro de las próximas 3 horas para evitar problemas con su cuenta. Si ya pagó, puede enviar su comprobante a soporte.
Informa al cliente que para seguir el plan de 7 exhibiciones tienen que ser en plazos semanales y para el plan de 5 exhibiciones tiene que ser en plazos quincenales.

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
