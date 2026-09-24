# Verifies candidate featured playlist ids against the live Deezer API.
import json, sys, time, urllib.request

def get(url):
    for attempt in range(3):
        with urllib.request.urlopen(url, timeout=15) as r:
            d = json.load(r)
        if isinstance(d, dict) and d.get('error', {}).get('code') == 4:
            time.sleep(1.5); continue
        return d
    return d

def check(pid):
    meta = get(f'https://api.deezer.com/playlist/{pid}')
    if 'error' in meta:
        return (pid, 'ERR', meta['error'])
    total = meta.get('nb_tracks', 0)
    seen = set(); playable = 0; ranks = []
    idx = 0
    while idx < min(total, 300):
        page = get(f'https://api.deezer.com/playlist/{pid}/tracks?limit=100&index={idx}')
        data = page.get('data', [])
        if not data: break
        for t in data:
            if t.get('id') in seen: continue
            seen.add(t.get('id'))
            if t.get('preview') and t.get('readable', True) is not False and t.get('type') == 'track':
                playable += 1; ranks.append(t.get('rank', 0))
        idx += 100
    ranks.sort(reverse=True)
    med = ranks[len(ranks)//2] if ranks else 0
    return (pid, total, playable, med, meta.get('title'), meta.get('creator', {}).get('name'), meta.get('fans'))

ids = [int(x) for x in sys.argv[1:]]
for pid in ids:
    print(*check(pid), sep=' | ', flush=True)
    time.sleep(0.25)
