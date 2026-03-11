import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-9839b3d0/health", (c) => {
  return c.json({ status: "ok" });
});

// Profile endpoints
app.get("/make-server-9839b3d0/profile", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);
    
    const userId = c.req.query('userId');
    if (!userId) return c.json({ error: 'Missing userId' }, 400);

    const profile = await kv.get(`profile_${userId}`);
    return c.json({ data: profile || null });
  } catch (err: any) {
    console.error("[Profile GET] Error:", err);
    return c.json({ error: err.message }, 500);
  }
});

app.post("/make-server-9839b3d0/profile", async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return c.json({ error: 'Unauthorized' }, 401);
    
    const body = await c.req.json();
    const userId = body.userId;
    const profileData = body.profile;
    
    if (!userId || !profileData) {
      return c.json({ error: 'Missing userId or profile' }, 400);
    }

    await kv.set(`profile_${userId}`, profileData);
    return c.json({ success: true });
  } catch (err: any) {
    console.error("[Profile POST] Error:", err);
    return c.json({ error: err.message }, 500);
  }
});

Deno.serve(app.fetch);