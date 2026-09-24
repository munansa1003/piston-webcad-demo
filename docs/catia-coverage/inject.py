"""페이지 데이터(PAGE)·검증 통계(STATS)·통과 주장(CLAIMS)·페이지 대조 요약(CHECK)을 렌더러 자리표시자에 넣는다."""
import json, sys
page_path, out_path = sys.argv[1], sys.argv[2]
check_text = sys.argv[3] if len(sys.argv) > 3 else None
page = json.load(open(page_path))
res = json.load(open('coverage-result.json'))
full = json.load(open('claims-full.json'))
claims = [{k: c[k] for k in ('id', 'headline', 'value', 'range', 'unit', 'confidence', 'agree', 'round')} for c in full['confirmed']]
def js(o):
    return json.dumps(o, ensure_ascii=False).replace('</', '<\\/')
html = open('catia-coverage.html').read()
for key, val in (('PAGE', page), ('STATS', res['stats']), ('CLAIMS', claims), ('CHECK', {'text': check_text} if check_text else None)):
    ph = f'/*__{key}__*/null'
    assert html.count(ph) == 1, key
    html = html.replace(ph, js(val))
open(out_path, 'w').write(html)
print(out_path, len(html))
