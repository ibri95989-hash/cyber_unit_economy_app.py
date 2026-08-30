import json
d=json.load(open("transcript.json"))
FIX={"риулс":"REELS","рилс":"REELS","аай":"AI","ии":"AI","съемки":"СЪЁМКИ","еще":"ЕЩЁ","все":"ВСЁ"}
words=[]
for s in d:
    for w in s["words"]:
        t=w["w"]
        disp=FIX.get(t, t.upper())
        words.append({"w":disp,"s":w["s"],"e":w["e"]})
# scene bounds
B=[0.0,1.45,3.88,11.72,15.22,26.45,30.25,35.65,44.0]
def scene_of(t):
    for i in range(len(B)-1):
        if B[i]<=t<B[i+1]: return i
    return len(B)-2
# emphasis words -> bigger
EMPH={"СКУЧНЫЕ","ВИДЕО","КОНКУРЕНТЫ","ВНИМАНИЕ","СЕКУНД","ГРАФИКУ","ДИНАМИКУ","AI","REELS","ИДЕЮ",
      "СЦЕНАРИЙ","ВИЗУАЛ","ОЗВУЧКУ","МОНТАЖ","СУБТИТРЫ","ГОТОВЫЕ","БИЗНЕС","ВИРУСНЫЙ","НАПИШИТЕ",
      "ДАЛЬШЕ","КЛИЕНТЫ","ЦЕПЛЯЛ","СОВРЕМЕННО","УДЕРЖИВАЮТ","КЛЮЧ","ТЕХНОЛОГИИ"}
chunks=[];cur=[]
def flush():
    global cur
    if cur: chunks.append(cur); cur=[]
prev=None
for w in words:
    w["big"]= w["w"] in EMPH
    if cur:
        gap=w["s"]-cur[-1]["e"]
        dur=w["e"]-cur[0]["s"]
        same=scene_of(w["s"])==scene_of(cur[0]["s"])
        chars=sum(len(x["w"]) for x in cur)+len(w["w"])
        if gap>0.30 or len(cur)>=3 or dur>1.7 or not same or chars>26:
            flush()
    cur.append(w)
flush()

# post-process: move trailing function words to next chunk; merge tiny chunks
FUNC={"И","С","НА","НЕ","В","ПОД","А","ЧТОБЫ","ВЫ","МНЕ","Я","ВАМ","ВАШ"}
changed=True
def rebuild(cs):
    return [{"s":round(c[0]["s"],3),"e":round(c[-1]["e"],3),"words":c} for c in cs if c]
cs=[list(c) for c in chunks]
for i in range(len(cs)-1):
    while len(cs[i])>1 and cs[i][-1]["w"] in FUNC and len(cs[i+1])<3 and cs[i+1][0]["s"]-cs[i][-1]["e"]<0.6:
        cs[i+1].insert(0,cs[i].pop())
i=1
while i<len(cs):
    if len(cs[i])==1 and len(cs[i][0]["w"])<=5 and len(cs[i-1])<3 and cs[i][0]["s"]-cs[i-1][-1]["e"]<0.35:
        cs[i-1].extend(cs[i]); cs.pop(i); continue
    i+=1
out=rebuild(cs)

open("reel/words.js","w").write("const SUBS="+json.dumps(out,ensure_ascii=False)+";\n"
   +"const WORDS="+json.dumps(words,ensure_ascii=False)+";\n")
for c in out: print(f"{c['s']:6.2f}-{c['e']:6.2f}  "+" ".join(w["w"] for w in c["words"]))
print(len(out),"chunks")
