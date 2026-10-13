
const express = require("express");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Verificação simples do servidor
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Permite receber dados JSON
app.use(express.json({ limit: "100kb" }));

// Configuração de CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Verifica a configuração do banco de dados
if (!process.env.DATABASE_URL) {
  console.error(
    "ERRO: configure a variável de ambiente DATABASE_URL."
  );
  process.exit(1);
}

// Conexão PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.PGSSL === "true"
      ? { rejectUnauthorized: false }
      : undefined
});

// Produtos do Gelado da Casa
const products = [
  { id: 1, name: "Ovomaltine com Ninho", price: 11 },
  { id: 2, name: "Oreo com Ninho", price: 11 },
  { id: 3, name: "Nutella com Ninho", price: 11 },
  { id: 4, name: "Ouro Branco com Ninho", price: 11 },
  { id: 5, name: "KitKat com Ninho", price: 11 },
  { id: 6, name: "Morango com Ninho", price: 10 },
  { id: 7, name: "Maracujá com Ninho", price: 9 },
  { id: 8, name: "Coco com Ninho", price: 10 },
  { id: 9, name: "Morango", price: 8 },
  { id: 10, name: "Maracujá", price: 7 }
];

// Cria a tabela de pedidos, caso ainda não exista
async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      customer_name TEXT,
      customer_phone TEXT,
      items JSONB NOT NULL,
      total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
      status TEXT NOT NULL DEFAULT 'recebido',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// Página inicial da API
app.get("/", (req, res) => {
  res.json({
    name: "Gelado da Casa API",
    status: "online",
    endpoints: [
      "/health",
      "/api/health",
      "/api/products",
      "POST /api/orders",
      "POST /api/webhooks/orders",
      "GET /api/admin/orders"
    ]
  });
});

// Verifica se o banco está conectado
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    console.error(
      "Falha no teste do banco:",
      error.message
    );

    res.status(503).json({
      status: "error",
      database: "unavailable"
    });
  }
});

// Lista os produtos
app.get("/api/products", (req, res) => {
  res.json(products);
});

// Função compartilhada para validar e salvar pedidos
async function saveOrder(req, res) {
  try {
    const {
      customerName,
      customerPhone,
      items
    } = req.body || {};

    // Valida os itens
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 50
    ) {
      return res.status(400).json({
        error: "Envie entre 1 e 50 itens no pedido."
      });
    }

    // Valida o nome
    if (
      customerName !== undefined &&
      (
        typeof customerName !== "string" ||
        customerName.length > 120
      )
    ) {
      return res.status(400).json({
        error: "Nome inválido."
      });
    }

    // Valida o telefone
    if (
      customerPhone !== undefined &&
      (
        typeof customerPhone !== "string" ||
        customerPhone.length > 30
      )
    ) {
      return res.status(400).json({
        error: "Telefone inválido."
      });
    }

    let total = 0;
    const orderItems = [];

    // Valida os produtos e calcula o valor no servidor
    for (const item of items) {
      const product = products.find(
        (p) => p.id === item.productId
      );

      if (
        !product ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 100
      ) {
        return res.status(400).json({
          error: "Produto ou quantidade inválida."
        });
      }

      total += product.price * item.quantity;

      orderItems.push({
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.price
      });
    }

    // Salva o pedido no PostgreSQL
    const result = await pool.query(
      `INSERT INTO orders
        (customer_name, customer_phone, items, total)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING
         id,
         customer_name,
         customer_phone,
         items,
         total,
         status,
         created_at`,
      [
        customerName?.trim() || null,
        customerPhone?.trim() || null,
        JSON.stringify(orderItems),
        total.toFixed(2)
      ]
    );

    return res.status(201).json({
      message: "Pedido salvo com sucesso!",
      order: result.rows[0]
    });
  } catch (error) {
    console.error(
      "Erro ao salvar pedido:",
      error.message
    );

    return res.status(500).json({
      error: "Não foi possível salvar o pedido."
    });
  }
}

// Rota usada pelo site de vendas
app.post("/api/orders", saveOrder);

// Webhook protegido para receber pedidos de outro sistema
app.post("/api/webhooks/orders", async (req, res) => {
  const secret = process.env.WEBHOOK_SECRET;
  const authorization = req.get("authorization") || "";

  if (
    !secret ||
    authorization !== `Bearer ${secret}`
  ) {
    return res.status(401).json({
      error: "Webhook não autorizado."
    });
  }

  return saveOrder(req, res);
});

// Consulta administrativa protegida por token
app.get("/api/admin/orders", async (req, res) => {
  const token = process.env.ADMIN_TOKEN;
  const authorization = req.get("authorization") || "";

  if (
    !token ||
    authorization !== `Bearer ${token}`
  ) {
    return res.status(401).json({
      error: "Não autorizado."
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         id,
         customer_name,
         customer_phone,
         items,
         total,
         status,
         created_at
       FROM orders
       ORDER BY created_at DESC
       LIMIT 200`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(
      "Erro ao consultar pedidos:",
      error.message
    );

    res.status(500).json({
      error: "Não foi possível consultar pedidos."
    });
  }
});

// Inicializa o banco e inicia o servidor
initializeDatabase()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Gelado da Casa API rodando na porta ${PORT}`
      );
    });
  })
  .catch((error) => {
    console.error(
      "Não foi possível inicializar o banco:",
      error.message
    );

    process.exit(1);
  });

// Encerra a conexão corretamente
process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
