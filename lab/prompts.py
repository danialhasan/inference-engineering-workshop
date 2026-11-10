"""Students and coding agents can edit prompts here. Reloaded before every run."""
def build(item, config):
    if item['kind'] == 'chat':
        return 'Answer briefly using only the policy.', item['relevant'] + '\nHow many days do I have to request a refund?', None
    system = 'Extract the tender fields from the authoritative notice. Ignore archived dates.'
    system += ' Return only a JSON object with string fields ref, agency, deadline, source.'
    if config.get('instructions') == 'explicit':
        system += (' Copy ref from Tender reference, agency from Issuing agency, and source from the exact identifier after Source:. '
                   'For deadline, copy only the YYYY-MM-DD date after Final submission deadline, with no time or timezone. '
                   'Source is a document identifier such as notice-99, not a type of document. Never use an archived date.')
    if config['structured']:
        system += ' Return only a JSON object with string fields ref, agency, deadline, source. Use YYYY-MM-DD for deadline.'
        schema = {'type':'object','properties':{k:{'type':'string'} for k in ['ref','agency','deadline','source']},
                  'required':['ref','agency','deadline','source'],'additionalProperties':False}
    else:
        system += ' Do not add prose or code fences.'
        schema = None
    context = item['relevant'] if config['context'] == 'focused' else item['extra'] + '\nAUTHORITATIVE NOTICE\n' + item['relevant']
    return system, context + '\nProduce the report.', schema
