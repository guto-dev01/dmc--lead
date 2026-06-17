// Estilo dos badges por categoria — variações dentro da paleta "Precision"
// (ciano / verde / âmbar + semânticas), mantendo a identidade do sistema.
type BadgeStyle = { text: string; bg: string; border: string; dot: string }

const STYLES: BadgeStyle[] = [
  { text: 'text-[#12e7ff]', bg: 'bg-[#12e7ff]/10', border: 'border-[#12e7ff]/25', dot: 'bg-[#12e7ff]' },
  { text: 'text-[#00ff6a]', bg: 'bg-[#00ff6a]/10', border: 'border-[#00ff6a]/25', dot: 'bg-[#00ff6a]' },
  { text: 'text-[#f59e0b]', bg: 'bg-[#f59e0b]/10', border: 'border-[#f59e0b]/25', dot: 'bg-[#f59e0b]' },
  { text: 'text-[#7dd3fc]', bg: 'bg-[#7dd3fc]/10', border: 'border-[#7dd3fc]/25', dot: 'bg-[#7dd3fc]' },
  { text: 'text-[#34d399]', bg: 'bg-[#34d399]/10', border: 'border-[#34d399]/25', dot: 'bg-[#34d399]' },
]

// Mapa fixo categoria → estilo (determinístico, estável entre renders)
const MAP: Record<string, BadgeStyle> = {
  'Poder Judiciário': STYLES[0],
  'Criação de Peças Jurídicas': STYLES[1],
  'Revisão de Peças Jurídicas': STYLES[2],
  'Extração de Dados': STYLES[3],
  'Revisão e Melhoria de Textos': STYLES[4],
  'Estratégia do Caso': STYLES[0],
  Jurisprudência: STYLES[1],
  'Atendimento ao Cliente': STYLES[2],
  'Audiência e Julgamento': STYLES[3],
  'Marketing Jurídico': STYLES[4],
  Contratos: STYLES[0],
  'Negociação e Conflitos': STYLES[1],
  'Áreas do Direito': STYLES[2],
  'Segurança Pública': STYLES[3],
  'Otimização para IA do Judiciário': STYLES[4],
  'Transcrição de Áudio': STYLES[0],
}

export function categoryStyle(categoria: string): BadgeStyle {
  return MAP[categoria] ?? STYLES[0]
}
