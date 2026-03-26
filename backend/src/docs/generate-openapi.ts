import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Route mapping from index.ts
const routeMap: Record<string, string> = {
  "/auth": "Authentication",
  "/health": "Health",
  "/habits": "Habits",
  "/journeys": "Journeys",
  "/progress": "Progress",
  "/analytics": "Analytics",
  "/ai": "AI Services",
  "/ai-diagnostics": "AI Diagnostics",
  "/notifications": "Notifications",
  "/coach": "Coach",
  "/rewards": "Rewards",
  "/settings": "Settings",
  "/buddies": "Buddies",
  "/admin": "Admin",
  "/home": "Home",
  "/streaks": "Streaks",
  "/leaderboard": "Leaderboard",
  "/focus": "Focus",
  "/recovery": "Recovery",
  "/share": "Share",
  "/challenges": "Challenges",
};

// Parse route files to extract endpoints
function parseRouteFile(filePath: string, basePath: string): any[] {
  try {
    const content = readFileSync(filePath, "utf-8");
    const endpoints: any[] = [];

    // Match JSDoc comments with route definitions
    const routePattern = /\/\*\*\s*\n\s*\*\s*([A-Z]+)\s+(\/api\/[^\n]+)\s*\n\s*\*\s*([^\n]+(?:\n\s*\*[^\n]+)*)\s*\*\/\s*\n\s*r\.(get|post|put|delete|patch)\(["']([^"']+)["']/g;

    let match;
    while ((match = routePattern.exec(content)) !== null) {
      if (!match[1] || !match[2] || !match[3] || !match[4] || !match[5]) continue;
      const method = match[1];
      const fullPath = match[2];
      const description = match[3].replace(/\*\s*/g, "").trim();
      const httpMethod = match[4].toLowerCase();
      const routePath = match[5];

      // Check if requireAuth is used
      const authRequired = content.includes(`r.${httpMethod}("${routePath}", requireAuth`) ||
        content.includes(`r.${httpMethod}("${routePath}", requireAuth,`);

      // Extract path parameters
      const pathParams = routePath?.match(/:(\w+)/g)?.map(p => p.slice(1)) || [];

      // Extract query parameters from code
      const queryParams: any[] = [];
      const queryMatch = routePath ? content.match(new RegExp(`r\\.${httpMethod}\\("${routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^}]*req\\.query\\.(\\w+)`, 's')) : null;

      // Try to extract Zod schema for request body
      let requestBody: any = null;
      const schemaMatch = content.match(/const schema = z\.object\(\{([^}]+)\}\)/s);
      if (schemaMatch && (httpMethod === "post" || httpMethod === "put" || httpMethod === "patch")) {
        const schemaContent = schemaMatch[1];
        const properties: any = {};
        const required: string[] = [];

        // Parse Zod schema fields
        const fieldPattern = /(\w+):\s*z\.(string|number|boolean|object|array|enum)\([^)]*\)(\.(optional|email|min|max|uuid))*/g;
        let fieldMatch;
        while (schemaContent && (fieldMatch = fieldPattern.exec(schemaContent)) !== null) {
          if (!fieldMatch[1] || !fieldMatch[2]) continue;
          const fieldName = fieldMatch[1];
          const zodType = fieldMatch[2];
          const modifiers = fieldMatch[4];

          let type = zodType;
          if (zodType === "string") type = "string";
          else if (zodType === "number") type = "number";
          else if (zodType === "boolean") type = "boolean";
          else if (zodType === "object") type = "object";
          else if (zodType === "array") type = "array";

          if (fieldName) {
            properties[fieldName] = { type };

            if (!modifiers?.includes("optional")) {
              required.push(fieldName);
            }
          }
        }

        if (Object.keys(properties).length > 0) {
          requestBody = {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties,
                  required: required.length > 0 ? required : undefined,
                },
              },
            },
          };
        }
      }

      // Build OpenAPI path
      if (!routePath) continue;
      const openApiPath = `${basePath}${routePath.replace(/:(\w+)/g, "{$1}")}`;

      endpoints.push({
        path: openApiPath,
        method: httpMethod,
        operation: {
          tags: [routeMap[basePath] || basePath.slice(1)],
          summary: description.split("\n")[0] || `${method} ${fullPath}`,
          description: description,
          operationId: `${httpMethod}${routePath?.replace(/[\/:]/g, "").replace(/\{(\w+)\}/g, "$1") || ''}`,
          security: authRequired ? [{ bearerAuth: [] }] : [],
          parameters: [
            ...pathParams.map((param: string) => ({
              name: param,
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: `${param} parameter`,
            })),
            ...queryParams,
          ],
          requestBody: requestBody,
          responses: {
            "200": {
              description: "Success",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { type: "object" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "201": {
              description: "Created",
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { $ref: "#/components/schemas/SuccessResponse" },
                      {
                        type: "object",
                        properties: {
                          data: { type: "object" },
                        },
                      },
                    ],
                  },
                },
              },
            },
            "400": {
              description: "Bad Request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "404": {
              description: "Not Found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      });
    }

    return endpoints;
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return [];
  }
}

// Generate OpenAPI spec
function generateOpenAPI() {
  const routesDir = join(__dirname, "../routes");
  const allEndpoints: any[] = [];

  // Parse all route files
  for (const [basePath, tag] of Object.entries(routeMap)) {
    const fileName = basePath.slice(1);
    const filePath = join(routesDir, `${fileName}.ts`);

    try {
      const endpoints = parseRouteFile(filePath, basePath);
      allEndpoints.push(...endpoints);
    } catch (error) {
      console.warn(`Could not parse ${filePath}:`, error);
    }
  }

  // Build paths object
  const paths: any = {};
  for (const endpoint of allEndpoints) {
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }
    paths[endpoint.path][endpoint.method] = endpoint.operation;
  }

  // Create complete OpenAPI spec
  const openApiSpec = {
    openapi: "3.0.0",
    info: {
      title: "UnHabit API",
      version: "1.0.0",
      description: "Complete API documentation for UnHabit backend service. This API provides endpoints for habit tracking, journeys, progress monitoring, AI-powered coaching, social features, and more.",
      contact: {
        name: "UnHabit API Support",
      },
    },
    servers: [
      {
        url: "/api",
        description: "API Base URL",
      },
      {
        url: "http://localhost:3000/api",
        description: "Local Development Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token from Supabase authentication. Include as: Authorization: Bearer <token>",
        },
      },
      schemas: {
        SuccessResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              type: "object",
              description: "Response data",
            },
          },
          required: ["success"],
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "string",
              description: "Error message",
            },
          },
          required: ["success", "error"],
        },
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
            },
            email: {
              type: "string",
              format: "email",
            },
            created_at: {
              type: "string",
              format: "date-time",
            },
          },
        },
      },
    },
    tags: Object.values(routeMap).map((name) => ({
      name,
      description: `${name} endpoints`,
    })),
    paths,
  };

  // Write to file
  const outputPath = join(__dirname, "../../openapi.json");
  writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2));
  console.log(`✅ OpenAPI spec generated: ${outputPath}`);
  console.log(`📊 Total endpoints: ${allEndpoints.length}`);
}

generateOpenAPI();
