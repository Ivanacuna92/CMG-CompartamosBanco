// server.js - v2.1
import express    from "express";
import dotenv     from "dotenv";
import bodyParser from "body-parser";
import path       from "path";

import indexRoutes  from "./routes/index.js";
import chatRoutes   from "./routes/chat.js";
import reportRoutes from "./routes/reports.js";

// **Importamos y arrancamos el cron**
import { startAutoProcessing } from "./cron/autoProcess.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT;

app.use(bodyParser.json());

// Rutas de páginas estáticas (chat + reporte)
app.use("/", indexRoutes);

// Rutas de chat
app.use("/", chatRoutes);

// Rutas API de reportes
app.use("/api", reportRoutes);

// Servir assets estáticos
app.use(express.static(path.join(process.cwd(), "public")));

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
  // Una vez que el servidor está arriba, arrancamos el cron
  startAutoProcessing();
});
