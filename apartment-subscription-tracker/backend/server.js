const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { Pool } = require("pg");

const app = express();
const PORT = 5000;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Apartment subscription API is running!",
  });
});

// pool.query("SELECT NOW()", (error, result) => {
//   if (error) {
//     console.error("Database connection failed:", error);
//   } else {
//     console.log("Database connected:", result.rows[0]);
//   }
// });

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
