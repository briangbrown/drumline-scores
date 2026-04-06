#!/usr/bin/env python3
"""
generate_report.py

Weekly GitHub work report generator for pickleball-lab.

Collects the past 7 days of GitHub activity (commits + file lists, issues,
PRs), estimates hours worked from commit sessions, fetches Codespaces billing
and Anthropic API usage where available, then uses Claude to write narrative
sections and assembles them into an HTML email template.

The email template (report_template.html) lives next to this script and
defines the consistent visual structure. Claude generates only the prose
sections (summary, productivity insights, architecture notes) while all
data-driven content (tables, stats) is populated directly by this script.

Required GitHub Actions secrets (see README.md for setup):
  REPORT_GITHUB_PAT    – PAT with repo + read:user + read:org + codespace scopes
  ANTHROPIC_API_KEY    – Standard API key (sk-ant-api…) used to call Claude
  ANTHROPIC_ADMIN_KEY  – Admin API key (sk-ant-admin…) for usage/cost reports;
                         optional — without it the report notes data is unavailable
  GMAIL_ADDRESS        – Sender Gmail address
  GMAIL_APP_PASSWORD   – Gmail App Password (not the account password)
  RECIPIENT_EMAIL      – Recipient address

Environment variables with defaults (no secret needed):
  GITHUB_REPO          – Repository in owner/name format
                         (default: briangbrown/drumline-scores)
"""

from __future__ import annotations

import json
import logging
import os
import re
import smtplib
import sys
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

GITHUB_PAT: str = os.environ.get("REPORT_GITHUB_PAT", "")
GITHUB_REPO: str = os.environ.get("GITHUB_REPO", "briangbrown/drumline-scores")
ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
GMAIL_ADDRESS: str = os.environ.get("GMAIL_ADDRESS", "")
GMAIL_APP_PASSWORD: str = os.environ.get("GMAIL_APP_PASSWORD", "")
RECIPIENT_EMAIL: str = os.environ.get("RECIPIENT_EMAIL", "")

OWNER, REPO = GITHUB_REPO.split("/", 1)

# Commits separated by more than this many hours start a new work session.
SESSION_GAP_HOURS: int = 1
# Extra minutes added to each session to account for non-commit work.
SESSION_BUFFER_MINUTES: int = 10

CLAUDE_MODEL: str = "claude-sonnet-4-6"

# Colorado timezone for session breakdown display
MOUNTAIN_TZ = ZoneInfo("America/Denver")

# Template lives next to this script
TEMPLATE_PATH = Path(__file__).parent / "report_template.html"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Commit type classification
# ---------------------------------------------------------------------------

# Maps commit-message prefix patterns to human-readable category labels.
COMMIT_TYPE_PATTERNS: list[tuple[str, str]] = [
    (r"^feat", "Features"),
    (r"^fix", "Bug Fixes"),
    (r"^refactor", "Refactors"),
    (r"^docs", "Documentation"),
    (r"^test", "Tests"),
    (r"^chore", "Chores"),
    (r"^style", "Style"),
    (r"^perf", "Performance"),
    (r"^ci", "CI/CD"),
    (r"^build", "Build"),
]


def _classify_commit(message: str) -> str:
    """Return a category label for a commit message based on conventional prefixes."""
    lower = message.lower().strip()
    for pattern, label in COMMIT_TYPE_PATTERNS:
        if re.match(pattern, lower):
            return label
    # Heuristic fallbacks for non-conventional messages
    if any(kw in lower for kw in ["merge", "merge pull request"]):
        return "Merges"
    if any(kw in lower for kw in ["readme", "doc", "architecture"]):
        return "Documentation"
    if any(kw in lower for kw in ["test", "spec"]):
        return "Tests"
    return "Other"


# ---------------------------------------------------------------------------
# GitHub API helpers
# ---------------------------------------------------------------------------


def _gh_headers() -> dict[str, str]:
    h: dict[str, str] = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if GITHUB_PAT:
        h["Authorization"] = f"Bearer {GITHUB_PAT}"
    return h


def _gh_get_paged(url: str, params: dict[str, str] | None = None) -> list[dict]:
    """Fetch all pages from a GitHub list endpoint and return the combined list."""
    results: list[dict] = []
    current_url: str = url
    current_params = params
    while current_url:
        resp = requests.get(
            current_url, headers=_gh_headers(), params=current_params, timeout=30
        )
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list):
            results.extend(data)
        else:
            return [data]
        current_url = resp.links.get("next", {}).get("url", "")
        current_params = None  # Already encoded in the next-page URL
    return results


