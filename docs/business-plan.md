# Business Plan — KlaroApp

> Versão 1.0 — Abril 2026  
> Confidencial

---

## 1. Sumário Executivo

**KlaroApp** é uma plataforma de inteligência financeira com IA para micro e pequenos empreendedores brasileiros que não têm budget para contratar um analista de dados, um CFO ou ferramentas corporativas.

Em vez de entregar dashboards que o empreendedor não sabe interpretar, o Klaro transforma dados financeiros em **insights acionáveis** e **planos de ação passo a passo** — como ter um consultor financeiro no bolso por R$99/mês.

O diferencial de entrada de dados é total: o empreendedor pode enviar **CSV, PDF, extrato bancário, foto do caderninho ou mensagem pelo WhatsApp**. Nenhuma ferramenta concorrente aceita qualquer coisa que o usuário já tem na mão.

**Stage atual:** Produto em desenvolvimento (MVP funcional), sem clientes pagantes.  
**Time:** 2 sócios — 1 técnico, 1 comercial.  
**Modelo:** SaaS mensal, R$99 (primeiros 100 clientes) → R$149.  
**Captação:** Bootstrapped. Sem necessidade de investimento externo no momento.

---

## 2. Problema

O Brasil tem mais de **14 milhões de MEIs** e ~6 milhões de micro e pequenas empresas. A grande maioria toma decisões financeiras no escuro:

- **Dados existem, mas não viram decisão.** O empreendedor sabe quanto entrou e saiu, mas não sabe o que fazer com isso.
- **Ferramentas disponíveis exigem conhecimento contábil.** ERPs como Conta Azul, Nibo e Omie entregam relatórios e dashboards — não prescrevem ações.
- **Contratar ajuda especializada é caro.** Um contador faz o básico fiscal; um analista de dados ou CFO está fora do alcance financeiro do MEI.
- **A consequência:** decisões por intuição, fluxo de caixa descontrolado e negócios que morrem nos primeiros 5 anos por má gestão financeira (60% dos MEIs fecham antes de 5 anos — SEBRAE 2024).

---

## 3. Solução

**KlaroApp = inteligência financeira com IA, acessível e prescritiva.**

O fluxo do produto:

```
Envio de dados em qualquer formato
(CSV · PDF · extrato bancário · foto do caderninho · mensagem no WhatsApp)
        ↓
Leitura e interpretação por IA (OCR + parsing automático)
        ↓
Análise financeira por IA (Claude Sonnet)
        ↓
Insights: "Seu custo fixo cresceu 18% sem aumento de receita"
        ↓
Missão com plano de ação: "1. Mapeie seus custos fixos. 2. Negocie contratos com fornecedores. ..."
        ↓
Empreendedor executa com clareza
```

**O que diferencia o Klaro:**

| Atributo | Klaro | ERPs tradicionais |
|----------|:-----:|:-----------------:|
| Insights em linguagem simples | ✅ | ❌ |
| Plano de ação gerado por IA | ✅ | ❌ |
| Aceita qualquer formato de dados (CSV, PDF, foto, extrato, WhatsApp) | ✅ | ❌ |
| Não exige conhecimento contábil | ✅ | ❌ |
| Acesso via WhatsApp | ✅ | ❌ |
| Mobile-first | ✅ | Parcial |
| Preço acessível para MEI | ✅ | ❌ |
| Setup em menos de 5 minutos | ✅ | ❌ |

---

## 4. Mercado

### Tamanho do mercado (Brasil)

| Segmento | Tamanho |
|----------|--------:|
| MEIs ativos | ~14 milhões |
| Microempresas (ME) | ~4 milhões |
| Pequenas empresas (EPP) | ~2 milhões |
| **Total endereçável (TAM)** | **~20 milhões** |

### Mercado alcançável (SAM)

Empreendedores com smartphone, acesso à internet e disposição de pagar por ferramenta digital de gestão financeira:

- Estimativa conservadora: 8–12% do TAM
- **SAM: ~1,6–2,4 milhões de negócios**

### Mercado capturável nos primeiros 3 anos (SOM)

- Meta realista: 5.000 a 15.000 clientes
- Com R$149 ARPU médio estabilizado: **R$0,7M–R$2,2M MRR**

### Por que agora

