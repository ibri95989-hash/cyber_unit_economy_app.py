# -*- coding: utf-8 -*-
"""
Раскладывает распознанную озвучку на сцены ролика.

На вход — слова с тайм-кодами (из ASR) и brand.json с текстами.
На выход — plan.js: список сцен, тайм-коды всех ключевых моментов
внутри каждой сцены и подписи. Движок src/reel.js рисует ровно то,
что здесь описано, — никакой логики выбора сцен в нём нет.

Всё детерминировано: одна и та же озвучка всегда даёт один и тот же план.
"""
import json, re, sys, os

# ---------------------------------------------------------------- словари
# Ключевые слова ищутся по началу слова (стеммы), регистр не важен.
SCENE_KEYS = {
    'boring': ['скучн','обычн','статичн','однообраз','шаблон','сер','устарел',
               'никто','не смотр','неинтересн','одинаков','простыми','слайд'],
    'comp':   ['конкурент','другие','рынок','соперник','тренд','современн',
               'динамик','график','мощн','технолог','нейросет','искусствен',
               'внимание','секунд','цепля','захват'],
    'scroll': ['клиент','аудитор','подписчик','зрител','листа','пролист',
               'уход','теря','дальше','скролл','мимо','не увид','не дойд'],
    'pipe':   ['под ключ','иде','сценар','визуал','озвучк','монтаж','субтитр',
               'создаю','делаю','этап','процесс','разрабат','пишу','добавля','беру на себя'],
    'noeff':  ['не нужно','не надо','не трат','без','сам','ничего не','забуд',
               'съёмк','съемк','камер','снимат','врем','час'],
    'result': ['получ','готов','результат','выдел','удержив','рост','раст',
               'продаж','заявк','эффект','работа','окуп','прибыл','отлича'],
    'cta':    ['напиши','пиши','свяжит','оставьт','заказ','хотите','жми',
               'ссылк','директ','обращ','звони','консультац','пиш','приход'],
}
# Вес: длинные фразы весомее одиночных стеммов.
def score(text, keys):
    t = text.lower()
    s = 0.0
    for k in keys:
        if k in t:
            s += 2.0 if ' ' in k else 1.0
    return s

STEP_LIB = [
    ('ИДЕЯ',            'bulb', '#FFB020', ['иде','придумыв','концепц','смысл'],
     'ЦЕПЛЯЮЩАЯ ИДЕЯ ПОД ВАШУ НИШУ', 0, None),
    ('СЦЕНАРИЙ',        'doc',  '#7FF3FF', ['сценар','пишу','текст','структур'],
     'СЦЕНАРИЙ С ЧЁТКОЙ СТРУКТУРОЙ УДЕРЖАНИЯ', 1, None),
    ('AI',              'chip', '#B58CFF', ['ии','ai','нейросет','искусствен'],
     'НЕЙРОСЕТИ · ГЕНЕРАЦИЯ', 2, None),
    ('ВИЗУАЛ',          'img',  '#5FD4FF', ['визуал','картинк','кадр','графи','анимац'],
     'УНИКАЛЬНЫЙ ВИЗУАЛ ПОД ВАШ БРЕНД', 3, None),
    ('ОЗВУЧКА',         'mic',  '#FF6FB0', ['озвучк','голос','звук','диктор','музык'],
     'ПРОФЕССИОНАЛЬНЫЙ ГОЛОС И ЗВУК', 4, None),
    ('МОНТАЖ',          'cut',  '#34D399', ['монтаж','склейк','режу','сборк'],
     'ДИНАМИЧНЫЙ МОНТАЖ БЕЗ ПРОВИСАНИЙ', 5, None),
    ('СУБТИТРЫ',        'cc',   '#A3E635', ['субтитр','титр','подпис'],
     'ДИНАМИЧЕСКИЕ СУБТИТРЫ ДЛЯ УДЕРЖАНИЯ', 6, None),
]
FINAL_STEP = ('ГОТОВЫЙ REELS', 'play', '#FFFFFF', [], '', 7, 'ГОТОВО')

