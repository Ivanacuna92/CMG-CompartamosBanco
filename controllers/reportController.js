// controllers/reportController.js
import { pool } from "../utils/dbClient.js";
import { getUserByCredito } from "../utils/dbUsers.js";
import { Parser } from "json2csv";

export async function getSummary(req, res) {
  const { month = "", day = "", contract = "" } = req.query;
  const [rows] = await pool.query(`
    SELECT
      COUNT(*) AS totalConversations,
      SUM(total_interactions) AS totalInteractions,
      SUM(IF(payment_agreement=1,1,0)) AS totalAgreements,
      SUM(IFNULL(estimated_recovery,0)) AS totalRecovery,
      SUM(IF(interactions_over_two=1,1,0)) AS overTwo
    FROM inbursa_conversations
    WHERE (? = '' OR MONTH(last_update) = ?)
      AND (? = '' OR DAY(last_update) = ?)
      AND (? = '' OR contract_number = ?)
  `, [month, month, day, day, contract, contract]);
  res.json(rows[0]);
}

export async function listConversations(req, res) {
  const { month = "", day = "", contract = "", page = 1, size = 10 } = req.query;
  const offset = (page - 1) * size;
  const [data] = await pool.query(`
    SELECT SQL_CALC_FOUND_ROWS
      id, uuid, last_update, payment_agreement, estimated_recovery, total_interactions, contract_number
    FROM inbursa_conversations
    WHERE (? = '' OR MONTH(last_update) = ?)
      AND (? = '' OR DAY(last_update) = ?)
      AND (? = '' OR contract_number = ?)
    ORDER BY id DESC
    LIMIT ? OFFSET ?
  `, [month, month, day, day, contract, contract, Number(size), offset]);

  // Obtener nombres de clientes desde el Excel
  for (let row of data) {
    if (row.contract_number) {
      const cliente = await getUserByCredito(row.contract_number);
      row.client_name = cliente?.nombre || '-';
    } else {
      row.client_name = '-';
    }
  }

  const [[{ total }]] = await pool.query("SELECT FOUND_ROWS() AS total");
  const totalPages = Math.ceil(total / size);
  res.json({ rows: data, totalPages });
}

export async function getConversationMessages(req, res) {
  const { uuid } = req.params;
  const [msgs] = await pool.query(`
    SELECT role, message
      FROM inbursa_messages
     WHERE uuid = ?
     ORDER BY created_at
  `, [uuid]);
  res.json(msgs);
}

export async function exportCsv(req, res) {
  const { month = "", day = "", contract = "" } = req.query;
  const [rows] = await pool.query(`
    SELECT *
      FROM inbursa_conversations
     WHERE (? = '' OR MONTH(last_update) = ?)
       AND (? = '' OR DAY(last_update) = ?)
       AND (? = '' OR contract_number = ?)
  `, [month, month, day, day, contract, contract]);

  // Agregar nombres de clientes desde el Excel
  for (let row of rows) {
    if (row.contract_number) {
      const cliente = await getUserByCredito(row.contract_number);
      row.client_name = cliente?.nombre || '-';
    } else {
      row.client_name = '-';
    }
  }

  const parser = new Parser();
  const csv = parser.parse(rows);
  res.header("Content-Type", "text/csv");
  res.attachment("reporte.csv");
  res.send(csv);
}
