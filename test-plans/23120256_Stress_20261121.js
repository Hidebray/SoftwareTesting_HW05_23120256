/**
 * HW05 — Performance Testing (Task 1: Stress Test)
 * Student: Tran Dai Hiep (23120256)
 * Workflow: Coupon Campaign, Discount Redemption & Order Monitoring
 *   + Dedicated parallel `lockout_probe` scenario testing account lockout behavior
 *     on isolated accounts (locktest01..03@eshop.com) without polluting main pool.
 *
 * Report View 2 (Non-repeating): k6 Built-in Web Dashboard Time-Series HTML
 *   -> html-reports/stress-dashboard-report/index.html (equivalent to JMeter Summary Report)
 *
 * Run (Full — with Web Dashboard export + full raw CSV):
 *   $env:K6_WEB_DASHBOARD="true"
 *   $env:K6_WEB_DASHBOARD_EXPORT="html-reports/stress-dashboard-report/index.html"
 *   k6 run --out csv=raw-logs/23120256_Stress_20261121.csv test-plans/23120256_Stress_20261121.js
 *
 * Run (Smoke):
 *   k6 run -e SMOKE=1 test-plans/23120256_Stress_20261121.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Counter, Trend } from "k6/metrics";

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
const lockoutUsers = new SharedArray("lockoutUsers", () =>
  parseCsvFile("../data/users.csv").filter((u) => u.account_type === "lockout_probe")
);
const coupons = new SharedArray("coupons", () => parseCsvFile("../data/coupons.csv"));
const redemptions = new SharedArray("redemptions", () => parseCsvFile("../data/redemptions.csv"));

// Custom Metrics
const grpAuth = new Trend("grp_auth_duration", true);
const grpRead = new Trend("grp_read_duration", true);
const grpTx = new Trend("grp_transactional_duration", true);

const sutServer5xx = new Counter("sut_server_5xx_errors");
const sutBugPercentDiscount = new Counter("sut_bug_percent_negative_discount");
const lockout401Count = new Counter("lockout_probe_401_count");
const lockout403Count = new Counter("lockout_probe_403_triggered");
const sutBugEarlyLockout = new Counter("sut_bug_early_lockout_on_2nd_fail");

export const options = IS_SMOKE
  ? {
      scenarios: {
        stress_workflow: {
          executor: "shared-iterations",
          exec: "mainWorkflow",
          vus: 2,
          iterations: 4,
        },
        lockout_behavior_probe: {
          executor: "per-vu-iterations",
          exec: "lockoutProbe",
          vus: 1,
          iterations: 1,
          startTime: "1s",
        },
      },
    }
  : {
      scenarios: {
        stress_workflow: {
          executor: "ramping-vus",
          exec: "mainWorkflow",
          startVUs: 0,
          stages: [
            { duration: "45s", target: 20 },  // Stage 1: Baseline load
            { duration: "45s", target: 50 },  // Stage 2: Moderate stress
            { duration: "45s", target: 100 }, // Stage 3: High concurrency
            { duration: "45s", target: 150 }, // Stage 4: Severe write contention
            { duration: "45s", target: 200 }, // Stage 5: Breaking-point push
            { duration: "30s", target: 0 },   // Stage 6: Recovery ramp-down
          ],
          gracefulRampDown: "15s",
        },
        lockout_behavior_probe: {
          executor: "per-vu-iterations",
          exec: "lockoutProbe",
          vus: 3,
          iterations: 1,
          startTime: "30s",
        },
      },
      thresholds: {
        // Stress test intentionally pushes past comfort zone; thresholds flag breaking point
        http_req_duration: ["p(95)<1500"],
        http_req_failed: ["rate<0.10"],
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

export function mainWorkflow() {
  const user = staffUsers[(__VU - 1) % staffUsers.length];
  const couponTpl = coupons[(__VU + __ITER) % coupons.length];
  const redemption = redemptions[(__VU * 3 + __ITER) % redemptions.length];

  const jsonHeaders = { "Content-Type": "application/json" };
  let token = null;
  let userId = null;
  let createdCouponId = null;
  const uniqueCode = `${couponTpl.code_prefix}_S${__VU}_${__ITER}_${Date.now() % 100000}`;

  // 1. Auth-heavy
  group("01_Auth_Heavy", () => {
    const loginRes = http.post(
      `${BASE_URL}/api/login`,
      JSON.stringify({ email: user.email, password: user.password }),
      {
        headers: jsonHeaders,
        tags: { group_type: "auth", endpoint: "post_login" },
      }
    );
    grpAuth.add(loginRes.timings.duration);
    track5xx(loginRes);

    const loginOk = check(loginRes, {
      "login: status is 200": (r) => r.status === 200,
      "login: JWT issued": (r) => {
        try {
          return Boolean(r.json().token);
        } catch (_) {
          return false;
        }
      },
    });
    if (!loginOk) return;

    const body = loginRes.json();
    token = body.token;
    userId = body.user.id;

    const meRes = http.get(`${BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      tags: { group_type: "auth", endpoint: "get_users_me" },
    });
    grpAuth.add(meRes.timings.duration);
    track5xx(meRes);
    check(meRes, { "users/me: status is 200": (r) => r.status === 200 });
  });

  if (!token) {
    think(0.3, 0.6);
    return;
  }

  think(0.2, 0.4);
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 2. Read-heavy
  group("02_Read_Heavy", () => {
    const couponsRes = http.get(`${BASE_URL}/api/coupons`, {
      headers: authHeaders,
      tags: { group_type: "read", endpoint: "get_coupons" },
    });
    grpRead.add(couponsRes.timings.duration);
    track5xx(couponsRes);
    check(couponsRes, { "coupons: status is 200": (r) => r.status === 200 });

    const ordersRes = http.get(`${BASE_URL}/api/admin/orders`, {
      headers: authHeaders,
      tags: { group_type: "read", endpoint: "get_admin_orders" },
    });
    grpRead.add(ordersRes.timings.duration);
    track5xx(ordersRes);
    check(ordersRes, { "admin/orders: status is 200": (r) => r.status === 200 });
  });

  think(0.2, 0.4);

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
        tags: { group_type: "transactional", endpoint: "post_admin_coupons" },
      }
    );
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
        tags: { group_type: "transactional", endpoint: "post_apply_coupon" },
      }
    );
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
          tags: { group_type: "transactional", endpoint: "post_coupon_usage" },
        }
      );
      grpTx.add(usageRes.timings.duration);
      track5xx(usageRes);
      check(usageRes, { "coupon-usage: status is 200": (r) => r.status === 200 });
    }

    const delRes = http.del(`${BASE_URL}/api/admin/coupons/${createdCouponId}`, null, {
      headers: authHeaders,
      tags: { group_type: "transactional", endpoint: "delete_admin_coupon" },
    });
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
          tags: { group_type: "verification", endpoint: "verify_coupon_revoked" },
        }
      );
      track5xx(verifyRes);
      check(verifyRes, { "verify-revoked: returns 404": (r) => r.status === 404 });
    });
  }

  think(0.1, 0.4);
}

/**
 * Isolated Account-Lockout Probe:
 * Sends 4 consecutive wrong-password logins on dedicated locktest01..03 accounts.
 * Because server.js:54 increments login_attempts by +2 instead of +1,
 * attempt #3 ALREADY gets HTTP 403 (locked after 2 fails instead of 3!).
 */
