const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Access token required",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (error, user) => {
    if (error) {
      return res.status(403).json({
        error: "Invalid or expired access token",
      });
    }

    req.user = user;
    next();
  });
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Access denied",
      });
    }

    next();
  };
}

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({
    message: "Token is valid",
    user: req.user,
  });
});

app.get(
  "/api/admin/test",
  authenticateToken,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({
      message: "You have admin access",
      user: req.user,
    });
  },
);

app.get(
  "/api/resident/test",
  authenticateToken,
  authorizeRoles("resident"),
  (req, res) => {
    res.json({
      message: "You have resident access",
      user: req.user,
    });
  },
);

app.get("/", (req, res) => {
  res.json({
    message: "Apartment subscription API is running!",
  });
});

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

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      `
      SELECT *
      FROM users
      WHERE email = $1`,
      [email],
    );
    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }
    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        apartmentId: user.apartment_id,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "15m",
      },
    );

    res.json({
      message: "Login successful",
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        apartment_id: user.apartment_id,
      },
    });
  } catch (error) {
    console.log("Error logging in:", error);
    res.status(500).json({
      error: "Failed to login",
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
    const { name, type, price_monthly } = req.body;

    const result = await pool.query(
      `UPDATE publications
        SET
          name = $1,
          type = $2,
          price_monthly = $3
        WHERE id = $4
        RETURNING *;
        `,
      [name, type, price_monthly, publicationId],
    );

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

app.post("/api/apartments", async (req, res) => {
  try {
    const { unit_number, floor } = req.body;

    const result = await pool.query(
      `
      INSERT INTO apartments (
      unit_number,
      floor)
      VALUES ($1, $2)
      RETURNING *;
      `,
      [unit_number, floor],
    );
    res.status(201).json({
      message: "Apartment added successfully",
      apartment: result.rows[0],
    });
  } catch (error) {
    console.log("Error creating apartment", error);
    res.status(500).json({
      error: "Failed to create apartment",
    });
  }
});

app.patch("/api/apartments/:id", async (req, res) => {
  try {
    const apartmentId = req.params.id;
    const { unit_number, floor } = req.body;

    const result = await pool.query(
      `
      UPDATE apartments
      SET 
        unit_number = $1,
        floor = $2 
      WHERE id = $3
      RETURNING *;
      `,
      [unit_number, floor, apartmentId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Apartment not found",
      });
    }

    res.json({
      message: "Apartment updated successfully",
      apartment: result.rows[0],
    });
  } catch (error) {
    console.log("Error updating apartment", error);
    res.status(500).json({
      error: "Failed to update apartment",
    });
  }
});

// Registration endpoint
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, role, apartment_id } = req.body;

    const existingUser = await pool.query(
      `
      SELECT id
      FROM users
      WHERE email = $1`,
      [email],
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: "User with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `
      INSERT INTO users (
        email,
        password_hash,
        role,
        apartment_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, role, apartment_id;
        `,
      [email, passwordHash, role, apartment_id],
    );

    res.status(201).json({
      message: "User registered successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.log("Error registering user", error);
    res.status(500).json({
      error: "Failed to register user",
    });
  }
});

// Endpoint to view list of users
app.get("/api/users", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, email, role, apartment_id
      FROM users
      ORDER BY id;
      `,
    );

    res.json(result.rows);
  } catch (error) {
    console.log("Error fetching users:", error);

    res.status(500).json({
      error: "Failed to fetch users",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
