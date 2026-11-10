"""Own an isolated Ollama child; never change the user's main Ollama service."""
import json, os, pathlib, shutil, subprocess, time, urllib.request, urllib.error

class Ollama:
    def __init__(self, state_dir, port=18731):
        self.state_dir=state_dir; self.port=port; self.base=f'http://127.0.0.1:{port}'
        self.process=None; self.slots=None; self.log=None
    def request(self, route, payload=None, timeout=10):
        data=None if payload is None else json.dumps(payload).encode()
        req=urllib.request.Request(self.base+route,data=data,headers={'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=timeout) as r: return json.load(r)
    def ensure(self, slots):
        if self.process and self.process.poll() is None and self.slots==slots: return
        self.stop()
        if not shutil.which('ollama'): raise RuntimeError('Install Ollama, then restart the workshop. See README.md.')
        try:
            self.request('/api/version',timeout=.5)
        except Exception: pass
        else: raise RuntimeError(f'Port {self.port} is already in use. Choose another --ollama-port; no existing process was stopped.')
        env=os.environ.copy()
        env.update(OLLAMA_HOST=f'127.0.0.1:{self.port}', OLLAMA_NUM_PARALLEL=str(slots),
                   OLLAMA_MAX_LOADED_MODELS='1', OLLAMA_CONTEXT_LENGTH='2048', OLLAMA_KEEP_ALIVE='5m')
        self.state_dir.mkdir(parents=True,exist_ok=True)
        self.log=open(self.state_dir/'ollama.log','a')
        self.process=subprocess.Popen(['ollama','serve'],env=env,stdout=self.log,stderr=self.log)
        self.slots=slots
        for _ in range(100):
            if self.process.poll() is not None: raise RuntimeError('Workshop model server exited. Inspect .workshop/ollama.log.')
            try: self.request('/api/version',timeout=.4); return
            except Exception: time.sleep(.1)
        raise RuntimeError('Workshop model server did not become ready within 10 seconds.')
    def status(self):
        info=dict(owned=True,port=self.port,pid=self.process.pid if self.process and self.process.poll() is None else None,
                  parallel=self.slots,model='qwen2.5:1.5b',ready=False)
        try:
            info['version']=self.request('/api/version')['version']
            info['models']=self.request('/api/tags').get('models',[])
            info['ready']=any(m['name']=='qwen2.5:1.5b' for m in info['models'])
            info['running']=self.request('/api/ps').get('models',[])
        except Exception as e: info['error']=str(e)
        return info
    def pull(self):
        with urllib.request.urlopen(urllib.request.Request(self.base+'/api/pull',data=json.dumps({'model':'qwen2.5:1.5b','stream':False}).encode(),headers={'Content-Type':'application/json'}),timeout=1200) as r:
            result=json.load(r)
            if result.get('error'): raise RuntimeError(result['error'])
        return self.status()
    def generate(self, system, prompt, schema, config, on_token):
        payload=dict(model='qwen2.5:1.5b', system=system,prompt=prompt,stream=True,keep_alive='5m',
                     options=dict(temperature=0,seed=42,num_ctx=2048,num_predict=config['max_tokens'],num_gpu=0 if config['device']=='cpu' else -1))
        if schema: payload['format']=schema
        req=urllib.request.Request(self.base+'/api/generate',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
        chunks=[]; final=None
        with urllib.request.urlopen(req,timeout=120) as response:
            for line in response:
                event=json.loads(line)
                if event.get('error'): raise RuntimeError(event['error'])
                piece=event.get('response','')
                if piece: chunks.append(piece); on_token(piece)
                if event.get('done'): final=event
        if final is None: raise RuntimeError('Model stream ended before its completion record.')
        return ''.join(chunks), final
    def stop(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:self.process.kill();self.process.wait()
        self.process=None
        if self.log:self.log.close();self.log=None
