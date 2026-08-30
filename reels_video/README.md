# Reels 9:16 — рекламный ролик под озвучку

Вертикальный ролик **1080×1920 / 30 fps / 45.6 c** под приложенную аудиоозвучку,
полностью синхронизированный с речью диктора: моушен‑графика, инфографика,
динамические субтитры и семь разных типов переходов.

Итоговый файл: `REELS_9x16_final.mp4` (H.264 high, CRF 16, AAC 192 kbps 48 kHz,
громкость нормализована к −14 LUFS — целевой уровень Instagram/TikTok/YouTube).

## Как это собрано

1. **Расшифровка озвучки.** `pipeline/asr.py` + `pipeline/fix_seg.py` — offline‑ASR
   (sherpa‑onnx, русская модель GigaAM v2 CTC) с посимвольными тайм‑кодами,
   Silero VAD для нарезки на фразы. Результат — `transcript.json`
   с пословным таймингом.
2. **Субтитры.** `pipeline/mkwords.py` режет пословный поток на группы по 1–3
   ключевых слова с учётом пауз, границ сцен и длины строки, помечает слова,
   которые нужно увеличить, и пишет `src/words.js`.
3. **Анимация.** `src/reel.js` — детерминированный canvas‑движок: одна функция
   `render(t)` рисует кадр для любого момента времени. Ничего не зависит от
   реального времени, поэтому рендер побитово воспроизводим.
4. **Рендер.** `pipeline/render.py` открывает `src/index.html` в headless Chromium,
   для каждого кадра вызывает `render(t)`, снимает скриншот и отдаёт PNG прямо
   в stdin ffmpeg.
5. **Сведение.** `pipeline/mux.sh` подкладывает оригинальную озвучку,
   нормализует громкость и собирает финальный MP4.

## Запуск

```bash
pip install playwright imageio-ffmpeg sherpa-onnx numpy pillow
pipeline/fetch_fonts.sh          # Montserrat / Inter / JetBrains Mono (OFL)
python pipeline/render.py        # покадровый рендер -> out/reels_raw.mp4
bash    pipeline/mux.sh          # + звук -> out/REELS_9x16_final.mp4
```

`pipeline/preview.py 3.5 17.2 40.1` — быстрый рендер отдельных кадров в PNG
для правки сцен без полного прогона.

## Структура

```
src/index.html   страница‑холст 1080×1920 + подключение шрифтов
src/reel.js      движок: палитра, easing, фоны, UI‑примитивы, иконки,
                 субтитры, 8 сцен, компоновщик переходов
src/words.js     сгенерированные группы субтитров и пословный тайминг
transcript.json  расшифровка озвучки с тайм‑кодами
STORYBOARD.md    покадровый сценарий: сцены, тайм‑коды, переходы
```

Подробный разбор сцен — в [STORYBOARD.md](STORYBOARD.md).

## Шрифты

Montserrat, Inter, JetBrains Mono — Open Font License, скачиваются скриптом
`pipeline/fetch_fonts.sh` и в репозитории не хранятся.
