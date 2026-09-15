#!/usr/bin/env python3
"""Idempotent: wire driver cash confirmation into delivery flow."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
TARGET = ROOT / "www" / "index.html"

if not TARGET.exists():
    print("www/index.html not found", file=sys.stderr)
    sys.exit(1)

text = TARGET.read_text(encoding="utf-8")
orig = text
changed = []

# 1) Cash banner on deliveryConfirm (before Complete delivery button)
CASH_BANNER = '''      <div id="cashCollectBanner" style="display:none;margin:0 0 14px;padding:14px 16px;border-radius:14px;background:rgba(6,193,103,.1);border:1px solid rgba(6,193,103,.35);">
        <div style="font-size:13px;font-weight:700;color:var(--grn);letter-spacing:-.2px;margin-bottom:4px;">Cash on delivery</div>
        <div style="font-size:12px;color:var(--g40);line-height:1.4;margin-bottom:10px;">Collect the full fare from the customer, then confirm below. Completing delivery will mark this cash payment as received.</div>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="checkbox" id="cashCollectedCheck" style="width:18px;height:18px;accent-color:var(--grn);">
          <span style="font-size:13px;font-weight:600;color:var(--w);">I collected the cash</span>
        </label>
      </div>
'''

if 'id="cashCollectBanner"' in text:
    print("✓ cashCollectBanner already present")
else:
    needle = '<button class="cta grn" onclick="completeDelivery()"'
    idx = text.find(needle)
    if idx == -1:
        print("! Complete delivery button not found", file=sys.stderr)
    else:
        text = text[:idx] + CASH_BANNER + text[idx:]
        changed.append("cash banner")
        print("✓ cashCollectBanner inserted above Complete delivery")

# 2) Show/hide banner in renderDeliveryConfirm
OLD_RDC = "function renderDeliveryConfirm(){\n  const photoEl=document.getElementById('deliveryPhoto');\n  const gpsEl=document.getElementById('deliveryGps');\n  const sigEl=document.getElementById('deliverySig');"

NEW_RDC = "function renderDeliveryConfirm(){\n  const photoEl=document.getElementById('deliveryPhoto');\n  const gpsEl=document.getElementById('deliveryGps');\n  const sigEl=document.getElementById('deliverySig');\n  const cashBanner=document.getElementById('cashCollectBanner');\n  const cashCheck=document.getElementById('cashCollectedCheck');\n  const isCash=DriverState.activeLoad&&String(DriverState.activeLoad.payment_method||'')==='cash';\n  if(cashBanner)cashBanner.style.display=isCash?'block':'none';\n  if(cashCheck){cashCheck.checked=false;}"

if "cashCollectBanner" in text and "isCash=DriverState.activeLoad" in text:
    print("✓ renderDeliveryConfirm cash logic already present")
elif OLD_RDC in text:
    text = text.replace(OLD_RDC, NEW_RDC, 1)
    changed.append("renderDeliveryConfirm")
    print("✓ renderDeliveryConfirm shows cash banner when payment_method=cash")
else:
    print("! renderDeliveryConfirm pattern not found", file=sys.stderr)

# 3) completeDelivery: require cash checkbox + call confirmCashPayment
OLD_CD = """async function completeDelivery(){
  if(!DriverState.deliveryPhotoTaken){alert('Please take a delivery photo first.');return;}
  if(!DriverState.signatureCaptured){alert('Please capture the customer signature first.');return;}
  const load=DriverState.activeLoad;
  if(load){
    try{
      await updateBookingStatus(load.id,'delivered');
    }catch(e){
      console.error(e);
      alert('Could not mark delivery complete: '+e.message);
      return;
    }
  }
  const payoutAmt=load?Math.round(load.total_fare*(1-load.commission_pct/100)):0;
  document.getElementById('dsPayout').textContent='R'+payoutAmt;
  document.getElementById('dsSubtitle').textContent=load?(load.pickup_address+' to '+load.dropoff_address):'Load completed';
  document.getElementById('dsPickup').textContent=load?load.pickup_address:'—';
  document.getElementById('dsDropoff').textContent=load?load.dropoff_address:'—';
  DriverState.activeLoad=null;
  go('deliverySuccess');
}"""

NEW_CD = """async function completeDelivery(){
  if(!DriverState.deliveryPhotoTaken){alert('Please take a delivery photo first.');return;}
  if(!DriverState.signatureCaptured){alert('Please capture the customer signature first.');return;}
  const load=DriverState.activeLoad;
  const isCash=load&&String(load.payment_method||'')==='cash';
  if(isCash){
    const cashCheck=document.getElementById('cashCollectedCheck');
    if(!cashCheck||!cashCheck.checked){
      alert('Please confirm you collected the cash from the customer.');
      return;
    }
  }
  if(load){
    try{
      await updateBookingStatus(load.id,'delivered');
    }catch(e){
      console.error(e);
      alert('Could not mark delivery complete: '+e.message);
      return;
    }
    if(isCash&&typeof confirmCashPayment==='function'){
      try{
        await confirmCashPayment(load.id);
      }catch(e){
        console.error('Cash confirm failed',e);
        alert('Delivery saved, but cash confirmation failed: '+e.message+'\nYou can retry from support if needed.');
      }
    }
  }
  const payoutAmt=load?Math.round(load.total_fare*(1-(load.commission_pct||0)/100)):0;
  const dsPayout=document.getElementById('dsPayout');
  const dsSubtitle=document.getElementById('dsSubtitle');
  const dsPickup=document.getElementById('dsPickup');
  const dsDropoff=document.getElementById('dsDropoff');
  if(dsPayout)dsPayout.textContent='R'+payoutAmt;
  if(dsSubtitle)dsSubtitle.textContent=load?(load.pickup_address+' to '+load.dropoff_address):'Load completed';
  if(dsPickup)dsPickup.textContent=load?load.pickup_address:'—';
  if(dsDropoff)dsDropoff.textContent=load?load.dropoff_address:'—';
  const dsCashNote=document.getElementById('dsCashNote');
  if(dsCashNote){
    dsCashNote.style.display=isCash?'block':'none';
    dsCashNote.textContent=isCash?'Cash collected and confirmed':'';
  }
  DriverState.activeLoad=null;
  go('deliverySuccess');
}"""

if "confirmCashPayment(load.id)" in text:
    print("✓ completeDelivery already calls confirmCashPayment")
elif OLD_CD in text:
    text = text.replace(OLD_CD, NEW_CD, 1)
    changed.append("completeDelivery")
    print("✓ completeDelivery requires cash checkbox + calls confirmCashPayment")
else:
    print("! completeDelivery block not found exactly — check manually", file=sys.stderr)

# 4) Optional note on success screen
if 'id="dsCashNote"' in text:
    print("✓ dsCashNote already present")
else:
    needle = "document.getElementById('dsDropoff')"
    # insert HTML near dsPayout if possible
    mark = 'id="dsPayout"'
    i = text.find(mark)
    if i != -1:
        # find end of that element line and inject after payout section - keep simple
        insert_at = text.find('</div>', i)
        if insert_at != -1:
            note = '\n      <div id="dsCashNote" style="display:none;margin-top:8px;font-size:12px;font-weight:600;color:var(--grn);"></div>'
            # too fragile — skip if not clean
            pass
    # Try inject after dsSubtitle line in success markup
    for hint in ['id="dsSubtitle"', "id='dsSubtitle'"]:
        j = text.find(hint)
        if j != -1:
            end = text.find('</div>', j)
            if end != -1:
                text = text[:end+6] + '\n      <div id="dsCashNote" style="display:none;margin-top:8px;font-size:12px;font-weight:600;color:var(--grn);text-align:center;"></div>' + text[end+6:]
                changed.append("dsCashNote")
                print("✓ dsCashNote on delivery success")
                break

if text == orig:
    print("No file changes (already applied or patterns drifted).")
    sys.exit(0)

TARGET.write_text(text, encoding="utf-8")
print("\nDone:", ", ".join(changed) if changed else "updated")
print("Review: git diff www/index.html")