NOEFF_LIB = [
    (['врем','час','трат','долг'],            'clock', 'ТРАТИТЬ ВРЕМЯ',  'ЧАСЫ НА ПРОДАКШН'),
    (['съёмк','съемк','камер','снима','студи'],'cam',   'СЪЁМКИ',         'КАМЕРА, СВЕТ, ЛОКАЦИИ'),
    (['придумыв','иде','контент','сценар'],   'brain', 'ПРИДУМЫВАТЬ',    'ИДЕИ И СЦЕНАРИИ'),
    (['нанима','команд','подрядчик','монтажёр','монтажер'],'brain','НАНИМАТЬ КОМАНДУ','МОНТАЖЁР, ДИЗАЙНЕР, ОПЕРАТОР'),
    (['разбира','учит','осваив','программ'],  'chip',  'РАЗБИРАТЬСЯ',    'ПРОГРАММЫ И НАСТРОЙКИ'),
]

TRANSITIONS = ['glitch','whip','ramp','iris','match','streak','punch']


# ---------------------------------------------------------------- утилиты
def phrases(words, gap=0.30):
    """Режет поток слов на фразы по паузам."""
    out, cur = [], []
    for w in words:
        if cur and w['s'] - cur[-1]['e'] > gap:
            out.append(cur); cur = []
        cur.append(w)
    if cur: out.append(cur)
    return out


def find(words, a, b, stems, after=None):
    """Начало первого слова в [a,b], совпадающего со стеммами."""
    for w in words:
        if w['s'] < a or w['s'] > b: continue
        if after is not None and w['s'] < after: continue
        lw = w['w'].lower()
        for k in stems:
            if ' ' in k: continue
            if lw.startswith(k) or k in lw:
                return w['s']
    return None


def order(vals, lo, hi, gap=0.22):
    """Приводит тайм-коды к возрастающему порядку внутри [lo,hi]."""
    out = []
    prev = lo
    for v in vals:
        if v is None:
            out.append(None); continue
        v = max(prev + (gap if out and out[-1] is not None else 0.0), min(v, hi))
        out.append(round(v, 3)); prev = v
    return out


def wtext(ws): return ' '.join(w['w'] for w in ws)


# ---------------------------------------------------------- выбор сцен
UNIQUE = {'boring','scroll','pipe','noeff','result','cta'}   # не повторяются
MIN_SCENE = 1.7                                              # короче — сливаем
# канонический порядок повествования: назад ходить дорого
RANK = {'boring':0,'comp':1,'scroll':2,'pipe':3,'noeff':4,'result':5,'cta':6}
STATES = list(RANK) + ['kinetic']
KINETIC_FLOOR = 0.9          # порог, ниже которого сцена считается неопознанной


def emissions(ph):
    """Оценка каждого состояния для каждого сегмента речи.

    Приоритеты считаются по положению сегмента во времени, а не по его номеру:
    сегментов может быть и пять, и полсотни — важно, где они звучат.
    """
    out = []
    T = max(p[-1]['e'] for p in ph) or 1.0
    for p in ph:
        txt = wtext(p)
        pos = ((p[0]['s'] + p[-1]['e']) / 2.0) / T          # 0 — начало, 1 — конец
        up = lambda lo, hi: max(0.0, min(1.0, (pos - lo) / (hi - lo)))
        e = {k: score(txt, v) for k, v in SCENE_KEYS.items()}
        e['cta']    += 4.0 * up(0.70, 1.00) - (3.0 if pos < 0.50 else 0.0)
        e['boring'] += 0.9 * (1.0 - up(0.00, 0.25)) - 2.0 * up(0.40, 1.00)
        e['comp']   -= 1.5 * up(0.60, 1.00)
        e['scroll'] -= 1.2 * up(0.65, 1.00)
        e['result'] += 0.7 * up(0.55, 1.00) - 1.5 * (1.0 - up(0.00, 0.45))
        e['pipe']   += 0.4 * (1.0 - abs(pos - 0.5) / 0.5)
        e['kinetic'] = KINETIC_FLOOR
        out.append(e)
    return out


