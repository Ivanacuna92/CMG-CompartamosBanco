import express from "express";
import { processChatMessageSQLite, newChatSessionSQLite } from "../controllers/chatPruebasController.js";

const router = express.Router();

router.post("/chat", processChatMessageSQLite);
router.post("/new", newChatSessionSQLite);

export default router;
