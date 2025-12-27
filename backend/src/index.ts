import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Server as SocketServer } from "socket.io";
import { config } from "./config";
import { verifyAccessToken } from "./utils/jwt";
import { setRealtimeServer } from "./realtime";
import { sequelize } from "./db";
import "./models/User";
import "./models/Entry";
import "./models/Attachment";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import entriesRouter from "./routes/entries";
import attachmentsRouter from "./routes/attachments";

const app = express();
const httpServer = http.createServer(app);

app.use(helmet());
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300
  })
);

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/entries", entriesRouter);
app.use("/api/attachments", attachmentsRouter);

const io = new SocketServer(httpServer, {
  cors: {
    origin: config.clientOrigin,
    credentials: true
  }
});

io.use((socket, next) => {
  const authHeader = socket.handshake.headers.authorization;
  const authToken = socket.handshake.auth?.token as string | undefined;
  const rawToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : authToken;

  if (!rawToken) {
    return next(new Error("Unauthorized"));
  }

  try {
    const userId = verifyAccessToken(rawToken);
    if (!userId) {
      return next(new Error("Unauthorized"));
    }
    socket.data.userId = userId;
    return next();
  } catch (error) {
    return next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as string | undefined;
  if (userId) {
    socket.join(`user:${userId}`);
  }
});

setRealtimeServer(io);

app.get("/api/health", async (_req, res) => {
  try {
    await sequelize.authenticate();
    if (config.db.sync) {
      await sequelize.sync({ alter: config.db.syncAlter });
    }
    res.status(200).json({ ok: true, db: "up" });
  } catch (error) {
    res.status(200).json({ ok: true, db: "down" });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

const start = async () => {
  try {
    await sequelize.authenticate();
    if (config.db.sync) {
      await sequelize.sync({ alter: config.db.syncAlter });
    }
    httpServer.listen(config.port, () => {
      // eslint-disable-next-line no-console
      console.log(`API listening on ${config.port}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

start();