def _gh_get(url: str) -> dict:
    """Fetch a single GitHub API resource."""
    resp = requests.get(url, headers=_gh_headers(), timeout=30)
    resp.raise_for_status()
    result = resp.json()
    return result if isinstance(result, dict) else {}


# ---------------------------------------------------------------------------
# Data collection
# ---------------------------------------------------------------------------


def collect_commits(since: datetime, until: datetime) -> list[dict]:
    log.info("Fetching commits…")
    raw = _gh_get_paged(
        f"https://api.github.com/repos/{OWNER}/{REPO}/commits",
        params={
            "since": since.isoformat(),
            "until": until.isoformat(),
            "per_page": "100",
        },
    )

    commits: list[dict] = []
    for item in raw:
        sha: str = item.get("sha", "")
        commit_data: dict = item.get("commit", {})
        # First line of commit message only
        message: str = commit_data.get("message", "").split("\n")[0].strip()
        timestamp: str = commit_data.get("author", {}).get("date", "")
        author: str = commit_data.get("author", {}).get("name", "unknown")

        files: list[str] = []
        try:
            detail = _gh_get(
                f"https://api.github.com/repos/{OWNER}/{REPO}/commits/{sha}"
            )
            files = [f["filename"] for f in detail.get("files", [])]
        except Exception as exc:
            log.warning("Could not fetch file list for %s: %s", sha[:7], exc)

        commits.append(
            {
                "sha": sha[:7],
                "message": message,
                "timestamp": timestamp,
                "author": author,
                "files": files,
                "files_changed": len(files),
            }
        )

    log.info("  → %d commits", len(commits))
    return commits


def collect_issues(since: datetime) -> dict[str, list[dict]]:
    log.info("Fetching issues…")
    raw = _gh_get_paged(
        f"https://api.github.com/repos/{OWNER}/{REPO}/issues",
        params={"state": "all", "since": since.isoformat(), "per_page": "100"},
    )

    # The /issues endpoint includes PRs; exclude them
    issues = [i for i in raw if "pull_request" not in i]
    since_str = since.isoformat()

    opened = [i for i in issues if (i.get("created_at") or "") >= since_str]
    closed = [
        i
        for i in issues
        if i.get("state") == "closed"
        and (i.get("closed_at") or "") >= since_str
    ]

    log.info("  → %d opened, %d closed", len(opened), len(closed))
    return {
        "opened": [{"number": i["number"], "title": i["title"]} for i in opened],
        "closed": [{"number": i["number"], "title": i["title"]} for i in closed],
    }


def collect_prs(since: datetime) -> list[dict]:
    log.info("Fetching pull requests…")
    raw = _gh_get_paged(
        f"https://api.github.com/repos/{OWNER}/{REPO}/pulls",
        params={"state": "all", "per_page": "100"},
    )
    since_str = since.isoformat()
    prs = [
        {
            "number": pr["number"],
            "title": pr["title"],
            "state": pr["state"],
            "created_at": pr.get("created_at"),
            "merged_at": pr.get("merged_at"),
        }
        for pr in raw
        if (pr.get("updated_at") or "") >= since_str
    ]
    log.info("  → %d PRs", len(prs))
    return prs


def collect_codespaces_billing() -> dict | None:
    """Fetch Codespaces info for the authenticated user.

    GitHub's per-user billing cost endpoint is not available via the REST API
    for personal accounts.  We use GET /user/codespaces instead, which returns
    the list of codespaces with machine type and last-used timestamps — enough
    to give a useful snapshot in the report.
    """
    log.info("Fetching Codespaces info…")
    try:
        resp = requests.get(
            "https://api.github.com/user/codespaces",
            headers=_gh_headers(),
            timeout=30,
        )
        if resp.status_code != 200:
            log.warning(
                "  → Codespaces unavailable (HTTP %d)",
                resp.status_code,
            )
            return None

        raw: list[dict] = resp.json().get("codespaces", [])
        spaces = [
            {
                "name": cs.get("display_name") or cs.get("name"),
                "state": cs.get("state"),
                "machine": (cs.get("machine") or {}).get("display_name"),
                "created_at": cs.get("created_at"),
                "last_used_at": cs.get("last_used_at"),
            }
            for cs in raw
        ]
        log.info("  → %d codespace(s) found", len(spaces))
        return {
            "codespaces": spaces,
            "note": (
                "Exact billing cost is not available via the GitHub REST API "
                "for personal accounts. Check github.com/settings/billing for usage."
            ),
        }
    except Exception as exc:
        log.warning("  → Codespaces error: %s", exc)
        return None