def viterbi(em):
    """Последовательность сцен с инерцией и штрафом за ход назад."""
    def trans(a, b):
        if a == b: return 0.7                       # держимся текущей сцены
        if a == 'kinetic' or b == 'kinetic': return -0.2
        d = RANK[b] - RANK[a]
        if d < 0: return -3.0                       # назад по сюжету — почти запрет
        return -0.15 * (d - 1)                      # перепрыгивать сцены слегка дорого
    best = {st: (em[0][st], [st]) for st in STATES}
    for i in range(1, len(em)):
        nxt = {}
        for st in STATES:
            sc, path = max(((best[pr][0] + trans(pr, st) + em[i][st], best[pr][1])
                            for pr in STATES), key=lambda x: x[0])
            nxt[st] = (sc, path + [st])
        best = nxt
    return max(best.values(), key=lambda x: x[0])[1]


def choose_scenes(words, duration, tail):
    ph = phrases(words, gap=0.16)
    if not ph: return []

    # 1. Хук — первые ~1.5 с речи, отрезаются от начала.
    hook_end = min(1.60, words[min(3, len(words) - 1)]['e'] + 0.10)
    hook_end = max(hook_end, 0.9)

    # 2. Классификация сегментов.
    path = viterbi(emissions(ph))
    cand = [{'s': p[0]['s'], 'e': p[-1]['e'], 'n': st, 'words': list(p)}
            for p, st in zip(ph, path)]
    cand[-1]['n'] = 'cta'

    # 3. Склейка соседей одного типа.
    merged = []
    for c in cand:
        if merged and merged[-1]['n'] == c['n']:
            merged[-1]['e'] = c['e']; merged[-1]['words'] += c['words']
        else:
            merged.append(dict(c))

    # 4. Уникальность и позиция призыва.
    seen = set()
    for m in merged:
        if m['n'] in UNIQUE:
            if m['n'] in seen: m['n'] = 'kinetic'
            else: seen.add(m['n'])
    for m in merged[:-1]:
        if m['n'] == 'cta': m['n'] = 'kinetic'
    merged[-1]['n'] = 'cta'
    merged = _remerge(merged)

    # 5. Короткие сцены прилипают к соседу.
    changed = True
    while changed and len(merged) > 2:
        changed = False
        for i, m in enumerate(merged):
            if m['e'] - m['s'] >= MIN_SCENE: continue
            j = i - 1 if i > 0 else i + 1
            if j >= len(merged): j = i - 1
            merged[j]['s'] = min(merged[j]['s'], m['s'])
            merged[j]['e'] = max(merged[j]['e'], m['e'])
            merged[j]['words'] = sorted(merged[j]['words'] + m['words'], key=lambda w: w['s'])
            merged.pop(i); changed = True; break
    merged = _remerge(merged)

    # 6. Стыковка встык.
    starts = [0.0]
    for i, m in enumerate(merged):
        s = max(hook_end, m['s'] - 0.06) if i == 0 else max(starts[-1] + MIN_SCENE, m['s'] - 0.06)
        starts.append(round(s, 3))
    names = ['hook'] + [m['n'] for m in merged]
    wl = [[w for w in words if w['s'] < hook_end]] + [m['words'] for m in merged]
    scenes = []
    for i, nm in enumerate(names):
        e = starts[i + 1] if i + 1 < len(starts) else duration
        scenes.append({'n': nm, 's': starts[i], 'e': round(e, 3), 'words': wl[i]})
    scenes[-1]['e'] = round(duration, 3)

    # 7. Переходы — по кругу, без повторов подряд.
    prev = None; k = 0
    for i, s in enumerate(scenes):
        if i == 0: s['tr'] = 'none'; continue
        tr = TRANSITIONS[k % len(TRANSITIONS)]
        if tr == prev: k += 1; tr = TRANSITIONS[k % len(TRANSITIONS)]
        s['tr'] = tr; prev = tr; k += 1
        s['seed'] = 3 + i * 7
    return scenes


def _remerge(ms):
    out = []
    for c in ms:
        if out and out[-1]['n'] == c['n']:
            out[-1]['e'] = c['e']; out[-1]['words'] += c['words']
        else:
            out.append(dict(c))
    return out


