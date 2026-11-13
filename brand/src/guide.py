import re,os
B='/mnt/project-files/samra-game/brand/'
def inl(n,cls=''):
    s=open(B+n).read().strip()
    s=re.sub(r'<title>.*?</title>','',s)
    s=re.sub(r' width="[\d.]+" height="[\d.]+"','',s,count=1)
    return s.replace('<svg ',f'<svg class="{cls}" aria-hidden="true" ',1)
cols=[('أحمر السدو','#A8473B','الرمز، التنبيهات المهمة، فريق ١'),('ذهبي','#C9934A','الأزرار والنقاط والتلميحات'),('صوف','#E9E1D3','النصوص على الداكن'),('ليل','#1C1816','الخلفية الأساسية'),('خيمة','#26201D','البطاقات والأسطح'),('فحمي','#120F0E','داخل الرمز والحدود العميقة')]
def cmyk(h):
    r,g,b=[int(h[i:i+2],16)/255 for i in (1,3,5)];k=1-max(r,g,b)
    if k==1: return '0 0 0 100'
    return ' '.join(str(round((1-x-k)/(1-k)*100)) for x in (r,g,b))+' '+str(round(k*100))
def rgb(h): return ', '.join(str(int(h[i:i+2],16)) for i in (1,3,5))
chips=''.join(f'<div class="col"><div class="sw" style="background:{h}"></div><div class="cm"><b>{n}</b><span>{h}</span><span>RGB {rgb(h)}</span><span>CMYK {cmyk(h)}</span><em>{u}</em></div></div>' for n,h,u in cols)
html=open('guide_tpl.html').read()
for k,v in {'{{H_LIGHT}}':inl('lockup-horizontal-light.svg','lk'),'{{H_DARK}}':inl('lockup-horizontal-dark.svg','lk'),'{{ST_LIGHT}}':inl('lockup-stacked-light.svg','st'),'{{SYM}}':inl('symbol.svg','sy'),'{{SYM_ML}}':inl('symbol-mono-light.svg','sy'),'{{SYM_MD}}':inl('symbol-mono-dark.svg','sy'),'{{WM_L}}':inl('wordmark-light.svg','wm'),'{{LAT_L}}':inl('wordmark-latin-light.svg','lat'),'{{ICON}}':inl('icon.svg','ic'),'{{CHIPS}}':chips}.items():
    html=html.replace(k,v)
open(B+'brand-guide.html','w').write(html)
