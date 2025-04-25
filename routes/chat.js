// routes/chat.js
import express from "express";
import { processChatMessage, newChatSession } from "../controllers/chatController.js";
const router = express.Router();

router.post("/new", newChatSession);
router.post("/chat", processChatMessage);

export default router;
