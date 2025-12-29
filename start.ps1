# Стартовий скрипт для проєкту
Write-Host "🚀 Запуск проєкту..." -ForegroundColor Green

# Застосувати PROMT 1 (якщо використовуєш Rovo Dev)
if (Test-Path ".rovodev\autorun.ps1") {
    & .\.rovodev\autorun.ps1
}

# Запуск dev сервера
Write-Host "`n📦 Запуск Vite dev server..." -ForegroundColor Cyan
npm run dev
