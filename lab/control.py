import copy, concurrent.futures, datetime, hashlib, importlib, json, pathlib, platform, threading, time, uuid
from . import prompts
from .provider import Ollama
from .scenarios import DEFAULT, SCENARIOS, items, scenario
from .metrics import summarize

ROOT=pathlib.Path(__file__).resolve().parents[1]

def validate(value):
    if not isinstance(value,dict): raise ValueError('Configuration must be an object.')
    if set(value)-set(DEFAULT): raise ValueError('Unknown configuration field.')
    cfg={**DEFAULT,**value}
    for key,allowed in [('context',['focused','full']),('device',['auto','cpu']),('instructions',['brief','explicit'])]:
        if cfg[key] not in allowed: raise ValueError(f'Invalid {key}.')
    if type(cfg['structured']) is not bool: raise ValueError('Structured output must be true or false.')
    for key,allowed in [('max_tokens',[32,64,128,256]),('client_parallel',range(1,9)),('server_parallel',[1,4]),('count',range(4,25))]:
        if type(cfg[key]) is not int or cfg[key] not in allowed: raise ValueError(f'Invalid {key}.')
    if type(cfg['hourly_rate']) not in (int,float) or not 0<=cfg['hourly_rate']<=100: raise ValueError('Hourly rate must be 0–100 dollars.')
    return cfg

def check(item, output):
    if item['kind']=='chat':return '30' in output or 'thirty' in output.lower(), 'Answer must include the 30-day refund period.'
    try:
        parsed=json.loads(output)
        good=isinstance(parsed,dict) and all(parsed.get(k)==v for k,v in item['expected'].items())
    except (ValueError,TypeError):good=False
    return good, 'All four fields must exactly match the authoritative notice in valid JSON.'

def atomic(path, value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,indent=2));temp.replace(path)

