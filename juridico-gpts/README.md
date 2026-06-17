# Assistentes Jurídicos IA

Diretório web de **78 GPTs especializados em Direito Brasileiro**, organizados por
categoria, com busca e filtro. Cada card abre o assistente diretamente no ChatGPT.

Construído em **React + TypeScript + Vite + TailwindCSS**, tema escuro, seguindo a
paleta de design **"Precision"** do ImobPro (fundo grafite/teal, accent neon
ciano→verde, fonte Geist).

## Abas

- **GPTs Jurídicos** — diretório completo (busca, filtro por categoria, contador, grid responsivo).
- **Chat IA** — placeholder de chat (interface pronta; precisa conectar um provedor de IA para funcionar).
- **Dashboard** — métricas e distribuição dos assistentes por categoria.

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build de produção

```bash
npm run build    # gera ./dist
npm run preview  # serve o build localmente
```

## Estrutura

```
src/
  App.tsx                 layout, abas, cabeçalho e rodapé
  data/gpts.ts            os 78 assistentes + lista de categorias
  types.ts                tipos (Gpt, Tab)
  lib/categoryStyle.ts    cores dos badges por categoria
  components/
    TabNav.tsx            navegação por abas
    GptsDirectory.tsx     busca + filtros + grid + contador
    GptCard.tsx           card individual (abre o link no ChatGPT)
    ChatPlaceholder.tsx   aba Chat IA (placeholder)
    Dashboard.tsx         aba Dashboard (estatísticas)
```

> ⚠️ Os documentos gerados pelos assistentes são **minutas** e devem ser revisados
> por profissional habilitado antes de uso oficial.