- IA generativa viabilizou análise prescritiva a custo acessível (Haiku 4.5 = R$0,005/ação).
- PIX e digitalização acelerada do MEI: mais dados financeiros disponíveis.
- Geração de empreendedores digitais que cobra experiência mobile-first.
- Nenhum player direto ocupa o espaço de "consultoria financeira com IA para MEI".

---

## 5. Produto

### Funcionalidades atuais (MVP)

| Feature | Status |
|---------|--------|
| Importação de transações via CSV | ✅ |
| Anamnese — perfil do negócio e contexto setorial | ✅ |
| Geração de insights financeiros por IA | ✅ |
| Missões com plano de ação passo a passo | ✅ |
| App mobile (iOS + Android) | ✅ |
| Web app | ✅ |
| Autenticação e sessão segura | ✅ |

### Roadmap (próximos 12 meses)

| Prioridade | Feature | Impacto |
|:----------:|---------|---------|
| 🔴 Alta | Leitura de PDF e extrato bancário (OCR + parsing por IA) | Elimina dependência do CSV; qualquer banco |
| 🔴 Alta | Leitura de foto do caderninho / nota fiscal (OCR mobile) | Atende empreendedor mais informal; diferencial único |
| 🔴 Alta | Canal WhatsApp — envio de dados e recebimento de insights via bot | Acesso onde o MEI já está; zero fricção de onboarding |
| 🔴 Alta | Relatório semanal por e-mail | Retenção e engajamento passivo |
| 🟡 Média | Integração bancária via Open Finance | Alimentação automática de dados; maior retenção |
| 🟡 Média | Categorização automática de despesas | Reduz fricção na confirmação de transações |
| 🟡 Média | Comparativo de desempenho por setor | Diferencial competitivo e benchmarking |
| 🟢 Baixa | Dashboard de metas e acompanhamento | Gamificação e retenção longa |
| 🟢 Baixa | Multi-empresa (contador gerencia vários clientes) | Canal B2B2C via contadores |

---

## 6. Modelo de Negócio

### Precificação

| Plano | Preço/mês | Público |
|-------|:---------:|---------|
| **Starter** (primeiros 100 clientes) | R$99 | Early adopters, MEIs |
| **Pro** (a partir do 101º) | R$149 | Crescimento sustentado |

> Os primeiros 10 clientes são onboardados sem cobrança (validação e depoimentos).

### Métricas de saúde do SaaS

| Métrica | Referência assumida |
|---------|-------------------|
| Churn mensal (inicial) | 4–5% |
| Churn mensal (maduro, 12m+) | 2–3% |
| LTV médio (R$149 × 18 meses) | ~R$2.682 |
| CAC estimado (tráfego pago) | R$200–350 |
| LTV/CAC | 7–13× |
| Payback do CAC | 2–3 meses |

---

## 7. Go-to-Market

### Fase 1 — Validação (meses 1–3)

- Onboarding manual dos primeiros 10–30 clientes (gratuito).
- Foco em coletar depoimentos, identificar fricções no produto e validar proposta de valor.
- Canal: rede pessoal dos sócios, grupos de WhatsApp de empreendedores, comunidades no Instagram.

### Fase 2 — Tração (meses 4–9)

- **Tráfego pago:** Meta Ads + Google Ads direcionados a MEI/microempresário. Criativos focados na dor ("você sabe quanto está gastando, mas não sabe o que fazer?").
- **Vendas diretas:** Sócio comercial prospecta ativamente grupos de empreendedores, associações comerciais locais, redes de franqueados pequenos.
- **Conteúdo orgânico:** Instagram/TikTok com dicas financeiras práticas — construção de audiência qualificada.
- Meta: 100 clientes pagantes ao fim da Fase 2.

### Fase 3 — Escala (meses 10–24)

- Intensificação do tráfego pago com budget crescente (reinvestimento da receita).
- **Canal contador:** Parceria com escritórios de contabilidade que indicam o Klaro para seus clientes MEI (revenue share ou comissão por indicação).
- **SEO e inbound:** conteúdo sobre gestão financeira para MEI.
- Meta: 300–500 clientes pagantes ao fim do ano 2.

### Budget de aquisição estimado

