#!/usr/bin/env python3
"""Zero-dependency local dashboard. Python 3.10+; Ollama for live work."""
import argparse, atexit, json, mimetypes, pathlib, threading, urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from lab.control import Control, ROOT

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def send_json(self, value, status=200):
        data=json.dumps(value).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data)
    def do_GET(self):
        route=urllib.parse.urlparse(self.path).path
        if route=='/api/state':return self.send_json(self.server.control.state())
        if route=='/api/health':return self.send_json(self.server.control.provider.status())
        if route=='/api/export':return self.send_json(self.server.control.history())
        base=ROOT/'web';rel=route.lstrip('/') or 'index.html'
        for prefix,folder in [('/slides/','slides'),('/reference/','reference')]:
            if route.startswith(prefix):base=ROOT/folder;rel=route[len(prefix):] or 'index.html'
        file=(base/rel).resolve()
        if not file.is_relative_to(base.resolve()) or not file.is_file():return self.send_json({'error':'Not found'},404)
        data=file.read_bytes();self.send_response(200);self.send_header('Content-Type',mimetypes.guess_type(file)[0] or 'application/octet-stream');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_POST(self):
        origin=self.headers.get('Origin')
        host=self.headers.get('Host','')
        if host not in [f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'] or (origin and origin not in [f'http://{host}']):return self.send_json({'error':'Use the local dashboard origin.'},403)
        if self.headers.get_content_type()!='application/json':return self.send_json({'error':'JSON required'},415)
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=65536:raise ValueError('Invalid request size.')
            value=json.loads(self.rfile.read(size));c=self.server.control
            if self.path=='/api/config':result=c.save(value)
            elif self.path=='/api/run':result={'id':c.start(value['scenario'])}
            elif self.path=='/api/setup':c.setup();result={'ok':True}
            elif self.path=='/api/cancel':
                with c.lock:
                    if c.current and c.busy():c.current.update(status='cancelling',message='Finishing active requests; queued work will be skipped.');c.cancel.set()
                result={'ok':True}
            elif self.path=='/api/baseline':c.baseline(value['id']);result={'ok':True}
            else:return self.send_json({'error':'Not found'},404)
            return self.send_json(result)
        except (ValueError,KeyError,TypeError) as e:return self.send_json({'error':str(e)},400)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--port',type=int,default=8876);p.add_argument('--ollama-port',type=int,default=18731);p.add_argument('--state-dir');p.add_argument('--check',action='store_true');args=p.parse_args()
    if args.check:
        import shutil,sys
        print('Python:',sys.version.split()[0]);print('Ollama:',shutil.which('ollama') or 'MISSING — install from https://ollama.com/download');return
    control=Control(args.state_dir,args.ollama_port);server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler);server.control=control
    atexit.register(control.provider.stop)
    print(f'Workshop dashboard: http://127.0.0.1:{args.port}\nModel server uses its own port {args.ollama_port}. Press Ctrl+C to stop.',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close();control.provider.stop()
if __name__=='__main__':main()
