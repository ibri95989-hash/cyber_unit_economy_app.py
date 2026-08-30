# -*- coding: utf-8 -*-
"""Разбор чисел, произнесённых словами.

Распознавание пишет числа прописью: «триста сорок процентов», «в пять раз»,
«двенадцать тысяч подписчиков». Здесь они превращаются в значения для
инфографики, чтобы на экране стояли цифры из самой озвучки, а не из конфига.
"""
import re

ONES = {'ноль':0,'один':1,'одна':1,'одно':1,'два':2,'две':2,'три':3,'четыре':4,'пять':5,
        'шесть':6,'семь':7,'восемь':8,'девять':9}
TEENS = {'десять':10,'одиннадцать':11,'двенадцать':12,'тринадцать':13,'четырнадцать':14,
         'пятнадцать':15,'шестнадцать':16,'семнадцать':17,'восемнадцать':18,'девятнадцать':19}
TENS = {'двадцать':20,'тридцать':30,'сорок':40,'пятьдесят':50,'шестьдесят':60,
        'семьдесят':70,'восемьдесят':80,'девяносто':90}
HUNDREDS = {'сто':100,'двести':200,'триста':300,'четыреста':400,'пятьсот':500,
            'шестьсот':600,'семьсот':700,'восемьсот':800,'девятьсот':900}
SCALES = {'тысяча':1000,'тысячи':1000,'тысяч':1000,'тысячу':1000,
          'миллион':10**6,'миллиона':10**6,'миллионов':10**6,
          'миллиард':10**9,'миллиарда':10**9,'миллиардов':10**9}
SMALL = {}
SMALL.update(ONES); SMALL.update(TEENS); SMALL.update(TENS); SMALL.update(HUNDREDS)

# слова, которые не разрывают число: «сто двадцать И пять»
GLUE = {'и'}

PERCENT = ('процент', 'проц', '%')
TIMES = ('раз', 'раза')
HALF = {'полтора': 1.5, 'полторы': 1.5, 'половина': 0.5}


def _val(tok):
    tok = tok.strip('.,!?:;').lower()
    if tok.isdigit(): return int(tok), 'digit'
    if tok in SMALL: return SMALL[tok], 'small'
    if tok in SCALES: return SCALES[tok], 'scale'
    return None, None


def find_numbers(words):
    """words: [{w,s,e}] -> [{'value':float,'kind':str,'s':float,'e':float,'i':int,'ctx':str}]

    kind: 'percent' | 'times' | 'count'
    """
    out = []
    i, n = 0, len(words)
    while i < n:
        v, k = _val(words[i]['w'])
        low = words[i]['w'].lower()
        if v is None and low not in HALF:
            i += 1; continue
        start = i
        total, cur = 0, 0
        if low in HALF:
            total = HALF[low]; i += 1
            if i < n:
                sv, sk = _val(words[i]['w'])
                if sk == 'scale': total *= sv; i += 1
        else:
            while i < n:
                tok = words[i]['w'].lower()
                if tok in GLUE and i + 1 < n and _val(words[i + 1]['w'])[0] is not None:
                    i += 1; continue
                v, k = _val(words[i]['w'])
                if v is None: break
                if k == 'scale':
                    cur = (cur or 1) * v; total += cur; cur = 0
                elif k == 'digit':
                    if cur: break
                    cur = v
                else:
                    cur += v
                i += 1
            total += cur
        if total <= 0:
            i = max(i, start + 1); continue

        # что стоит рядом — определяет смысл числа
        after = ' '.join(w['w'].lower() for w in words[i:i + 2])
        before = ' '.join(w['w'].lower() for w in words[max(0, start - 2):start])
        kind = 'count'
        if any(p in after for p in PERCENT): kind = 'percent'
        elif any(after.startswith(t) for t in TIMES) or ' в' == before[-2:]: kind = 'times'
        elif re.search(r'\bв$', before) and any(after.startswith(t) for t in TIMES): kind = 'times'
        out.append({'value': float(total), 'kind': kind, 'i': start,
                    's': words[start]['s'], 'e': words[i - 1]['e'] if i > start else words[start]['e'],
                    'ctx': (before + ' | ' + after).strip()})
    return out


# какие слова рядом с числом означают какой показатель
ROLES = {
    'growth':    ['рост','раст','выросл','увеличи','больше','подняли','прирост',
                  'эффективн','быстрее','конверс','окупа','выручк','прибыл'],
    'retention': ['удержан','досмотр','смотрят','дочитыв','вовлеч','вовлечён','дослуш'],
    'audience':  ['подписчик','клиент','аудитор','человек','людей','пользовател',
                  'заяв','зрител','лид','обращен','запис'],
    'views':     ['просмотр','охват','показ','увидел','досмотрел','посмотрел','реакц'],
    'price':     ['рубл','стоит','цена','стоимост','бюджет'],
}
# процент и «в N раз» не могут быть числом аудитории, а тысячи людей — не проценты
KIND_OK = {
    'percent': {'growth', 'retention', 'price'},
    'times':   {'growth'},
    'count':   {'audience', 'views', 'price', 'growth'},
}


def assign(numbers, words, scene_a=None, scene_b=None):
    """Раскладывает найденные числа по показателям инфографики.

    Совпадение ищется по началу слова, а не по подстроке: иначе «рост»
    находится внутри «просто», и число уезжает не в тот показатель.
    Из нескольких подходящих ролей побеждает та, чьё слово ближе к числу.
    """
    got = {}
    for num in numbers:
        if scene_a is not None and not (scene_a <= num['s'] <= scene_b): continue
        lo, hi = max(0, num['i'] - 4), min(len(words), num['i'] + 6)
        best = None
        for j in range(lo, hi):
            tok = words[j]['w'].lower().strip('.,!?:;')
            dist = abs(j - num['i'])
            for role, keys in ROLES.items():
                if role in got: continue
                if role not in KIND_OK.get(num['kind'], set()): continue
                if any(tok.startswith(k) for k in keys):
                    if best is None or dist < best[0]:
                        best = (dist, role)
        if best: got[best[1]] = num
    return got