# ------------------------------------------------------- тайминги внутри сцен
def fill(scene, words, brand, duration):
    n, a, b = scene['n'], scene['s'], scene['e']
    d = b - a
    W = [w for w in words if a - 0.05 <= w['s'] < b]
    B, P = {}, {}
    T = brand.get('texts', {})
    g = lambda k, dflt: T.get(k, dflt)

    if n == 'hook':
        starts = [w['s'] for w in W][:6]
        picks = []
        for s in starts:
            if not picks or s - picks[-1] >= 0.26: picks.append(s)
            if len(picks) == 3: break
        while len(picks) < 3:
            picks.append(a + d * (0.05 + 0.42 * len(picks)))
        B['w1'], B['w2'], B['w3'] = order(picks[:3], a, b - 0.18, 0.26)
        B['w1'] = round(max(a + 0.02, min(B['w1'], a + 0.14)), 3)
        P.update(l1=g('hook1', 'ВАШИ'), l2=g('hook2', 'REELS'), l3=g('hook3', 'ПРОЛИСТЫВАЮТ?'))

    elif n == 'boring':
        dup   = find(W, a, b, SCENE_KEYS['boring'][:4]) or a + d * .35
        stamp = find(W, a, b, ['скучн','нудн','устарел','сер','однообраз'], after=dup + .2) or a + d * .55
        flick = find(W, a, b, ['видео','контент','ролик','пролист','листа','дальше'], after=stamp + .2) or a + d * .78
        B['metrics'], B['dupes'], B['stamp'], B['flick'] = order(
            [a + 0.25, dup, stamp, flick], a, b - 0.30, 0.30)
        B['outro'] = round(min(B['flick'] + 0.14, b - 0.16), 3)
        P.update(chip=g('boringChip', 'ВАШ КОНТЕНТ СЕЙЧАС'), stamp=g('boringStamp', 'СКУЧНО'),
                 metricLabel=g('boringMetric', 'ПРОСМОТРЫ'),
                 metricFrom=brand.get('numbers', {}).get('viewsFrom', 214),
                 metricTo=brand.get('numbers', {}).get('viewsTo', 9),
                 outro1=g('boringOutro1', 'ПРОЛИСТАЛИ'), outro2=g('boringOutro2', 'ЗА 1.2 СЕКУНДЫ'))

    elif n == 'comp':
        raw = {
            'split':     a,
            'timer':     find(W, a + .5, b, ['секунд','первых','первые','сразу','старт']),
            'graphics':  find(W, a + .5, b, ['график','визуал','картинк','оформл','мощн','анимац']),
            'dynamic':   find(W, a + .5, b, ['динамик','быстр','темп','энерг','скорост','движ']),
            'ai':        find(W, a + .5, b, ['ии','ai','нейросет','искусствен','технолог']),
        }
        B['attention'] = find(W, a, b, ['внимание','цепля','захват','интерес','удержив'])
        got = [(k, v) for k, v in raw.items() if v is not None and k != 'split']
        got.sort(key=lambda x: x[1])
        # выкидываем слишком тесные подсцены
        keep, last = [], a
        for k, v in got:
            if v - last >= 0.85: keep.append((k, v)); last = v
        B['split'] = round(a, 3)
        for k, v in keep: B[k] = round(v, 3)
        # если ничего не нашлось — раскладываем равномерно
        if not keep and d > 4.0:
            names = ['timer', 'graphics', 'dynamic', 'ai']
            for i, k in enumerate(names):
                B[k] = round(a + d * (0.28 + 0.18 * i), 3)
        if B['attention'] is not None:
            nxt = min([v for v in B.values() if v is not None and v > B['split'] + .3] or [b])
            if not (B['split'] + .3 < B['attention'] < nxt - .35): B['attention'] = None
        num = brand.get('numbers', {})
        P.update(you=g('compYou', 'ВЫ'), rival=g('compRival', 'КОНКУРЕНТЫ'),
                 growth=num.get('growth', 340), attentionChip=g('compAttention', 'ВНИМАНИЕ ЗАХВАЧЕНО'),
                 timerTop=g('compTimerTop', 'ПЕРВЫЕ 3 СЕКУНДЫ'), timerBottom=g('compTimerBottom', 'РЕШАЮТ ВСЁ'),
                 graphicsLabel=g('compGraphics', 'МОЩНАЯ ГРАФИКА'), dynamicLabel=g('compDynamic', 'ДИНАМИКА'),
                 dynamicUnit=g('compDynamicUnit', 'FPS ЭНЕРГИИ'), aiLabel=g('compAI', 'AI ТЕХНОЛОГИИ'),
                 aiTags=T.get('compAITags', ['ГЕНЕРАЦИЯ', 'АНАЛИЗ', 'СКОРОСТЬ']))

    elif n == 'scroll':
        away = find(W, a + .4, b, ['листа','пролист','уход','дальше','мимо','теря','скролл']) or a + d * .52
        B['grid'], B['counter'], B['away'] = order([a + .14, a + .38, away], a, b - .55, 0.22)
        B['verdict'] = round(min(B['away'] + 0.47, b - 0.35), 3)
        P.update(chip=g('scrollChip', 'ВАША ПОТЕНЦИАЛЬНАЯ АУДИТОРИЯ'),
                 audience=brand.get('numbers', {}).get('audience', 12480),
                 audienceLabel=g('scrollAudience', 'ПОТЕНЦИАЛЬНЫХ КЛИЕНТОВ'),
                 verdict=g('scrollVerdict', 'ЛИСТАЮТ ДАЛЬШЕ'))

    elif n == 'pipe':
        # Каждый этап ищется независимо, затем всё сортируется по порядку речи:
        # диктор может назвать визуал раньше ИИ — ролик должен идти за голосом.
        found = []
        for k, icon, col, stems, cap, art, short in STEP_LIB:
            t0 = find(W, a + 0.55, b - 0.5, stems)
            if t0 is None: continue
            found.append({'k': k, 'ic': icon, 'c': col, 't': round(t0, 3),
                          'art': art, 'cap': cap})
        found.sort(key=lambda x: x['t'])
        steps, last = [], -9.0
        for f in found:                      # слишком тесные этапы отбрасываем
            if f['t'] - last < 0.55: continue
            steps.append(f); last = f['t']
        if len(steps) < 2:                       # речь не перечисляет этапы — берём базовую цепочку
            base = STEP_LIB[:6]
            steps = [{'k': k, 'ic': i2, 'c': c, 'art': art, 'cap': cap,
                      't': round(a + d * (0.28 + 0.62 * n2 / max(1, len(base))), 3)}
                     for n2, (k, i2, c, st, cap, art, short) in enumerate(base)]
        fk, fi, fc, fst, fcap, fart, fshort = FINAL_STEP
        steps.append({'k': g('pipeFinal', fk), 'ic': fi, 'c': fc, 'art': fart,
                      'cap': '', 'short': fshort,
                      't': round(min(max(steps[-1]['t'] + 0.6, b - 0.42), b - 0.18), 3)})
        P['steps'] = steps
        first = steps[0]['t']
        B['chain'] = round(max(a + 0.35, first - 0.15), 3)
        B['intro'] = round(a + 0.02, 3)
        B['title'] = round(min(a + 0.18, B['chain'] - 0.9), 3)
        sub = find(W, a, b, ['ключ','полност','целиком']) or B['title'] + 1.0
        B['subtitle'] = round(min(max(sub, B['title'] + 0.5), B['chain'] - 0.25), 3)
        B['chips'] = round(min(B['title'] + 0.55, B['chain'] - 0.4), 3)
        P.update(chip=g('pipeChip', 'ПОЛНЫЙ ЦИКЛ ПРОИЗВОДСТВА'), title=g('pipeTitle', 'REELS'),
                 subtitle=g('pipeSubtitle', 'ПОД КЛЮЧ'), header=g('pipeHeader', 'ПРОЦЕСС ПРОИЗВОДСТВА'))

    elif n == 'noeff':
        items, last = [], a + 0.35
        for stems, icon, k, sub in NOEFF_LIB:
            t0 = find(W, last, b - 0.55, stems, after=last)
            if t0 is None: continue
            items.append({'t': round(t0, 3), 'ic': icon, 'k': k, 'sub': sub})
            last = t0 + 0.5
            if len(items) == 3: break
        if not items:
            items = [{'t': round(a + d * (0.30 + 0.20 * i), 3), 'ic': ic2, 'k': k, 'sub': sub}
                     for i, (st, ic2, k, sub) in enumerate(NOEFF_LIB[:3])]
        P['items'] = items
        B['head'] = round(a + 0.11, 3)
        B['badge'] = round(max(items[-1]['t'] + 0.55, b - 0.63), 3)
        P.update(head=g('noeffHead', 'ВАМ НЕ НУЖНО'), badge=g('noeffBadge', '0 УСИЛИЙ С ВАШЕЙ СТОРОНЫ'))

    elif n == 'result':
        rise = find(W, a + .5, b, ['выдел','отлич','замет','лучше','сильн']) or a + d * .28
        met  = find(W, a + 1.2, b, ['удержив','внимание','результат','рост','конверс','продаж'],
                    after=rise + .5) or a + d * .71
        B['hero'], B['rise'], B['metrics'] = order([a + .11, rise, met], a, b - 1.0, 0.5)
        num = brand.get('numbers', {})
        P.update(heroLabel=g('resultHero', 'ГОТОВЫЕ REELS'), phoneWord=g('resultPhone', 'REELS'),
                 riseChip=g('resultRise', 'ВЫДЕЛЯЮТ ВАШ БИЗНЕС'),
                 metricTitle=g('resultMetric', 'УДЕРЖАНИЕ ВНИМАНИЯ'), pct=num.get('retention', 87),
                 tiles=T.get('resultTiles', [['ОХВАТ', '×5.4'], ['СОХРАНЕНИЯ', '+218%'], ['ЗАЯВКИ', '+37']]),
                 finalLabel=g('resultFinal', 'УДЕРЖИВАЮТ ВНИМАНИЕ'))

    elif n == 'cta':
        # Секции призыва подгоняются под длину сцены: на коротком финале
        # блок с вирусным графиком просто выключается, а не вылезает за край.
        lock_len = min(2.0, max(1.2, d * 0.28))
        lock = b - lock_len
        has_viral = d >= 8.0
        wr = find(W, a + 0.6, b, ['напиши','пиши','свяжит','оставьт','заказ','жми',
                                  'обращ','звони','приход','подпис'])
        if has_viral:
            vir = find(W, a + 2.0, b, ['вирусн','следующ','создад','запуст','результат'])
            vir = vir if vir is not None else a + d * 0.69
            vir = min(max(vir, a + d * 0.45), lock - 1.0)
        else:
            vir = lock                      # секции C нет — она схлопывается
        wr_hi = vir - (1.2 if has_viral else 0.9)
        wr_lo = a + 0.45
        if wr_hi <= wr_lo: wr_hi = wr_lo = max(a + 0.15, vir - 0.6)
        wr = min(max(wr if wr is not None else a + d * 0.41, wr_lo), wr_hi)

        # вопрос «хотите …?» — три удара в промежутке до призыва
        qhi = wr - 0.25
        picks = []
        for w in W:
            if w['s'] >= qhi: break
            if not picks or w['s'] - picks[-1] >= 0.40: picks.append(w['s'])
            if len(picks) == 3: break
        span = max(0.12, (qhi - a) / 3.0)
        while len(picks) < 3: picks.append(a + span * len(picks))
        B['q1'], B['q2'], B['q3'] = order(picks[:3], a, qhi, min(0.40, span))
        B['icons'] = round(min(B['q3'] + 0.5, max(B['q3'] + 0.05, wr - 0.4)), 3)
        B['write1'] = round(wr, 3)
        B['write2'] = round(min(wr + 0.42, vir - 0.15), 3)
        B['composer'] = round(min(wr + 0.66, vir - 0.10), 3)
        B['typing'] = round(min(wr + 0.84, vir - 0.05), 3)
        # входящие сообщения показываем, только если под них есть место
        for i, (k, off) in enumerate((('msg1', 1.56), ('msg2', 1.96), ('msg3', 2.28))):
            tm = wr + off
            B[k] = round(tm if tm <= vir - 0.25 else vir + 5.0, 3)
        B['viral'] = round(vir, 3)
        B['viralText'] = round(vir + 0.16, 3)
        B['lockup'] = round(lock, 3)
        num = brand.get('numbers', {})
        P.update(q1=g('ctaQ1', 'ХОТИТЕ'), q2=g('ctaQ2', 'REELS'), q3=g('ctaQ3', 'КОТОРЫЕ ЦЕПЛЯЮТ?'),
                 cta1=g('ctaWrite1', 'НАПИШИТЕ'), cta2=g('ctaWrite2', 'МНЕ'),
                 dmText=g('ctaDM', 'Хочу такие Reels для бизнеса'),
                 messages=T.get('ctaMessages', ['Хочу такие Reels 🔥', 'Сколько стоит?', 'Когда начнём? 🚀']),
                 views=num.get('views', 1240000), viewsLabel=g('ctaViewsLabel', 'ПРОСМОТРОВ'),
                 viralLabel=g('ctaViral', 'ВИРУСНЫЙ РОЛИК'), lockup=g('ctaLockup', 'НАПИШИТЕ МНЕ'),
                 lockSub1=g('ctaLockSub1', 'И СОЗДАДИМ ВАШ СЛЕДУЮЩИЙ'),
                 lockSub2=g('ctaLockSub2', 'ВИРУСНЫЙ REELS'),
                 lockChips=T.get('ctaLockChips', ['ИДЕЯ', 'СЦЕНАРИЙ', 'AI', 'ОЗВУЧКА', 'МОНТАЖ']))

    else:  # kinetic — крупная типографика по ключевым словам фразы
        extra = {k.lower(): v for k, v in (brand.get('spelling') or {}).items()}
        key = [w for w in W if len(w['w']) >= 5][:3] or W[:3]
        lines = [{'txt': spell(w['w'], extra), 't': round(w['s'], 3), 'accent': i == 1}
                 for i, w in enumerate(key)]
        if not lines: lines = [{'txt': g('kineticFallback', 'REELS'), 't': round(a + .1, 3), 'accent': True}]
        P['lines'] = lines
        P['chip'] = None

    # страховка: ни один тайминг не должен вылезти за границы сцены
    HIDE = round(b + 5.0, 3)
    scene['b'] = {k: (HIDE if v >= b + 4.0 else round(min(max(v, a), b), 3))
                  for k, v in B.items() if v is not None}
    scene['p'] = P
    return scene


