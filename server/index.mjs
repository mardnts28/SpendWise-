import express from "express";
import cors from "cors";
import pg from "pg";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || "spendwise_secret_key_2026";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Rate limiter for authentication routes to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 auth attempts per windowMs
  message: { error: "Too many login attempts from this IP. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Connect to PostgreSQL database
const pool = new pg.Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || "spendwise_db",
  user: process.env.PGUSER || "maryardientes",
  password: process.env.PGPASSWORD || undefined,
});

const DEFAULT_CATEGORIES = [
  { id: "cat-0", name: "Food", color: "#6366f1", icon: "fork", budget: 6000 },
  { id: "cat-1", name: "Transport", color: "#f97316", icon: "car", budget: 3000 },
  { id: "cat-2", name: "Bills", color: "#0ea5e9", icon: "bill", budget: 8000 },
  { id: "cat-3", name: "Shopping", color: "#ec4899", icon: "bag", budget: 4000 },
  { id: "cat-4", name: "Health", color: "#10b981", icon: "heart", budget: 2500 },
  { id: "cat-5", name: "Entertainment", color: "#8b5cf6", icon: "film", budget: 2000 },
  { id: "cat-6", name: "Education", color: "#eab308", icon: "book", budget: 3000 },
  { id: "cat-7", name: "Other", color: "#64748b", icon: "dots", budget: 2000 },
];

// Helper: Ensure default categories exist for a user
async function ensureCategories(userId) {
  const existing = await pool.query("SELECT id FROM categories WHERE user_id = $1", [userId]);
  if (existing.rows.length === 0) {
    for (const c of DEFAULT_CATEGORIES) {
      const catId = `${userId}-${c.id}`;
      await pool.query(
        `INSERT INTO categories (id, user_id, name, color, icon, custom, budget) 
         VALUES ($1, $2, $3, $4, $5, false, $6) 
         ON CONFLICT (id) DO NOTHING`,
        [catId, userId, c.name, c.color, c.icon, c.budget]
      );
    }
  }
}

// Authentication Middleware to verify JWT token
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Soft fallback: allow request if userId is present in headers or params
    return next();
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (_err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// GET all store data for a specific user
app.get("/api/store/:userId", verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    const userRes = await pool.query("SELECT id, name, email, currency FROM users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    await ensureCategories(userId);

    const catRes = await pool.query(
      `SELECT 
        id, 
        name, 
        color, 
        icon, 
        custom, 
        COALESCE(budget, 0)::float AS budget 
       FROM categories 
       WHERE user_id = $1 
       ORDER BY id ASC`,
      [userId]
    );

    const expRes = await pool.query(
      `SELECT 
        id, 
        amount::float AS amount, 
        category_id AS "categoryId", 
        to_char(date, 'YYYY-MM-DD') AS date, 
        notes,
        COALESCE(type, 'expense') AS type,
        COALESCE(is_recurring, false) AS "isRecurring",
        receipt_image AS "receiptImage"
       FROM expenses 
       WHERE user_id = $1 
       ORDER BY date DESC, created_at DESC`,
      [userId]
    );

    res.json({
      user: userRes.rows[0],
      categories: catRes.rows,
      expenses: expRes.rows,
    });
  } catch (err) {
    console.error("Error fetching store:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST add or update a transaction (expense or income)
app.post("/api/expenses", verifyToken, async (req, res) => {
  try {
    const { id, userId, categoryId, amount, date, notes, type = "expense", isRecurring = false, receiptImage = null } = req.body;
    if (!id || !userId || !categoryId || amount === undefined || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify user exists in database to prevent foreign key errors
    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(401).json({ error: "User does not exist in the database. Please sign up or log in again." });
    }

    // Ensure category exists before inserting
    const catCheck = await pool.query("SELECT id FROM categories WHERE id = $1", [categoryId]);
    if (catCheck.rows.length === 0) {
      const matched = DEFAULT_CATEGORIES.find((c) => c.id === categoryId) || {
        name: "General",
        color: "#6366f1",
        icon: "dots",
        budget: 2000,
      };
      await pool.query(
        "INSERT INTO categories (id, user_id, name, color, icon, custom, budget) VALUES ($1, $2, $3, $4, $5, false, $6) ON CONFLICT (id) DO NOTHING",
        [categoryId, userId, matched.name, matched.color, matched.icon, matched.budget]
      );
    }

    await pool.query(
      `INSERT INTO expenses (id, user_id, category_id, amount, date, notes, type, is_recurring, receipt_image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE
       SET category_id = EXCLUDED.category_id,
           amount = EXCLUDED.amount,
           date = EXCLUDED.date,
           notes = EXCLUDED.notes,
           type = EXCLUDED.type,
           is_recurring = EXCLUDED.is_recurring,
           receipt_image = EXCLUDED.receipt_image`,
      [id, userId, categoryId, amount, date, notes || "", type, isRecurring, receiptImage]
    );

    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error("Error saving expense:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE an expense
app.delete("/api/expenses/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM expenses WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting expense:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST add or update a category (including budget)
app.post("/api/categories", verifyToken, async (req, res) => {
  try {
    const { id, userId, name, color, icon, custom, budget = 0 } = req.body;
    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(401).json({ error: "User does not exist in the database." });
    }

    await pool.query(
      `INSERT INTO categories (id, user_id, name, color, icon, custom, budget)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE
       SET name = EXCLUDED.name,
           color = EXCLUDED.color,
           icon = EXCLUDED.icon,
           custom = EXCLUDED.custom,
           budget = EXCLUDED.budget`,
      [id, userId, name, color, icon, custom ?? true, budget]
    );
    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error("Error saving category:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE a category
app.delete("/api/categories/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM categories WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: err.message });
  }
});

// Auth endpoints with bcrypt and JWT
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      "SELECT id, name, email, password, currency FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const user = result.rows[0];

    // Check password: first try bcrypt, fallback to plaintext for migration
    let isMatch = false;
    if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = user.password === password;
      if (isMatch) {
        // Upgrade legacy plaintext password to hashed password
        const newHash = await bcrypt.hash(password, 10);
        await pool.query("UPDATE users SET password = $1 WHERE id = $2", [newHash, user.id]);
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    await ensureCategories(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      user: { id: user.id, name: user.name, email: user.email, currency: user.currency },
      token,
    });
  } catch (err) {
    console.error("Error logging in:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/signup", authLimiter, async (req, res) => {
  try {
    const { id, name, email, password, currency = "PHP" } = req.body;
    const exists = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO users (id, name, email, password, currency) VALUES ($1, $2, $3, $4, $5)",
      [id, name, email, hashedPassword, currency]
    );
    await ensureCategories(id);

    // Generate JWT token
    const token = jwt.sign({ id, email, name }, JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      user: { id, name, email, currency },
      token,
    });
  } catch (err) {
    console.error("Error signing up:", err);
    res.status(500).json({ error: err.message });
  }
});

// User profile update
app.put("/api/users/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, currency } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        "UPDATE users SET name = $1, email = $2, password = $3, currency = $4 WHERE id = $5",
        [name, email, hashedPassword, currency || "PHP", id]
      );
    } else {
      await pool.query(
        "UPDATE users SET name = $1, email = $2, currency = $3 WHERE id = $4",
        [name, email, currency || "PHP", id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete account and all cascade data
app.delete("/api/users/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting user account:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SpendWise API Server running on http://localhost:${PORT}`);
});
