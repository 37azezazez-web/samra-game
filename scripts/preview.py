"""يبني نسخة صفحة وحدة (كل CSS وJS داخلها) للمعاينة كـ Artifact. الاستخدام: python3 scripts/preview.py OUT.html"""
import re, sys, base64, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / 'index.html').read_text()
head = re.search(r'<head>(.*?)</head>', s, re.S).group(1)
body = re.search(r'<body>(.*?)</body>', s, re.S).group(1)
head = re.sub(r'<meta http-equiv[^>]*>\s*|<meta name="referrer"[^>]*>\s*|<meta charset[^>]*>\s*|<meta name="viewport"[^>]*>\s*|<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\s*|<title>.*?</title>\s*', '', head)
head = head.replace('<link rel="stylesheet" href="css/fonts.css">', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@700&family=Almarai:wght@400;700;800&display=swap">')
head = head.replace('<link rel="stylesheet" href="css/style.css">', '<style>' + (root / 'css/style.css').read_text() + '</style>')
for f in ['js/cards.js', 'js/sounds.js', 'js/who.js', 'js/sfx.js', 'js/engine.js', 'js/app.js']:
    body = body.replace(f'<script src="{f}"></script>', '<script>' + (root / f).read_text() + '</script>')
svg = base64.b64encode((root / 'assets/img/lockup-stacked-light.svg').read_bytes()).decode()
body = body.replace('<script>', '<script>window.SAMRA_LOGO="data:image/svg+xml;base64,' + svg + '";</script><script>', 1)
out = '<title>سمرة</title>\n' + head + '<script>document.documentElement.dir="rtl";document.documentElement.lang="ar"</script>\n' + body
pathlib.Path(sys.argv[1]).write_text(out)