| Fase | Budget/mês | CAC alvo | Novos clientes/mês |
|------|:----------:|:--------:|:-----------------:|
| Fase 2 | R$2.000–5.000 | R$300 | 7–17 |
| Fase 3 | R$8.000–15.000 | R$250 | 32–60 |

---

## 8. Projeção Financeira

> Baseada nos custos reais de infraestrutura (Railway + Neon + Anthropic + Vercel).  
> Taxa de câmbio: R$5,02/USD (29/04/2026).

| Clientes | Receita/mês | Infra/mês | Lucro Bruto | Pró-labore total | Pró-labore (cada) | Caixa acumulado |
|:--------:|------------:|:---------:|------------:|-----------------:|------------------:|----------------:|
| **0** | R$0 | R$75 | −R$75 | R$0 | R$0 | −R$75 |
| **10** | R$0 | R$78 | −R$78 | R$0 | R$0 | −R$153 |
| **30** | R$1.980 | R$85 | R$1.895 | R$0 | R$0 | R$1.742 |
| **50** | R$3.960 | R$91 | R$3.869 | R$0 | R$0 | R$5.611 |
| **100** | R$8.910 | R$112 | R$8.798 | R$0 | R$0 | R$14.409 |
| **150** ⚠️ | R$16.360 | R$223 | R$16.137 | R$6.000 | R$3.000 | R$30.546 |
| **200** | R$23.810 | R$244 | R$23.566 | R$12.000 | R$6.000 | R$54.112 |
| **300** | R$38.710 | R$291 | R$38.419 | R$18.000 | R$9.000 | R$92.531 |
| **400** | R$53.610 | R$333 | R$53.277 | R$24.000 | R$12.000 | R$145.808 |
| **500** | R$68.510 | R$380 | R$68.130 | R$30.000 | R$15.000 | R$213.938 |
| **700** ⚠️ | R$98.310 | R$584 | R$97.726 | R$40.000 | R$20.000 | R$311.664 |
| **1.000** | R$143.010 | R$766 | R$142.244 | R$50.000 | R$25.000 | R$453.908 |

⚠️ **150 clientes** — Neon sobe para plano Launch (+R$95/mês).  
⚠️ **700 clientes** — Vercel sobe para plano Pro (+R$100/mês).

### Cenário de crescimento — 24 meses

| Período | Clientes | MRR | Observação |
|---------|:--------:|----:|-----------|
| Mês 3 | 30 | R$1.980 | Beta encerrado, primeiros pagantes |
| Mês 6 | 80 | R$6.930 | Tráfego pago iniciado |
| Mês 9 | 130 | R$13.360 | Break-even operacional |
| Mês 12 | 200 | R$23.810 | Pró-labore R$6k/sócio |
| Mês 18 | 400 | R$53.610 | Pró-labore R$12k/sócio |
| Mês 24 | 700 | R$98.310 | Pró-labore R$20k/sócio |

> **Break-even operacional estimado:** entre 80–100 clientes pagantes (~mês 6–9).

---

## 9. Custos e Estrutura

### Infraestrutura tecnológica (detalhamento)

| Serviço | Função | Custo (1.000 clientes) |
|---------|--------|:---------------------:|
| Railway | API server | R$251/mês |
| Neon | Banco de dados PostgreSQL | R$95/mês |
| Anthropic | IA (insights + missões) | R$320/mês |
| Vercel | Web app | R$100/mês |
| **Total infra** | | **R$766/mês** |

### Custos fixos operacionais

| Item | Custo |
|------|-------|
| Apple Developer Program | R$497/ano |
| Google Play | R$126 (único) |
| Domínio | ~R$100/ano |
| Ferramentas (Figma, Notion, etc.) | ~R$200/mês |

### Custo de aquisição (Fase 2+)

- Budget inicial de tráfego pago: R$2.000–5.000/mês
- Reinvestimento progressivo conforme MRR cresce

---

## 10. Time

| Sócio | Papel | Responsabilidade |
|-------|-------|-----------------|
| **Técnico** | CTO / Produto | Desenvolvimento, infraestrutura, IA, produto |
| **Comercial** | CEO / Growth | Vendas, marketing, parcerias, operação |

**Vantagem do modelo:**
- Infra 100% cloud, sem custo de servidor próprio.
- IA como serviço (Anthropic) — sem necessidade de time de dados.
- Produto cross-platform (web + mobile) com uma única base de código compartilhada.
- Time enxuto consegue escalar até ~1.000 clientes sem contratação.

