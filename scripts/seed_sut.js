#!/usr/bin/env node
/**
 * HW05 SUT Seeding Script (Zero-dependency, Node.js >= 18)
 *
 * Seeds EShop backend (http://localhost:3000) via REST APIs after a clean start:
 *  1. Registers all users from data/users.csv (30 staff_pool + 3 lockout_probe)
 *  2. Promotes staff_pool accounts to role="admin" via PUT /api/users/me
 *  3. Creates 20 realistic baseline orders via POST /api/checkout so
 *     GET /api/admin/orders exercises a real LEFT JOIN orders + users query
 *  4. Verifies user & order counts via admin endpoints
 */

const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const USERS_CSV = path.resolve(__dirname, "..", "data", "users.csv");

function parseCsv(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8").trim();
  const lines = raw.split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

async function apiRequest(endpoint, options = {}) {
  const { headers = {}, ...restOptions } = options;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function main() {
  console.log(`[SEED] Target SUT: ${BASE_URL}`);

  // 1. Health check
  const health = await apiRequest("/api/categories");
  if (!health.ok) {
    throw new Error(`SUT health check failed (${health.status}): ${JSON.stringify(health.data)}`);
  }
  console.log(`[SEED] Backend reachable. Seeded categories: ${Array.isArray(health.data) ? health.data.length : 0}`);

  // 2. Register and promote users from users.csv
  const users = parseCsv(USERS_CSV);
  const staffTokens = [];
  let registeredCount = 0;
  let promotedCount = 0;

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const displayName = u.email.split("@")[0];

    const reg = await apiRequest("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name: displayName,
        email: u.email,
        password: u.password,
      }),
    });
    if (!reg.ok) {
      throw new Error(`Failed to register ${u.email}: ${reg.status} ${JSON.stringify(reg.data)}`);
    }
    registeredCount++;

    if (u.account_type === "staff_pool") {
      const login = await apiRequest("/api/login", {
        method: "POST",
        body: JSON.stringify({ email: u.email, password: u.password }),
      });
      if (!login.ok || !login.data.token) {
        throw new Error(`Failed to login ${u.email}: ${login.status}`);
      }
      const token = login.data.token;
      staffTokens.push({ email: u.email, token });

      // Brief pause because server.js:47 fires an un-awaited UPDATE users during /api/login
      // which can trigger SQLITE_BUSY on immediate sequential writes.
      await new Promise((r) => setTimeout(r, 40));

      let upd = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        upd = await apiRequest("/api/users/me", {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: `Staff ${String(i + 1).padStart(2, "0")}`,
            shipping_address: `${100 + i} Nguyen Van Cu, Q5, TP.HCM`,
            phone: `0901000${String(i + 1).padStart(3, "0")}`,
            role: u.role || "admin",
          }),
        });
        if (upd.ok) break;
        await new Promise((r) => setTimeout(r, 80 * attempt));
      }
      if (!upd || !upd.ok) {
        throw new Error(`Failed to promote ${u.email}: ${upd ? upd.status : "ERR"} ${JSON.stringify(upd?.data)}`);
      }
      promotedCount++;
    }
  }

  // 3. Seed 20 baseline orders so GET /api/admin/orders returns realistic JOIN rows
  const orderAmounts = [
    1200000, 1500000, 2800000, 3000000, 4000000,
    6000000, 4500000, 1850000, 2200000, 950000,
    3100000, 5400000, 1750000, 2600000, 3800000,
    1400000, 4200000, 2950000, 3300000, 4900000,
  ];
  let ordersSeeded = 0;

  for (let idx = 0; idx < orderAmounts.length; idx++) {
    const staff = staffTokens[idx % staffTokens.length];
    const checkout = await apiRequest("/api/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${staff.token}` },
      body: JSON.stringify({
        total_amount: orderAmounts[idx],
        shipping_address: `Order #${idx + 1} - 227 Nguyen Van Cu, Q5, TP.HCM`,
      }),
    });
    if (!checkout.ok) {
      throw new Error(`Failed to seed order #${idx + 1}: ${checkout.status}`);
    }
    ordersSeeded++;
  }

  // 4. Verify via Admin APIs
  const verifyToken = staffTokens[0].token;
  const usersRes = await apiRequest("/api/admin/users", {
    headers: { Authorization: `Bearer ${verifyToken}` },
  });
  const ordersRes = await apiRequest("/api/admin/orders", {
    headers: { Authorization: `Bearer ${verifyToken}` },
  });

  console.log("========================================");
  console.log("[SEED] Completed Successfully!");
  console.log(`  - CSV Users Registered : ${registeredCount} (${promotedCount} promoted to admin)`);
  console.log(`  - Baseline Orders Made : ${ordersSeeded}`);
  console.log(`  - Total Users in DB    : ${Array.isArray(usersRes.data) ? usersRes.data.length : "N/A"}`);
  console.log(`  - Total Orders in DB   : ${Array.isArray(ordersRes.data) ? ordersRes.data.length : "N/A"}`);
  console.log("========================================");
}

main().catch((err) => {
  console.error("[SEED] ERROR:", err.message);
  process.exit(1);
});