def collect_anthropic_usage(since: datetime, until: datetime) -> dict | None:
    """Fetch Anthropic API token usage and costs for the reporting window.

    Requires two distinct key types; both are optional:

    ANTHROPIC_API_KEY     – standard sk-ant-api… key.  Used by the script to
                            call Claude for report generation.  Cannot access
                            usage or cost reports.

    ANTHROPIC_ADMIN_KEY   – admin sk-ant-admin… key provisioned at
                            platform.claude.com → Settings → Admin API keys.
                            Required for the usage_report/messages and
                            cost_report endpoints.

    Claude.ai Max / Pro subscription usage is a completely separate billing
    system and has no REST API — it cannot be retrieved programmatically.
    """
    log.info("Fetching Anthropic API usage…")

    admin_key: str = os.environ.get("ANTHROPIC_ADMIN_KEY", "")

    if not admin_key:
        log.warning(
            "  → ANTHROPIC_ADMIN_KEY not set; skipping usage. "
            "Provision an admin key at platform.claude.com → Settings → Admin API keys."
        )
        return {
            "available": False,
            "reason": (
                "ANTHROPIC_ADMIN_KEY secret not configured. "
                "Usage and cost data require an Admin API key (sk-ant-admin…) "
                "separate from the standard API key. "
                "Provision one at platform.claude.com → Settings → Admin API keys. "
                "Note: Claude.ai Max subscription usage has no REST API and cannot "
                "be retrieved programmatically."
            ),
        }

    if not admin_key.startswith("sk-ant-admin"):
        log.warning(
            "  → ANTHROPIC_ADMIN_KEY looks like a standard API key. "
            "Usage endpoints require an admin key."
        )
        return {
            "available": False,
            "reason": (
                "The provided ANTHROPIC_ADMIN_KEY does not look like an admin key "
                f"(got prefix '{admin_key[:14]}…'). "
                "Admin keys start with 'sk-ant-admin' and are provisioned separately "
                "at platform.claude.com → Settings → Admin API keys."
            ),
        }

    headers = {
        "x-api-key": admin_key,
        "anthropic-version": "2023-06-01",
    }
    starting_at = since.strftime("%Y-%m-%dT%H:%M:%SZ")
    ending_at = until.strftime("%Y-%m-%dT%H:%M:%SZ")
    base = "https://api.anthropic.com/v1/organizations"

    result: dict = {"available": True}

    # --- Token usage (grouped by model, daily buckets) ---
    try:
        resp = requests.get(
            f"{base}/usage_report/messages",
            headers=headers,
            params={
                "starting_at": starting_at,
                "ending_at": ending_at,
                "bucket_width": "1d",
                "group_by[]": "model",
            },
            timeout=30,
        )
        if resp.status_code == 200:
            payload = resp.json()
            # Flatten across all daily buckets into per-model totals
            totals: dict[str, dict[str, int]] = {}
            for bucket in payload.get("data", []):
                for row in bucket.get("results", []):
                    model = row.get("model") or "unknown"
                    entry = totals.setdefault(
                        model,
                        {
                            "uncached_input_tokens": 0,
                            "cache_read_input_tokens": 0,
                            "output_tokens": 0,
                        },
                    )
                    entry["uncached_input_tokens"] += row.get("uncached_input_tokens") or 0
                    entry["cache_read_input_tokens"] += row.get("cache_read_input_tokens") or 0
                    entry["output_tokens"] += row.get("output_tokens") or 0
            result["token_usage_by_model"] = totals
            log.info("  → Token usage collected (%d model(s))", len(totals))
        else:
            log.warning(
                "  → usage_report/messages HTTP %d",
                resp.status_code,
            )
            result["token_usage_error"] = f"HTTP {resp.status_code}"
    except Exception as exc:
        log.warning("  → Token usage error: %s", exc)
        result["token_usage_error"] = str(exc)

    # --- Cost report (daily, no extra grouping needed for a weekly total) ---
    try:
        resp = requests.get(
            f"{base}/cost_report",
            headers=headers,
            params={
                "starting_at": starting_at,
                "ending_at": ending_at,
                "bucket_width": "1d",
            },
            timeout=30,
        )
        if resp.status_code == 200:
            payload = resp.json()
            # Sum all cost rows; amount is a decimal string in USD cents
            total_cents = 0.0
            by_type: dict[str, float] = {}
            for bucket in payload.get("data", []):
                for row in bucket.get("results", []):
                    cents = float(row.get("amount") or 0)
                    total_cents += cents
                    cost_type = row.get("cost_type") or "other"
                    by_type[cost_type] = by_type.get(cost_type, 0.0) + cents
            result["total_cost_usd"] = round(total_cents / 100, 4)
            result["cost_by_type_usd"] = {k: round(v / 100, 4) for k, v in by_type.items()}
            log.info("  → Cost report collected ($%.4f USD)", result["total_cost_usd"])
        else:
            log.warning(
                "  → cost_report HTTP %d",
                resp.status_code,
            )
            result["cost_error"] = f"HTTP {resp.status_code}"
    except Exception as exc:
        log.warning("  → Cost report error: %s", exc)
        result["cost_error"] = str(exc)

    result["note"] = (
        "Covers API key usage only (api.anthropic.com). "
        "Claude.ai Max/Pro subscription usage has no REST API."
    )
    return result


