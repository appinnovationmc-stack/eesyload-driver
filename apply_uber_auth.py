#!/usr/bin/env python3
"""Uber-style login: Google / Apple / Phone on driver phoneEntry screen."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
HTML = ROOT / "www" / "index.html"
JS = ROOT / "www" / "driver-supabase-integration.js"

if not HTML.exists() or not JS.exists():
    print("www files missing", file=sys.stderr)
    sys.exit(1)

html = HTML.read_text(encoding="utf-8")
js = JS.read_text(encoding="utf-8")

OAUTH = r'''

/* ─── SOCIAL AUTH (Uber-style) ───────────────────────────── */
function authRedirectTo() {
  try {
    if (window.location && window.location.origin && window.location.origin !== 'null') {
      return window.location.origin + window.location.pathname;
    }
  } catch (e) {}
  return 'https://mbtqqnbklcltrtwlpduq.supabase.co';
}

async function sbSignInWithGoogle() {
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: authRedirectTo(),
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) throw error;
  return data;
}

async function sbSignInWithApple() {
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'apple',
    options: { redirectTo: authRedirectTo() },
  });
  if (error) throw error;
  return data;
}

/** After OAuth, ensure driver profile exists (role=driver). */
async function ensureDriverProfileFromSession() {
  const user = await sbGetCurrentUser();
  if (!user) return null;
  const { data: existing } = await sb.from('profiles').select('id,role,full_name,driver_status').eq('id', user.id).maybeSingle();
  if (!existing) {
    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || '';
    await sb.from('profiles').insert({
      id: user.id,
      role: 'driver',
      full_name: name || null,
      phone: user.phone || meta.phone || null,
      driver_status: 'pending_review',
      is_online: false,
    });
  } else if (existing.role !== 'driver') {
    // Do not silently convert a rider account — ask them to use a different login
    throw new Error('This account is registered as a rider. Use a different Google/Apple account for driving.');
  }
  return user;
}
'''

if "function sbSignInWithGoogle" not in js:
    js = js.rstrip() + "\n" + OAUTH + "\n"
    JS.write_text(js, encoding="utf-8")
    print("✓ OAuth helpers added to driver-supabase-integration.js")
else:
    print("✓ OAuth helpers already present")

if 'id="btnGoogleAuth"' in html:
    print("✓ Social buttons already in HTML")
else:
    needle = '<button class="cta grn" id="phoneEntryBtn" onclick="continueWithPhone()">Continue</button>'
    social = '''
      <button class="cta" id="btnGoogleAuth" onclick="continueWithGoogleDriver()" style="display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;color:#1a1a1a;border:1px solid var(--b);margin-bottom:10px;">
        <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Continue with Google
      </button>
      <button class="cta" id="btnAppleAuth" onclick="continueWithAppleDriver()" style="display:flex;align-items:center;justify-content:center;gap:10px;background:#000;color:#fff;border:1px solid #333;margin-bottom:14px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
        Continue with Apple
      </button>
      <div style="display:flex;align-items:center;gap:12px;margin:6px 0 14px;">
        <div style="flex:1;height:1px;background:var(--b);"></div>
        <span style="font-size:12px;color:var(--g60);font-weight:600;">or</span>
        <div style="flex:1;height:1px;background:var(--b);"></div>
      </div>
      <button class="cta grn" id="phoneEntryBtn" onclick="continueWithPhone()">Continue with phone</button>'''
    if needle not in html:
        print("! phoneEntryBtn not found", file=sys.stderr)
    else:
        html = html.replace(needle, social, 1)
        print("✓ Google / Apple / phone on phoneEntry")

HANDLERS = r'''
async function continueWithGoogleDriver(){
  try{
    await sbSignInWithGoogle();
  }catch(e){
    console.error(e);
    alert('Google sign-in is not available yet. Enable Google in Supabase Auth, or use phone.\n\n'+(e.message||e));
  }
}
async function continueWithAppleDriver(){
  try{
    await sbSignInWithApple();
  }catch(e){
    console.error(e);
    alert('Apple sign-in is not available yet. Enable Apple in Supabase Auth, or use phone.\n\n'+(e.message||e));
  }
}
async function bootAuthSessionDriver(){
  try{
    const user=await ensureDriverProfileFromSession();
    if(!user)return;
    const profile=await getMyDriverProfile();
    if(!profile){go('register');return;}
    if(!profile.full_name||!profile.vehicle_type){go('register');return;}
    go('dHome');
  }catch(e){
    console.error('bootAuthSession',e);
    if(e&&e.message&&e.message.indexOf('rider')!==-1)alert(e.message);
  }
}
'''

if "function continueWithGoogleDriver" not in html:
    if "</body>" in html:
        html = html.replace(
            "</body>",
            "<script>\n" + HANDLERS + "\ndocument.addEventListener('DOMContentLoaded',function(){setTimeout(bootAuthSessionDriver,400);});\n</script>\n</body>",
            1,
        )
        print("✓ Driver social handlers injected")
    else:
        print("! no </body>", file=sys.stderr)
else:
    print("✓ Handlers already present")

HTML.write_text(html, encoding="utf-8")
print("Done. Enable Google & Apple in Supabase → Authentication → Providers.")
