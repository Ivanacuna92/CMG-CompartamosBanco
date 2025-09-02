// cron/autoProcess.js
import cron from "node-cron";
import { pool } from "../utils/dbClient.js";
import OpenAI from "openai";
import { getUserByCredito } from "../utils/dbUsers.js"; // ← función nueva o ya existente

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY
});

const ANALYSIS_PROMPT = (convoText) => `
Analiza cuidadosamente la siguiente conversación:
${convoText}

Aplica estas reglas:
- Si el usuario ACEPTA pagar o menciona cosas relacionadas a esto como "mañana lo hago", "ya lo haré", "pasado mañana", etc. (sin negaciones), responde "1".
- Si el usuario ACEPTA pagar o pregunta cuales son las formas disponibles para pagar le tienes que hacer saber que solo hay una forma de hacerlo y es por via SPEI.
- En cualquier otro caso responde "0".
Solo devuelve "1" o "0".
`.trim();

export function startAutoProcessing() {
  cron.schedule("0 3 * * *", async () => {
    console.log("🔄 Procesando conversaciones a las 03:00am…");

    // 1) Traer conversaciones no procesadas
    const [rows] = await pool.query(`
      SELECT id, conversation, contract_number
      FROM esac_conversations
      WHERE payment_agreement IS NULL
    `);

    for (const convo of rows) {
      try {
        // 2) Obtener acuerdo desde IA
        const resp = await openai.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: ANALYSIS_PROMPT(convo.conversation) }
          ]
        });

        const answer = resp.choices[0].message.content.trim();
        const agreement = answer === "1" ? 1 : 0;

        // 3) Recuperar monto si hay acuerdo
        let estimated = 0.00;
        if (agreement === 1 && convo.contract_number) {
          const user = await getUserByCredito(convo.contract_number);
          estimated = user ? parseFloat(user.total || 0) : 0.00;
        }

        // 4) Actualizar la conversación
        await pool.query(
          `UPDATE esac_conversations
           SET payment_agreement = ?,
               estimated_recovery = ?
           WHERE id = ?`,
          [agreement, estimated, convo.id]
        );

        // 5) Marcar anteriores como renegociadas
        if (convo.contract_number) {
          await pool.query(
            `UPDATE esac_conversations
             SET payment_agreement = 2
             WHERE contract_number = ?
               AND id <> ?
               AND payment_agreement <> 2`,
            [convo.contract_number, convo.id]
          );
        }

        console.log(`✅ Convo ${convo.id} → acuerdo=${agreement}, estimado=${estimated.toFixed(2)}`);
      } catch (err) {
        console.error(`❌ Error en convo ${convo.id}:`, err.message);
      }
    }
  }, {
    timezone: "America/Mexico_City"
  });
}
