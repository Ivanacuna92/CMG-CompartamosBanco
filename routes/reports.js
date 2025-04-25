// routes/reports.js
import express from "express";
import {
  getSummary,
  listConversations,
  getConversationMessages,
  exportCsv
} from "../controllers/reportController.js";

const router = express.Router();

// GET /api/reports?month=&day=
router.get("/reports", getSummary);

// GET /api/conversations?month=&day=&page=&size=
router.get("/conversations", listConversations);

// GET /api/conversations/:uuid/messages
router.get("/conversations/:uuid/messages", getConversationMessages);

// GET /api/export?month=&day=
router.get("/export", exportCsv);

export default router;
