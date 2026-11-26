/* Modestry On × NEOUL — prototype result tracking.
   One anonymous "experience id" (xid) follows a visitor from the shop to the try-on service and back.
   No face image, name or email is ever sent: only ids, product codes and step names. */
(function(){
  var CFG = window.MO_TRACK_CONFIG || {url:"", key:""};      // Supabase project URL + public anon key
  var SITE = window.MO_SITE || "shop", IDLE = 30*60*1000;
  var q = new URLSearchParams(location.search), LS = function(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } };
  var SS = function(k,v){ try{ if(v===undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k,v); }catch(e){ return null; } };
  var uid = function(){ return (crypto.randomUUID ? crypto.randomUUID() : "x"+Date.now().toString(36)+Math.random().toString(36).slice(2,12)); };
  var bid = LS("mo_bid"); if(!bid){ bid = uid(); LS("mo_bid", bid); }
  // environment: real results are "prod"; anything opened with ?mo_env=test (or on a local machine) is kept apart
  var env = q.get("mo_env") || SS("mo_env") || (/^(localhost|127\.|\[::1\])/.test(location.hostname) && !window.MO_FORCE_PROD ? "test" : "prod"); SS("mo_env", env);
  var src = q.get("src") || SS("mo_src") || (window.KIOSK ? "popup" : (SITE==="tryon" ? "direct" : "shop"));
  function load(){ try{ return JSON.parse(LS("mo_x")||"null"); }catch(e){ return null; } }
  function save(x){ x.t = Date.now(); LS("mo_x", JSON.stringify(x)); return x; }
  var X = null;
  if(q.get("xid")){ X = save({id:q.get("xid"), src:q.get("src")||"shop"}); src = X.src; }
  else { X = load(); if(X && Date.now()-X.t < IDLE){ if(SITE==="tryon" && !SS("mo_src")) { /* same visit continues */ } src = SITE==="tryon" ? (X.src||src) : src; } else X = null; }
  SS("mo_src", src);
  function xid(){ if(!X || Date.now()-X.t > IDLE) X = {id:uid(), src:src}; return save(X).id; }
  function newSession(){ X = save({id:uid(), src:src}); return X.id; }
  var pending = []; try{ pending = JSON.parse(LS("mo_q")||"[]"); }catch(e){}
  function flush(){ if(!CFG.url || !CFG.key || !pending.length) return; var batch = pending.splice(0); LS("mo_q","[]");
    batch.forEach(function(row){ fetch(CFG.url+"/rest/v1/mo_events", {method:"POST", keepalive:true, headers:{"Content-Type":"application/json", apikey:CFG.key, Authorization:"Bearer "+CFG.key, Prefer:"return=minimal"}, body:JSON.stringify(row)})
      .then(function(r){ if(!r.ok && r.status!==409){ pending.push(row); LS("mo_q", JSON.stringify(pending.slice(-200))); } })   // 409 = already recorded (refresh, repeated click)
      .catch(function(){ pending.push(row); LS("mo_q", JSON.stringify(pending.slice(-200))); }); }); }
  var seen = {};
  function track(event, d){ d = d || {}; var id = xid(), key = [id, event, d.sku||"", d.prev_sku||"", d.order_id||""].join("|");
    if(seen[key]) return; seen[key] = 1;
    pending.push({xid:id, bid:bid, env:env, site:SITE, src:src, event:event, sku:d.sku||null, prev_sku:d.prev_sku||null, mode:d.mode||null, order_id:d.order_id||null, amount:d.amount==null?null:d.amount, meta:d.meta||null, dedupe_key:key, client_ts:new Date().toISOString()});
    LS("mo_q", JSON.stringify(pending.slice(-200))); flush(); }
  // a link that carries the experience to the other site
  function link(url, extra){ var u = new URL(url, location.href); u.searchParams.set("xid", xid()); u.searchParams.set("src", src); if(env!=="prod") u.searchParams.set("mo_env", env);
    Object.keys(extra||{}).forEach(function(k){ if(extra[k]!=null) u.searchParams.set(k, extra[k]); }); return u.toString(); }
  window.MOT = {track:track, link:link, xid:xid, newSession:newSession, env:env, src:src, bid:bid, param:function(k){ return q.get(k); }, connected:!!(CFG.url&&CFG.key)};
  addEventListener("online", flush); flush();
})();
