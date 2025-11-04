import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { errorHandler } from "./middlewares/error.js";
const app = express();
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
    credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use("/api", routes);
// health
app.get("/healthz", (_req, res) => res.json({ ok: true }));
// errors
app.use(errorHandler);
export default app;
//# sourceMappingURL=app.js.map