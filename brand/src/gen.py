import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import sys
FONT='/tmp/claude-0/-home-claude/b31363f1-3340-55ed-afc9-eb8cb08dceca/scratchpad/fonts/ReemKufi-700.ttf'
blob=hb.Blob.from_file_path(FONT); face=hb.Face(blob); font=hb.Font(face)
tt=TTFont(FONT); gs=tt.getGlyphSet(); order=tt.getGlyphOrder()
upm=tt['head'].unitsPerEm
def shape(text,direction,track=0):
    buf=hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    buf.direction=direction
    hb.shape(font,buf)
    pen=SVGPathPen(gs); x=0
    for info,pos in zip(buf.glyph_infos,buf.glyph_positions):
        g=order[info.codepoint]
        tp=TransformPen(pen,(1,0,0,-1,x+pos.x_offset,-pos.y_offset))
        gs[g].draw(tp); x+=pos.x_advance+track
    return pen.getCommands(), x-track
ar,arw=shape('سمرة','rtl')
la,law=shape('SAMRA','ltr',track=180)
asc=tt['hhea'].ascent; desc=tt['hhea'].descent
print(arw,law,asc,desc,upm,file=sys.stderr)
import json
json.dump({'ar':ar,'arw':arw,'la':la,'law':law,'upm':upm},open(sys.argv[1],'w'))
from fontTools.pens.boundsPen import BoundsPen
def bounds(text,direction,track=0):
    buf=hb.Buffer(); buf.add_str(text); buf.guess_segment_properties(); buf.direction=direction; hb.shape(font,buf)
    bp=BoundsPen(gs); x=0
    for info,pos in zip(buf.glyph_infos,buf.glyph_positions):
        tp=TransformPen(bp,(1,0,0,-1,x+pos.x_offset,-pos.y_offset)); gs[order[info.codepoint]].draw(tp); x+=pos.x_advance+track
    return bp.bounds
d=json.load(open(sys.argv[1])); d['arb']=bounds('سمرة','rtl'); d['lab']=bounds('SAMRA','ltr',180)
json.dump(d,open(sys.argv[1],'w')); print(d['arb'],d['lab'])
