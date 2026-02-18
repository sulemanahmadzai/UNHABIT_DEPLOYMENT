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
    origin: (origin, callback) => {
        // In development, allow all localhost origins and any configured origins
        if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
            // Allow requests with no origin (like mobile apps or curl)
            if (!origin) {
                return callback(null, true);
            }
            // Allow all localhost origins
            if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
                return callback(null, true);
            }
            // Also allow explicitly configured origins
            if (process.env.CORS_ORIGIN) {
                const allowedOrigins = process.env.CORS_ORIGIN.split(",").map(o => o.trim());
                if (allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }
            }
            // Default: allow all in development
            return callback(null, true);
        }
        // Production: use configured origins only
        if (process.env.CORS_ORIGIN) {
            const allowedOrigins = process.env.CORS_ORIGIN.split(",").map(o => o.trim());
            if (origin && allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            return callback(new Error('Not allowed by CORS'));
        }
        // No CORS_ORIGIN set in production - deny by default
        callback(new Error('CORS_ORIGIN must be set in production'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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