# ------------------------------------------------------------- субтитры
FUNC = {"И","С","НА","НЕ","В","ПОД","А","ЧТОБЫ","ВЫ","МНЕ","Я","ВАМ","ВАШ","ПО","ЗА","ОТ","К","ДЛЯ","ЧТО"}
# Распознавание пишет латиницу и ё кириллицей и без буквы ё — приводим к виду для экрана.
# Свои замены (названия, бренды) добавляются в brand.json -> "spelling".
SPELLING = {"риулс":"REELS","рилс":"REELS","рилз":"REELS","аай":"AI","ии":"AI","эйай":"AI",
            "съемки":"СЪЁМКИ","съемку":"СЪЁМКУ","еще":"ЕЩЁ","все":"ВСЁ","сторис":"STORIES",
            "инстаграм":"INSTAGRAM","тикток":"TIKTOK","ютуб":"YOUTUBE","директ":"DIRECT",
            "подключ":"ПОД КЛЮЧ","какпо":"КАК ПО"}

def spell(word, extra):
    low = word.lower()
    if low in extra:   return extra[low]
    if low in SPELLING: return SPELLING[low]
    return word.upper()
EMPH_STEMS = ['reels','ai','скучн','конкурент','внимани','секунд','график','динамик','иде','сценар',
              'визуал','озвучк','монтаж','субтитр','готов','бизнес','вирусн','напиш','клиент',
              'дальше','цепля','современ','удержив','ключ','технолог','результат','контент','рост']

