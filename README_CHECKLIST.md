# Last_hope — Чеклист интеграции настроек

Этот пакет содержит готовые конфиги: DevContainer+Qoder, Docker (CUDA), Terraform для GCP, CI (GitHub Actions), Makefile и .env.example.

## 0) Предварительные требования
- Windows 11 + WSL2, Docker Desktop (WSL2 engine, NVIDIA GPU support)
- Драйвер NVIDIA на Windows, `nvidia-smi` доступен
- VS Code (опц.) с Dev Containers
- Terraform CLI, Node.js 18+, Python 3.10+
- Ключи: HTX, OpenAI, (опц.) CoinGecko

## 1) Импорт файлов в репозиторий
1. Скопируй содержимое архива в корень проекта `Last_hope`.
2. Проверь, что добавлены каталоги:
   - `infra/docker`, `infra/devcontainer`, `infra/terraform`, `qoder`, `.github/workflows`
3. Удали любые следы CryptoPanic (если остались из старых файлов).

## 2) Окружение и Qoder
1. Скопируй `.env.example` в `.env` и заполни ключи.
2. Открой проект в VS Code → Reopen in Container.
   - Автоматически установится qoder и зависимости фронтенда.
3. Экономия токенов: см. `qoder/qoder.config.json` (уменьшены `max_tokens`, включены дифф-патчи).

## 3) Локальный запуск (Docker + CUDA)
```bash
make up
# проверка
curl -fsS http://localhost:8000/health
curl -fsS http://localhost:9000/health
# фронтенд на http://localhost:3000
```

## 4) FinGPT
- Образ собирается из `infra/docker/fingpt.Dockerfile`.
- Контейнер стартует по compose как `fingpt` (порт 9000).

## 5) Terraform (GCP)
```bash
cd infra/terraform
terraform init
terraform apply -var="project_id=YOUR_GCP_PROJECT" -var="region=europe-central2"
```
Создаются: BigQuery dataset и 3 таблицы, GCS bucket, Secret Manager для ключей.

## 6) CI (GitHub Actions)
- Файл `.github/workflows/ci.yml` уже включает:
  - frontend: install + lint + test
  - backend: deps + pytest
  - trufflehog: скан утечек секретов
- Включи GitHub Copilot для автогенерации тестов в PR.

## 7) Команды Makefile
- `make setup` — инициализация .env и Terraform
- `make up` / `make down` — запуск/остановка dev-стека
- `make logs` — логи сервисов
- `make ci-local` — локальный CI

## 8) Маршруты бэкенда (ожидаемые)
- `POST /api/v1/portfolio/csv` — загрузка CSV и агрегация
- `GET /api/v1/htx/accounts` — аккаунты/балансы (HTX)
- `GET /api/v1/htx/ticker/{symbol}` — тикер с кэшем
- `GET /api/v1/market/metrics?ids=btc,eth` — метрики CoinGecko
- `POST /api/v1/analysis/summary` — краткий/среднесрочный анализ (FinGPT → OpenAI)

## 9) Проверка перед коммитом
- [ ] Файл `.env` заполнен
- [ ] `make up` проходит без ошибок, сервисы доступны
- [ ] CI в GitHub проходит (frontend/backend tests, trufflehog)
- [ ] Terraform применён (если используешь GCP)
- [ ] Нет упоминаний CryptoPanic в коде и конфигурациях

---
Готово! Можно коммитить и открывать PR.
