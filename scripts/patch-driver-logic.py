#!/usr/bin/env python3
from pathlib import Path
root = Path(__file__).resolve().parents[1]
p = root / "www" / "index.html"
t = p.read_text(encoding="utf-8")

def sub(old, new, label):
    global t
    if old in t:
        t = t.replace(old, new, 1)
        print("OK  ", label)
    else:
        print("SKIP", label)

sub(
"function handleErAction(){\n  const phase=DriverState.erPhase||'pickup';\n  if(phase==='pickup'){\n    DriverState.erPhase='dropoff';\n    renderEnRoute();\n    initEnRouteMap();\n  }else{\n    go('deliveryConfirm');\n  }\n}",
"async function handleErAction(){\n  const load=DriverState.activeLoad;\n  const phase=DriverState.erPhase||'pickup';\n  if(phase==='pickup'){\n    if(load&&load.id){\n      try{await updateBookingStatus(load.id,'loading');}catch(e){console.error(e);alert(e.message);return;}\n    }\n    DriverState.erPhase='dropoff';\n    renderEnRoute();\n    initEnRouteMap();\n  }else{\n    if(load&&load.id){\n      try{await updateBookingStatus(load.id,'in_transit');}catch(e){console.error(e);alert(e.message);return;}\n    }\n    go('deliveryConfirm');\n  }\n}",
"persist pickup/dropoff trip status",
)
sub("function completeDelivery(){","async function completeDelivery(){","completeDelivery is async")
sub("function toggleOnline(el){","async function toggleOnline(el){","toggleOnline is async")
p.write_text(t, encoding="utf-8")
print("done")
