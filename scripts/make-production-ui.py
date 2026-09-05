#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
html_path = root / "www" / "index.html"
text = html_path.read_text(encoding="utf-8")

text = text.replace('<div class="di"></div>', "")
start = text.find('<div class="sb">')
if start >= 0:
    end = text.find("<!--", start)
    if end > start:
        text = text[:start] + text[end:]

text = text.replace("setTheme(saved || 'light')", "setTheme(saved || 'dark')")
text = text.replace('setTheme(saved || "light")', 'setTheme(saved || "dark")')

if "glass.css" not in text:
    text = text.replace("</head>", '<link rel="stylesheet" href="glass.css">\n</head>')

if "driver-location.js" not in text:
    text = text.replace(
        '<script src="driver-supabase-integration.js"></script>',
        '<script src="driver-supabase-integration.js"></script>\n<script src="driver-location.js"></script>',
    )

old_start = """function startLocationPings(){
  if(DriverState.locationInterval)return;
  DriverState.locationInterval=setInterval(()=>{
    if(!navigator.geolocation)return;
    navigator.geolocation.getCurrentPosition(
      pos=>updateDriverLocation(pos.coords.latitude,pos.coords.longitude,pos.coords.heading||0).catch(console.error),
      ()=>{}
    );
  },5000);
}"""
new_start = """function startLocationPings(){
  if(typeof startDriverTracking==='function'){startDriverTracking();return;}
  if(DriverState.locationInterval)return;
  DriverState.locationInterval=setInterval(()=>{
    if(!navigator.geolocation)return;
    navigator.geolocation.getCurrentPosition(
      pos=>updateDriverLocation(pos.coords.latitude,pos.coords.longitude,pos.coords.heading||0).catch(console.error),
      ()=>{}
    );
  },5000);
}"""
if old_start in text:
    text = text.replace(old_start, new_start)

old_stop = """function stopLocationPings(){
  if(DriverState.locationInterval){clearInterval(DriverState.locationInterval);DriverState.locationInterval=null;}
}"""
new_stop = """function stopLocationPings(){
  if(typeof stopDriverTracking==='function')stopDriverTracking();
  if(DriverState.locationInterval){clearInterval(DriverState.locationInterval);DriverState.locationInterval=null;}
}"""
if old_stop in text:
    text = text.replace(old_stop, new_stop)

html_path.write_text(text, encoding="utf-8")

checks = {
    "status bar removed": '<div class="sb">' not in text,
    "island removed": '<div class="di"></div>' not in text,
    "9:41 removed": ">9:41<" not in text,
    "glass.css linked": "glass.css" in text,
    "location module linked": "driver-location.js" in text,
    "native tracking wired": "startDriverTracking" in text,
}
for name, ok in checks.items():
    print(("OK  " if ok else "FAIL"), name)