# ---------------------------------------------------------------------------
# Work-session estimation from commit timestamps
# ---------------------------------------------------------------------------


def estimate_sessions(commits: list[dict]) -> dict:
    """Group commits into work sessions and estimate total hours.

    Algorithm:
    - Sort commits oldest-first by timestamp.
    - A gap of more than SESSION_GAP_HOURS between consecutive commits marks
      the boundary between two sessions.
    - Each session's duration = (last commit − first commit) + SESSION_BUFFER_MINUTES
      to account for non-commit work (thinking, reading, testing, etc.).
    """
    if not commits:
        return {"sessions": 0, "estimated_hours": 0.0, "breakdown": []}

    sorted_commits = sorted(commits, key=lambda c: c["timestamp"])

    sessions: list[list[dict]] = []
    current: list[dict] = [sorted_commits[0]]

    for commit in sorted_commits[1:]:
        prev_dt = datetime.fromisoformat(
            current[-1]["timestamp"].replace("Z", "+00:00")
        )
        curr_dt = datetime.fromisoformat(commit["timestamp"].replace("Z", "+00:00"))
        gap_hours = (curr_dt - prev_dt).total_seconds() / 3600

        if gap_hours > SESSION_GAP_HOURS:
            sessions.append(current)
            current = [commit]
        else:
            current.append(commit)

    sessions.append(current)

    total_minutes = 0.0
    breakdown: list[dict] = []

    for session in sessions:
        start_dt = datetime.fromisoformat(
            session[0]["timestamp"].replace("Z", "+00:00")
        )
        end_dt = datetime.fromisoformat(
            session[-1]["timestamp"].replace("Z", "+00:00")
        )
        # Convert to Mountain Time for display
        start_mt = start_dt.astimezone(MOUNTAIN_TZ)
        end_mt = end_dt.astimezone(MOUNTAIN_TZ)

        active_minutes = (end_dt - start_dt).total_seconds() / 60
        session_minutes = active_minutes + SESSION_BUFFER_MINUTES
        total_minutes += session_minutes

        breakdown.append(
            {
                "date": start_mt.strftime("%a %b %-d"),
                "start": start_mt.strftime("%-I:%M %p"),
                "end": end_mt.strftime("%-I:%M %p"),
                "tz_abbr": start_mt.strftime("%Z"),
                "commits": len(session),
                "hours": round(session_minutes / 60, 1),
            }
        )

    return {
        "sessions": len(sessions),
        "estimated_hours": round(total_minutes / 60, 1),
        "breakdown": breakdown,
    }


# ---------------------------------------------------------------------------
# HTML section builders
# ---------------------------------------------------------------------------

_ESC_TABLE = str.maketrans({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})


def _esc(text: str) -> str:
    """Escape HTML special characters."""
    return text.translate(_ESC_TABLE)


def _build_change_types_html(commits: list[dict]) -> str:
    """Build an HTML table categorizing commits by type with counts and examples."""
    if not commits:
        return '<p style="margin:0; font-size:14px; color:#64748b;">No commits this week.</p>'

    # Classify and group
    categories: dict[str, list[dict]] = {}
    for commit in commits:
        cat = _classify_commit(commit["message"])
        categories.setdefault(cat, []).append(commit)

    # Sort by count descending
    sorted_cats = sorted(categories.items(), key=lambda x: -len(x[1]))

    rows = []
    for i, (cat, cat_commits) in enumerate(sorted_cats):
        bg = "#f8fafc" if i % 2 == 0 else "#ffffff"
        example = _esc(cat_commits[0]["message"])
        if len(example) > 70:
            example = example[:67] + "…"
        rows.append(
            f'<tr style="background-color:{bg};">'
            f'<td style="padding:10px 12px; font-size:13px; font-weight:600; color:#1e293b; border-bottom:1px solid #e2e8f0;">{_esc(cat)}</td>'
            f'<td style="padding:10px 12px; font-size:13px; color:#334155; text-align:center; border-bottom:1px solid #e2e8f0;">{len(cat_commits)}</td>'
            f'<td style="padding:10px 12px; font-size:13px; color:#64748b; border-bottom:1px solid #e2e8f0;">{example}</td>'
            f"</tr>"
        )

    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">'
        '<tr style="background-color:#f1f5f9;">'
        '<th style="padding:10px 12px; font-size:12px; font-weight:600; color:#475569; text-align:left; text-transform:uppercase; letter-spacing:0.5px;">Category</th>'
        '<th style="padding:10px 12px; font-size:12px; font-weight:600; color:#475569; text-align:center; text-transform:uppercase; letter-spacing:0.5px;">Count</th>'
        '<th style="padding:10px 12px; font-size:12px; font-weight:600; color:#475569; text-align:left; text-transform:uppercase; letter-spacing:0.5px;">Example</th>'
        "</tr>"
        + "".join(rows)
        + "</table>"
    )


