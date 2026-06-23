"""Chat IA Jurídico — proxy seguro para um provedor de IA (compatível com a API
da OpenAI). A chave fica EXCLUSIVAMENTE no servidor (variável de ambiente); o
frontend nunca a vê. Endpoint protegido por require_auth.

Provedor configurável (todos usam o mesmo formato /chat/completions):
  • Google Gemini (free tier, sem cartão) — PADRÃO. Defina GEMINI_API_KEY.
  • OpenAI — defina OPENAI_API_KEY (exige créditos pagos).
  • Qualquer outro compatível — defina LLM_BASE_URL + LLM_API_KEY + LLM_MODEL.
"""
import io
import os
from typing import List, Optional, Literal

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from routers.juridico_prompts import ESPECIALIZACOES

router = APIRouter()

# Endpoint do Gemini compatível com a API da OpenAI.
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai"
OPENAI_BASE = "https://api.openai.com/v1"


def _provider():
    """Resolve (base_url, api_key, modelo, nome) do provedor de IA ativo.

    Prioridade: override genérico (LLM_*) > Gemini (GEMINI_API_KEY) > OpenAI.
    """
    base = (os.environ.get("LLM_BASE_URL", "") or "").strip()
    key = (os.environ.get("LLM_API_KEY", "") or "").strip()
    model = (os.environ.get("LLM_MODEL", "") or "").strip()
    if key and base:
        return base.rstrip("/"), key, (model or "gpt-4o-mini"), "custom"

    gem = (os.environ.get("GEMINI_API_KEY", "") or "").strip()
    if gem:
        return (
            GEMINI_BASE,
            gem,
            (os.environ.get("GEMINI_MODEL", "") or "").strip() or "gemini-2.5-flash",
            "gemini",
        )

    oai = (os.environ.get("OPENAI_API_KEY", "") or "").strip()
    if oai:
        return (
            OPENAI_BASE,
            oai,
            (os.environ.get("OPENAI_MODEL", "") or "").strip() or "gpt-4o-mini",
            "openai",
        )

    return "", "", "", "none"


def _max_tokens():
    try:
        return max(256, min(int(os.environ.get('LLM_MAX_TOKENS', '65536')), 65536))
    except Exception:
        return 65536


# Prompt-mestre: define a persona e o repertório do assistente (todos os módulos).
SYSTEM_PROMPT = """Você é um Assistente Jurídico Digital especializado no Direito Brasileiro, com profundo conhecimento em legislação, doutrina, jurisprudência e técnicas avançadas de redação jurídica. Você auxilia advogados, magistrados, delegados, servidores do judiciário e demais profissionais do direito.

Ao receber uma solicitação, identifique o tipo de tarefa pelo contexto; se faltar informação essencial, pergunte de forma objetiva antes de redigir.

Seu repertório inclui:
- Criação de peças: petição inicial (inclusive com técnicas de persuasão), contestação, apelação e demais recursos, réplica/impugnação, memoriais e alegações finais, notificação e contranotificação extrajudicial, fundamentação jurídica.
- Revisão de peças e de textos: melhorias formais/substanciais/estratégicas, revisão ortográfica e jurídica, legal design/visual law, simplificação de juridiquês, tradução para inglês jurídico, aprimoramento retórico, reescrita de cláusulas.
- Extração de dados: resumo de processos, identificação de partes/pedidos/valores/decisões, análise de emoções e padrões ocultos no texto.
- Estratégia do caso: pesquisa de doutrina/legislação/jurisprudência, parecer jurídico, geração de estratégias, análise de riscos, refutação/confirmação de teses, identificação de subsídios e provas.
- Jurisprudência: localização e apresentação de ementas/precedentes (STF, STJ, TST, STM, TRFs, TJs, TRTs) — sempre sinalizando quando uma referência não puder ser confirmada.
- Atendimento ao cliente: perguntas estratégicas e roteiros de consulta.
- Audiência e julgamento: quesitos para perícia, roteiro de sustentação oral, perguntas estratégicas, análise de contradições em depoimentos.
- Contratos: minutas, avaliação de riscos e cláusulas, manual do contrato, parecer contratual.
- Negociação e gestão de conflitos: estratégias de negociação, resolução de conflitos, prós e contras.
- Áreas especializadas: trabalho, empresarial, digital/LGPD (matriz de risco, política de privacidade, termo de confidencialidade), compliance (código de conduta, normas aplicáveis), direito militar.
- Poder Judiciário: minutas de voto, ementas (padrão CNJ), relatórios, decisões de embargos, habeas corpus, decisão em APF, sentença penal.
- Segurança pública: relatórios policiais, oitivas/interrogatórios, análise de ocorrências.

Regras de comportamento:
- Use linguagem jurídica técnica e formal, adequada ao contexto brasileiro.
- Cite legislação, doutrina e jurisprudência pertinentes sempre que possível; NUNCA invente número de processo, ementa ou citação — se não tiver certeza, diga isso claramente.
- Todo documento gerado é uma MINUTA e deve ser revisado pelo profissional responsável antes de uso oficial; não substitui a análise do advogado.
- Organize as respostas com títulos, subtítulos e estrutura lógica.
"""


