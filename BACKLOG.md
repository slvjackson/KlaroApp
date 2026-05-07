# Klaro — Backlog Deferido

Itens identificados em discussões mas adiados pra não bloquear entregas.
Cada item lista contexto, motivação pra adiar, e o que destrava a retomada.

---

## Pilar 3 — Conteúdo que vive sem upload novo

### Desafio semanal
**Status:** não iniciado
**Contexto:** 1 desafio por semana ("reduza 10% em Marketing essa semana") com barra de progresso até domingo e recompensa ao completar.
**Por que adiamos:** sobrepõe conceitualmente com daily tasks do Pilar 1. Risco de UX confusa com dois sistemas paralelos de "tarefas".
**Destrava:** validar daily tasks em produção primeiro e ter clareza da diferença "missão de hoje" vs "desafio da semana".

### Replay mensal (estilo Spotify Wrapped)
**Status:** não iniciado
**Contexto:** cards animados no fim do mês com números do mês, evolução do score, conquistas. Compartilhável, com link público read-only.
**Por que adiamos:** feature de marketing/viralidade, não retenção diária pura. Roda 1×/mês — ROI é sobre aquisição, não engajamento recorrente.
**Destrava:** quando o foco shift de retenção pra growth/aquisição, ou quando tivermos base grande o suficiente pra movimento orgânico fazer diferença.

### Push notifications dinâmicos
**Status:** não iniciado
**Contexto:** notificações disparadas por sinal real ("3 transações sem categoria há 5 dias", "seu streak vence em 2h") em vez de cron fixo às 20h.
**Por que adiamos:** precisa de infra de push (FCM no mobile, decisão sobre Web Push API) configurada antes — fora do escopo das entregas atuais.
**Destrava:** setup de FCM no app mobile + decisão sobre push web.

---

## Pilar 3 — Today Card por IA

### `web_search` tool da Anthropic (contexto externo ao vivo)
**Status:** não iniciado
**Contexto:** SDK Anthropic suporta tool de busca web nativa. IA conseguiria puxar notícias do segmento, dados macro, eventos recentes ao vivo.
**Por que adiamos:** custo por chamada dobra/triplica. Vale só pra usuários premium ou casos específicos com alto valor por insight.
**Destrava:** definição de tier premium OU evidência de que usuários valorizam contexto externo ao vivo (sinal de churn por "cards não são informados o suficiente").

### Telemetria de cards
**Status:** não iniciado
**Contexto:** tracking de qual ângulo narrativo (callout / barChart / comparison / lineChart) o usuário mais clica, quais CTAs convertem, qual narrativa gera retorno no dia seguinte.
**Por que adiamos:** precisa estar em produção primeiro pra ter dados pra analisar.
**Destrava:** 30 dias de uso real + decisão de instrumentação (Posthog / eventos em DB próprio).

### Tela admin pra revisar samples e tunar prompt
**Status:** não iniciado
**Contexto:** gerador roda em produção sem audit. Precisa de UI pra ver últimas N gerações por segmento, marcar boas/ruins, ajustar prompt iterativamente.
**Por que adiamos:** só vira gargalo quando volume é caótico (>100 batches/dia).
**Destrava:** 100+ DAU usando o Today Card por IA.

### Tier "daily generation" pra premium
**Status:** não iniciado
**Contexto:** usuários premium ou de alto engajamento (streak >14d) recebem geração diária em vez do batch semanal. Custo justificado pelo tier.
**Por que adiamos:** depende de tier premium estar lançado e de evidência de que weekly não basta.
**Destrava:** lançamento de tier premium + sinal de churn por "card cansou".

### A/B test daily vs weekly batch
**Status:** não iniciado
**Contexto:** medir se geração diária aumenta retenção o suficiente pra justificar 7× o custo. Cohort A em weekly, cohort B em daily, comparar D7/D14 retention e abertura do card.
**Por que adiamos:** precisa de base estatisticamente significativa (~500 DAU) pra ter poder de teste.
**Destrava:** 500+ DAU.

---

## Pilar 1 — Habit Loop diário

### Paridade mobile (Streak + Daily Tasks + Pergunta do Dia)
**Status:** não iniciado
**Contexto:** endpoints já existem; falta o componente React Native equivalente ao `DailyHeader` do web.
**Por que adiamos:** foco prévio foi em validar o loop primeiro no web antes de duplicar pro mobile.
**Destrava:** estabilidade do desenho web (sem mudanças semanais) + foco em mobile.

---

## Backend / Operações

### Privacy review pra benchmarks agregados
**Status:** mitigação implementada, revisão pendente
**Contexto:** benchmarks de segmento puxam dados agregados de outros usuários. Risco teórico de inferência se um segmento tiver poucos usuários.
**Mitigação atual:** mínimo de 5 usuários por segmento antes de exibir benchmark; fallback "ainda construindo" quando menor.
**Destrava:** revisão jurídica/LGPD antes de escalar pra muitos segmentos ou expor benchmarks publicamente.

### Cache persistente de benchmarks (hoje em memória)
**Status:** v1 in-memory
**Contexto:** benchmarks são computados sob demanda e cached em memória por 1h. Em servidor multi-instância ou após restart, recomputamos.
**Por que adiamos:** v1 é single-instance, custo de recomputação aceitável.
**Destrava:** quando virarmos multi-instância OU quando o cálculo ficar caro o suficiente pra justificar uma tabela `segment_benchmarks` atualizada por cron.

### Modelo Sonnet pra usuários premium
**Status:** não iniciado
**Contexto:** atualmente todos usam Haiku 4.5 no Today Card. Sonnet entregaria narrativas mais ricas — mas 5× mais caro.
**Por que adiamos:** weekly + Haiku já entrega valor e custo controlado. Sonnet só quando tiver tier premium pra absorver custo.
**Destrava:** lançamento de tier premium.

---

## Insights & Missões

### Auto-tagging via IA + filtro por tag no histórico
**Status:** não iniciado
**Contexto:** Fase 3 do redesenho de ciclo de vida de insights. A mesma chamada Haiku que hoje gera título/steps em background no `POST /insights` passaria a devolver também 1-2 tags semânticas (`["fornecedores", "food-cost"]`). Coluna `tags: text[]` no schema. Filtro por tag adicional na página de Histórico — usuário não escreve nada e ainda assim consegue achar "todos os insights de fornecedores".
**Por que adiamos:** Fase 1 (estados de ciclo de vida) + Fase 2 (histórico com search por texto + filtro por tom) já cobrem o caso real. Tag manual era pior (fricção pra 100% dos usuários, valor pra ~5%); tag automática só faz sentido depois que o histórico crescer e search por texto começar a falhar.
**Destrava:** quando o histórico de algum usuário passar de ~50 itens E houver sinal de que `Ctrl+F` no título/descrição não basta (ex: usuário pedir "tag por categoria" explicitamente, ou heatmap de busca mostrar queries genéricas demais). Adicionar `tags` ao prompt da Haiku que já roda; sem nova chamada de IA.

---

## Como manter este doc

- Toda decisão de "vamos deixar pra depois" durante implementação vira entrada aqui, com **status / contexto / motivo / destrava**.
- Quando um item for retomado, mover pra um histórico ou simplesmente remover (Git tem o registro).
- Não usar como TODO list ativa — é registro de débito consciente, não fila de trabalho.
