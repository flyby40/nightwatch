# Capture real Chicago forecasts from the existing providers for an opt-in integration check.
# No substitution on errors: requests fail, and provider missing values stay missing.
import urllib.request,urllib.parse,json,datetime,zoneinfo,sys,xml.etree.ElementTree as ET
now=datetime.datetime.now(datetime.timezone.utc);local=now.astimezone(zoneinfo.ZoneInfo('America/Chicago'));target=local.replace(hour=1,minute=0,second=0,microsecond=0)
if target<=local:target+=datetime.timedelta(days=1)
target=target.astimezone(datetime.timezone.utc).isoformat().replace('+00:00','Z')
def fetch(url):
 with urllib.request.urlopen(url,timeout=30) as r:return r.read().decode()
base='https://geo.weather.gc.ca/geomet/'
cap={};points={}
for field,layer in [('seeing','RDPS_10km_SeeingIndex'),('transparency','RDPS_10km_SkyTransparencyIndex')]:
 cap[field]=fetch(base+'?'+urllib.parse.urlencode({'SERVICE':'WMS','VERSION':'1.3.0','REQUEST':'GetCapabilities','LAYERS':layer}))
 tree=ET.fromstring(cap[field]);node=next(n for n in tree.iter() if n.tag.split('}')[-1]=='Layer' and any(c.tag.split('}')[-1]=='Name' and c.text==layer for c in n))
 ref=next(c.attrib['default'] for c in node if c.tag.split('}')[-1]=='Dimension' and c.attrib.get('name')=='reference_time')
 points[field]=json.loads(fetch(base+'?'+urllib.parse.urlencode({'SERVICE':'WMS','VERSION':'1.3.0','REQUEST':'GetFeatureInfo','LAYERS':layer,'QUERY_LAYERS':layer,'CRS':'EPSG:4326','BBOX':'41.8681,-87.6398,41.8881,-87.6198','WIDTH':11,'HEIGHT':11,'I':5,'J':5,'FORMAT':'image/png','INFO_FORMAT':'application/json','TIME':target,'DIM_REFERENCE_TIME':ref})))
weather=json.loads(fetch('https://api.open-meteo.com/v1/forecast?latitude=41.8781&longitude=-87.6298&hourly=temperature_2m,dew_point_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,precipitation_probability,precipitation&forecast_days=5&timezone=auto&timeformat=unixtime'))
result={'capturedAt':now.isoformat(),'selectedTime':target,'weather':weather,'capabilities':cap,'points':points}
with open(sys.argv[1] if len(sys.argv)>1 else '/tmp/nightwatch-live-chicago.json','w') as output:
 json.dump(result,output)
print(json.dumps({'capturedAt':result['capturedAt'],'target':target,'CMC':{k:v.get('features') for k,v in points.items()}},indent=2))
