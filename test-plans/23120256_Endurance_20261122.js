/**
 * HW05 — Performance Testing (Task 1: Endurance / Soak Test — 12 Minutes)
 * Student: Tran Dai Hiep (23120256)
 * Workflow: Coupon Campaign, Discount Redemption & Order Monitoring
 * Purpose : Hold sustained moderate-high load (40 VUs for 11m steady, 12m total)
 *           to empirically determine hardware/SUT endurance thresholds
 *           (Max Stable RPS, p95 latency drift under unindexed coupon_usage growth,
 *           CPU ceiling, and Memory ceiling on TRAN_DAI_HIEP).
 *
 * Improvement applied from Stress run lesson (Skill v1.1 candidate):
 *   - Adds explicit `name` tag on dynamic `DELETE /api/admin/coupons/:id` URL
 *     to prevent k6 high-cardinality (>100k time series) memory bloat over 12 minutes!
 *
 * Run (Full 12m):
 *   powershell -ExecutionPolicy Bypass -File scripts/run_endurance.ps1
 * Run (Smoke):
 *   k6 run -e SMOKE=1 test-plans/23120256_Endurance_20261122.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Counter, Trend } from "k6/metrics";
import { buildAggregateHtmlReport } from "../skills/performance-tester/resources/k6/report_view3_aggregate.js";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const IS_SMOKE = __ENV.SMOKE === "1";

function parseCsvFile(relativePath) {
  const raw = open(relativePath).trim();
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

const staffUsers = new SharedArray("staffUsers", () =>
  parseCsvFile("../data/users.csv").filter((u) => u.account_type === "staff_pool")
);
const coupons = new SharedArray("coupons", () => parseCsvFile("../data/coupons.csv"));
const redemptions = new SharedArray("redemptions", () => parseCsvFile("../data/redemptions.csv"));

// Group & Endpoint Trends
const grpAuth = new Trend("grp_auth_heavy", true);
const grpRead = new Trend("grp_read_heavy", true);
const grpTx = new Trend("grp_transactional", true);

const epLogin = new Trend("ep_01_post_login", true);
const epUsersMe = new Trend("ep_02_get_users_me", true);
const epCoupons = new Trend("ep_03_get_coupons", true);
const epOrders = new Trend("ep_04_get_admin_orders", true);
const epCreateCoupon = new Trend("ep_05_post_admin_coupons", true);
const epApplyCoupon = new Trend("ep_06_post_apply_coupon", true);
const epCouponUsage = new Trend("ep_07_post_coupon_usage", true);
const epDeleteCoupon = new Trend("ep_08_delete_admin_coupon", true);
const epVerifyRevoked = new Trend("ep_09_verify_coupon_revoked", true);

const sutServer5xx = new Counter("sut_server_5xx_errors");
const sutBugPercentDiscount = new Counter("sut_bug_percent_negative_discount");

export const options = IS_SMOKE
  ? {
      vus: 2,
      iterations: 4,
    }
  : {
      stages: [
        { duration: "30s", target: 40 }, // Ramp up to sustained soak load
        { duration: "11m", target: 40 }, // Hold steady 40 VUs for 11 minutes
        { duration: "30s", target: 0 },  // Graceful ramp-down (Total = 12m00s)
      ],
      thresholds: {
        http_req_duration: ["p(95)<500"],
        http_req_failed: ["rate<0.01"],
      },
    };

function think(minSec, maxSec) {
  sleep(minSec + Math.random() * (maxSec - minSec));
}

function track5xx(res) {
  if (res.status === 0 || res.status >= 500) {
    sutServer5xx.add(1);
  }
}

export default function () {
  const user = staffUsers[(__VU - 1) % staffUsers.length];
  const couponTpl = coupons[(__VU + __ITER) % coupons.length];
  const redemption = redemptions[(__VU * 3 + __ITER) % redemptions.length];

  const jsonHeaders = { "Content-Type": "application/json" };
  let token = null;
  let userId = null;
  let createdCouponId = null;
  const uniqueCode = `${couponTpl.code_prefix}_E${__VU}_${__ITER}_${Date.now() % 100000}`;

  // 1. Auth-heavy
  group("01_Auth_Heavy", () => {
    const loginRes = http.post(
      `${BASE_URL}/api/login`,
      JSON.stringify({ email: user.email, password: user.password }),
      {
        headers: jsonHeaders,
        tags: { name: "POST /api/login", group_type: "auth", endpoint: "post_login" },
      }
    );
    epLogin.add(loginRes.timings.duration);
    grpAuth.add(loginRes.timings.duration);
    track5xx(loginRes);

    const ok = check(loginRes, { "login: status is 200": (r) => r.status === 200 });
    if (!ok) return;
    try {
      const body = loginRes.json();
      token = body.token;
      userId = body.user.id;
    } catch (_) {
      return;
    }

    const meRes = http.get(`${BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      tags: { name: "GET /api/users/me", group_type: "auth", endpoint: "get_users_me" },
    });
    epUsersMe.add(meRes.timings.duration);
    grpAuth.add(meRes.timings.duration);
    track5xx(meRes);
    check(meRes, { "users/me: status is 200": (r) => r.status === 200 });
  });

  if (!token) {
    think(0.3, 0.7);
    return;
  }

  think(0.25, 0.55);
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 2. Read-heavy
  group("02_Read_Heavy", () => {
    const couponsRes = http.get(`${BASE_URL}/api/coupons`, {
      headers: authHeaders,
      tags: { name: "GET /api/coupons", group_type: "read", endpoint: "get_coupons" },
    });
    epCoupons.add(couponsRes.timings.duration);
    grpRead.add(couponsRes.timings.duration);
    track5xx(couponsRes);
    check(couponsRes, { "coupons: status is 200": (r) => r.status === 200 });

    const ordersRes = http.get(`${BASE_URL}/api/admin/orders`, {
      headers: authHeaders,
      tags: { name: "GET /api/admin/orders", group_type: "read", endpoint: "get_admin_orders" },
    });
    epOrders.add(ordersRes.timings.duration);
    grpRead.add(ordersRes.timings.duration);
    track5xx(ordersRes);
    check(ordersRes, { "admin/orders: status is 200": (r) => r.status === 200 });
  });

  think(0.25, 0.55);

  // 3. Transactional
  group("03_Transactional", () => {
    const minOrder = Number(couponTpl.min_order_amount);
    const createRes = http.post(
      `${BASE_URL}/api/admin/coupons`,
      JSON.stringify({
        code: uniqueCode,
        type: couponTpl.type,
        discount_value: Number(couponTpl.discount_value),
        min_order_amount: minOrder,
        expired_at: couponTpl.expired_at,
        max_uses_per_user: Number(couponTpl.max_uses_per_user),
      }),
      {
        headers: authHeaders,
        tags: { name: "POST /api/admin/coupons", group_type: "transactional", endpoint: "post_admin_coupons" },
      }
    );
    epCreateCoupon.add(createRes.timings.duration);
    grpTx.add(createRes.timings.duration);
    track5xx(createRes);

    if (createRes.status === 200) {
      try {
        createdCouponId = createRes.json().id;
      } catch (_) {}
    }
    check(createRes, { "create-coupon: status is 200": (r) => r.status === 200 });
    if (!createdCouponId) return;

    const totalAmount = Number(redemption.total_amount);
    const expect400Allowed = totalAmount <= minOrder;
    const applyRes = http.post(
      `${BASE_URL}/api/apply-coupon`,
      JSON.stringify({ code: uniqueCode, total_amount: totalAmount, user_id: userId }),
      {
        headers: jsonHeaders,
        responseCallback: expect400Allowed ? http.expectedStatuses(200, 400) : http.expectedStatuses(200),
        tags: { name: "POST /api/apply-coupon", group_type: "transactional", endpoint: "post_apply_coupon" },
      }
    );
    epApplyCoupon.add(applyRes.timings.duration);
    grpTx.add(applyRes.timings.duration);
    track5xx(applyRes);

    if (applyRes.status === 200) {
      try {
        const b = applyRes.json();
        if (b.discount_amount <= 0 && couponTpl.type === "percent") {
          sutBugPercentDiscount.add(1);
        }
      } catch (_) {}

      const usageRes = http.post(
        `${BASE_URL}/api/coupon-usage`,
        JSON.stringify({ coupon_id: createdCouponId }),
        {
          headers: authHeaders,
          tags: { name: "POST /api/coupon-usage", group_type: "transactional", endpoint: "post_coupon_usage" },
        }
      );
      epCouponUsage.add(usageRes.timings.duration);
      grpTx.add(usageRes.timings.duration);
      track5xx(usageRes);
      check(usageRes, { "coupon-usage: status is 200": (r) => r.status === 200 });
    }

    // Explicit `name` tag prevents high-cardinality URL metric explosion during 12-min soak
    const delRes = http.del(`${BASE_URL}/api/admin/coupons/${createdCouponId}`, null, {
      headers: authHeaders,
      tags: { name: "DELETE /api/admin/coupons/:id", group_type: "transactional", endpoint: "delete_admin_coupon" },
    });
    epDeleteCoupon.add(delRes.timings.duration);
    grpTx.add(delRes.timings.duration);
    track5xx(delRes);
    check(delRes, { "delete-coupon: status is 200": (r) => r.status === 200 });
  });

  // 4. Verification
  if (createdCouponId) {
    group("04_Verification", () => {
      const verifyRes = http.post(
        `${BASE_URL}/api/apply-coupon`,
        JSON.stringify({ code: uniqueCode, total_amount: 2000000, user_id: userId }),
        {
          headers: jsonHeaders,
          responseCallback: http.expectedStatuses(404),
          tags: { name: "POST /api/apply-coupon (verify 404)", group_type: "verification", endpoint: "verify_coupon_revoked" },
        }
      );
      epVerifyRevoked.add(verifyRes.timings.duration);
      track5xx(verifyRes);
      check(verifyRes, { "verify-revoked: returns 404": (r) => r.status === 404 });
    });
  }

  think(0.25, 0.55);
}

export function handleSummary(data) {
  const m = data.metrics || {};
  const d = m.http_req_duration?.values || {};
  const rps = m.http_reqs?.values?.rate || 0;
  const reqs = m.http_reqs?.values?.count || 0;
  const errPct = (m.http_req_failed?.values?.rate || 0) * 100;

  const textSummary = [
    "",
    "============== ENDURANCE / SOAK TEST SUMMARY (12 MINUTES) ==============",
    `  Total HTTP Requests  : ${reqs}`,
    `  Sustained RPS        : ${rps.toFixed(2)} req/s`,
    `  Latency (ms)         : min=${(d.min || 0).toFixed(2)} | avg=${(d.avg || 0).toFixed(2)} | p50=${(d.med || 0).toFixed(2)} | p90=${(d["p(90)"] || 0).toFixed(2)} | p95=${(d["p(95)"] || 0).toFixed(2)} | max=${(d.max || 0).toFixed(2)}`,
    `  Unexpected Err Rate  : ${errPct.toFixed(2)}% (5xx/Net=${m.sut_server_5xx_errors?.values?.count || 0})`,
    `  Percent Bug Hits     : ${m.sut_bug_percent_negative_discount?.values?.count || 0}`,
    "  HTML Report Saved To : html-reports/endurance-soak-report/index.html",
    "========================================================================",
    "",
  ].join("\n");

  const out = { stdout: textSummary };
  if (!IS_SMOKE) {
    out["html-reports/endurance-soak-report/index.html"] = buildAggregateHtmlReport(data, {
      title: "23120256 — HW05 Endurance / Soak Test Report (40 VUs, 12 Minutes)",
      scenario: "Endurance / Soak Test (0 -> 40 VUs, 11m steady, 30s ramp-down)",
      workflow: "Coupon Campaign, Discount Redemption & Order Monitoring",
    });
  }
  return out;
}
