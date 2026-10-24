const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { createClient } = require("redis");
const crypto = require("crypto");

const app = express();
const PORT = 5000;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});
const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (error) => {
  console.log("Redis Client Error: ", error);
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

function authorizeApartment(req, res, next) {
  const requestedApartmentId = Number(req.params.id);

  if (req.user.role === "admin") {
    return next();
  }

  if (
    req.user.role === "resident" &&
    req.user.apartmentId === requestedApartmentId
  ) {
    return next();
  }
  return res.status(403).json({ error: "Access denied" });
}

app.get("/", (req, res) => {
  res.json({
    message: "Apartment subscription API is running!",
  });
});

app.get("/api/redis-test", async (req, res) => {
  try {
    await redisClient.set("test_key", "Hello from Redis!");
    const value = await redisClient.get("test_key");
    res.json({
      message: "Redis is working!",
      value: value,
    });
  } catch (error) {
    console.log("Redis test error:", error);
    res.status(500).json({
      error: "Redis test failed",
    });
  }
});

app.get(
  "/api/apartments",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM APARTMENTS");
      res.json(result.rows);
    } catch (error) {
      console.log("Error fetching apartments:", error);
      res.status(500).json({
        error: "Failed to fetch apartments",
      });
    }
  },
);

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

    const refreshToken = crypto.randomBytes(64).toString("hex");
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    await redisClient.set(`refresh:${refreshTokenHash}`, String(user.id), {
      EX: 7 * 24 * 60 * 60,
    });

    app.post("/api/auth/refresh", async (req, res) => {
      try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
          return res.status(401).json({
            error: "Refresh token required",
          });
        }

        const refreshTokenHash = crypto
          .createHash("sha256")
          .update(refreshToken)
          .digest("hex");

        const userId = await redisClient.get(`refresh:${refreshTokenHash}`);

        if (!userId) {
          return res.status(403).json({
            error: "Invalid or expired refresh token",
          });
        }

        const result = await pool.query(
          `
      SELECT id, email, role, apartment_id
      FROM users
      WHERE id = $1
      `,
          [userId],
        );

        if (result.rows.length === 0) {
          return res.status(403).json({
            error: "User not found",
          });
        }

        const user = result.rows[0];

        const accessToken = jwt.sign(
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
          message: "Access token refreshed",
          accessToken: accessToken,
        });
      } catch (error) {
        console.log("Error refreshing token:", error);

        res.status(500).json({
          error: "Failed to refresh token",
        });
      }
    });

    app.post("/api/auth/logout", async (req, res) => {
      try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
          return res.status(401).json({
            error: "Refresh token required",
          });
        }

        const refreshTokenHash = crypto
          .createHash("sha256")
          .update(refreshToken)
          .digest("hex");

        await redisClient.del(`refresh:${refreshTokenHash}`);

        res.json({
          message: "Logout successful",
        });
      } catch (error) {
        console.log("Error logging out:", error);

        res.status(500).json({
          error: "Failed to logout",
        });
      }
    });

    res.json({
      message: "Login successful",
      accessToken: token,
      refreshToken: refreshToken,
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

app.get(
  "/api/apartments/:id/subscriptions",
  authenticateToken,
  authorizeApartment,
  async (req, res) => {
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
  },
);

app.get(
  "/api/apartments/:id/bill",
  authenticateToken,
  authorizeApartment,
  async (req, res) => {
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
  },
);

app.patch(
  "/api/subscriptions/:id/cancel",
  authenticateToken,
  async (req, res) => {
    try {
      const subscriptionId = Number(req.params.id);
      const subscriptionResult = await pool.query(
        `SELECT apartment_id, active
         FROM subscriptions
         WHERE id = $1 
        `,
        [subscriptionId],
      );

      if (subscriptionResult.rows.length === 0) {
        return res.status(404).json({
          error: "Subscription not found",
        });
      }

      if (!subscriptionResult.rows[0].active) {
        return res.status(400).json({
          error: "Subscription already cancelled",
        });
      }

      const subscriptionApartmentId = subscriptionResult.rows[0].apartment_id;

      if (
        req.user.role === "resident" &&
        req.user.apartmentId !== subscriptionApartmentId
      ) {
        return res.status(403).json({
          error: "You can only cancel subscriptions for your own apartment",
        });
      }
      const result = await pool.query(
        `
      UPDATE subscriptions
      SET 
        active = FALSE,
        end_date = CURRENT_DATE
      WHERE id = $1 AND active = TRUE
      RETURNING *`,
        [subscriptionId],
      );

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
  },
);

app.post("/api/subscriptions", authenticateToken, async (req, res) => {
  try {
    const { apartment_id, publication_id, start_date } = req.body;

    if (!apartment_id || !publication_id || !start_date) {
      return res.status(400).json({
        error: "Apartment, publication and start date are required",
      });
    }

    if (
      req.user.role === "resident" &&
      req.user.apartmentId !== Number(apartment_id)
    ) {
      return res.status(403).json({
        error: "You can only create subscriptions for your own apartment",
      });
    }

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

app.get("/api/publications", authenticateToken, async (req, res) => {
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

app.post(
  "/api/publications",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
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
  },
);

app.patch(
  "/api/publications/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
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
  },
);

app.post(
  "/api/apartments",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
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
  },
);

app.patch(
  "/api/apartments/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
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
  },
);

// Registration endpoint
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, apartment_id } = req.body;

    if (!email || !password || !apartment_id) {
      return res.status(400).json({
        error: "Email, password and apartment required",
      });
    }

    const role = "resident";

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
app.get(
  "/api/users",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
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
  },
);

async function startServer() {
  try {
    await redisClient.connect();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.log("Failed to start server:", error);
  }
}

startServer();
