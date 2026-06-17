"""Job interno Fase 2: descobre empresas NOVAS (scan rua a rua) -> importa para
Empresas (dedup por dominio) -> enriquece as novas (CNPJ/QSA = decisores).
Dimensionado para nao estourar a cota do Google CSE (~100 buscas/dia).
Roda com: .venv/bin/python _bulk_scan.py
"""
import asyncio
import json
import re

from database import get_db, new_id, now, serialize, like
from routers.mercado import _save_market_item, _dominio_item
from services.market_intelligence import scan_market_by_streets
from services.ramos import normalizar_ramo, ramo_config
from services.cnpj_enrichment import (
    clean_cnpj, fetch_cnpj_data, search_cnpj_by_name, descobrir_whatsapp,
)
from routers.empresas import salvar_dados_cnpj

CONTA_ID = "7dd81713-c64e-487d-9235-92ae1a7cc832"

# Regioes centrais de SP onde a base ja atua. Mantido enxuto p/ caber na cota.
REGIOES = [
    "Consolação/Jardins/Bela Vista",
    "Pinheiros",
    "Paulista/Paraíso",
    "Vila Mariana",
]
RAMOS = ["funeraria", "imobiliaria"]
STREETS_LIMIT = 6      # buscas Google por (regiao, ramo)
HITS_PER_STREET = 4
LIMIT = 60             # itens por scan


async def _scan_e_salvar(db):
    total_itens = 0
    for ramo in RAMOS:
        rn = normalizar_ramo(ramo)
        for area in REGIOES:
            try:
                res = await scan_market_by_streets(
                    area, streets_limit=STREETS_LIMIT, hits_per_street=HITS_PER_STREET,
                    limit=LIMIT, ramo=rn, cidade="São Paulo",
                )
            except Exception as e:
                print(f"  [scan erro] {rn}/{area}: {type(e).__name__} {str(e)[:80]}")
                continue
            saved = 0
            for item in res.get("items", []):
                await _save_market_item(db, item, CONTA_ID, rn)
                saved += 1
            total_itens += saved
            print(f"  [scan] {rn:12} {area:32} itens={saved} (ruas={len(res.get('ruas',[]))})")
            if res.get("aviso"):
                print(f"         aviso: {res['aviso']}")
    return total_itens


async def _importar(db, ramo):
    """Replica /mercado/importar: 1 empresa por dominio."""
    rn = normalizar_ramo(ramo)
    cfg = ramo_config(rn)
    tipos_validos = {t["value"] for t in cfg["tipos"]}
    tipo_padrao = cfg["tipo_padrao"]
    itens = [serialize(r) for r in await db.mercado_itens.find(
        {"conta_id": CONTA_ID, "ramo": rn}).to_list(length=None)]

    def _rank(x):
        t = x.get("tipo")
        return (1 if (t in tipos_validos and t != "outro") else 0, x.get("score") or 0)

    por_dom = {}
    for it in itens:
        dom = _dominio_item(it)
        if not dom:
            continue
        if dom not in por_dom or _rank(it) > _rank(por_dom[dom]):
            por_dom[dom] = it

    criadas, novas_ids = 0, []
    for dom, it in por_dom.items():
        existe = await db.empresas.find_one(
            {"conta_id": CONTA_ID, "ramo": rn, "website": {"$regex": re.escape(dom), "$options": "i"}},
            {"_id": 1})
        if existe:
            continue
        tipo = it.get("tipo") if it.get("tipo") in tipos_validos else tipo_padrao
        nome = (it.get("nome") or "").strip() or dom
        emp_id = new_id()
        await db.empresas.insert_one({
            "_id": emp_id, "conta_id": CONTA_ID, "ramo": rn,
            "nome": nome[:255], "tipo": tipo, "website": it.get("url"),
            "bairro": it.get("bairro"), "municipio": it.get("municipio"),
            "uf": it.get("uf") or "SP", "regiao": it.get("area"),
            "score": 0, "status_prospeccao": "nao_iniciado", "prioridade": "normal",
            "created_at": now(), "updated_at": now(),
        })
        await db.mercado_itens.update_many(
            {"conta_id": CONTA_ID, "ramo": rn, "fonte": it.get("fonte")},
            {"$set": {"empresa_id": emp_id}})
        criadas += 1
        novas_ids.append(emp_id)
    print(f"  [importar] {rn}: criadas={criadas}")
    return novas_ids


async def _enrich(db, ids):
    sem = asyncio.Semaphore(4)
    stats = {"enriquecidas": 0, "sem_cnpj": 0, "erros": 0, "decisores": 0}

    async def one(eid):
        async with sem:
            row = await db.empresas.find_one({"_id": eid}, {"nome": 1, "cnpj": 1})
            nome = (row or {}).get("nome") or ""
            cnpj = clean_cnpj((row or {}).get("cnpj") or "")
            descoberta = None
            try:
                if not cnpj:
                    descoberta = await asyncio.wait_for(search_cnpj_by_name(nome), timeout=25)
                    if descoberta and descoberta.get("cnpj"):
                        cnpj = clean_cnpj(descoberta["cnpj"])
                if not cnpj:
                    stats["sem_cnpj"] += 1
                    return
                data = await asyncio.wait_for(fetch_cnpj_data(cnpj), timeout=30)
                if descoberta:
                    data["descoberta"] = descoberta
                if not data.get("whatsapp"):
                    try:
                        a = await asyncio.wait_for(descobrir_whatsapp(nome), timeout=20)
                        if a and a.get("whatsapp"):
                            data["whatsapp"] = a["whatsapp"]; data["fonte_whatsapp"] = a.get("fonte_whatsapp")
                    except Exception:
                        pass
                await salvar_dados_cnpj(db, eid, data, cnpj, conta_id=CONTA_ID)
                stats["enriquecidas"] += 1
                stats["decisores"] += len(data.get("qsa") or [])
            except Exception as e:
                stats["erros"] += 1
                print(f"    [enrich erro] {nome[:40]}: {type(e).__name__}")

    await asyncio.gather(*[one(i) for i in ids])
    print(f"  [enrich novas] {json.dumps(stats, ensure_ascii=False)}")
    return stats


async def main():
    db = get_db()
    print("== FASE 2: scan rua a rua ==")
    total_itens = await _scan_e_salvar(db)
    print(f"  total itens de mercado salvos: {total_itens}")
    print("== FASE 2b: importar -> Empresas ==")
    novas = []
    for ramo in RAMOS:
        novas += await _importar(db, ramo)
    print(f"  total empresas novas: {len(novas)}")
    print("== FASE 2c: enriquecer as novas ==")
    if novas:
        await _enrich(db, novas)
    print("\n== FASE 2 CONCLUIDA ==")


if __name__ == "__main__":
    asyncio.run(main())
