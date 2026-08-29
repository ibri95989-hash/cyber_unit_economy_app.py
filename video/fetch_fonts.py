#!/usr/bin/env python3
"""Download the Cyrillic subsets of Montserrat + Inter and inline them as
base64 into render/fonts.css, so the renderer needs no network at run time."""
import base64, os, re, subprocess, sys

CSS_URL = ('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900'
           '&family=Inter:wght@500;600;700;800&display=swap')
UA = ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/120.0.0.0 Safari/537.36')
# latin-ext carries the ruble sign (U+20BD), cyrillic-ext the rest of the extras
KEEP = {'cyrillic', 'cyrillic-ext', 'latin', 'latin-ext'}
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'fonts')
OUT = os.path.join(HERE, 'render', 'fonts.css')


def curl(url, out=None):
    cmd = ['curl', '-sS', '-H', f'User-Agent: {UA}', url]
    if out:
        cmd += ['-o', out]
        subprocess.run(cmd, check=True)
        return None
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def main():
    os.makedirs(CACHE, exist_ok=True)
    css = curl(CSS_URL)
    faces = []
    for subset, body in re.findall(r'/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}', css, re.S):
        if subset not in KEEP:
            continue
        fam = re.search(r"font-family:\s*'([^']+)'", body).group(1)
        wt = re.search(r'font-weight:\s*(\d+)', body).group(1)
        url = re.search(r'url\((https://[^)]+)\)', body).group(1)
        rng = re.search(r'unicode-range:\s*([^;]+);', body).group(1).strip()
        name = f'{fam}-{wt}-{subset}.woff2'
        path = os.path.join(CACHE, name)
        if not os.path.exists(path):
            curl(url, path)
        b64 = base64.b64encode(open(path, 'rb').read()).decode()
        faces.append(f"@font-face{{font-family:'{fam}';font-style:normal;font-weight:{wt};"
                     f"font-display:block;src:url(data:font/woff2;base64,{b64}) format('woff2');"
                     f"unicode-range:{rng};}}")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write('\n'.join(faces))
    print(f'{len(faces)} faces -> {OUT} ({os.path.getsize(OUT) // 1024} KB)')


if __name__ == '__main__':
    main()
