import asyncio
from dotenv import load_dotenv
load_dotenv()
from config import load_seed
from db import get_pool, run_migrations
from memory import embed


async def main():
    seed = load_seed()
    memories = seed.get("memories", [])
    pool = await get_pool()
    await run_migrations(pool)
    async with pool.acquire() as conn:
        await conn.execute("delete from memories where pinned=true")
        for m in memories:
            emb = await embed(m)
            await conn.execute(
                "insert into memories(content,tag,embedding,pinned) values($1,'event',$2::vector,true)",
                m, str(emb)
            )
    print(f"Inserted {len(memories)} pinned memories")
    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
