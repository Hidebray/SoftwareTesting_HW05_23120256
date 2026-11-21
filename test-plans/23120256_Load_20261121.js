/**
 * HW05 — Performance Testing (Task 1: Load Test)
 * Student: Tran Dai Hiep (23120256)
 * Workflow: Coupon Campaign, Discount Redemption & Order Monitoring
 *   - Auth-heavy   : POST /api/login, GET /api/users/me
 *   - Read-heavy   : GET /api/coupons, GET /api/admin/orders
 *   - Transactional: POST /api/admin/coupons, POST /api/apply-coupon,
 *                    POST /api/coupon-usage, DELETE /api/admin/coupons/:id
 *   - Verification : POST /api/apply-coupon (expects 404 after deletion)
 *
 * Report View 1 (Non-repeating): Per-Group & Assertion Check Trace HTML
 *   -> html-reports/load-trace-report/index.html (equivalent to JMeter View Results Tree)
 *
 * Run (Full):
 *   k6 run --out csv=raw-logs/23120256_Load_20261121.csv test-plans/23120256_Load_20261121.js
 * Run (Smoke):
 *   k6 run -e SMOKE=1 test-plans/23120256_Load_20261121.js
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Counter, Trend } from "k6/metrics";
import { buildTraceHtmlReport } from "../skills/performance-tester/resources/k6/report_view1_trace.js";

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

// Custom Group & Endpoint Metrics
const grpAuth = new Trend("grp_auth_duration", true);
const grpRead = new Trend("grp_read_duration", true);
const grpTx = new Trend("grp_transactional_duration", true);

const sutBugPercentDiscount = new Counter("sut_bug_percent_negative_discount");
const sutBugBoundaryStrictGt = new Counter("sut_bug_min_order_strict_gt");
const sutServer5xx = new Counter("sut_server_5xx_errors");

export const options = IS_SMOKE
  ? {
      vus: 2,
      iterations: 4,
      thresholds: {
        http_req_duration: ["p(95)<2000"],
      },
    }
  : {
      stages: [
        { duration: "30s", target: 20 }, // Smooth ramp-up to nominal load
        { duration: "2m", target: 20 },  // Sustained steady-state load
        { duration: "30s", target: 0 },  // Graceful ramp-down
      ],
      thresholds: {
        http_req_duration: ["p(95)<500", "p(99)<1000"],
        http_req_failed: ["rate<0.02"],
        grp_auth_duration: ["p(95)<400"],
        grp_read_duration: ["p(95)<400"],
        grp_transactional_duration: ["p(95)<600"],
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
  const uniqueCode = `${couponTpl.code_prefix}_L${__VU}_${__ITER}_${Date.now() % 100000}`;

  // =========================================================================
  // GROUP 1: AUTH-HEAVY (POST /api/login + GET /api/users/me)
  // =========================================================================
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
      "login: returns JWT token": (r) => {
        try {
          const b = r.json();
          return Boolean(b && b.token && b.user && b.user.id);
        } catch (_) {
          return false;
        }
      },
    });

    if (loginOk) {
      const body = loginRes.json();
      token = body.token;
      userId = body.user.id;
    } else {
      return;
    }

    const meRes = http.get(`${BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      tags: { group_type: "auth", endpoint: "get_users_me" },
    });
    grpAuth.add(meRes.timings.duration);
    track5xx(meRes);

    check(meRes, {
      "users/me: status is 200": (r) => r.status === 200,
      "users/me: email matches authenticated user": (r) => {
        try {
          return r.json().email === user.email;
        } catch (_) {
          return false;
        }
      },
    });
  });

  if (!token) {
    think(0.5, 1.0);
    return;
  }

  think(0.3, 0.8);

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // =========================================================================
  // GROUP 2: READ-HEAVY (GET /api/coupons + GET /api/admin/orders)
  // =========================================================================
  group("02_Read_Heavy", () => {
    const couponsRes = http.get(`${BASE_URL}/api/coupons`, {
      headers: authHeaders,
      tags: { group_type: "read", endpoint: "get_coupons" },
    });
    grpRead.add(couponsRes.timings.duration);
    track5xx(couponsRes);

    check(couponsRes, {
      "coupons: status is 200": (r) => r.status === 200,
      "coupons: returns non-empty array": (r) => {
        try {
          return Array.isArray(r.json()) && r.json().length > 0;
        } catch (_) {
          return false;
        }
      },
    });

    const ordersRes = http.get(`${BASE_URL}/api/admin/orders`, {
      headers: authHeaders,
      tags: { group_type: "read", endpoint: "get_admin_orders" },
    });
    grpRead.add(ordersRes.timings.duration);
    track5xx(ordersRes);

    check(ordersRes, {
      "admin/orders: status is 200": (r) => r.status === 200,
      "admin/orders: returns joined order rows": (r) => {
        try {
          const arr = r.json();
          return Array.isArray(arr) && arr.length >= 20;
        } catch (_) {
          return false;
        }
      },
    });
  });

  think(0.4, 0.9);

  // =========================================================================
  // GROUP 3: TRANSACTIONAL (Create -> Apply -> Record Usage -> Delete Coupon)
  // =========================================================================
  group("03_Transactional", () => {
    const minOrder = Number(couponTpl.min_order_amount);
    const discountVal = Number(couponTpl.discount_value);

    // 3.1 Create Campaign Coupon
    const createRes = http.post(
      `${BASE_URL}/api/admin/coupons`,
      JSON.stringify({
        code: uniqueCode,
        type: couponTpl.type,
        discount_value: discountVal,
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

    const createdOk = check(createRes, {
      "create-coupon: status is 200": (r) => r.status === 200,
      "create-coupon: returns new coupon id": (r) => {
        try {
          return Boolean(r.json().id);
        } catch (_) {
          return false;
        }
      },
    });

    if (createdOk) {
      createdCouponId = createRes.json().id;
    } else {
      return;
    }

    // 3.2 Validate & Apply Coupon
    const totalAmount = Number(redemption.total_amount);
    const isIntentionalBelow = totalAmount < minOrder;
    const isExactBoundary = totalAmount === minOrder;

    const applyParams = {
      headers: jsonHeaders,
      tags: { group_type: "transactional", endpoint: "post_apply_coupon" },
    };
    if (isIntentionalBelow || isExactBoundary) {
      applyParams.responseCallback = http.expectedStatuses(200, 400);
    }

    const applyRes = http.post(
      `${BASE_URL}/api/apply-coupon`,
      JSON.stringify({
        code: uniqueCode,
        total_amount: totalAmount,
        user_id: userId,
      }),
      applyParams
    );
    grpTx.add(applyRes.timings.duration);
    track5xx(applyRes);

    if (isIntentionalBelow) {
      check(applyRes, {
        "apply-coupon (below min): properly rejected with 400": (r) => r.status === 400,
      });
    } else if (isExactBoundary) {
      // Exposes server.js:379 bug (strict > instead of >=)
      if (applyRes.status === 400) {
        sutBugBoundaryStrictGt.add(1);
      }
      check(applyRes, {
        "apply-coupon (exact min boundary): accepted with 200 [SUT BUG: strict >]": (r) => r.status === 200,
      });
    } else {
      const applyOk = check(applyRes, {
        "apply-coupon (valid): status is 200": (r) => r.status === 200,
        "apply-coupon (valid): discount is positive & final < total [SUT BUG on percent]": (r) => {
          try {
            const b = r.json();
            const validMath = b.discount_amount > 0 && b.final_amount < totalAmount;
            if (!validMath && couponTpl.type === "percent") {
              sutBugPercentDiscount.add(1);
            }
            return validMath;
          } catch (_) {
            return false;
          }
        },
      });

      // 3.3 Record Coupon Usage (only when coupon application returned 200)
      if (applyRes.status === 200) {
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

        check(usageRes, {
          "coupon-usage: status is 200": (r) => r.status === 200,
          "coupon-usage: message confirms recorded": (r) => {
            try {
              return r.json().message === "Usage recorded";
            } catch (_) {
              return false;
            }
          },
        });
      }
      void applyOk;
    }

    // 3.4 Delete Campaign Coupon (always clean up created coupon)
    const delRes = http.del(`${BASE_URL}/api/admin/coupons/${createdCouponId}`, null, {
      headers: authHeaders,
      tags: { group_type: "transactional", endpoint: "delete_admin_coupon" },
    });
    grpTx.add(delRes.timings.duration);
    track5xx(delRes);

    check(delRes, {
      "delete-coupon: status is 200": (r) => r.status === 200,
    });
  });

  // =========================================================================
  // GROUP 4: VERIFICATION (Confirm revoked coupon returns HTTP 404)
  // =========================================================================
  if (createdCouponId) {
    group("04_Verification", () => {
      const verifyRes = http.post(
        `${BASE_URL}/api/apply-coupon`,
        JSON.stringify({
          code: uniqueCode,
          total_amount: 2000000,
          user_id: userId,
        }),
        {
          headers: jsonHeaders,
          responseCallback: http.expectedStatuses(404),
          tags: { group_type: "verification", endpoint: "verify_coupon_revoked" },
        }
      );
      track5xx(verifyRes);

      check(verifyRes, {
        "verify-revoked: deleted coupon returns 404": (r) => r.status === 404,
      });
    });
  }

  think(0.3, 0.8);
}

export function handleSummary(data) {
  const m = data.metrics || {};
  const d = m.http_req_duration?.values || {};
  const rps = m.http_reqs?.values?.rate || 0;
  const reqs = m.http_reqs?.values?.count || 0;
  const errPct = (m.http_req_failed?.values?.rate || 0) * 100;
  const chkPct = (m.checks?.values?.rate || 0) * 100;

  const textSummary = [
    "",
    "================ LOAD TEST SUMMARY (VIEW 1: TRACE HTML) ================",
    `  Total HTTP Requests  : ${reqs}`,
    `  Throughput (RPS)     : ${rps.toFixed(2)} req/s`,
    `  Latency (ms)         : avg=${(d.avg || 0).toFixed(2)} | p50=${(d.med || 0).toFixed(2)} | p95=${(d["p(95)"] || 0).toFixed(2)} | max=${(d.max || 0).toFixed(2)}`,
    `  Unexpected Err Rate  : ${errPct.toFixed(2)}%`,
    `  Checks Pass Rate     : ${chkPct.toFixed(2)}%`,
    `  SUT Bugs Triggered   : percent_neg=${m.sut_bug_percent_negative_discount?.values?.count || 0}, strict_gt=${m.sut_bug_min_order_strict_gt?.values?.count || 0}, 5xx=${m.sut_server_5xx_errors?.values?.count || 0}`,
    "  HTML Report Saved To : html-reports/load-trace-report/index.html",
    "========================================================================",
    "",
  ].join("\n");

  const out = { stdout: textSummary };
  if (!IS_SMOKE) {
    out["html-reports/load-trace-report/index.html"] = buildTraceHtmlReport(data, {
      title: "23120256 — HW05 Load Test Report (View 1: Trace & Check Detail)",
      scenario: "Load Test (0 -> 20 VUs, 2m hold)",
      workflow: "Coupon Campaign, Discount Redemption & Order Monitoring",
    });
  } else {
    out["html-reports/load-trace-report/smoke_preview.html"] = buildTraceHtmlReport(data, {
      title: "23120256 — Load Test Smoke Preview",
      scenario: "Smoke Dry-Run",
      workflow: "Coupon Campaign, Discount Redemption & Order Monitoring",
    });
  }
  return out;
}

