# Estudo de Custos — KlaroApp

> Última atualização: 29/04/2026  
> Taxa de câmbio utilizada: **R$5,02 por USD** (29/04/2026)  
> Faixa analisada: 1 a 1.000 clientes ativos

---

## Modelo de precificação

| Segmento | Preço/mês |
|----------|:---------:|
| Primeiros 100 clientes (1–100) | R$99 |
| A partir do 101º cliente | R$149 |

> Os primeiros 10 clientes são considerados beta/founders (receita zero) — usado como piso no modelo de projeção.  
> Fórmula da receita: `(min(clientes, 100) − 10) × R$99 + max(clientes − 100, 0) × R$149`

---

## Stack de produção

| Serviço | Função |
|---------|--------|
| **Railway** | API server Node.js (autodeploy via GitHub) |
| **Neon** | PostgreSQL serverless com connection pooler |
| **Anthropic** | Sonnet 4.6 (geração de insights) + Haiku 4.5 (plano de ação de missões) |
| **Vercel** | Web app estático (Vite/React) |
| **Expo EAS** | Build e OTA updates do app mobile |

---

## Custo de IA por usuário/mês

### Premissas de uso

| Comportamento | Valor assumido |
|---------------|---------------|
| Gerações de insights por mês | 4× |
| Missões criadas por mês | 6× |

### Custo por operação

| Operação | Modelo | Input | Output | Preço/chamada | Freq./mês | Custo/usuário |
|----------|--------|-------|--------|:------------:|:---------:|:-------------:|
| Gerar insights | claude-sonnet-4-6 | ~750 tokens | ~800 tokens | R$0,07 | 4× | R$0,29 |
| Criar missão (steps) | claude-haiku-4-5 | ~175 tokens | ~200 tokens | R$0,005 | 6× | R$0,03 |
| **Total IA** | | | | | | **~R$0,32/usuário** |

### Tabela de preços Anthropic (convertidos)

| Modelo | Input | Output |
|--------|-------|--------|
| claude-sonnet-4-6 | R$15,06 / 1M tokens | R$75,30 / 1M tokens |
| claude-haiku-4-5 | R$4,02 / 1M tokens | R$20,08 / 1M tokens |

---

## Custos por faixa de clientes

| Clientes | Railway | Neon | Anthropic | Vercel | **Total/mês** | **Custo/usuário** |
|----------|:-------:|:----:|:---------:|:------:|:-------------:|:-----------------:|
| **1–100** | R$75 | R$0 free | R$5–30 | R$0 free | **~R$80–105** | ~R$1,05 |
| **101–200** | R$75 | R$95 Launch | R$35–65 | R$0 free | **~R$205–235** | ~R$1,18 |
| **201–300** | R$100 | R$95 | R$65–95 | R$0 free | **~R$260–290** | ~R$0,97 |
| **301–400** | R$100 | R$95 | R$95–126 | R$0 free | **~R$290–321** | ~R$0,80 |
| **401–500** | R$125 | R$95 | R$126–161 | R$0 free | **~R$346–381** | ~R$0,76 |
| **501–600** | R$151 | R$95 | R$161–191 | R$0 free | **~R$407–437** | ~R$0,73 |
| **601–700** | R$176 | R$95 | R$191–221 | R$100 Pro | **~R$562–592** | ~R$0,85 |
| **701–800** | R$201 | R$95 | R$221–256 | R$100 | **~R$617–652** | ~R$0,82 |
| **801–900** | R$226 | R$95 | R$256–286 | R$100 | **~R$677–707** | ~R$0,79 |
| **901–1.000** | R$251 | R$95 | R$286–317 | R$100 | **~R$732–763** | ~R$0,76 |

### Notas por serviço

**Railway**
- Hobby plan (R$25 base) + uso de compute (vCPU + RAM).
- 1 réplica cobre bem até ~600 usuários simultâneos.
- Acima disso considerar 2 réplicas ou upgrade de plano (~+R$75/mês).

**Neon**
- Free tier: 512 MB storage, suficiente para ~100 usuários.
- Launch (R$95/mês): 10 GB storage, cobre até ~5.000 usuários (dados do app ≈ 300 KB/usuário ativo).
- Scale (R$346/mês): necessário apenas acima de ~2.000 usuários com alta concorrência de queries.

**Vercel**
- Hobby (free): 100 GB/mês bandwidth, suficiente até ~600 usuários.
- Pro (R$100/mês): bandwidth ilimitado, analytics, preview deployments por branch.
- Alternativa zero-custo: **Cloudflare Pages** (CDN global, builds ilimitados, sem limite de bandwidth).

---

## Custos fixos (independem do número de usuários)

| Item | Custo |
|------|-------|
| Apple Developer Program | R$497/ano (~R$41/mês) |
| Google Play (cadastro único) | R$126 one-time |
| Domínio (.com.br ou .app) | ~R$75–201/ano |
| Expo EAS Build | Free até 30 builds/mês; Production R$497/mês |

