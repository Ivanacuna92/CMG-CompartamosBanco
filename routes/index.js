// routes/index.js
import express from "express";
import path    from "path";

import chatRoutes   from "./chat.js";
import reportRoutes from "./reports.js";

const router = express.Router();
const publicDir = path.join(process.cwd(), "public");

// Rutas de página estática
router.get("/",        (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});
router.get("/reporte", (req, res) => {
  res.sendFile(path.join(publicDir, "reporte.html"));
});

// Rutas de chat bajo /
router.use("/", chatRoutes);

// Rutas de reporte JSON bajo /api
router.use("/api", reportRoutes);

export default router;