def build_subs(words, scenes, spelling=None):
    extra = {k.lower(): v for k, v in (spelling or {}).items()}
    def scene_of(t):
        for i, s in enumerate(scenes):
            if s['s'] <= t < s['e']: return i
        return len(scenes) - 1
    ws = []
    for w in words:
        low = w['w'].lower()
        ws.append({'w': spell(w['w'], extra), 's': w['s'], 'e': w['e'],
                   'big': any(low.startswith(k) or k == low for k in EMPH_STEMS)})
    chunks, cur = [], []
    for w in ws:
        if cur:
            gap = w['s'] - cur[-1]['e']
            dur = w['e'] - cur[0]['s']
            chars = sum(len(x['w']) for x in cur) + len(w['w'])
            if (gap > 0.30 or len(cur) >= 3 or dur > 1.7 or chars > 26
                    or scene_of(w['s']) != scene_of(cur[0]['s'])):
                chunks.append(cur); cur = []
        cur.append(w)
    if cur: chunks.append(cur)
    # хвостовые служебные слова уезжают в следующую группу
    for i in range(len(chunks) - 1):
        while (len(chunks[i]) > 1 and chunks[i][-1]['w'] in FUNC
               and len(chunks[i + 1]) < 3 and chunks[i + 1][0]['s'] - chunks[i][-1]['e'] < 0.6):
            chunks[i + 1].insert(0, chunks[i].pop())
    i = 1
    while i < len(chunks):
        if (len(chunks[i]) == 1 and len(chunks[i][0]['w']) <= 5 and len(chunks[i - 1]) < 3
                and chunks[i][0]['s'] - chunks[i - 1][-1]['e'] < 0.35):
            chunks[i - 1].extend(chunks.pop(i)); continue
        i += 1
    return [{'s': round(c[0]['s'], 3), 'e': round(c[-1]['e'], 3), 'words': c} for c in chunks if c]


