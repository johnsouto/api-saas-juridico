from __future__ import annotations

import argparse
import os
import sys


PROD_BLOCK_SUBSTRINGS = [
    "elementojuris.cloud",
]


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() == "true"


def _fail(msg: str, code: int = 2) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    raise SystemExit(code)


def _is_blocked_target(url: str) -> bool:
    u = (url or "").strip().lower()
    return any(bad in u for bad in PROD_BLOCK_SUBSTRINGS)


def main() -> None:
    p = argparse.ArgumentParser(description="Guardrails for QA scans/load tests (never run against production).")
    p.add_argument("--target-env", default="QA_TARGET_BASE_URL", help="Env var holding the target base URL.")
    p.add_argument(
        "--require-allow-dangerous",
        action="store_true",
        help="Require QA_ALLOW_DANGEROUS=true to proceed.",
    )
    args = p.parse_args()

    target_env = str(args.target_env)
    target = (os.getenv(target_env) or "").strip()
    if not target:
        _fail(
            "\n".join(
                [
                    f"Missing {target_env}.",
                    "This command can only run against localhost/staging targets.",
                    "",
                    f"Example: set {target_env}=http://localhost",
                ]
            )
        )

    if _is_blocked_target(target):
        _fail(
            "\n".join(
                [
                    "Blocked: refusing to run QA scan/load against a production domain.",
                    f"{target_env}={target}",
                    "",
                    "Point it to localhost/staging instead.",
                ]
            )
        )

    if args.require_allow_dangerous:
        if not _env_bool("QA_ALLOW_DANGEROUS", False):
            _fail(
                "\n".join(
                    [
                        "Blocked: QA_ALLOW_DANGEROUS is not enabled.",
                        "Set QA_ALLOW_DANGEROUS=true to explicitly opt-in.",
                        "",
                        f"{target_env}={target}",
                    ]
                )
            )


if __name__ == "__main__":
    main()

