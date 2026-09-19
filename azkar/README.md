# AZKAR

Приложение для ежедневного чтения азкаров: арабский текст, русский перевод,
транскрипция, счётчик повторов, сохранение прогресса и работа без интернета.

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PWA · без бэкенда.

---

## Запуск

```bash
npm install
npm run dev      # http://localhost:3000
```

Сборка и проверки:

```bash
npm run build          # продакшен-сборка
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run check          # всё сразу
npm run content:audit  # аудит достоверности контента
```

Переменные окружения — см. `.env.example`. Обязательных нет: без
`NEXT_PUBLIC_SITE_URL` метаданные соберутся с заглушкой.

---

## Достоверность текстов — главное правило

Отметка **«Проверено»** ставится только тем записям, где источник указан
точно и выверен. Сейчас это аяты Корана со ссылкой «сура: аят».

Для записей из сунны **номер хадиса намеренно не проставлен**: название
сборника указано, а точная ссылка — нет. Выдуманная ссылка хуже отсутствующей,
поэтому такие записи честно помечены как «Требует проверки» и в интерфейсе, и
в данных (`verified: false` + `reviewNote`).

Текущее состояние всегда можно посмотреть:

```bash
npm run content:audit
```

Скрипт печатает сводку по разделам, полный список записей без выверенной
ссылки и падает с ненулевым кодом, если в данных появились структурные
ошибки (дубли id, пустые поля, `verified: true` без `source.reference`).

Переводы на русский написаны для этого проекта и являются смысловыми. Чужие
переводы и тексты не копировались.

---

## Структура

```
app/                      маршруты App Router
  layout.tsx              шрифты, метаданные, тема до первой отрисовки
  page.tsx                главная
  [category]/page.tsx     страница раздела (9 статических маршрутов)
  azkar/ favorites/ search/ about/ offline/
  manifest.ts sitemap.ts robots.ts
  error.tsx global-error.tsx not-found.tsx

components/
  ui/                     примитивы: Button, Sheet, Toggle, ProgressBar, Icon…
  azkar/                  AzkarCard, AzkarReader, CounterButton, ArabicText…
  navigation/             TopBar, BottomNavigation, DesktopSidebar, AppShell
  settings/               SettingsSheet, FontSizeControl, ThemeToggle
  audio/                  AudioPlayer
  home/                   CategoryCard, WelcomeBlock, TodayStats
  search/                 Search
  seo/                    JsonLd

data/                     ВЕСЬ КОНТЕНТ (см. ниже)
lib/                      чистая логика: прогресс, поиск, настройки, хранилища
hooks/                    React-обвязка над хранилищами
types/                    модель данных
public/                   иконки, service worker, аудио
styles/globals.css        дизайн-система: токены, темы, утилиты
scripts/                  генерация иконок, аудит контента
```

---

## Где лежит контент

| Файл | Что внутри |
|---|---|
| `data/categories.ts` | разделы: название, slug, эмодзи, акцент, SEO-метаданные |
| `data/azkar/morning.ts` | утренние азкары |
| `data/azkar/evening.ts` | вечерние азкары |
| `data/azkar/after-prayer.ts` | после намаза |
| `data/azkar/sleep.ts` | перед сном |
| `data/azkar/waking.ts` | после пробуждения |
| `data/azkar/protection.ts` | защитные дуа |
| `data/azkar/quran-duas.ts` | дуа из Корана |
| `data/azkar/prophet-duas.ts` | дуа пророка ﷺ |
| `data/azkar/situations.ts` | жизненные ситуации |
| `data/azkar/_shared/morning-evening.ts` | общее ядро утренних и вечерних |
| `data/azkar/_shared/quran.ts` | коранические отрывки, встречающиеся в нескольких разделах |
| `data/index.ts` | реестр: связывает разделы и записи |

Контент нигде не зашит в компоненты.

---

## Как добавить новый азкар

**В обычный раздел** — допишите объект в массив нужного файла:

```ts
{
  key: '16-moy-novyy-azkar',      // часть id; менять нельзя — сбросит прогресс
  title: 'Название дуа',
  arabic: 'النص العربي',
  transliteration: 'Транскрипция кириллицей.',
  translation: 'Смысловой перевод.',
  repetitions: 3,
  source: { kind: 'hadith', collection: 'Сахих Муслим' },
  tags: ['защита', 'утро'],       // по ним работает поиск
  verified: false,                // true только после ручной сверки
  reviewNote: REF_PENDING,
}
```

`id` и `order` проставляются автоматически по позиции в массиве.

**В утренние или вечерние** — правьте `_shared/morning-evening.ts`: там одна
запись разворачивается сразу в оба раздела. Если текст отличается по времени
суток, задайте объект `{ morning: '…', evening: '…' }`. Если азкар читается
только утром — добавьте `only: 'morning'`.

**Коранический отрывок** — используйте `fromQuran(AYAT_AL_KURSI, { … })`, чтобы
текст не дублировался между разделами.

После правок обязательно: `npm run content:audit && npm run check`.

---

## Как добавить новый раздел

1. `data/azkar/<slug>.ts` — по образцу существующих.
2. Новый id в `CATEGORY_IDS` (`types/azkar.ts`).
3. Описание раздела в `data/categories.ts` (включая `seo`).
4. Импорт в таблицу `azkarByCategory` (`data/index.ts`).

Маршрут `/<slug>`, метаданные, sitemap и манифест подхватятся сами.

---

## Архитектура состояния

Настройки, избранное и прогресс живут во внешних хранилищах
(`lib/stores/*`), построенных на `lib/store.ts`, и читаются через
`useSyncExternalStore`. Это даёт корректную гидрацию без «вспышки»
дефолтных значений, синхронизацию между вкладками и одну точку замены,
когда появится Supabase, — компоненты трогать не придётся.

Публичные хуки:

```ts
useAzkarProgress(categoryId, azkar)  // increment, complete, reset,
                                     // getProgress, continueFromLast
useSettings()                        // settings, setSetting, update, reset
useFavorites()                       // ids, isFavorite, toggle, clear
```

Прогресс привязан к локальной дате и обнуляется каждый день. История
завершённых дней хранится отдельно и нужна только для серии («🔥 7 дней»).

---

## PWA и офлайн

- `app/manifest.ts` — манифест, ярлыки генерируются из разделов.
- `public/sw.js` — навигация: сеть с откатом в кеш; статика: cache-first;
  аудио не кешируется.
- `app/offline/page.tsx` — страница на случай полного отсутствия сети.
- Иконки: `node scripts/generate-icons.mjs` (без бинарных зависимостей).

Service worker регистрируется только в продакшен-сборке.

---

## Что можно добавить дальше

- Аудио-чтения (см. `public/audio/README.md`).
- Проставить номера хадисов и перевести записи в `verified: true`.
- Supabase: авторизация и синхронизация прогресса между устройствами.
- i18n: интерфейс уже разделён на данные и компоненты, в настройках
  есть поле `locale`.
- Напоминания через Web Push.
