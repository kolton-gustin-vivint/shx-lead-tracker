import json,sys,urllib.request
ak,out,stage=sys.argv[1],sys.argv[2],sys.argv[3]; H={"Authorization":f"Bearer {ak}"}
get=lambda p: json.load(urllib.request.urlopen(urllib.request.Request(f"https://api.airtable.com/v0/apphPJFvk2oPNeJK9/{p}",headers=H)))
res=json.load(open(f"{out}/live-result.json")); lid=res['leadId']; audit=res['res']['auditLogId']
before=json.load(open(f"{out}/live-snapshot-{lid}.json"))['fields']; now=get(f"tblm2jOl13AAWpvOy/{lid}")['fields']
diff=[k for k in sorted(set(before)|set(now)) if before.get(k)!=now.get(k)]
print(f"{stage}: {len(diff)} field(s) differ from the original snapshot")
for k in diff: print(f"   {k:44} {json.dumps(before.get(k))[:55]:55} -> {json.dumps(now.get(k))[:70]}")
if stage=='after-load':
    meta=json.load(urllib.request.urlopen(urllib.request.Request("https://api.airtable.com/v0/meta/bases/apphPJFvk2oPNeJK9/tables",headers=H)))
    alt=[t['id'] for t in meta['tables'] if t['name']=='Audit Log'][0]
    e=get(f"{alt}/{audit}")['fields']
    print("\nAUDIT LOG", audit, "| Actions:", e.get('Actions'), "| actor:", e.get('Assigned Pro'))
    print("   " + "\n   ".join(e.get('Details','').splitlines()))
pro=get("tblUIvaqRrrBZE8y4/recoGS5krxqNkDyzc")['fields']
print(f"\nTEST PRO: Today's Leads {pro.get(chr(84)+'oday'+chr(39)+'s Leads')} | # Assigned Active Leads {pro.get('# Assigned Active Leads')} | Assigned Leads {pro.get('Assigned Leads')}")
