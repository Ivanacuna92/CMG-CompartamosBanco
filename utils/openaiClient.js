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
 * Genera el siguiente plan disponible en la negociación gradual
 * Orden de ofrecimiento: 8 semanal -> 9 semanal -> 10 semanal -> 6 quincenal
 * (De más exhibiciones a menos = De menor pago por exhibición a mayor)
 *
 * @param {Object} registro - Datos del cliente
 * @param {number} nivelNegociacion - Nivel actual de negociación (1-4)
 * @returns {Object} { mensaje: string, hayMasPlanes: boolean, planOfrecido: string }
 */
export function generateNextNegotiationPlan(registro, nivelNegociacion = 1) {
  const {
    nombre,
    plan_10_exhibiciones_semanales,
    plan_9_exhibiciones_semanales,
    plan_8_exhibiciones_semanales,
    plan_6_exhibiciones_quincenales
  } = registro;

  // Definir el orden de los planes (de más exhibiciones a menos)
  const planesDisponibles = [
    {
      nivel: 1,
      nombre: "8 exhibiciones semanales",
      valor: plan_8_exhibiciones_semanales,
      tipo: "semanal",
      key: "plan_8"
    },
    {
      nivel: 2,
      nombre: "9 exhibiciones semanales",
      valor: plan_9_exhibiciones_semanales,
      tipo: "semanal",
      key: "plan_9"
    },
    {
      nivel: 3,
      nombre: "10 exhibiciones semanales",
      valor: plan_10_exhibiciones_semanales,
      tipo: "semanal",
      key: "plan_10"
    },
    {
      nivel: 4,
      nombre: "6 exhibiciones quincenales",
      valor: plan_6_exhibiciones_quincenales,
      tipo: "quincenal",
      key: "plan_6"
    }
  ];

  console.log(`📋 [generateNextNegotiationPlan] Nivel de negociación: ${nivelNegociacion}`);

  // Buscar el siguiente plan válido desde el nivel actual
  for (let i = nivelNegociacion - 1; i < planesDisponibles.length; i++) {
    const plan = planesDisponibles[i];
    const esValido = plan.valor && parseFloat(plan.valor) > 0;

    console.log(`   🔍 Revisando ${plan.nombre}: $${parseFloat(plan.valor || 0).toFixed(2)} ${esValido ? '✅' : '❌'}`);

    if (esValido) {
      const monto = parseFloat(plan.valor).toFixed(2);
      const hayMasPlanes = planesDisponibles.slice(i + 1).some(p => p.valor && parseFloat(p.valor) > 0);

      console.log(`   ✅ Plan seleccionado: ${plan.nombre} - $${monto} MXN`);
      console.log(`   📊 ¿Hay más planes disponibles?: ${hayMasPlanes ? 'Sí' : 'No'}`);

      const mensaje = `Entiendo ${nombre}, ¿qué te parece esta opción? Puedes hacer ${plan.nombre} de $${monto} MXN (empezando hoy). Tienes 3 horas para realizar el primer pago. ¿Te funciona esta opción?`;

      return {
        mensaje,
        hayMasPlanes,
        planOfrecido: plan.key,
        siguienteNivel: plan.nivel + 1
      };
    }
  }

  // Si no hay más planes disponibles
  console.log("⚠️ [generateNextNegotiationPlan] No hay más planes disponibles");
  return {
    mensaje: `${nombre}, lamentablemente ya no tengo más opciones de pago disponibles. Te recomiendo contactar directamente a Stori para explorar alternativas:\n📱 WhatsApp: 5648615858\n📞 Teléfono: 5598161281\n\nEllos podrán revisar tu caso de manera personalizada.`,
    hayMasPlanes: false,
    planOfrecido: null,
    siguienteNivel: null
  };
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
