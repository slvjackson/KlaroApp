# Klaro — Mockups HTML

Protótipo hi-fi em HTML+React (via Babel standalone) das telas do Klaro.

## Estrutura

- `Klaro App.html` — entrypoint (abrir no navegador)
- `app.jsx` — router por hash, páginas (home/login/signup/dashboard/transactions/insights/chat/upload/profile/404)
- `components.jsx` — Sidebar, TopBar, SummaryCard, MonthlyChart, CategoryDonut, TransactionsList, InsightsCard, Icon, KlaroMark
- `chat.jsx` — painel de chat com o assistente Klaro
- `data.jsx` — dados mock (BRL, SUMMARY, MONTHLY, CATEGORIES, TRANSACTIONS, INSIGHTS, SUGGESTIONS, REPLIES)

## Como rodar

Basta abrir `Klaro App.html` em qualquer navegador moderno — não precisa de servidor nem build.
Para navegar entre rotas use a barra de pílulas no rodapé ou mude o `#/rota` na URL.

## Caminho sugerido no repo

`artifacts/klaro/mockups/`