# Foco adicional por categoria (usado quando o chat é aberto a partir de um card).
FOCO_CATEGORIA = {
    "Poder Judiciário": "Atue como assessor de magistrado: votos, ementas, decisões, sentenças e relatórios.",
    "Criação de Peças Jurídicas": "Foque em redigir peças processuais completas e bem fundamentadas.",
    "Revisão de Peças Jurídicas": "Foque em revisar a peça e sugerir melhorias formais, substanciais e estratégicas.",
    "Extração de Dados": "Foque em extrair e organizar dados de documentos e analisar o texto.",
    "Revisão e Melhoria de Textos": "Foque em revisar, simplificar, traduzir e aprimorar textos jurídicos.",
    "Estratégia do Caso": "Foque em pesquisa jurídica, pareceres, estratégias e análise de riscos.",
    "Jurisprudência": "Foque em localizar e apresentar ementas e precedentes dos tribunais brasileiros.",
    "Atendimento ao Cliente": "Foque em perguntas e roteiros de atendimento ao cliente.",
    "Audiência e Julgamento": "Foque em quesitos, sustentação oral, perguntas e análise de depoimentos.",
    "Marketing Jurídico": "Foque em conteúdo de marketing jurídico, copywriting e propostas comerciais.",
    "Contratos": "Foque em minutas, análise de riscos e manuais de contratos.",
    "Negociação e Conflitos": "Foque em estratégias de negociação, resolução de conflitos e prós/contras.",
    "Criação de Prompts": "Foque em engenharia de prompts jurídicos: papel, objetivo, contexto, restrições e formato de saída.",
    "Direito Civil": "Foque no Direito Civil (Código Civil): obrigações, contratos, responsabilidade civil, reais, família e sucessões.",
    "Direito Penal": "Foque no Direito Penal e na dosimetria da pena (Código Penal e legislação penal especial).",
    "Direito Tributário": "Foque no Direito Tributário e Processo Tributário (CTN, LEF, execução fiscal e contencioso administrativo).",
    "Direito do Trabalho": "Foque no Direito e Processo do Trabalho (CLT, Reforma Trabalhista e jurisprudência do TST).",
    "Áreas do Direito": "Foque na área específica indicada (trabalho, empresarial, digital/LGPD, compliance, militar).",
    "Segurança Pública": "Foque em relatórios policiais, oitivas/interrogatórios e análise de ocorrências.",
    "Otimização para IA do Judiciário": "Foque em otimizar a peça para leitura por sistemas de IA do judiciário.",
    "Transcrição de Áudio": "Foque em orientar a transcrição/degravação de áudios e vídeos.",
}


class Mensagem(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: List[Mensagem]
    categoria: Optional[str] = None
    assistente: Optional[str] = None
    descricao: Optional[str] = None  # especialização específica do assistente (card)
    documento: Optional[str] = None  # texto extraído de um anexo
    documento_nome: Optional[str] = None


MAX_DOC_CHARS = 200_000


def _extrair_texto(nome, conteudo):
    ext = (nome.rsplit('.', 1)[-1] if '.' in (nome or '') else '').lower()
    if ext == 'pdf':
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(conteudo))
        return '\n'.join((pg.extract_text() or '') for pg in reader.pages).strip()
    if ext == 'docx':
        import docx
        d = docx.Document(io.BytesIO(conteudo))
        return '\n'.join(par.text for par in d.paragraphs).strip()
    if ext in ('txt', 'md', 'csv', 'json', 'rtf', 'htm', 'html', 'log'):
        for enc in ('utf-8', 'latin-1'):
            try:
                return conteudo.decode(enc).strip()
            except Exception:
                continue
        return conteudo.decode('utf-8', errors='ignore').strip()
    raise ValueError(f'Tipo .{ext} nao suportado. Anexe PDF, DOCX ou TXT.')


