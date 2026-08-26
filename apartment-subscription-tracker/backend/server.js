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

app.get("/api/apartments", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM APARTMENTS");
    res.json(result.rows);
  } catch (error) {
    console.log("Error fetching apartments:", error);
    res.status(500).json({
      error: "Failed to fetch apartments",
    });
  }
});

app.get("/api/apartments/:id/subscriptions", async (req, res) => {
  try {
    const apartmentId = req.params.id;
    const result = await pool.query(
      `SELECT 
      subscriptions.id,
      apartments.unit_number,
      publications.name,
      publications.type,
      publications.price_monthly
      FROM subscriptions
      JOIN apartments
        ON subscriptions.apartment_id = apartments.id
      JOIN publications
        ON subscriptions.publication_id = publications.id
      WHERE apartments.id = $1
      AND subscriptions.active = TRUE;`,
      [apartmentId],
    );
    res.json(result.rows);
  } catch (error) {
    console.log("Error fetching subscriptions", error);
    res.status(500).json({
      error: "Failed to fetch subscriptions",
    });
  }
});

app.get("/api/apartments/:id/bill", async (req, res) => {
  try {
    const apartmentId = req.params.id;
    const result = await pool.query(
      `
    SELECT
      apartments.unit_number,
      SUM(publications.price_monthly) AS total_monthly_bill
    FROM subscriptions
    JOIN apartments
      ON subscriptions.apartment_id = apartments.id
    JOIN publications
      ON subscriptions.publication_id = publications.id
    WHERE apartments.id = $1
    AND subscriptions.active = TRUE
    GROUP BY apartments.unit_number;`,
      [apartmentId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching bill", error);
    res.status(500).json({
      error: "Failed to fetch bill",
    });
  }
});

app.patch("/api/subscriptions/:id/cancel", async (req, res) => {
  try {
    const subscriptionId = req.params.id;
    const result = await pool.query(
      `
      UPDATE subscriptions
      SET 
        active = FALSE,
        end_date = CURRENT_DATE
      WHERE id = $1
      RETURNING *`,
      [subscriptionId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Subscription not found",
      });
    }
    res.json({
      message: "Subscription cancelled successfully",
      subscription: result.rows[0],
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({
      error: "Failed to cancel subscription",
    });
  }
});

app.post("/api/subscriptions", async (req, res) => {
  try {
    const { apartment_id, publication_id, start_date } = req.body;
    const result = await pool.query(
      ` 
    INSERT INTO subscriptions (
      apartment_id,
      publication_id,
      start_date,
      active)
      VALUES ($1, $2, $3, TRUE)
      RETURNING *;`,
      [apartment_id, publication_id, start_date],
    );

    res.status(201).json({
      message: "Subscription created successfully",
      subscription: result.rows[0],
    });
  } catch (error) {
    console.log("Error creating subscription", error);
    res.status(500).json({
      error: "Failed to create subscription",
    });
  }
});

app.get("/api/publications", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM publications
      ORDER BY id; `);
    res.json(result.rows);
  } catch (error) {
    console.log("Error fetching publications", error);
    res.status(500).json({
      error: "Failed to fetch publications",
    });
  }
});

app.post("/api/publications", async (req, res) => {
  try {
    const { name, type, price_monthly } = req.body;
    const result = await pool.query(
      `
      INSERT INTO publications (
      name,
      type,
      price_monthly
      ) 
      VALUES ($1, $2, $3)
      RETURNING *;`,
      [name, type, price_monthly],
    );

    res.status(201).json({
      message: "Publication added successfully",
      publication: result.rows[0],
    });
  } catch (error) {
    console.log("Error adding publication", error);
    res.status(500).json({
      error: "Failed to add publication",
    });
  }
});

app.patch("/api/publications/:id", async (req, res) => {
  try {
    const publicationId = req.params.id;

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Publication not found",
      });
    }

    res.json({
      message: "Publication updated successfully",
      publication: result.rows[0],
    });
  } catch (error) {
    console.log("Error updating publication", error);
    res.status(500).json({
      error: "Failed to update publication",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
