import { Router } from "express";
import auth from "./auth.js";
import health from "./health.js";
import ai from "./ai.js";
import swaggerRouter from "../docs/swagger.js";
const r = Router();
r.use("/auth", auth);
r.use("/health", health);
r.use("/ai", ai);
r.use("/docs", swaggerRouter); // Swagger UI
export default r;
//# sourceMappingURL=index.js.map