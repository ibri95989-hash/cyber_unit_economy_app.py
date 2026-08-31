#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Обновление программы до последней версии.

    python update.py

Скачивает свежую версию и заменяет только код. Ваши настройки
(brand.json), готовые ролики (out) и шрифты остаются на месте.
"""
import io, os, shutil, sys, tempfile, urllib.request, zipfile

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

HERE = os.path.dirname(os.path.abspath(__file__))
BRANCH = 'claude/professional-reels-video-8oqd7l'
ZIP = ('https://github.com/ibri95989-hash/cyber_unit_economy_app.py/'
       'archive/refs/heads/' + BRANCH + '.zip')

# Что НЕ трогаем ни при каких условиях — всё остальное берётся из архива.
# Список обновляемых файлов раньше был зашит здесь, и старая версия
# не знала про файлы, появившиеся позже: она их не искала и сообщала
# «у вас последняя версия», хотя половины новых файлов не было.
KEEP_NAMES = {'brand.json', 'plan.js'}
KEEP_DIRS = {'out', 'clients', 'preview', 'examples'}
KEEP_EXT = {'.ttf', '.otf', '.mp4', '.mov', '.mp3', '.wav', '.backup'}


def _updatable(rel):
    parts = rel.replace('\\', '/').split('/')
    if any(p in KEEP_DIRS or p.startswith('.work_') for p in parts[:-1]): return False
    name = parts[-1]
    if name in KEEP_NAMES: return False
    if os.path.splitext(name)[1].lower() in KEEP_EXT: return False
    return True


def _archive_files(src):
    """Все файлы свежей версии, которые можно обновлять."""
    out = []
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in KEEP_DIRS and not d.startswith('.work_')]
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), src).replace(os.sep, '/')
            if _updatable(rel): out.append(rel)
    return sorted(out)


def main():
    print('Скачиваю свежую версию…', flush=True)
    try:
        data = urllib.request.urlopen(ZIP, timeout=180).read()
    except Exception as e:
        sys.exit('Не удалось скачать: %s\nПроверьте интернет и попробуйте снова.' % e)

    tmp = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            z.extractall(tmp)
        roots = [d for d in os.listdir(tmp) if os.path.isdir(os.path.join(tmp, d))]
        if not roots: sys.exit('В архиве нет папки с проектом.')
        src = os.path.join(tmp, roots[0], 'reels_video')
        if not os.path.isdir(src): sys.exit('В архиве нет папки reels_video.')

        # копию настроек кладём рядом — на случай, если что-то пойдёт не так
        brand = os.path.join(HERE, 'brand.json')
        if os.path.exists(brand):
            shutil.copy2(brand, brand + '.backup')

        changed, added = [], []
        for rel in _archive_files(src):
            s = os.path.join(src, rel.replace('/', os.sep))
            d = os.path.join(HERE, rel.replace('/', os.sep))
            if not os.path.exists(s): continue
            os.makedirs(os.path.dirname(d), exist_ok=True)
            if not os.path.exists(d):
                added.append(rel)
            elif open(s, 'rb').read() != open(d, 'rb').read():
                changed.append(rel)
            else:
                continue
            shutil.copy2(s, d)
            if rel.endswith('.command'):
                try: os.chmod(d, 0o755)
                except Exception: pass

        # новые тексты из свежего brand.json добавляем, свои значения не трогаем
        newly = _merge_brand(os.path.join(src, 'brand.json'), brand)

        if not changed and not added and not newly:
            print('\nУ вас уже последняя версия (проверено %d файлов).' % len(_archive_files(src)))
        else:
            if added:   print('\nДобавлено:  ' + ', '.join(added))
            if changed: print('Обновлено:  ' + ', '.join(changed))
            if newly:   print('Новые настройки в brand.json: ' + ', '.join(newly))
            print('\nГотово (проверено %d файлов). Ваши настройки и ролики не тронуты.'
                  % len(_archive_files(src)))
            print('Проверьте установку: ПРОВЕРКА, затем запускайте СТАРТ.')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _merge_brand(new_path, cur_path):
    """Добавляет появившиеся ключи, оставляя ваши значения нетронутыми."""
    import json
    if not (os.path.exists(new_path) and os.path.exists(cur_path)):
        if os.path.exists(new_path) and not os.path.exists(cur_path):
            shutil.copy2(new_path, cur_path)
        return []
    try:
        new = json.load(open(new_path, encoding='utf-8'))
        cur = json.load(open(cur_path, encoding='utf-8'))
    except Exception:
        return []
    added = []
    for section in ('texts', 'numbers', 'spelling'):
        cur.setdefault(section, {})
        for k, v in new.get(section, {}).items():
            if k not in cur[section]:
                cur[section][k] = v; added.append(k)
    if added:
        json.dump(cur, open(cur_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    return added


if __name__ == '__main__':
    main()
