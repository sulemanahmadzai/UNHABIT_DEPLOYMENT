import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load OpenAPI spec from generated JSON file
let specs;
try {
    const specPath = join(__dirname, "../../openapi.json");
    const specContent = readFileSync(specPath, "utf-8");
    specs = JSON.parse(specContent);
}
catch (error) {
    console.warn("Could not load openapi.json, using minimal spec:", error);
    // Fallback to minimal spec
    specs = {
        openapi: "3.0.0",
        info: { title: "UnHabit API", version: "1.0.0" },
        servers: [{ url: "/api" }],
        components: {
            securitySchemes: {
                bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
            },
        },
        paths: {},
    };
}
router.use("/", swaggerUi.serve, swaggerUi.setup(specs));
export default router;
//# sourceMappingURL=swagger.js.map