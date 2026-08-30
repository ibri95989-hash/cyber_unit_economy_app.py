import sys, os
from playwright.sync_api import sync_playwright
times=[float(x) for x in sys.argv[1:]] or [0.3,0.7,1.1,2.0,2.9,3.5]
out="/home/user/work/prev"; os.makedirs(out,exist_ok=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
        args=['--no-sandbox','--disable-lcd-text','--force-color-profile=srgb','--hide-scrollbars','--allow-file-access-from-files'])
    pg=b.new_page(viewport={'width':1080,'height':1920},device_scale_factor=1)
    pg.on("console", lambda m: print("JS:",m.type,m.text))
    pg.on("pageerror", lambda e: print("PAGEERROR:",e))
    pg.goto("file:///home/user/work/reel/index.html")
    pg.wait_for_function("window.__ready===true && typeof window.render==='function'",timeout=30000)
    for t in times:
        pg.evaluate("t=>window.render(t)", t)
        pg.screenshot(path=f"{out}/f_{t:06.2f}.png")
    b.close()
print("done", out)
