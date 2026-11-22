#!/usr/bin/env python3
"""
Exports HW05 Markdown deliverables to print-ready PDFs using Pandoc + Edge/Chrome Headless.
- Preserves Vietnamese Unicode, GitHub-style tables, code blocks, and high-res embedded images.
- Replaces Mermaid flowchart blocks with a crisp native SVG diagram so PDFs render cleanly offline.
"""

import os
import re
import subprocess
import sys
import tempfile

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PANDOC = r"C:\Program Files\Pandoc\pandoc.exe"
BROWSER = next(
    (p for p in [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    ] if os.path.isfile(p)),
    None,
)

PRINT_CSS = """
<style>
  @page { size: A4; margin: 14mm 14mm 16mm 14mm; }
  body {
    font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.5;
    color: #0f172a;
    max-width: 100%;
    margin: 0;
  }
  h1 { font-size: 18pt; color: #0f172a; border-bottom: 2px solid #2563eb; padding-bottom: 6px; margin-top: 0; }
  h2 { font-size: 13.5pt; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 20px; page-break-after: avoid; }
  h3 { font-size: 11.5pt; color: #1e40af; margin-top: 14px; page-break-after: avoid; }
  blockquote {
    background: #f8fafc; border-left: 4px solid #2563eb;
    margin: 10px 0; padding: 8px 12px; color: #334155; font-size: 9.8pt;
  }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 9pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #1e293b; color: #f8fafc; font-weight: 600; }
  tr:nth-child(even) td { background: #f8fafc; }
  code {
    font-family: Consolas, "Courier New", monospace;
    font-size: 8.8pt;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    color: #0f172a;
  }
  pre {
    background: #0f172a; color: #e2e8f0; padding: 10px 12px;
    border-radius: 6px; overflow-x: auto; font-size: 8.2pt; line-height: 1.4;
    white-space: pre-wrap; word-wrap: break-word; page-break-inside: avoid;
  }
  pre code { background: transparent; color: inherit; padding: 0; }
  img {
    max-width: 100%; height: auto; display: block; margin: 10px auto;
    border: 1px solid #cbd5e1; border-radius: 4px; page-break-inside: avoid;
  }
  figure { margin: 10px 0 16px; text-align: center; page-break-inside: avoid; }
  figcaption { font-size: 8.8pt; color: #475569; margin-top: 4px; font-style: italic; }
  details { border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; margin: 6px 0; }
  summary { font-weight: 600; color: #1e40af; }
  hr { border: none; border-top: 1px solid #cbd5e1; margin: 16px 0; }
  .svg-box { margin: 12px 0; text-align: center; page-break-inside: avoid; }
</style>
"""

