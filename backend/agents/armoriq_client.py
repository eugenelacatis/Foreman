import logging
import os
import uuid

logger = logging.getLogger(__name__)


class ArmorIQBlockedError(Exception):
    pass


async def sign_plan(action: str, plan: dict, api_key: str | None = None) -> str:
    api_key = api_key or os.getenv("ARMORIQ_API_KEY", "")
    plan_id = str(uuid.uuid4())
    logger.info("ArmorIQ sign_plan action=%s plan_id=%s", action, plan_id)
    # TODO: replace stub with real HTTP call:
    # async with httpx.AsyncClient() as c:
    #     resp = await c.post(
    #         "https://api.armoriq.com/v1/plans",
    #         headers={"Authorization": f"Bearer {api_key}"},
    #         json={"action": action, "plan": plan},
    #     )
    #     resp.raise_for_status()
    #     return resp.json()["plan_id"]
    return plan_id


async def check_action(
    action: str, plan_id: str, api_key: str | None = None
) -> dict:
    api_key = api_key or os.getenv("ARMORIQ_API_KEY", "")
    logger.info("ArmorIQ check_action action=%s plan_id=%s", action, plan_id)
    # TODO: replace stub with real HTTP call:
    # async with httpx.AsyncClient() as c:
    #     resp = await c.post(
    #         "https://api.armoriq.com/v1/check",
    #         headers={"Authorization": f"Bearer {api_key}"},
    #         json={"action": action, "plan_id": plan_id},
    #     )
    #     resp.raise_for_status()
    #     return resp.json()  # expects {"allowed": bool, "reason": str}
    if action == "DEMO_BLOCK":
        return {
            "allowed": False,
            "reason": (
                "Invoice total is 47% above similar historical jobs "
                "and invoice_approved=False"
            ),
        }
    return {"allowed": True, "reason": ""}


if __name__ == "__main__":
    import asyncio

    async def _main() -> None:
        blocked = await check_action("DEMO_BLOCK", "plan-test-001")
        print(f"DEMO_BLOCK → allowed={blocked['allowed']}  reason={blocked['reason']!r}")

        allowed = await check_action("prefill_invoice", "plan-test-002")
        print(f"prefill_invoice → allowed={allowed['allowed']}  reason={allowed['reason']!r}")

    asyncio.run(_main())