**Próximas contratações previstas (acima de 500 clientes):**
- Suporte ao cliente / Customer Success (1 pessoa)
- Marketing de conteúdo (freelancer ou CLT)

---

## 11. Análise Competitiva

### Panorama atual

| Concorrente | Foco | Preço | IA prescritiva | Qualquer formato de entrada | WhatsApp |
|-------------|------|:-----:|:--------------:|:--------------------------:|:--------:|
| **Conta Azul** | ERP + NF-e + contabilidade | R$69–349/mês | ❌ | ❌ | ❌ |
| **Nibo** | Gestão financeira + contador | R$79–299/mês | ❌ | ❌ | ❌ |
| **Omie** | ERP completo | R$119–499/mês | ❌ | ❌ | ❌ |
| **Granatum** | Planejamento orçamentário | R$89–249/mês | ❌ | ❌ | ❌ |
| **Excel/Planilhas** | Manual | R$0 | ❌ | ❌ | ❌ |
| **KlaroApp** | Insights + plano de ação com IA | R$99–149/mês | ✅ | ✅ | ✅ |

### Posicionamento

O Klaro **não compete** diretamente com ERPs. Enquanto eles resolvem o problema de **registrar e organizar** dados, o Klaro resolve o problema de **entender e agir** sobre eles.

> **Tagline:** *"Você já tem os dados. O Klaro te diz o que fazer com eles."*

---

## 12. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|:------------:|:-------:|-----------|
| Churn alto por falta de engajamento | Alta | Alto | E-mail semanal automático, notificações push, missões gamificadas |
| Custo de aquisição acima do previsto | Média | Alto | Testar canais orgânicos (TikTok, SEO) em paralelo; canal contadores |
| Concorrente grande copia feature de IA | Média | Médio | Velocidade de execução + profundidade de personalização por segmento |
| Aumento de preço da API Anthropic | Baixa | Médio | Prompt caching implementado; possibilidade de migrar modelo se necessário |
| Qualidade do OCR em fotos de baixa resolução | Média | Médio | Feedback imediato ao usuário com opção de revisão manual; melhoria contínua do modelo |
| Custo adicional de infraestrutura WhatsApp (Meta API) | Baixa | Baixo | WhatsApp Business API via Twilio ou Z-API; custo por mensagem ~R$0,08, absorvível no plano |
| Inadimplência / cancelamento em massa | Baixa | Alto | Cobrança anual com desconto; contratos semestrais para clientes maiores |

---

## 13. Próximos Passos

### Curto prazo (0–3 meses)

- [ ] Finalizar MVP e estabilizar produto
- [ ] Onboarding dos primeiros 10 clientes beta (gratuito)
- [ ] Coletar feedback estruturado e iterar
- [ ] Definir identidade visual e posicionamento de marca
- [ ] Criar página de vendas (landing page com CTA de cadastro)

### Médio prazo (3–9 meses)

- [ ] Lançar tráfego pago (Meta Ads) com budget inicial de R$2.000/mês
- [ ] Atingir 100 clientes pagantes
- [ ] Implementar integração Open Finance (maior prioridade de produto)
- [ ] Iniciar canal de conteúdo (Instagram + TikTok) sobre finanças para MEI
- [ ] Estruturar processo de CS para reduzir churn

### Longo prazo (9–24 meses)

- [ ] Atingir 300–500 clientes pagantes
- [ ] Lançar canal de parceiros contadores
- [ ] Avaliar expansão de features (metas, fluxo de caixa projetado, DRE simplificado)
- [ ] Reavaliar pricing e criação de plano anual com desconto
- [ ] Considerar captação externa se crescimento orgânico demandar aceleração

---

## Apêndice — Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| API | Node.js + Express (Railway) |
| Banco de dados | PostgreSQL via Neon (serverless) |
| IA — Insights | Claude Sonnet 4.6 (Anthropic) |
| IA — Planos de ação | Claude Haiku 4.5 (Anthropic) |
| Web app | React + Vite (Vercel) |
| Mobile | React Native + Expo (iOS + Android) |
| Auth | Sessão server-side com cookie seguro |
| Monorepo | pnpm workspaces |
