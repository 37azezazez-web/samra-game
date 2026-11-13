import json,sys,os
d=json.load(open('paths.json')); OUT=sys.argv[1]
RED,OCH,BONE,CHAR,BG='#A8473B','#C9934A','#E9E1D3','#120F0E','#1C1816'
def dia(cx,cy,r): return f'M{cx},{cy-r}L{cx+r},{cy}L{cx},{cy+r}L{cx-r},{cy}Z'
def symbol(cx,cy,R,mono=None):
    k=R/46
    if mono:
        p=dia(cx,cy,46*k)+dia(cx,cy,35*k)+dia(cx,cy,26*k)+dia(cx,cy,16*k)+dia(cx,cy,8*k)
        return f'<path fill-rule="evenodd" fill="{mono}" d="{p}"/>'
    return ''.join(f'<path fill="{c}" d="{dia(cx,cy,r*k)}"/>' for r,c in [(46,RED),(35,CHAR),(26,OCH),(16,CHAR),(8,BONE)])
def text(key,x,y,s,fill):
    b=d[key+'b']
    return f'<path fill="{fill}" transform="translate({x-b[0]*s:.2f},{y-b[1]*s:.2f}) scale({s})" d="{d[key]}"/>', ((b[2]-b[0])*s,(b[3]-b[1])*s)
def svg(name,w,h,body,title):
    open(os.path.join(OUT,name),'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}" role="img"><title>{title}</title>{body}</svg>\n')
S=0.1
aw,ah=(d['arb'][2]-d['arb'][0])*S,(d['arb'][3]-d['arb'][1])*S
lw,lh=(d['lab'][2]-d['lab'][0]),(d['lab'][3]-d['lab'][1])
for tone,fill in [('light',BONE),('dark',BG)]:
    # symbol
    svg(f'symbol-mono-{tone}.svg',100,100,symbol(50,50,46,mono=fill),'سمرة')
    # wordmark arabic only
    t,_=text('ar',0,0,S,fill); svg(f'wordmark-{tone}.svg',aw,ah,t,'سمرة')
    # horizontal: symbol right
    sym=ah*1.05; gap=ah*0.28; W=aw+gap+sym; H=max(ah,sym)
    t,_=text('ar',0,(H-ah)/2,S,fill)
    svg(f'lockup-horizontal-{tone}.svg',W,H,t+symbol(aw+gap+sym/2,H/2,sym/2),'سمرة')
    # stacked: symbol, arabic, latin
    sym=ah*1.15; ls=aw*0.62/lw; lhh=lh*ls; W=aw; H=sym+ah*0.3+ah+ah*0.32+lhh
    t,_=text('ar',0,sym+ah*0.3,S,fill)
    l,_=text('la',(aw-lw*ls)/2,sym+ah*0.3+ah+ah*0.32,ls,fill)
    svg(f'lockup-stacked-{tone}.svg',W,H,symbol(W/2,sym/2,sym/2)+t+l,'سمرة Samra')
svg('symbol.svg',100,100,symbol(50,50,46),'سمرة')
# latin wordmark
for tone,fill in [('light',BONE),('dark',BG)]:
    l,_=text('la',0,0,1,fill); svg(f'wordmark-latin-{tone}.svg',lw,lh,l,'Samra')
# sadu band
def band(y,h,W,flip=False):
    n=8; tw=W/n; out=[f'<rect x="0" y="{y}" width="{W}" height="{h}" fill="{RED}"/>']
    for i in range(n):
        x=i*tw
        a,b=(y+h,y) if not flip else (y,y+h)
        out.append(f'<path fill="{OCH}" d="M{x},{a}L{x+tw/2},{b+(h*0.25 if not flip else -h*0.25)}L{x+tw},{a}Z"/>')
        out.append(f'<path fill="{CHAR}" d="M{x+tw/2-tw*0.18},{y+h/2}L{x+tw/2},{y+h/2-h*0.2}L{x+tw/2+tw*0.18},{y+h/2}L{x+tw/2},{y+h/2+h*0.2}Z"/>')
    return ''.join(out)
W=1024
icon=f'<rect width="{W}" height="{W}" fill="{BG}"/>'+band(0,110,W)+band(W-110,110,W,True)+symbol(512,512,300)
svg('icon.svg',W,W,icon,'سمرة')
