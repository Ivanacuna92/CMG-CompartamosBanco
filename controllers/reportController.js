// controllers/reportController.js
import { pool } from "../utils/dbClient.js";
import { Parser } from "json2csv";

export async function getSummary(req, res) {
  const { month = "", day = "" } = req.query;
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS totalConversations,
      SUM(total_interactions) AS totalInteractions,
      SUM(IF(payment_agreement=1,1,0)) AS totalAgreements,
      SUM(IFNULL(estimated_recovery,0)) AS totalRecovery,
      SUM(IF(interactions_over_two=1,1,0)) AS overTwo
    FROM esac_conversations
    WHERE (? = '' OR MONTH(last_update) = ?)
      AND (? = '' OR DAY(last_update) = ?)
  `, [month, month, day, day]);
  res.json(rows[0]);
}

export async function listConversations(req, res) {
  const { month = "", day = "", page = 1, size = 10 } = req.query;
  const offset = (page - 1) * size;
  const [data] = await pool.query(`
    SELECT SQL_CALC_FOUND_ROWS
      id, uuid, last_update, payment_agreement, estimated_recovery, total_interactions, contract_number
    FROM esac_conversations
    WHERE (? = '' OR MONTH(last_update) = ?)
      AND (? = '' OR DAY(last_update) = ?)
    ORDER BY last_update DESC
    LIMIT ? OFFSET ?
  `, [month, month, day, day, Number(size), offset]);
  const [[{ total }]] = await pool.query("SELECT FOUND_ROWS() AS total");
  const totalPages = Math.ceil(total / size);
  res.json({ rows: data, totalPages });
}

export async function getConversationMessages(req, res) {
  const { uuid } = req.params;
  const [msgs] = await pool.query(`
    SELECT role, message
      FROM esac_messages
     WHERE uuid = ?
     ORDER BY created_at
  `, [uuid]);
  res.json(msgs);
}

export async function exportCsv(req, res) {
  const { month = "", day = "" } = req.query;
  const [rows] = await pool.query(`
    SELECT *
      FROM esac_conversations
     WHERE (? = '' OR MONTH(last_update) = ?)
       AND (? = '' OR DAY(last_update) = ?)
  `, [month, month, day, day]);
  const parser = new Parser();
  const csv = parser.parse(rows);
  res.header("Content-Type", "text/csv");
  res.attachment("reporte.csv");
  res.send(csv);
}
