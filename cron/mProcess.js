// mProcess.js
import { pool } from "../utils/dbClient.js";
import OpenAI from "openai";
import { getUserByCredito } from "../utils/dbUsers.js";
import dotenv from "dotenv";
dotenv.config();

// Configurar DeepSeek
const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY
});

const ANALYSIS_PROMPT = convoText => `
Analiza cuidadosamente la siguiente conversación:
${convoText}

Aplica estas reglas:
- Si el usuario ACEPTA pagar o menciona cosas como "mañana lo hago", "ya lo haré", "pasado mañana", etc. (sin negaciones), responde "1".
.- En cualquier otro caso responde "0".
Solo devuelve "1" o "0".
`.trim();

// Obtener hora formateada (CDMX)
function horaMX() {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).format(new Date());
}

// 🔁 Ejecución manual única
(async function runManualAnalysis() {
  console.log(`🚀 Iniciando análisis manual → ${horaMX()}`);

  const [rows] = await pool.query(`
    SELECT id, conversation, contract_number
    FROM compartamos_conversations
    WHERE payment_agreement IS NULL
  `);

  for (const convo of rows) {
    try {
      const contrato = convo.contract_number?.trim();
      if (!contrato) {
        await pool.query(
          `UPDATE compartamos_conversations
           SET payment_agreement = 0,
               estimated_recovery = 0
           WHERE id = ?`,
          [convo.id]
        );
        console.log(`⚠️ ${horaMX()} → ID ${convo.id} sin contrato → marcado como 0`);
        continue;
      }

      // Llamar a la IA
      const resp = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: ANALYSIS_PROMPT(convo.conversation) }
        ]
      });

      const answer = resp.choices[0].message.content.trim();
      const agreement = answer === "1" ? 1 : 0;

      // Obtener monto estimado desde base real
      let estimated = 0.00;
      if (agreement === 1) {
        const user = await getUserByCredito(contrato);
        estimated = user ? parseFloat(user.total || 0) : 0.00;
      }

      // Actualizar conversación
      await pool.query(
        `UPDATE compartamos_conversations
         SET payment_agreement = ?,
             estimated_recovery = ?
         WHERE id = ?`,
        [agreement, estimated, convo.id]
      );

      // Marcar otras del mismo contrato como renegociadas
      await pool.query(
        `UPDATE compartamos_conversations
         SET payment_agreement = 2
         WHERE contract_number = ?
           AND id <> ?
           AND payment_agreement <> 2`,
        [contrato, convo.id]
      );

      console.log(`✅ ${horaMX()} → ID ${convo.id} evaluada → acuerdo=${agreement} → estimado=$${estimated.toFixed(2)}`);
    } catch (err) {
      console.error(`❌ ${horaMX()} → Error en ID ${convo.id}: ${err.message}`);
    }
  }

  console.log(`🏁 Proceso manual finalizado → ${horaMX()}`);
})();
