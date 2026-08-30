import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
FPS = 30
DUR = 45.60
N = int(round(DUR*FPS))
OUT = "/home/user/work/out/reels_raw.mp4"
os.makedirs("/home/user/work/out", exist_ok=True)

cmd = [FF,"-y","-f","image2pipe","-vcodec","png","-r",str(FPS),"-i","pipe:0",
       "-an","-c:v","libx264","-preset","slow","-crf","16","-pix_fmt","yuv420p",
       "-profile:v","high","-level","4.2","-movflags","+faststart", OUT]
errlog = open("/home/user/work/out/ffmpeg.log","wb")
proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=errlog)

t0=time.time()
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
        args=['--no-sandbox','--disable-lcd-text','--force-color-profile=srgb','--hide-scrollbars',
              '--allow-file-access-from-files','--disable-gpu','--disable-dev-shm-usage'])
    pg=b.new_page(viewport={'width':1080,'height':1920},device_scale_factor=1)
    errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file:///home/user/work/reel/index.html")
    pg.wait_for_function("window.__ready===true && typeof window.render==='function'",timeout=60000)
    for i in range(N):
        t=i/FPS
        pg.evaluate("t=>window.render(t)", t)
        png=pg.screenshot(type="png")
        proc.stdin.write(png)
        if i%60==0:
            el=time.time()-t0
            print(f"frame {i}/{N}  t={t:5.2f}s  elapsed={el:6.1f}s  eta={el/(i+1)*(N-i-1):6.1f}s", flush=True)
        if errs:
            print("PAGEERROR:", errs[:3], flush=True); break
    b.close()
proc.stdin.close()
rc=proc.wait()
print("ffmpeg rc", rc)
errlog.close()
if rc: print(open("/home/user/work/out/ffmpeg.log").read()[-3000:])
print("elapsed", time.time()-t0)
