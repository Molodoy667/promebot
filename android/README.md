# ПромоБот - Android додаток

WebView додаток для https://promobot.store

## Особливості

✅ Splash Screen з іконкою бота та назвою "ПромоБот"
✅ Примусова авторизація при першому запуску
✅ Автоматичний білд APK через GitHub Actions
✅ Adaptive icons для всіх розмірів екранів

## Налаштування GitHub Secrets

Детальна інструкція: [SETUP_GITHUB_SECRETS.md](SETUP_GITHUB_SECRETS.md)

## Локальний білд

```bash
cd android
./gradlew assembleRelease
```

APK буде в: `android/app/build/outputs/apk/release/`
