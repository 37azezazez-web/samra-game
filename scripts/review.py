"""يحدّث CONTENT-REVIEW.md من js/cards.js ويحافظ على علامات ✅ الموجودة."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / 'js/cards.js').read_text()
rows = re.findall(r"\{ id: '(\w+)', cat: '(\w+)', answer: '([^']+)'", s)
rev = root / 'CONTENT-REVIEW.md'
done = set(re.findall(r"\| ✅ \| (\w+) \|", rev.read_text())) if rev.exists() else set()
out = ['# مراجعة محتوى البطاقات', '', 'كل بطاقة فيها معلومات عن أشخاص أو أماكن أو تواريخ تحتاج تتأكد قبل الإطلاق. ✅ = تأكدت، ⬜ = باقي.', '',
       f'العدد: {len(rows)} بطاقة.', '', '| الحالة | id | الفئة | الجواب |', '|---|---|---|---|']
out += [f"| {'✅' if i in done else '⬜'} | {i} | {c} | {a} |" for i, c, a in rows]
rev.write_text('\n'.join(out) + '\n')
print(len(rows))
