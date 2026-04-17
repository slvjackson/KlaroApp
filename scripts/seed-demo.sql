-- Klaro demo seed
-- Run with: psql "postgresql://..." -f scripts/seed-demo.sql

-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_inputs (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL,
  file_name         TEXT NOT NULL,
  file_type         TEXT NOT NULL,
  original_text     TEXT,
  file_path         TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS parsed_records (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL,
  raw_input_id   INTEGER,
  date           TEXT NOT NULL,
  description    TEXT NOT NULL,
  amount         REAL NOT NULL,
  type           TEXT NOT NULL,
  category       TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL,
  date              TEXT NOT NULL,
  description       TEXT NOT NULL,
  amount            REAL NOT NULL,
  type              TEXT NOT NULL,
  category          TEXT NOT NULL,
  quantity          REAL,
  source_raw_input_id INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insights (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  recommendation  TEXT NOT NULL,
  period_label    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Demo user (senha: klaro123) ──────────────────────────────────────────────
-- bcrypt hash of "klaro123" with 10 rounds
INSERT INTO users (name, email, password_hash)
VALUES (
  'Demo User',
  'demo@klaro.app',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
)
ON CONFLICT (email) DO NOTHING;

-- ── Transactions for user_id = 1 ─────────────────────────────────────────────
DELETE FROM transactions WHERE user_id = 1;

INSERT INTO transactions (user_id, date, description, amount, type, category) VALUES
-- Janeiro 2026
(1, '2026-01-05', 'Salário',                  8500.00, 'income',  'Renda'),
(1, '2026-01-10', 'Freelance design',          1200.00, 'income',  'Freelance'),
(1, '2026-01-02', 'Aluguel',                   2200.00, 'expense', 'Moradia'),
(1, '2026-01-03', 'Condomínio',                 480.00, 'expense', 'Moradia'),
(1, '2026-01-08', 'Supermercado Pão de Açúcar', 638.50, 'expense', 'Alimentação'),
(1, '2026-01-12', 'Feira livre',                128.00, 'expense', 'Alimentação'),
(1, '2026-01-15', 'iFood',                       89.90, 'expense', 'Alimentação'),
(1, '2026-01-07', 'Gasolina',                   275.00, 'expense', 'Transporte'),
(1, '2026-01-18', 'Uber',                        58.50, 'expense', 'Transporte'),
(1, '2026-01-02', 'Plano de saúde',             520.00, 'expense', 'Saúde'),
(1, '2026-01-22', 'Farmácia',                    92.30, 'expense', 'Saúde'),
(1, '2026-01-05', 'Netflix',                     45.90, 'expense', 'Lazer'),
(1, '2026-01-05', 'Spotify',                     21.90, 'expense', 'Lazer'),
(1, '2026-01-20', 'Academia',                   110.00, 'expense', 'Lazer'),
(1, '2026-01-14', 'Conta de luz',               195.40, 'expense', 'Moradia'),
(1, '2026-01-14', 'Conta de água',               82.00, 'expense', 'Moradia'),
(1, '2026-01-10', 'Internet',                   119.90, 'expense', 'Moradia'),
(1, '2026-01-10', 'Celular Tim',                 98.00, 'expense', 'Serviços'),
(1, '2026-01-25', 'Restaurante',                 94.00, 'expense', 'Alimentação'),
(1, '2026-01-17', 'Padaria',                     43.50, 'expense', 'Alimentação'),
(1, '2026-01-28', 'Curso online Udemy',           89.90, 'expense', 'Educação'),

-- Fevereiro 2026
(1, '2026-02-05', 'Salário',                  8500.00, 'income',  'Renda'),
(1, '2026-02-18', 'Rendimento CDB',             185.20, 'income',  'Investimentos'),
(1, '2026-02-02', 'Aluguel',                   2200.00, 'expense', 'Moradia'),
(1, '2026-02-03', 'Condomínio',                 480.00, 'expense', 'Moradia'),
(1, '2026-02-09', 'Supermercado Pão de Açúcar', 592.00, 'expense', 'Alimentação'),
(1, '2026-02-15', 'Feira livre',                142.00, 'expense', 'Alimentação'),
(1, '2026-02-20', 'iFood',                       76.40, 'expense', 'Alimentação'),
(1, '2026-02-06', 'Gasolina',                   290.00, 'expense', 'Transporte'),
(1, '2026-02-22', 'Manutenção carro',           340.00, 'expense', 'Transporte'),
(1, '2026-02-02', 'Plano de saúde',             520.00, 'expense', 'Saúde'),
(1, '2026-02-14', 'Consulta médica',            250.00, 'expense', 'Saúde'),
(1, '2026-02-05', 'Netflix',                     45.90, 'expense', 'Lazer'),
(1, '2026-02-05', 'Spotify',                     21.90, 'expense', 'Lazer'),
(1, '2026-02-15', 'Cinema',                      68.00, 'expense', 'Lazer'),
(1, '2026-02-01', 'Academia',                   110.00, 'expense', 'Lazer'),
(1, '2026-02-13', 'Conta de luz',               178.60, 'expense', 'Moradia'),
(1, '2026-02-13', 'Conta de água',               86.00, 'expense', 'Moradia'),
(1, '2026-02-10', 'Internet',                   119.90, 'expense', 'Moradia'),
(1, '2026-02-10', 'Celular Tim',                 98.00, 'expense', 'Serviços'),
(1, '2026-02-25', 'Roupa Renner',               215.00, 'expense', 'Vestuário'),
(1, '2026-02-19', 'Cafeteria',                   37.50, 'expense', 'Alimentação'),

-- Março 2026
(1, '2026-03-05', 'Salário',                  8500.00, 'income',  'Renda'),
(1, '2026-03-12', 'Consultoria extra',          900.00, 'income',  'Freelance'),
(1, '2026-03-02', 'Aluguel',                   2200.00, 'expense', 'Moradia'),
(1, '2026-03-03', 'Condomínio',                 480.00, 'expense', 'Moradia'),
(1, '2026-03-07', 'Supermercado Pão de Açúcar', 671.20, 'expense', 'Alimentação'),
(1, '2026-03-14', 'Feira livre',                118.00, 'expense', 'Alimentação'),
(1, '2026-03-21', 'iFood',                       95.80, 'expense', 'Alimentação'),
(1, '2026-03-05', 'Gasolina',                   263.00, 'expense', 'Transporte'),
(1, '2026-03-19', 'Uber',                        72.00, 'expense', 'Transporte'),
(1, '2026-03-25', 'Pedágio',                     41.60, 'expense', 'Transporte'),
(1, '2026-03-02', 'Plano de saúde',             520.00, 'expense', 'Saúde'),
(1, '2026-03-18', 'Farmácia',                    67.40, 'expense', 'Saúde'),
(1, '2026-03-05', 'Netflix',                     45.90, 'expense', 'Lazer'),
(1, '2026-03-05', 'Spotify',                     21.90, 'expense', 'Lazer'),
(1, '2026-03-08', 'Academia',                   110.00, 'expense', 'Lazer'),
(1, '2026-03-22', 'Cinema',                      72.00, 'expense', 'Lazer'),
(1, '2026-03-12', 'Conta de luz',               210.80, 'expense', 'Moradia'),
(1, '2026-03-12', 'Conta de água',               79.00, 'expense', 'Moradia'),
(1, '2026-03-10', 'Internet',                   119.90, 'expense', 'Moradia'),
(1, '2026-03-10', 'Celular Tim',                 98.00, 'expense', 'Serviços'),
(1, '2026-03-28', 'Livros',                      74.00, 'expense', 'Educação'),
(1, '2026-03-17', 'Restaurante',                 88.00, 'expense', 'Alimentação'),

-- Abril 2026
(1, '2026-04-05', 'Salário',                  8500.00, 'income',  'Renda'),
(1, '2026-04-08', 'Reembolso empresa',          350.00, 'income',  'Outros'),
(1, '2026-04-02', 'Aluguel',                   2200.00, 'expense', 'Moradia'),
(1, '2026-04-03', 'Condomínio',                 480.00, 'expense', 'Moradia'),
(1, '2026-04-06', 'Supermercado Pão de Açúcar', 605.00, 'expense', 'Alimentação'),
(1, '2026-04-11', 'Feira livre',                135.00, 'expense', 'Alimentação'),
(1, '2026-04-16', 'iFood',                       82.50, 'expense', 'Alimentação'),
(1, '2026-04-04', 'Gasolina',                   298.00, 'expense', 'Transporte'),
(1, '2026-04-10', 'Uber',                        45.00, 'expense', 'Transporte'),
(1, '2026-04-02', 'Plano de saúde',             520.00, 'expense', 'Saúde'),
(1, '2026-04-05', 'Netflix',                     45.90, 'expense', 'Lazer'),
(1, '2026-04-05', 'Spotify',                     21.90, 'expense', 'Lazer'),
(1, '2026-04-01', 'Academia',                   110.00, 'expense', 'Lazer'),
(1, '2026-04-09', 'Conta de luz',               188.00, 'expense', 'Moradia'),
(1, '2026-04-09', 'Conta de água',               84.00, 'expense', 'Moradia'),
(1, '2026-04-07', 'Internet',                   119.90, 'expense', 'Moradia'),
(1, '2026-04-07', 'Celular Tim',                 98.00, 'expense', 'Serviços'),
(1, '2026-04-14', 'Cafeteria',                   41.00, 'expense', 'Alimentação');
