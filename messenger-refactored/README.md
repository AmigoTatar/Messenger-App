# messenger-refactored

Клиент Potok: Vite + React. Нативка — `android/` (Capacitor).

Документация продукта, смоук и стек — в корне репо: [`../README.md`](../README.md).  
Деплой и APK — [`../DEPLOY.md`](../DEPLOY.md).  
Журнал — [`../NOTES.md`](../NOTES.md).

```bash
npm run dev      # локально
npm run build    # dist → Nginx (потом отдельно скопировать подписанный potok.apk в dist/)
npx cap sync android   # после build, перед сборкой APK
```

`public/version.json` попадает в `dist` сам. APK — нет.

Единственный конфиг API: `src/config.js`. Корневой `config.js` не импортировать.