def _build_prs_html(prs: list[dict]) -> str:
    """Build an HTML table of pull requests."""
    if not prs:
        return '<p style="margin:0; font-size:14px; color:#64748b;">No pull requests this week.</p>'

    rows = []
    for i, pr in enumerate(prs):
        bg = "#f8fafc" if i % 2 == 0 else "#ffffff"
        state = pr.get("state", "open")
        merged = pr.get("merged_at")
        if merged:
            badge_bg = "#dbeafe"
            badge_color = "#1d4ed8"
            badge_text = "Merged"
        elif state == "closed":
            badge_bg = "#fee2e2"
            badge_color = "#dc2626"
            badge_text = "Closed"
        else:
            badge_bg = "#dcfce7"
            badge_color = "#15803d"
            badge_text = "Open"

        title = _esc(pr.get("title", ""))
        if len(title) > 65:
            title = title[:62] + "…"
        rows.append(
            f'<tr style="background-color:{bg};">'
            f'<td style="padding:10px 12px; font-size:13px; color:#64748b; border-bottom:1px solid #e2e8f0;">#{pr["number"]}</td>'
            f'<td style="padding:10px 12px; font-size:13px; color:#1e293b; border-bottom:1px solid #e2e8f0;">{title}</td>'
            f'<td style="padding:10px 12px; border-bottom:1px solid #e2e8f0;">'
            f'<span style="display:inline-block; padding:2px 8px; font-size:11px; font-weight:600; border-radius:9999px; background-color:{badge_bg}; color:{badge_color};">{badge_text}</span>'
            f"</td>"
            f"</tr>"
        )

    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">'
        '<tr style="background-color:#f1f5f9;">'
        '<th style="padding:10px 12px; font-size:12px; font-weight:600; color:#475569; text-align:left; text-transform:uppercase; letter-spacing:0.5px;">#</th>'
        '<th style="padding:10px 12px; font-size:12px; font-weight:600; color:#475569; text-align:left; text-transform:uppercase; letter-spacing:0.5px;">Title</th>'
        '<th style="padding:10px 12px; font-size:12px; font-weight:600; color:#475569; text-align:left; text-transform:uppercase; letter-spacing:0.5px;">Status</th>'
        "</tr>"
        + "".join(rows)
        + "</table>"
    )


def _build_session_table_html(breakdown: list[dict]) -> str:
    """Build an HTML table of work sessions in Mountain Time."""
    if not breakdown:
        return '<p style="margin:0; font-size:14px; color:#64748b;">No work sessions detected.</p>'

    rows = []
    for i, session in enumerate(breakdown):
        bg = "#f8fafc" if i % 2 == 0 else "#ffffff"
        rows.append(
            f'<tr style="background-color:{bg};">'
            f'<td style="padding:10px 12px; font-size:13px; font-weight:600; color:#1e293b; border-bottom:1px solid #e2e8f0;">{_esc(session["date"])}</td>'
            f'<td style="padding:10px 12px; font-size:13px; color:#334155; border-bottom:1px solid #e2e8f0;">{_esc(session["start"])} – {_esc(session["end"])}</td>'
            f'<td style="padding:10px 12px; font-size:13px; color:#334155; text-align:center; border-bottom:1px solid #e2e8f0;">{session["commits"]}</td>'
            f'<td style="padding:10px 12px; font-size:13px; color:#334155; text-align:center; border-bottom:1px solid #e2e8f0;">{session["hours"]}h</td>'
            f"</tr>"
        )

    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">'
        '<tr style="background-color:#f1f5f9;">'
        '<th style="padding:10px 12px; font-size:12px; font-weight:600; color:#475569; text-align:left; text-transform:uppercase; letter-spacing:0.5px;">Day</th>'
        '<th style="padding:10px 12px; font-size:12px; font-weight:600; color:#475569; text-align:left; text-transform:uppercase; letter-spacing:0.5px;">Time</th>'
        '<th style="padding:10px 12px; font-size:12px; font-weight:600; color:#475569; text-align:center; text-transform:uppercase; letter-spacing:0.5px;">Commits</th>'
        '<th style="padding:10px 12px; font-size:12px; font-weight:600; color:#475569; text-align:center; text-transform:uppercase; letter-spacing:0.5px;">Hours</th>'
        "</tr>"
        + "".join(rows)
        + "</table>"
    )


