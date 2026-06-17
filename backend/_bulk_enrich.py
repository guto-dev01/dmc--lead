"""Job interno: enriquece as empresas sem dados_cnpj (mesma logica do /enrich-all).
Puxa CNPJ/QSA (decisores) das APIs publicas + tenta WhatsApp no site.
Roda com: .venv/bin/python _bulk_enrich.py
"""
import asyncio
import json

from database import get_db
from services.cnpj_enrichment import (
    clean_cnpj, fetch_cnpj_data, search_cnpj_by_name, descobrir_whatsapp,
)
from routers.empresas import salvar_dados_cnpj

CONTA_ID = "7dd81713-c64e-487d-9235-92ae1a7cc832"
CONC = 4  # concorrencia (respeita rate limit das APIs)


def _qsa_count(data: dict) -> int:
    try:
        return len(data.get("qsa") or [])
    except Exception:
        return 0


async def _enrich_one(db, row, sem, stats):
    async with sem:
        eid = row["_id"]
        nome = row.get("nome") or ""
        cnpj = clean_cnpj(row.get("cnpj") or "")
        descoberta = None
        try:
            if not cnpj:
                descoberta = await asyncio.wait_for(search_cnpj_by_name(nome), timeout=25)
                if descoberta and descoberta.get("cnpj"):
                    cnpj = clean_cnpj(descoberta["cnpj"])
                    stats["descobertos"] += 1
            if not cnpj:
                stats["sem_cnpj"] += 1
                print(f"  [sem cnpj] {nome[:50]}")
                return
            data = await asyncio.wait_for(fetch_cnpj_data(cnpj), timeout=30)
            if descoberta:
                data["descoberta"] = descoberta
            if not data.get("whatsapp"):
                try:
                    achado = await asyncio.wait_for(descobrir_whatsapp(nome), timeout=20)
                    if achado and achado.get("whatsapp"):
                        data["whatsapp"] = achado["whatsapp"]
                        data["fonte_whatsapp"] = achado.get("fonte_whatsapp")
                except Exception:
                    pass
            await salvar_dados_cnpj(db, eid, data, cnpj, conta_id=CONTA_ID)
            n = _qsa_count(data)
            stats["enriquecidas"] += 1
            stats["decisores"] += n
            if data.get("whatsapp"):
                stats["com_whats"] += 1
            print(f"  [ok] {nome[:45]:45} cnpj={cnpj} decisores={n} wa={'s' if data.get('whatsapp') else '-'}")
        except Exception as e:
            stats["erros"] += 1
            print(f"  [erro] {nome[:45]}: {type(e).__name__} {str(e)[:80]}")


async def main():
    db = get_db()
    rows = await db.empresas.find(
        {"conta_id": CONTA_ID, "$or": [{"dados_cnpj": None}, {"dados_cnpj": ""}]},
        {"nome": 1, "cnpj": 1, "ramo": 1},
    ).to_list(length=None)
    print(f"== Empresas a enriquecer: {len(rows)} ==")
    stats = {"enriquecidas": 0, "descobertos": 0, "sem_cnpj": 0, "erros": 0,
             "decisores": 0, "com_whats": 0}
    sem = asyncio.Semaphore(CONC)
    await asyncio.gather(*[_enrich_one(db, r, sem, stats) for r in rows])
    print("\n== RESUMO FASE 1 ==")
    print(json.dumps(stats, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
