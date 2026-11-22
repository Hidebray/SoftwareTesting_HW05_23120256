/**
 * Agent Skill Reusability Demonstration (Skill `performance-tester` v1.1)
 * Student : Tran Dai Hiep (23120256)
 * Target  : Completely NEW Endpoint Group (Pool C — FR-15 & FR-16)
 *           "Admin Product Catalog & Bulk CSV Import"
 *   1. Auth-heavy   : POST /api/login
 *   2. Read-heavy   : GET /api/products
 *   3. Transactional: POST /api/products -> PUT /api/products/:id
 *                     -> POST /api/admin/import-products (batch insert of 3 products)
 *                     -> DELETE /api/products/:id (cleanup)
 *
 * Demonstrates ALL v1.1 Skill standards:
 *   - SharedArray CSV data-driven loading
 *   - Explicit `name` tags on dynamic `:id` URLs (v1.1 High-Cardinality Guard)
 *   - Group & Endpoint Trends + Offline Aggregate HTML Report
 *   - Compatible with universal `scripts/analyze_perf_logs.py`
 *
 * Run:
 *   k6 run --out csv=skill-demo/report/skill_demo_raw.csv skill-demo/23120256_SkillDemo_ProductImport.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Counter, Trend } from "k6/metrics";
import { buildAggregateHtmlReport } from "../skills/performance-tester/resources/k6/report_view3_aggregate.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

function parseCsv(relPath) {
  const raw = open(relPath).trim();
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] !== undefined ? cols[i] : "";
    });
    return obj;
  });
}

const staffUsers = new SharedArray("demoStaff", () =>
  parseCsv("../data/users.csv").filter((u) => u.account_type === "staff_pool")
);
const productsData = new SharedArray("demoProducts", () => parseCsv("./data/products_demo.csv"));

const grpAuth = new Trend("grp_auth_heavy", true);
const grpRead = new Trend("grp_read_heavy", true);
const grpTx = new Trend("grp_transactional", true);

const epLogin = new Trend("ep_01_post_login", true);
const epListProducts = new Trend("ep_02_get_products", true);
const epCreateProduct = new Trend("ep_03_post_products", true);
const epUpdateProduct = new Trend("ep_04_put_product_id", true);
const epBulkImport = new Trend("ep_05_post_bulk_import", true);
const epDeleteProduct = new Trend("ep_06_delete_product_id", true);
const err5xx = new Counter("sut_server_5xx_errors");

export const options = {
  stages: [
    { duration: "5s", target: 8 },
    { duration: "15s", target: 8 },
    { duration: "5s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<400"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const user = staffUsers[(__VU - 1) % staffUsers.length];
  const prod = productsData[(__VU + __ITER) % productsData.length];
  const jsonHeaders = { "Content-Type": "application/json" };
  let token = null;
  let createdId = null;

  // 1. Auth-heavy
  group("01_Auth_Heavy", () => {
    const res = http.post(
      `${BASE_URL}/api/login`,
      JSON.stringify({ email: user.email, password: user.password }),
      {
        headers: jsonHeaders,
        tags: { name: "POST /api/login", group_type: "auth", endpoint: "post_login" },
      }
    );
    epLogin.add(res.timings.duration);
    grpAuth.add(res.timings.duration);
    if (res.status === 0 || res.status >= 500) err5xx.add(1);

    const ok = check(res, { "login: status is 200": (r) => r.status === 200 });
    if (ok) {
      try { token = res.json().token; } catch (_) {}
    }
  });

  if (!token) {
    sleep(0.3);
    return;
  }

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 2. Read-heavy
  group("02_Read_Heavy", () => {
    const listRes = http.get(`${BASE_URL}/api/products`, {
      tags: { name: "GET /api/products", group_type: "read", endpoint: "get_products" },
    });
    epListProducts.add(listRes.timings.duration);
    grpRead.add(listRes.timings.duration);
    if (listRes.status === 0 || listRes.status >= 500) err5xx.add(1);
    check(listRes, {
      "products: status is 200": (r) => r.status === 200,
      "products: returns array": (r) => {
        try { return Array.isArray(r.json()) && r.json().length >= 5; } catch (_) { return false; }
      },
    });
  });

  sleep(0.2);

  // 3. Transactional (Create -> Update -> Bulk CSV Import -> Delete)
  group("03_Transactional", () => {
    const uniqueName = `${prod.name_prefix} #${__VU}-${__ITER}`;
    const createRes = http.post(
      `${BASE_URL}/api/products`,
      JSON.stringify({
        name: uniqueName,
        price: Number(prod.price),
        description: prod.description,
        imageUrl: prod.imageUrl,
        category_id: Number(prod.category_id),
      }),
      {
        headers: authHeaders,
        tags: { name: "POST /api/products", group_type: "transactional", endpoint: "post_products" },
      }
    );
    epCreateProduct.add(createRes.timings.duration);
    grpTx.add(createRes.timings.duration);
    if (createRes.status === 0 || createRes.status >= 500) err5xx.add(1);

    if (createRes.status === 200) {
      try { createdId = createRes.json().id; } catch (_) {}
    }
    check(createRes, { "create-product: status is 200": (r) => r.status === 200 });

    if (createdId) {
      // v1.1 High-Cardinality Guard: explicit static `name` tag on dynamic `:id`
      const updRes = http.put(
        `${BASE_URL}/api/products/${createdId}`,
        JSON.stringify({
          name: `${uniqueName} (Updated)`,
          price: Number(prod.updated_price),
          description: prod.description,
          imageUrl: prod.imageUrl,
          category_id: Number(prod.category_id),
        }),
        {
          headers: authHeaders,
          tags: { name: "PUT /api/products/:id", group_type: "transactional", endpoint: "put_product_id" },
        }
      );
      epUpdateProduct.add(updRes.timings.duration);
      grpTx.add(updRes.timings.duration);
      if (updRes.status === 0 || updRes.status >= 500) err5xx.add(1);
      check(updRes, { "update-product: status is 200": (r) => r.status === 200 });
    }

    // Bulk import 3 items from CSV
    const batchPayload = [0, 1, 2].map((offset) => {
      const p = productsData[(__VU + __ITER + offset) % productsData.length];
      return {
        name: `Bulk ${p.name_prefix} ${__VU}-${__ITER}-${offset}`,
        price: Number(p.price),
        description: p.description,
        imageUrl: p.imageUrl,
        category_id: Number(p.category_id),
      };
    });

    const importRes = http.post(
      `${BASE_URL}/api/admin/import-products`,
      JSON.stringify({ products: batchPayload }),
      {
        headers: authHeaders,
        tags: { name: "POST /api/admin/import-products", group_type: "transactional", endpoint: "post_bulk_import" },
      }
    );
    epBulkImport.add(importRes.timings.duration);
    grpTx.add(importRes.timings.duration);
    if (importRes.status === 0 || importRes.status >= 500) err5xx.add(1);
    check(importRes, {
      "bulk-import: status is 200": (r) => r.status === 200,
      "bulk-import: inserted 3 products": (r) => {
        try { return r.json().inserted === 3; } catch (_) { return false; }
      },
    });

    if (createdId) {
      const delRes = http.del(`${BASE_URL}/api/products/${createdId}`, null, {
        headers: authHeaders,
        tags: { name: "DELETE /api/products/:id", group_type: "transactional", endpoint: "delete_product_id" },
      });
      epDeleteProduct.add(delRes.timings.duration);
      grpTx.add(delRes.timings.duration);
      if (delRes.status === 0 || delRes.status >= 500) err5xx.add(1);
      check(delRes, { "delete-product: status is 200": (r) => r.status === 200 });
    }
  });

  sleep(0.3);
}

export function handleSummary(data) {
  const m = data.metrics || {};
  const d = m.http_req_duration?.values || {};
  const text = [
    "",
    "====== AGENT SKILL v1.1 REUSE DEMO — PRODUCT CATALOG & BULK IMPORT ======",
    `  Total HTTP Requests : ${m.http_reqs?.values?.count || 0}`,
    `  Throughput (RPS)    : ${(m.http_reqs?.values?.rate || 0).toFixed(2)} req/s`,
    `  Latency (ms)        : avg=${(d.avg || 0).toFixed(2)} | p50=${(d.med || 0).toFixed(2)} | p95=${(d["p(95)"] || 0).toFixed(2)} | max=${(d.max || 0).toFixed(2)}`,
    `  Unexpected Errors   : ${((m.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%`,
    "  HTML Report         : skill-demo/report/index.html",
    "=========================================================================",
    "",
  ].join("\n");

  return {
    stdout: text,
    "skill-demo/report/index.html": buildAggregateHtmlReport(data, {
      title: "23120256 — Agent Skill v1.1 Reuse Demo (Product Catalog & Bulk CSV Import)",
      scenario: "Skill Reuse Demo (8 VUs, 25s)",
      workflow: "Admin Product Catalog & Bulk CSV Import (Pool C FR-15 & FR-16)",
    }),
  };
}