CPT_SVG_FLOWCHART = """
<div class="svg-box">
<svg viewBox="0 0 860 540" width="100%" xmlns="http://www.w3.org/2000/svg" style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;font-family:Segoe UI,Arial,sans-serif;">
  <defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569"/>
    </marker>
  </defs>
  <!-- Title -->
  <text x="430" y="24" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">Continuous Performance Testing (Tiered CPT &amp; Dual-Guard p95 Regression Flow)</text>

  <!-- Row 1: Push -> Classifier -->
  <rect x="290" y="38" width="280" height="36" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
  <text x="430" y="61" text-anchor="middle" font-size="11" font-weight="600" fill="#1e3a8a">Git Push / Pull Request on eshop-sut</text>
  <line x1="430" y1="74" x2="430" y2="96" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>

  <!-- Classifier -->
  <rect x="255" y="98" width="350" height="36" rx="6" fill="#fefce8" stroke="#ca8a04" stroke-width="1.5"/>
  <text x="430" y="121" text-anchor="middle" font-size="11" font-weight="600" fill="#854d0e">Change-Impact Classifier (git diff &amp; path risk rules)</text>

  <!-- 3 Tier Branches -->
  <line x1="300" y1="134" x2="130" y2="168" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="430" y1="134" x2="430" y2="168" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="560" y1="134" x2="720" y2="168" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>

  <!-- Tier 0 -->
  <rect x="25" y="170" width="210" height="44" rx="6" fill="#f1f5f9" stroke="#64748b" stroke-width="1.5"/>
  <text x="130" y="189" text-anchor="middle" font-size="10.5" font-weight="700" fill="#334155">Tier 0: Skip Perf Test (0s)</text>
  <text x="130" y="205" text-anchor="middle" font-size="9.5" fill="#475569">Docs / CSS / Static only -&gt; Pass</text>

  <!-- Tier 1 -->
  <rect x="305" y="170" width="250" height="44" rx="6" fill="#ecfeff" stroke="#0891b2" stroke-width="1.5"/>
  <text x="430" y="189" text-anchor="middle" font-size="10.5" font-weight="700" fill="#155e75">Tier 1: PR Quick Perf Gate (~90s)</text>
  <text x="430" y="205" text-anchor="middle" font-size="9.5" fill="#164e63">backend/server.js -&gt; 15 VUs, 60s</text>

  <!-- Tier 2 -->
  <rect x="595" y="170" width="245" height="44" rx="6" fill="#f5f3ff" stroke="#7c3aed" stroke-width="1.5"/>
  <text x="717" y="189" text-anchor="middle" font-size="10.5" font-weight="700" fill="#5b21b6">Tier 2: Nightly / Release (~22m)</text>
  <text x="717" y="205" text-anchor="middle" font-size="9.5" fill="#4c1d95">database.js / Release -&gt; Full Suite</text>

  <!-- Converge to Run Pipeline -->
  <line x1="430" y1="214" x2="430" y2="244" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>
  <line x1="717" y1="214" x2="570" y2="244" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>

  <!-- Run Pipeline -->
  <rect x="190" y="246" width="480" height="42" rx="6" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/>
  <text x="430" y="264" text-anchor="middle" font-size="10.5" font-weight="700" fill="#1e3a8a">Isolated SUT Container + Deterministic Seed + 10s Warm-Up</text>
  <text x="430" y="280" text-anchor="middle" font-size="9.5" fill="#1d4ed8">Execute k6 (--out csv) -&gt; Ground-Truth Parser (analyze_perf_logs.py)</text>

  <line x1="430" y1="288" x2="430" y2="314" stroke="#475569" stroke-width="1.5" marker-end="url(#arr)"/>

  <!-- Gate 1: 5xx & Dual-Guard -->
  <rect x="180" y="316" width="500" height="44" rx="6" fill="#fff7ed" stroke="#ea580c" stroke-width="1.5"/>
  <text x="430" y="335" text-anchor="middle" font-size="10.5" font-weight="700" fill="#9a3412">Dual-Guard Regression Check vs. 5-Run Rolling Baseline (B_p95)</text>
  <text x="430" y="351" text-anchor="middle" font-size="9.5" fill="#7c2d12">Fail if 5xx &gt; 0.5%  OR  (p95_cur &gt; 1.15 * B_p95  AND  p95_cur - B_p95 &gt; 20ms)</text>

  <!-- Branches from Dual-Guard -->
  <line x1="290" y1="360" x2="150" y2="402" stroke="#16a34a" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="195" y="382" font-size="9.5" font-weight="600" fill="#15803d">No Regression</text>

  <line x1="430" y1="360" x2="430" y2="402" stroke="#d97706" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="436" y="384" font-size="9.5" font-weight="600" fill="#b45309">Drift &gt; +25% vs Tag</text>

  <line x1="570" y1="360" x2="710" y2="402" stroke="#dc2626" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="650" y="382" font-size="9.5" font-weight="600" fill="#b91c1c">Breached</text>

  <!-- Pass -->
  <rect x="25" y="404" width="235" height="50" rx="6" fill="#f0fdf4" stroke="#16a34a" stroke-width="1.5"/>
  <text x="142" y="424" text-anchor="middle" font-size="10.5" font-weight="700" fill="#166534">PASS &amp; Update Baseline</text>
  <text x="142" y="442" text-anchor="middle" font-size="9.5" fill="#15803d">Post PR metrics + store 7KB JSON</text>

  <!-- Drift Warning -->
  <rect x="295" y="404" width="255" height="50" rx="6" fill="#fefce8" stroke="#ca8a04" stroke-width="1.5"/>
  <text x="422" y="424" text-anchor="middle" font-size="10.5" font-weight="700" fill="#854d0e">WARN: Release Anchor Drift</text>
  <text x="422" y="442" text-anchor="middle" font-size="9.5" fill="#713f12">Open Perf-Debt Issue (anti-creep)</text>

  <!-- Retry / Block -->
  <rect x="585" y="404" width="250" height="50" rx="6" fill="#fef2f2" stroke="#dc2626" stroke-width="1.5"/>
  <text x="710" y="424" text-anchor="middle" font-size="10.5" font-weight="700" fill="#991b1b">Auto-Retry 1x Confirmation</text>
  <text x="710" y="442" text-anchor="middle" font-size="9.5" fill="#7f1d1d">2nd breach -&gt; BLOCK MERGE + Alert</text>

  <!-- Retry loop arrow -->
  <path d="M 835 429 L 850 429 L 850 267 L 672 267" fill="none" stroke="#dc2626" stroke-width="1.3" stroke-dasharray="4,3" marker-end="url(#arr)"/>
  <text x="770" y="500" text-anchor="middle" font-size="9.5" fill="#475569">Dashed red line: 1x clean retry eliminates transient shared-runner noise before failing PR.</text>
</svg>
</div>
"""


