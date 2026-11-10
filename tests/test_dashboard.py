import json, pathlib, tempfile, time, unittest
from lab.control import Control, check, validate
from lab.metrics import summarize
from lab.scenarios import DEFAULT, document, scenario

class FakeProvider:
    def __init__(self):self.slots=0
    def ensure(self,slots):self.slots=slots
    def status(self):return dict(ready=True,version='fixture',models=[],running=[],pid=1,port=18731,parallel=self.slots)
    def generate(self,system,prompt,schema,config,on_token):
        if prompt=='Ready':return 'Ready',{}
        time.sleep(.02);on_token('test')
        if 'How many days' in prompt:out='30 days'
        else:
            item=next(d for i in range(24) if (d:=document(i))['id'] in prompt)
            out=json.dumps(item['expected'])
        return out,dict(eval_count=10,prompt_eval_count=40,eval_duration=10000000,prompt_eval_duration=1000000)

class DashboardTests(unittest.TestCase):
    def test_validation(self):
        for bad in [{'count':0},{'device':'remote'},{'server_parallel':8},{'context':'secret'},{'hourly_rate':float('nan')},{'structured':'yes'},{'count':True}]:
            with self.assertRaises(ValueError):validate(bad)
    def test_all_fields_checked(self):
        d=document(0);self.assertTrue(check(d,json.dumps(d['expected']))[0])
        wrong={**d['expected'],'agency':'Something else'}
        self.assertFalse(check(d,json.dumps(wrong))[0]);self.assertFalse(check(d,'I finished it.')[0])
    def test_failure_denominator(self):
        rows=[dict(kind='report',quality=True,error=None,elapsed=1,output_tokens=10),dict(kind='report',quality=False,error='failed',elapsed=2,output_tokens=0)]
        m=summarize(rows,2,DEFAULT,scenario('burst'))
        self.assertEqual(m['quality'],.5);self.assertEqual(m['on_time'],.5)
        self.assertAlmostEqual(m['cost_per_1000'],2/3600*1.2*1000)
    def test_persistence_and_baseline(self):
        with tempfile.TemporaryDirectory() as tmp:
            c=Control(tmp,provider=FakeProvider());c.save({**DEFAULT,'count':4,'client_parallel':4})
            self.assertEqual(Control(tmp,provider=FakeProvider()).config['count'],4)
            c.start('shared')
            for _ in range(150):
                if not c.busy():break
                time.sleep(.025)
            run=c.history()[0]
            self.assertEqual(run['status'],'complete');self.assertEqual(len(run['rows']),8)
            self.assertEqual(run['summary']['correct'],4);self.assertEqual(run['summary']['interactive_quality'],1)
            self.assertEqual(run['manifest']['runtime']['server_parallel'],1)
            c.baseline(run['id']);self.assertEqual(Control(tmp,provider=FakeProvider()).baselines['shared'],run['id'])
    def test_no_overlapping_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            c=Control(tmp,provider=FakeProvider());c.start('quality')
            with self.assertRaises(ValueError):c.start('burst')
            with self.assertRaises(ValueError):c.save(DEFAULT)
            c.cancel.set()
            while c.busy():time.sleep(.01)
            self.assertEqual(c.history()[0]['status'],'cancelled')

if __name__=='__main__':unittest.main()