@router.post("/extrair")
async def extrair(arquivo: UploadFile = File(...)):
    conteudo = await arquivo.read()
    if len(conteudo) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Arquivo muito grande (max. 20 MB).")
    try:
        texto = _extrair_texto(arquivo.filename or "arquivo", conteudo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Nao foi possivel ler o documento: {e}")
    if not texto:
        raise HTTPException(status_code=422, detail="Documento sem texto extraivel (PDF escaneado/imagem?).")
    truncado = len(texto) > MAX_DOC_CHARS
    return {"nome": arquivo.filename, "texto": texto[:MAX_DOC_CHARS], "chars": len(texto), "truncado": truncado}


@router.get("/status")
async def status():
    """Indica ao frontend se o chat está configurado (sem expor a chave)."""
    base, key, model, nome = _provider()
    return {"configurado": bool(key), "modelo": model, "provider": nome}


@router.post("/chat")
async def chat(body: ChatRequest):
    base, key, model, nome = _provider()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Chat IA não configurado: defina GEMINI_API_KEY (grátis) ou OPENAI_API_KEY no servidor.",
        )
    msgs = [m for m in body.messages if (m.content or "").strip()]
    if not msgs:
        raise HTTPException(status_code=400, detail="Envie ao menos uma mensagem.")

    # Monta o prompt de sistema com a ESPECIALIZAÇÃO desta conversa.
    foco = []
    if body.assistente:
        rico = ESPECIALIZACOES.get(body.assistente)
        if rico:
            foco.append(rico)
        else:
            linha = f'Nesta conversa você atua ESPECIFICAMENTE como o assistente "{body.assistente}".'
            if body.descricao:
                linha += f" Especialização/tarefa deste assistente: {body.descricao}"
            foco.append(linha)
            foco.append("Concentre-se nessa especialização: entregue diretamente o que esse assistente faz e peça apenas as informações que faltarem.")
    if body.categoria and body.categoria not in ("", "Todas"):
        extra = FOCO_CATEGORIA.get(body.categoria)
        if extra:
            foco.append(f"Área de atuação: {body.categoria}. {extra}")
    system = SYSTEM_PROMPT + ("\n\n" + " ".join(foco) if foco else "")

    if body.documento and body.documento.strip():
        _doc = body.documento.strip()[:MAX_DOC_CHARS]
        _nome = body.documento_nome or "documento"
        system = system + f'\n\nDOCUMENTO ANEXADO PELO USUÁRIO ("{_nome}"). Use-o como base factual da resposta e seja fiel ao texto ao citar trechos.\n--- INÍCIO DO DOCUMENTO ---\n{_doc}\n--- FIM DO DOCUMENTO ---'

    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system}]
        + [{"role": m.role, "content": m.content} for m in msgs][-20:],  # janela das últimas 20 mensagens
        "temperature": 0.4,
        "max_tokens": _max_tokens(),
    }

    url = f"{base}/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                url,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Falha ao contatar o provedor de IA: {e}")

    if resp.status_code in (401, 403):
        raise HTTPException(status_code=502, detail=f"Chave do provedor de IA ({nome}) inválida ou sem permissão ({resp.status_code}).")
    if resp.status_code == 429:
        raise HTTPException(status_code=502, detail=f"Limite/quota do provedor de IA ({nome}) excedido (429). Tente novamente em instantes ou verifique o plano.")
    if resp.status_code >= 400:
        detalhe = ""
        try:
            j = resp.json()
            detalhe = (j.get("error") or {}).get("message") or ""
        except Exception:
            detalhe = resp.text[:300]
        raise HTTPException(status_code=502, detail=f"{nome} {resp.status_code}: {detalhe}")

    data = resp.json()
    reply = ((data.get("choices") or [{}])[0].get("message") or {}).get("content", "").strip()
    if not reply:
        raise HTTPException(status_code=502, detail="O provedor de IA não retornou resposta.")
    return {"reply": reply, "modelo": model, "provider": nome, "usage": data.get("usage") or {}}