---

## Providers recomendados para adicionar

| Provider | Função | Custo |
|----------|--------|-------|
| **Cloudflare R2** | Armazenar arquivos CSV de upload (hoje processados em memória) | R$0,075/GB + egress grátis |
| **Cloudflare Pages** | Hospedagem web alternativa ao Vercel — CDN global, builds ilimitados | R$0 para apps estáticos |
| **Upstash Redis** | Rate limiting na API, cache de sessão e deduplicação de requisições | R$0 free tier (10K req/dia); R$50/mês escalável |
| **Resend** | E-mails transacionais — confirmação de conta, relatório semanal de insights | Grátis até 3K/mês; R$100/mês até 50K |
| **Sentry** | Error tracking — captura crashes da API e do app mobile com stack trace | Grátis até 5K erros/mês; R$131/mês pro |
| **Clerk** | Auth gerenciado — elimina sessão/senha própria, suporta OAuth e MFA | Grátis até 10K MAU; R$126/mês além disso |

---

## Otimização: Prompt Caching (Anthropic)

O `generateInsights` envia o contexto de anamnese + perfil do negócio em toda chamada ao Sonnet 4.6. Esse conteúdo é estático entre chamadas do mesmo usuário — candidato ideal a **prompt caching**.

| Métrica | Sem cache | Com cache (leitura) | Economia |
|---------|:---------:|:-------------------:|:--------:|
| Custo tokens de contexto | R$15,06/1M | R$1,51/1M | **10× mais barato** |
| Economia por chamada | — | ~R$0,0065 | — |
| Economia com 1.000 usuários × 4 chamadas/mês | — | **~R$25/mês** | — |

Impacto pequeno agora, relevante acima de 2.000 usuários. Implementação: adicionar `cache_control: { type: "ephemeral" }` no bloco de system/context da chamada.

---

## Resumo executivo

```
1.000 clientes ativos  (90 × R$99 + 900 × R$149)
──────────────────────────────────────────────────
Receita MRR:         R$143.010/mês
Infra total:         ~R$766/mês    (0,5% da receita)
Lucro bruto:         ~R$142.244/mês
Pró-labore (2 sócios): R$50.000/mês  (R$25.000 cada)
Lucro após pró-labore: ~R$92.244/mês
Caixa acumulado:     ~R$453.908

Custo de infra por cliente: ~R$0,77/mês
Custo de IA por cliente:    ~R$0,32/mês  (42% do custo variável)
```

### Pontos de atenção por faixa

| Marco | O que muda |
|-------|-----------|
| **~100 usuários** | Neon passa de free → Launch (+R$95/mês). Maior salto proporcional. |
| **~600 usuários** | Vercel passa de free → Pro (+R$100/mês). Avaliar migrar para Cloudflare Pages para evitar. |
| **~800 usuários** | Railway pode precisar de 2 réplicas dependendo de picos de uso. |
| **~2.000 usuários** | Reavaliar Neon Scale e implementar prompt caching. |
| **~5.000 usuários** | Considerar contrato Railway Pro e negociar volume Anthropic. |

---

## Roadmap de Clientes — Projeção Financeira

> Custos de infra calculados com base nos valores reais de Railway + Neon + Anthropic + Vercel.  
> Lucro Bruto = Receita − Infra. Caixa acumulado = soma corrida do Lucro Bruto (antes de retiradas de pró-labore).

| Clientes | Receita | Infra (real) | Lucro Bruto | Pró-labore total | Pró-labore (cada) | Caixa acumulado |
|:--------:|--------:|:------------:|------------:|-----------------:|------------------:|----------------:|
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

⚠️ **150 clientes** — Neon sobe de free para Launch (+R$95/mês).  
⚠️ **700 clientes** — Vercel sobe de free para Pro (+R$100/mês).

### Composição do custo de infra por marco

| Clientes | Railway | Neon | Anthropic (IA) | Vercel | **Total** |
|:--------:|:-------:|:----:|:--------------:|:------:|:---------:|
| 0 | R$75 | R$0 | R$0 | R$0 | R$75 |
| 10 | R$75 | R$0 | R$3 | R$0 | R$78 |
| 30 | R$75 | R$0 | R$10 | R$0 | R$85 |
| 50 | R$75 | R$0 | R$16 | R$0 | R$91 |
| 100 | R$80 | R$0 | R$32 | R$0 | R$112 |
| 150 | R$80 | R$95 | R$48 | R$0 | R$223 |
| 200 | R$85 | R$95 | R$64 | R$0 | R$244 |
| 300 | R$100 | R$95 | R$96 | R$0 | R$291 |
| 400 | R$110 | R$95 | R$128 | R$0 | R$333 |
| 500 | R$125 | R$95 | R$160 | R$0 | R$380 |
| 700 | R$165 | R$95 | R$224 | R$100 | R$584 |
| 1.000 | R$251 | R$95 | R$320 | R$100 | R$766 |
