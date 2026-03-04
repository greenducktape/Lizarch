import express from "express";
import router from "../backend/routes.js";

const app = express();

// Vercel can forward catch-all paths with or without the /api prefix
// depending on routing configuration. Support both forms.
app.use(router);
app.use("/api", router);

export default app;
