import express from "express";
import router from "../backend/routes.js";

const app = express();

// In Vercel this catch-all function receives requests under /api/*.
// Mounting at /api keeps local and serverless paths consistent.
app.use("/api", router);

export default app;