class Control:
    def __init__(self, state_dir=None, port=18731, provider=None):
        self.path=pathlib.Path(state_dir or ROOT/'.workshop');self.path.mkdir(parents=True,exist_ok=True)
        self.provider=provider or Ollama(self.path,port);self.lock=threading.RLock();self.current=None;self.cancel=threading.Event();self.setup_error=None
        self.warnings=[]
        try:self.config=validate(json.loads((self.path/'config.json').read_text())) if (self.path/'config.json').exists() else dict(DEFAULT)
        except (OSError,ValueError,TypeError):
            self.config=dict(DEFAULT);self.warnings.append('Saved configuration could not be read; defaults are shown. The original file has been preserved.')
        try:self.baselines=json.loads((self.path/'baselines.json').read_text()) if (self.path/'baselines.json').exists() else {}
        except (OSError,ValueError):
            self.baselines={};self.warnings.append('Saved baseline selection could not be read. Run files have been preserved.')
        if not isinstance(self.baselines,dict):self.baselines={}
    def history(self):
        result=[]
        for p in sorted((self.path/'runs').glob('*.json'),reverse=True):
            try:
                run=json.loads(p.read_text())
                if not isinstance(run,dict) or not all(k in run for k in ('id','scenario','config','status','started','rows')):raise ValueError('Incomplete record')
                validate(run['config']);scenario(run['scenario'])
                if not isinstance(run['rows'],list) or not isinstance(run['started'],str):raise ValueError('Invalid record')
                result.append(run)
            except (OSError,ValueError,TypeError):
                warning=f'Could not read run {p.name}; its file has been preserved.'
                if warning not in self.warnings:self.warnings.append(warning)
        return result
    def state(self):
        with self.lock:
            history=self.history()
            pinned=set(self.baselines.values())
            visible=[r for i,r in enumerate(history) if i<40 or r['id'] in pinned]
            return copy.deepcopy(dict(config=self.config,scenarios=SCENARIOS,current=self.current,baselines=self.baselines,history=visible,history_total=len(history),warnings=self.warnings,setup_error=self.setup_error))
    def busy(self):return self.current and self.current['status'] in ['preparing','running','cancelling','downloading']
    def save(self,cfg):
        with self.lock:
            if self.busy():raise ValueError('Wait for this run to finish before changing configuration.')
            checked=validate(cfg);atomic(self.path/'config.json',checked);self.config=checked
            return self.config
    def baseline(self,id):
        with self.lock:
            run=next((x for x in self.history() if x['id']==id and x['status']=='complete'),None)
            if not run:raise ValueError('Choose a completed run to set a baseline.')
            updated={**self.baselines,run['scenario']:id};atomic(self.path/'baselines.json',updated);self.baselines=updated
    def setup(self):
        with self.lock:
            if self.busy():raise ValueError('A run is already active.')
            self.setup_error=None
            self.current=dict(id='setup',status='downloading',completed=0,total=0,rows=[],message='Preparing Ollama and Qwen2.5 1.5B…')
        def work():
            try:
                self.provider.ensure(self.config['server_parallel'])
                if not self.provider.status()['ready']:self.provider.pull()
                with self.lock:self.current.update(status='ready',message='Model ready. Choose an exercise and run the workload.')
            except Exception as e:
                with self.lock:self.current.update(status='error',message=str(e));self.setup_error=str(e)
        threading.Thread(target=work,daemon=True).start()
    def stop_run(self):
        with self.lock:
            if not self.current or self.current.get('scenario') is None or not self.busy():raise ValueError('No active workload to cancel.')
            self.current.update(status='cancelling',message='Finishing active requests; queued work will be skipped.')
            self.cancel.set()

    def start(self,key,config=None):
        scenario(key)
        with self.lock:
            if self.busy():raise ValueError('A run is already active.')
            if config is not None:
                checked=validate(config);atomic(self.path/'config.json',checked);self.config=checked
            cfg=dict(self.config);self.cancel.clear()
            run=dict(id=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')+'-'+uuid.uuid4().hex[:6],
                     scenario=key,config=cfg,status='preparing',started=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                     total=cfg['count']+(4 if key=='shared' else 0),completed=0,rows=[],source='live',message='Starting the private model server and warming the model…')
            self.current=run
        threading.Thread(target=self.execute,args=(run,),daemon=True).start()
        return run['id']
    def finish(self,run,**updates):
        with self.lock:
            result=copy.deepcopy({**run,**updates})
            if result['status']=='cancelled' and result.get('summary'):
                result['summary']['gates']={k:None for k in result['summary']['gates']}
            result['skipped']=result['total']-len(result['rows'])
            try:atomic(self.path/'runs'/f"{run['id']}.json",result)
            except OSError as e:result.update(status='error',message=f'Could not save the run: {e}')
            run.update(result)

    def execute(self,run):
        cfg=run['config'];rows=[]
        try:
            self.provider.ensure(cfg['server_parallel'])
            before=self.provider.status()
            if not before['ready']:raise RuntimeError('Qwen2.5 1.5B is missing. Select Prepare model first.')
            self.provider.generate('','Ready',None,{**cfg,'max_tokens':1},lambda _:None)
            if self.cancel.is_set():raise InterruptedError('Cancelled before workload requests started.')
            importlib.reload(prompts)
            prompt_hash=hashlib.sha256((ROOT/'lab/prompts.py').read_bytes()).hexdigest()
            with self.lock:
                if self.cancel.is_set():raise InterruptedError('Cancelled before workload requests started.')
                run.update(status='running',message='Running the workload. Metrics include application waiting time.')
            start=time.perf_counter()
            def task(item, arrival, delay=0):
                if delay:self.cancel.wait(max(0,start+delay-time.perf_counter()))
                if self.cancel.is_set():return None
                begin=time.perf_counter();first=[None];text_parts=[]
                row=dict(id=item['id'],kind=item['kind'],expected=item['expected'],quality=False,error=None,
                         first_token=None,output='',input_tokens=0,output_tokens=0,prefill=0,decode=0,load=0,
                         app_queue=max(0,begin-arrival),input='')
                try:
                    system,prompt,schema=prompts.build(item,cfg);row['input']=prompt
                    def token(piece):
                        if first[0] is None:first[0]=time.perf_counter()
                        text_parts.append(piece)
                    output,stats=self.provider.generate(system,prompt,schema,cfg,token)
                    row.update(output=output,provider=stats,input_tokens=stats.get('prompt_eval_count',0),output_tokens=stats.get('eval_count',0),
                               prefill=stats.get('prompt_eval_duration',0)/1e9,decode=stats.get('eval_duration',0)/1e9,load=stats.get('load_duration',0)/1e9)
                    row['quality'],row['quality_rule']=check(item,output)
                except Exception as e:row.update(error=str(e),output=''.join(text_parts),quality_rule='Request failed.')
                end=time.perf_counter();row.update(first_token=first[0]-arrival if first[0] else None,elapsed=end-arrival,
                                                   offset=arrival-start,finished=end-start)
                row['other']=max(0,row['elapsed']-row['app_queue']-row['prefill']-row['decode']-row['load'])
                with self.lock:
                    rows.append(row);run.update(completed=len(rows),rows=list(rows))
                return row
            work=items(run['scenario'],cfg['count'])
            with concurrent.futures.ThreadPoolExecutor(max_workers=cfg['client_parallel']) as pool, concurrent.futures.ThreadPoolExecutor(max_workers=1) as chat:
                futures=[]
                for item in work:
                    delay=(int(item['id'].split('-')[1])*.5) if item['kind']=='chat' else 0
                    target=chat if item['kind']=='chat' else pool
                    futures.append(target.submit(task,item,start+delay,delay))
                for future in concurrent.futures.as_completed(futures):future.result()
            seconds=time.perf_counter()-start
            meta=self.provider.status()
            manifest=dict(model='qwen2.5:1.5b',ollama=meta.get('version'),models=meta.get('models'),running=meta.get('running'),
                          runtime=dict(pid=meta.get('pid'),port=meta.get('port'),server_parallel=meta.get('parallel')),
                          platform=platform.platform(),python=platform.python_version(),prompt_sha256=prompt_hash,
                          source_sha256={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'lab').glob('*.py')},
                          cache_policy='Model warmed with one token; natural prefix reuse, not flushed between requests.',
                          cost_policy='Estimated occupied-run time × assumed hourly price; excludes warmup, idle capacity and power.',
                          timing_policy='Client end-to-end includes application queue. Other time includes unseparated server wait and transport; it is not a measured GPU queue.')
            self.finish(run,status='cancelled' if self.cancel.is_set() else 'complete',message='Run saved.',rows=rows,summary=summarize(rows,seconds,cfg,scenario(run['scenario'])),manifest=manifest)
        except InterruptedError as e:
            self.finish(run,status='cancelled',message=str(e),rows=rows)
        except Exception as e:
            self.finish(run,status='error',message=str(e),rows=rows)