def sub_hide(scenes, duration):
    """Диапазоны, где субтитры прячутся: их роль играет крупная типографика."""
    out = []
    for s in scenes:
        if s['n'] == 'hook':
            out.append([0.0, round(s['e'] - 0.03, 3)])
        if s['n'] == 'cta':
            b = s.get('b', {})
            if 'write1' in b: out.append([round(s['s'] + 0.05, 3), round(b['write1'] - 0.02, 3)])
            if 'viral' in b:  out.append([round(b['viral'] - 0.02, 3), round(duration, 3)])
        if s['n'] == 'noeff' and 'head' in s.get('b', {}):
            out.append([round(s['s'] + 0.02, 3), round(s['b']['head'] + 0.72, 3)])
    return [r for r in out if r[1] > r[0]]


# ------------------------------------------------------------------ сборка
def build(words, brand, tail=2.05, fps=30):
    last = max(w['e'] for w in words)
    duration = round(last + tail, 2)
    duration = round(int(duration * fps + 0.5) / fps, 4)
    scenes = choose_scenes(words, duration, tail)
    for s in scenes:
        fill(s, words, brand, duration)
        s.pop('words', None)
        s['s'] = round(s['s'], 3); s['e'] = round(s['e'], 3)
    subs = build_subs(words, scenes, brand.get('spelling'))
    return {'duration': duration, 'fps': fps, 'scenes': scenes,
            'subHide': sub_hide(scenes, duration)}, subs


