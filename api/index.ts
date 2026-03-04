import express from "express";
import router from "../backend/routes.js";

const app = express();

app.use("/api", router);

export default app;
