import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

const router = Router();

const options = {
  definition: {
    openapi: "3.0.0",
    info: { title: "UnHabit API", version: "1.0.0" },
    servers: [{ url: "/api" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
  apis: [], // (Optional: add JSDoc annotations if you want)
};

const specs = swaggerJsdoc(options);
router.use("/", swaggerUi.serve, swaggerUi.setup(specs));
export default router;