def _build_cost_html(anthropic_usage: dict | None, codespaces: dict | None) -> str:
    """Build the cost & infrastructure section HTML."""
    parts: list[str] = []

    # Anthropic API
    parts.append('<h3 style="margin:0 0 8px; font-size:14px; font-weight:600; color:#1e293b;">Claude API Usage</h3>')
    if anthropic_usage and anthropic_usage.get("available"):
        token_usage = anthropic_usage.get("token_usage_by_model", {})
        if token_usage:
            rows = []
            for i, (model, tokens) in enumerate(token_usage.items()):
                bg = "#f8fafc" if i % 2 == 0 else "#ffffff"
                input_tokens = tokens.get("uncached_input_tokens", 0) + tokens.get("cache_read_input_tokens", 0)
                output_tokens = tokens.get("output_tokens", 0)
                rows.append(
                    f'<tr style="background-color:{bg};">'
                    f'<td style="padding:8px 12px; font-size:13px; color:#1e293b; border-bottom:1px solid #e2e8f0;">{_esc(model)}</td>'
                    f'<td style="padding:8px 12px; font-size:13px; color:#334155; text-align:right; border-bottom:1px solid #e2e8f0;">{input_tokens:,}</td>'
                    f'<td style="padding:8px 12px; font-size:13px; color:#334155; text-align:right; border-bottom:1px solid #e2e8f0;">{output_tokens:,}</td>'
                    f"</tr>"
                )
            parts.append(
                '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:8px;">'
                '<tr style="background-color:#f1f5f9;">'
                '<th style="padding:8px 12px; font-size:12px; font-weight:600; color:#475569; text-align:left;">Model</th>'
                '<th style="padding:8px 12px; font-size:12px; font-weight:600; color:#475569; text-align:right;">Input Tokens</th>'
                '<th style="padding:8px 12px; font-size:12px; font-weight:600; color:#475569; text-align:right;">Output Tokens</th>'
                "</tr>"
                + "".join(rows)
                + "</table>"
            )

        total_cost = anthropic_usage.get("total_cost_usd")
        if total_cost is not None:
            parts.append(f'<p style="margin:0 0 4px; font-size:13px; color:#334155;"><strong>Total cost:</strong> ${total_cost:.4f} USD</p>')

        if anthropic_usage.get("token_usage_error"):
            parts.append(f'<p style="margin:0; font-size:12px; color:#dc2626;">Token usage error: {_esc(anthropic_usage["token_usage_error"])}</p>')
        if anthropic_usage.get("cost_error"):
            parts.append(f'<p style="margin:0; font-size:12px; color:#dc2626;">Cost error: {_esc(anthropic_usage["cost_error"])}</p>')

        note = anthropic_usage.get("note", "")
        if note:
            parts.append(f'<p style="margin:4px 0 0; font-size:11px; color:#94a3b8;">{_esc(note)}</p>')
    else:
        reason = (anthropic_usage or {}).get("reason", "Anthropic usage data unavailable.")
        parts.append(f'<p style="margin:0; font-size:13px; color:#64748b;">{_esc(reason)}</p>')

    # Codespaces
    parts.append('<h3 style="margin:16px 0 8px; font-size:14px; font-weight:600; color:#1e293b;">Codespaces</h3>')
    if codespaces and codespaces.get("codespaces"):
        for cs in codespaces["codespaces"]:
            name = _esc(cs.get("name") or "unnamed")
            machine = _esc(cs.get("machine") or "unknown")
            state = _esc(cs.get("state") or "unknown")
            last_used = cs.get("last_used_at") or "—"
            if last_used != "—":
                try:
                    lu_dt = datetime.fromisoformat(last_used.replace("Z", "+00:00"))
                    last_used = lu_dt.astimezone(MOUNTAIN_TZ).strftime("%b %-d, %-I:%M %p %Z")
                except (ValueError, AttributeError):
                    pass
            parts.append(
                f'<div style="padding:10px 12px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:6px;">'
                f'<div style="font-size:13px; font-weight:600; color:#1e293b;">{name}</div>'
                f'<div style="font-size:12px; color:#64748b; margin-top:2px;">{machine} · {state} · Last used: {_esc(last_used)}</div>'
                f"</div>"
            )
        note = codespaces.get("note", "")
        if note:
            parts.append(f'<p style="margin:4px 0 0; font-size:11px; color:#94a3b8;">{_esc(note)}</p>')
    else:
        parts.append('<p style="margin:0; font-size:13px; color:#64748b;">Codespaces data unavailable.</p>')

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Claude narrative generation
# ---------------------------------------------------------------------------