def main():
    import argparse
    ap = argparse.ArgumentParser(description='Раскладка озвучки на сцены ролика')
    ap.add_argument('transcript')
    ap.add_argument('-b', '--brand', default=None)
    ap.add_argument('-o', '--out', default='plan.js')
    ap.add_argument('--tail', type=float, default=2.05)
    ap.add_argument('--fps', type=int, default=30)
    a = ap.parse_args()
    tr = json.load(open(a.transcript, encoding='utf-8'))
    words = tr['words'] if isinstance(tr, dict) else [w for seg in tr for w in seg['words']]
    brand = json.load(open(a.brand, encoding='utf-8')) if a.brand and os.path.exists(a.brand) else {}
    plan, subs = build(words, brand, a.tail, a.fps)
    with open(a.out, 'w', encoding='utf-8') as f:
        f.write('const PLAN=' + json.dumps(plan, ensure_ascii=False) + ';\n')
        f.write('const SUBS=' + json.dumps(subs, ensure_ascii=False) + ';\n')
    print('%-8s %6s %6s  %s' % ('СЦЕНА', 'НАЧАЛО', 'КОНЕЦ', 'ПЕРЕХОД'))
    for s in plan['scenes']:
        print('%-8s %6.2f %6.2f  %s' % (s['n'], s['s'], s['e'], s.get('tr', '')))
    print('длительность %.2f с, групп субтитров %d -> %s' % (plan['duration'], len(subs), a.out))


if __name__ == '__main__':
    main()
