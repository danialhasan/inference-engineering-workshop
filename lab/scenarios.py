"""Fictional business scenarios and deterministic work items; no model answers here."""
SCENARIOS = [
    dict(id='quality', number='01', title='Make the report correct', customer='Northstar procurement desk',
         story='An analyst needs the reference, agency, closing date, and source of each tender. A fast report is useless if the date is wrong.',
         promise='Example contract: $2,000 per month. At least 95% of reports complete within 30 seconds. A missed monthly target earns a 5% service credit.',
         quality='At least 90% of reports must contain all four correct fields.',
         demand='A small batch of independent document requests.',
         question='Can you preserve the evidence while reducing unnecessary model work?',
         hints=['Compare brief instructions with explicit field definitions.', 'Give the model enough output tokens to finish.', 'Compare focused context with the complete packet.'],
         deadline=30, quality_min=.9, cost_limit=1.0),
    dict(id='burst', number='02', title='Keep up with the morning rush', customer='Northstar research API',
         story='Several customers submit document jobs at the same time. They each expect a correct, complete report, even when the server is busy.',
         promise='Example contract: $20,000 per month. At least 95% of eligible reports complete within 30 seconds. A missed monthly target earns a 5% service credit.',
         quality='At least 90% of reports must contain all four correct fields.',
         demand='All report jobs arrive together. Workload size is held fixed when comparing settings.',
         question='Which combination of request concurrency and server slots clears the queue without breaking report quality?',
         hints=['Client concurrency creates demand; server slots determine how many requests Ollama can run together.', 'Change one of these first, then compare both.', 'Inspect individual response time as well as total reports per minute.'],
         deadline=30, quality_min=.9, cost_limit=.75),
    dict(id='shared', number='03', title='Protect the waiting user', customer='Northstar shared AI service',
         story='A background document batch shares a model with a support assistant. The batch needs throughput; the person chatting needs a prompt answer.',
         promise='Example contract: the batch finishes within 30 seconds, and 95% of interactive answers start within 1 second. A missed monthly target earns a 5% service credit.',
         quality='At least 90% of document reports and interactive answers must pass their separate checks.',
         demand='A document batch plus four support questions arriving half a second apart.',
         question='How much background concurrency can you allow before the interactive user suffers?',
         hints=['Reduce background concurrency and inspect the interactive rows.', 'Compare one server slot with four slots.', 'Separate worker pools are a design option, but this exercise measures one shared server.'],
         deadline=30, quality_min=.9, cost_limit=1.0),
]
DEFAULT = dict(instructions='brief', context='focused', structured=True, max_tokens=128, client_parallel=1,
               server_parallel=1, device='auto', count=12, hourly_rate=1.2)

def scenario(key):
    return next(x for x in SCENARIOS if x['id'] == key)

def document(i):
    agency = ['Northern Rivers Water Board', 'Lakeshore Transit Authority', 'Eastfield Health District', 'Pinecrest School Board'][i % 4]
    ref = f'RFQ-2027-{1043+i*37}'
    deadline = f'2027-{1+i%9:02d}-{3+i%23:02d}'
    source = f'notice-{i+1:02d}'
    relevant = f'Source: {source}. Tender reference: {ref}. Issuing agency: {agency}. Final submission deadline: {deadline} at 17:00 local time. This date supersedes previous drafts.'
    extra = ('Archived, non-binding guidance: earlier drafts listed 2026-12-01, which is not the submission deadline. '
             'Suppliers should carry appropriate insurance, register in the vendor portal, provide references, and describe delivery arrangements. ')*6
    return dict(id=source, kind='report', relevant=relevant, extra=extra,
                expected=dict(ref=ref, agency=agency, deadline=deadline, source=source))

def items(key, count):
    docs = [document(i) for i in range(count)]
    if key == 'shared':
        docs += [dict(id=f'chat-{i+1}', kind='chat', relevant='Unused purchases can be refunded within 30 days. Shipping fees are non-refundable.',
                      extra='', expected='30') for i in range(4)]
    return docs
