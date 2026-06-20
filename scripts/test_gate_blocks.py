import asyncio
import httpx

BASE_URL = "http://localhost:8000"


async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        create_response = await client.post(
            f"{BASE_URL}/work-orders",
            json={
                "raw_request": "Water heater leaking at 456 Oak Ave. Customer says it started yesterday."
            },
        )
        create_response.raise_for_status()
        wo = create_response.json()
        work_order_id = wo["id"]

        print("Created:", work_order_id)

        response = await client.post(
            f"{BASE_URL}/work-orders/{work_order_id}/approve",
            json={"stage": "scheduling"},
        )

        print("Status code:", response.status_code)
        print("Response:", response.text)

        assert response.status_code == 422, "Expected 422 when skipping intake approval"

        print("✅ Gate block works: scheduling cannot run before intake approval.")


if __name__ == "__main__":
    asyncio.run(main())