_NARRATIVE_PROMPT = """\
You are a friendly technical assistant writing narrative sections for a weekly \
work report for a solo developer.

Below is JSON data about activity on the GitHub repository **{repo}** during \
the week of **{week_start} → {week_end}**.

```json
{data}
```

Write **three short narrative paragraphs** and return them as a JSON object \
with exactly these keys:

1. **"summary"** — A warm, 2–3 sentence high-level overview of the week. \
Mention the most impactful work, overall productivity, and any notable \
milestones.

2. **"productivity_insights"** — A paragraph about productivity patterns: \
busiest day(s), session count vs previous typical weeks, average session \
length, any notable streaks or gaps. Mention issue velocity (opened vs \
closed) and any quick wins.

3. **"architecture_notes"** — A paragraph noting any significant architecture \
changes, documentation updates, or major plan changes evident in the commits. \
If no architecture changes occurred, briefly note that the architecture \
remained stable and mention what areas received the most attention.

**Output rules:**
- Return ONLY a valid JSON object with the three keys above.
- Values must be plain text (no HTML tags, no markdown).
- Tone: warm, encouraging — the developer is reviewing their own week.
- Each paragraph should be 2–4 sentences.
- Do not include any text outside the JSON object.
"""


def _generate_narratives(data: dict) -> dict[str, str]:
    """Call Claude to generate narrative sections. Returns dict with summary,
    productivity_insights, and architecture_notes keys."""
    log.info("Generating narrative sections with Claude (%s)…", CLAUDE_MODEL)

    prompt = _NARRATIVE_PROMPT.format(
        repo=data.get("repo", GITHUB_REPO),
        week_start=data.get("week_start", ""),
        week_end=data.get("week_end", ""),
        data=json.dumps(data, indent=2, default=str),
    )

    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": CLAUDE_MODEL,
            "max_tokens": 2048,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=120,
    )
    resp.raise_for_status()

    content_blocks: list[dict] = resp.json().get("content", [])
    raw_text = next(
        (b["text"] for b in content_blocks if b.get("type") == "text"), "{}"
    )

    # Strip markdown code fences if present
    raw_text = raw_text.strip()
    if raw_text.startswith("```"):
        # Remove opening fence line and closing fence
        lines = raw_text.split("\n")
        lines = lines[1:]  # drop ```json or ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw_text = "\n".join(lines)

    try:
        narratives = json.loads(raw_text)
    except json.JSONDecodeError:
        log.warning("Failed to parse Claude response as JSON; using raw text as summary.")
        narratives = {
            "summary": raw_text[:500],
            "productivity_insights": "Productivity analysis unavailable.",
            "architecture_notes": "Architecture analysis unavailable.",
        }

    defaults = {
        "summary": "Report summary unavailable.",
        "productivity_insights": "Productivity analysis unavailable.",
        "architecture_notes": "Architecture analysis unavailable.",
    }
    for key, default in defaults.items():
        if key not in narratives or not narratives[key]:
            narratives[key] = default

    log.info("  → Narratives generated")
    return narratives


# ---------------------------------------------------------------------------
# Template assembly
# ---------------------------------------------------------------------------


def _load_template() -> str:
    """Load the HTML email template from disk."""
    return TEMPLATE_PATH.read_text(encoding="utf-8")


def generate_report_html(data: dict) -> str:
    """Assemble the final HTML report by populating the template with data
    and Claude-generated narratives."""

    template = _load_template()

    # Generate narrative sections via Claude
    narratives = _generate_narratives(data)

    # Build data-driven HTML sections
    commits = data.get("commits", [])
    prs = data.get("pull_requests", [])
    session_est = data.get("session_estimate", {})
    issues = data.get("issues", {})

    change_types_html = _build_change_types_html(commits)
    prs_html = _build_prs_html(prs)
    session_table_html = _build_session_table_html(session_est.get("breakdown", []))
    cost_html = _build_cost_html(
        data.get("anthropic_usage"),
        data.get("codespaces_billing"),
    )

    now_mt = datetime.now(tz=timezone.utc).astimezone(MOUNTAIN_TZ)

    # Populate template
    replacements = {
        "{{REPO_NAME}}": _esc(data.get("repo", GITHUB_REPO)),
        "{{DATE_RANGE}}": f'{data.get("week_start", "")} → {data.get("week_end", "")}',
        "{{TOTAL_COMMITS}}": str(len(commits)),
        "{{TOTAL_PRS}}": str(len(prs)),
        "{{ISSUES_OPENED}}": str(len(issues.get("opened", []))),
        "{{ISSUES_CLOSED}}": str(len(issues.get("closed", []))),
        "{{TOTAL_HOURS}}": str(session_est.get("estimated_hours", 0)),
        "{{TOTAL_SESSIONS}}": str(session_est.get("sessions", 0)),
        "{{SUMMARY_NARRATIVE}}": _esc(narratives.get("summary", "")),
        "{{CHANGE_TYPES_CONTENT}}": change_types_html,
        "{{MAJOR_PRS_CONTENT}}": prs_html,
        "{{PRODUCTIVITY_NARRATIVE}}": _esc(narratives.get("productivity_insights", "")),
        "{{SESSION_TABLE_CONTENT}}": session_table_html,
        "{{ARCHITECTURE_NARRATIVE}}": _esc(narratives.get("architecture_notes", "")),
        "{{COST_CONTENT}}": cost_html,
        "{{GENERATION_TIMESTAMP}}": now_mt.strftime("Generated %b %-d, %Y at %-I:%M %p %Z"),
    }

    html = template
    for placeholder, value in replacements.items():
        html = html.replace(placeholder, value)

    log.info("  → Report assembled (%d chars)", len(html))
    return html


