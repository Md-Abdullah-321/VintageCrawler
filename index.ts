/**
 * Title: index.js
 * Description: Run the server.
 * Author: Md Abdullah
 * Date: 06/10/2024
 */

import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";

const port = Number(process.env.PORT) || 8000;
app.listen(port, "0.0.0.0", () => {
  console.info(`Listening on http://localhost:${port}`);
});