export function lockoutProbe() {
  const probe = lockoutUsers[(__VU - 1) % lockoutUsers.length];
  const headers = { "Content-Type": "application/json" };

  group("05_Lockout_Probe", () => {
    for (let attempt = 1; attempt <= 4; attempt++) {
      const res = http.post(
        `${BASE_URL}/api/login`,
        JSON.stringify({ email: probe.email, password: probe.wrong_password }),
        {
          headers,
          responseCallback: http.expectedStatuses(401, 403),
          tags: { group_type: "auth", endpoint: "post_login_lockout_probe" },
        }
      );
      grpAuth.add(res.timings.duration);
      track5xx(res);

      if (res.status === 401) lockout401Count.add(1);
      if (res.status === 403) lockout403Count.add(1);

      if (attempt === 3 && res.status === 403) {
        sutBugEarlyLockout.add(1);
      }

      check(res, {
        [`lockout attempt #${attempt}: returns 401 or 403`]: (r) => r.status === 401 || r.status === 403,
      });
      sleep(0.3);
    }
  });
}

// Note: Intentionally omit handleSummary so k6's native CLI Summary + Built-in Web Dashboard
// (K6_WEB_DASHBOARD_EXPORT=html-reports/stress-dashboard-report/index.html) generates View 2 cleanly.