def md_to_pdf(md_rel_path: str, pdf_rel_path: str, expand_details: bool = False) -> None:
    md_abs = os.path.join(BASE_DIR, md_rel_path)
    pdf_abs = os.path.join(BASE_DIR, pdf_rel_path)
    md_dir = os.path.dirname(md_abs)

    with open(md_abs, "r", encoding="utf-8") as f:
        text = f.read()

    # Replace Mermaid flowchart block with crisp inline SVG so headless browser needs no CDN
    text = re.sub(r"```mermaid\s+.*?```", CPT_SVG_FLOWCHART, text, flags=re.DOTALL)

    if expand_details:
        # Keep details closed or open cleanly; for huge AI_Audit, keep <details> clean
        pass

    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".md", dir=md_dir, delete=False) as tf_md:
        tf_md.write(text)
        tmp_md = tf_md.name

    tmp_html = tmp_md.replace(".md", ".html")
    try:
        res = subprocess.run(
            [
                PANDOC,
                tmp_md,
                "-f", "gfm",
                "-t", "html5",
                "--standalone",
                "--metadata", f"title={os.path.splitext(os.path.basename(pdf_rel_path))[0]}",
                "-o", tmp_html,
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            cwd=md_dir,
        )
        if res.returncode != 0:
            raise RuntimeError(f"Pandoc failed for {md_rel_path}:\n{res.stderr}")

        with open(tmp_html, "r", encoding="utf-8") as hf:
            html = hf.read()

        # Inject base href & print CSS
        base_uri = "file:///" + md_dir.replace("\\", "/") + "/"
        inject = f'<base href="{base_uri}" />\n{PRINT_CSS}\n</head>'
        html = html.replace("</head>", inject, 1)

        with open(tmp_html, "w", encoding="utf-8") as hf:
            hf.write(html)

        file_url = "file:///" + tmp_html.replace("\\", "/")
        cmd = [
            BROWSER,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--allow-file-access-from-files",
            "--no-pdf-header-footer",
            f"--print-to-pdf={pdf_abs}",
            file_url,
        ]
        br = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if br.returncode != 0 or not os.path.isfile(pdf_abs):
            raise RuntimeError(f"Browser PDF export failed for {pdf_rel_path}:\n{br.stderr}")

        size_kb = os.path.getsize(pdf_abs) / 1024.0
        print(f"[OK] Exported {pdf_rel_path} ({size_kb:.1f} KB)")
    finally:
        for p in (tmp_md, tmp_html):
            if os.path.isfile(p):
                os.remove(p)


def main():
    if not os.path.isfile(PANDOC):
        print("ERROR: pandoc not found", file=sys.stderr)
        sys.exit(1)
    if not BROWSER:
        print("ERROR: Edge/Chrome not found", file=sys.stderr)
        sys.exit(1)

    targets = [
        ("reports/HW05_Main_Report.md", "reports/HW05_Main_Report.pdf"),
        ("AI/AI_Critical.md", "AI/AI_Critical.pdf"),
        ("AI/AI_Audit.md", "AI/AI_Audit.pdf"),
    ]
    for src, dst in targets:
        md_to_pdf(src, dst)


if __name__ == "__main__":
    main()
