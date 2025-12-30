# Deploy spammer functions to Supabase

Write-Host "🚀 Deploying spammer Edge Functions..." -ForegroundColor Green

# Check if SUPABASE_ACCESS_TOKEN is set
if (-not $env:SUPABASE_ACCESS_TOKEN) {
    Write-Host ""
    Write-Host "❌ SUPABASE_ACCESS_TOKEN not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 To get your token:" -ForegroundColor Yellow
    Write-Host "1. Visit: https://supabase.com/dashboard/account/tokens"
    Write-Host "2. Create new token"
    Write-Host "3. Add to .env: SUPABASE_ACCESS_TOKEN=sbp_xxx"
    Write-Host ""
    Write-Host "Then run: `$env:SUPABASE_ACCESS_TOKEN=`"YOUR_TOKEN`""
    exit 1
}

$PROJECT_REF = "vtrkcgaajgtlkjqcnwxk"

Write-Host ""
Write-Host "📦 Deploying test-spammer..." -ForegroundColor Cyan
supabase functions deploy test-spammer --no-verify-jwt --project-ref $PROJECT_REF

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ test-spammer deployed!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to deploy test-spammer" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📦 Deploying authorize-spammer..." -ForegroundColor Cyan
supabase functions deploy authorize-spammer --no-verify-jwt --project-ref $PROJECT_REF

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ authorize-spammer deployed!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to deploy authorize-spammer" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "All functions deployed successfully!" -ForegroundColor Green
