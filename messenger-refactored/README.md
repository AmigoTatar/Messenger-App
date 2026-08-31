# messenger-refactored

Клиент Potok: Vite + React. Нативка — `android/` (Capacitor).

Документация продукта, смоук и стек — в корне репо: [`../README.md`](../README.md).  
Деплой и APK — [`../DEPLOY.md`](../DEPLOY.md).  
Журнал — [`../NOTES.md`](../NOTES.md).

```bash
npm run dev      # локально
npm run build    # dist → Nginx; потом npx cap sync android перед APK
```

Единственный конфиг API: `src/config.js`. Корневой `config.js` не импортировать.
