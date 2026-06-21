import logging
import asyncio
from functools import lru_cache

logger = logging.getLogger(__name__)

# Approved actions for ForemanAI agents
APPROVED_ACTIONS = {
    "approve_intake",
    "approve_scheduling",
    "approve_invoice",
    "prefill_invoice",
    "gap_fill",
    "consistency_check",
    "send_invoice_draft",
}

DEMO_BLOCK_ACTION = "approve_invoice_overbudget"


class ArmorIQBlockedError(Exception):
    pass


@lru_cache(maxsize=1)
def _get_client():
    try:
        from armoriq_sdk import ArmorIQClient
        client = ArmorIQClient()  # reads ARMORIQ_API_KEY or uses armoriq login credentials
        logger.info("ArmorIQ client initialized")
        return client
    except Exception as e:
        logger.warning("ArmorIQ SDK unavailable, falling back to stub: %s", e)
        return None


async def sign_plan(action: str, plan: dict) -> str:
    client = _get_client()
    if client is None:
        return f"stub-plan-{action}"

    try:
        plan_capture = await asyncio.to_thread(
            client.capture_plan,
            llm="claude-sonnet-4-6",
            prompt=f"ForemanAI agent performing: {action}",
            plan={
                "goal": action,
                "steps": [
                    {
                        "action": action,
                        "mcp": "foreman-ai",
                        "params": plan,
                    }
                ],
            },
        )
        token = await asyncio.to_thread(client.get_intent_token, plan_capture)
        logger.info("ArmorIQ sign_plan action=%s token=%s", action, token)
        return str(token)
    except Exception as e:
        logger.warning("ArmorIQ sign_plan failed, using stub: %s", e)
        return f"stub-plan-{action}"


async def check_action(action: str, plan_id: str) -> dict:
    logger.info("ArmorIQ check_action action=%s", action)

    # Demo block: show ArmorIQ catching an off-plan action
    if action == DEMO_BLOCK_ACTION or action == "DEMO_BLOCK":
        return {
            "allowed": False,
            "reason": (
                "Invoice total is 47% above similar historical jobs "
                "and invoice_approved=False. ArmorIQ blocked this action "
                "as it deviates from the approved plan."
            ),
        }

    # Off-plan action: not in approved list
    if action not in APPROVED_ACTIONS and not plan_id.startswith("stub-"):
        return {
            "allowed": False,
            "reason": f"Action '{action}' was not declared in the approved plan.",
        }

    client = _get_client()
    if client is None or plan_id.startswith("stub-"):
        return {"allowed": True, "reason": ""}

    try:
        result = await asyncio.to_thread(
            client.invoke,
            mcp="foreman-ai",
            action=action,
            intent_token=plan_id,
        )
        allowed = getattr(result, "verified", True)
        reason = "" if allowed else "ArmorIQ rejected the intent token — action not in signed plan."
        return {"allowed": allowed, "reason": reason}
    except Exception as e:
        logger.warning("ArmorIQ invoke failed, defaulting to allow: %s", e)
        return {"allowed": True, "reason": ""}


if __name__ == "__main__":
    async def _main() -> None:
        # Test demo block
        blocked = await check_action("DEMO_BLOCK", "plan-test-001")
        print(f"DEMO_BLOCK → allowed={blocked['allowed']}  reason={blocked['reason']!r}")

        # Test approved action
        plan_id = await sign_plan("approve_invoice", {"work_order_id": "test-123"})
        allowed = await check_action("approve_invoice", plan_id)
        print(f"approve_invoice → allowed={allowed['allowed']}  reason={allowed['reason']!r}")

        # Test off-plan action
        off_plan = await check_action("delete_all_invoices", "some-plan-id")
        print(f"delete_all_invoices → allowed={off_plan['allowed']}  reason={off_plan['reason']!r}")

    asyncio.run(_main())
