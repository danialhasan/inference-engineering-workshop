import math

def percentile(xs, p):
    return sorted(xs)[max(0, math.ceil(len(xs)*p)-1)] if xs else None

def summarize(rows, seconds, config, scenario):
    reports = [r for r in rows if r['kind']=='report']
    chats = [r for r in rows if r['kind']=='chat']
    good = sum(r['quality'] for r in reports)
    succeeded = sum(not r['error'] for r in reports)
    cost = seconds / 3600 * config['hourly_rate']
    quality = good / len(reports) if reports else 0
    on_time = sum(not r['error'] and r['elapsed'] <= scenario['deadline'] for r in reports) / max(1,len(reports))
    chat_on_time = sum(not r['error'] and r['first_token'] is not None and r['first_token'] <= 1 for r in chats) / max(1,len(chats))
    chat_quality = sum(r['quality'] for r in chats) / max(1,len(chats))
    total_tokens = sum(r.get('output_tokens',0) for r in rows)
    cost_per_1000 = cost / good * 1000 if good else None
    return dict(seconds=seconds, reports=len(reports), correct=good, successful=succeeded, quality=quality,
                on_time=on_time, p95=percentile([r['elapsed'] for r in reports],.95),
                reports_per_minute=good/max(seconds,.001)*60, tokens_per_second=total_tokens/max(seconds,.001),
                input_tokens=sum(r.get('input_tokens',0) for r in rows), output_tokens=total_tokens,
                estimated_cost=cost, cost_per_1000=cost_per_1000, interactive_count=len(chats),
                interactive_on_time=chat_on_time, interactive_quality=chat_quality,
                interactive_p95=percentile([r['first_token'] for r in chats if r['first_token'] is not None],.95),
                gates=dict(quality=quality>=scenario['quality_min'], latency=on_time>=.95,
                           cost=cost_per_1000 is not None and cost_per_1000<=scenario['cost_limit'],
                           interactive=(not chats or (chat_on_time>=.95 and chat_quality>=.9))))