# ---------------------------------------------------------------------------
# Email delivery
# ---------------------------------------------------------------------------


def send_email(html: str, subject: str) -> None:
    log.info("Sending email to %s…", RECIPIENT_EMAIL)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = RECIPIENT_EMAIL
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        smtp.sendmail(GMAIL_ADDRESS, RECIPIENT_EMAIL, msg.as_string())

    log.info("  → Email sent")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    now = datetime.now(tz=timezone.utc)
    since = now - timedelta(days=7)

    log.info(
        "Collecting data for %s → %s",
        since.strftime("%Y-%m-%d"),
        now.strftime("%Y-%m-%d"),
    )

    collected: dict = {
        "repo": GITHUB_REPO,
        "week_start": since.strftime("%Y-%m-%d"),
        "week_end": now.strftime("%Y-%m-%d"),
    }
    errors: list[str] = []

    # --- Commits + session estimate ---
    try:
        commits = collect_commits(since, now)
        collected["commits"] = commits
        collected["session_estimate"] = estimate_sessions(commits)
    except Exception as exc:
        log.error("Failed to collect commits: %s", exc)
        errors.append(f"commits: {exc}")
        collected["commits"] = []
        collected["session_estimate"] = {
            "sessions": 0,
            "estimated_hours": 0.0,
            "breakdown": [],
        }

    # --- Issues ---
    try:
        collected["issues"] = collect_issues(since)
    except Exception as exc:
        log.error("Failed to collect issues: %s", exc)
        errors.append(f"issues: {exc}")
        collected["issues"] = {"opened": [], "closed": []}

    # --- Pull requests ---
    try:
        collected["pull_requests"] = collect_prs(since)
    except Exception as exc:
        log.error("Failed to collect PRs: %s", exc)
        errors.append(f"pull_requests: {exc}")
        collected["pull_requests"] = []

    # --- Codespaces billing (best-effort) ---
    collected["codespaces_billing"] = collect_codespaces_billing()

    # --- Anthropic usage (best-effort) ---
    collected["anthropic_usage"] = collect_anthropic_usage(since, now)

    if errors:
        collected["collection_errors"] = errors
        log.warning("Completed with %d collection error(s)", len(errors))
    else:
        log.info("All data collected successfully.")

    # --- Skip if nothing happened this week ---
    no_commits = len(collected.get("commits", [])) == 0
    no_issues = (
        len(collected.get("issues", {}).get("opened", [])) == 0
        and len(collected.get("issues", {}).get("closed", [])) == 0
    )
    no_prs = len(collected.get("pull_requests", [])) == 0
    if no_commits and no_issues and no_prs:
        log.info("No activity detected this week — skipping report.")
        return

    # --- Generate report ---
    if not ANTHROPIC_API_KEY:
        log.error("ANTHROPIC_API_KEY is required to generate the report. Aborting.")
        sys.exit(1)

    html = generate_report_html(collected)

    # --- Send or print ---
    if not all([GMAIL_ADDRESS, GMAIL_APP_PASSWORD, RECIPIENT_EMAIL]):
        log.warning(
            "Gmail credentials or RECIPIENT_EMAIL not set — printing HTML to stdout."
        )
        print(html)
        return

    week_label = (
        since.strftime("%b %-d") + " – " + now.strftime("%b %-d, %Y")
    )
    subject = f"Weekly Work Report: {GITHUB_REPO} ({week_label})"
    send_email(html, subject)
    log.info("Done.")


if __name__ == "__main__":
    main()
