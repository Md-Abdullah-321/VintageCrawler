/**
 * Title: index.js
 * Description: Run the server.
 * Author: Md Abdullah
 * Date: 06/10/2024
 */
import dotenv from "dotenv";
import app from "./src/app.js";
dotenv.config();
const port = process.env.PORT || 8000;
app.listen(port, () => {
    console.info(`Listening on http://localhost:${port}`);
});
