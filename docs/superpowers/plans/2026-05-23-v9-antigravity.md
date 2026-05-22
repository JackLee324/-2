# V9.0 Antigravity Spring Physics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace V8.0 phase-based splash with pure Antigravity spring-physics particle engine (~6,400 particles from step=2 pixel sampling).

**Architecture:** Single `<canvas>` rendered with `source-over`, no phases, no overlays. Each particle has `(baseX, baseY)` anchor + `(vx, vy)` velocity. Every frame: mouse repulsion → Hooke spring → air damping → draw flat 2D dots. Click to dismiss. Enter-hint fades in at 2.5s.

**Tech Stack:** Vanilla JS (ES5 IIFE), Canvas 2D API, inline CSS in `<style>` tag

---

### Task 1: Replace Splash CSS

**Files:**
- Modify: `public/index.html` lines ~3264-3279

- [ ] **Step 1: Replace V8.0 CSS block with V9.0 Antigravity styles**

Find the `<style>` block starting with `/* ═══ Splash Screen: Singularity Force Animation V8.0 ═══ */` at ~line 3265. Replace everything from the opening `<style>` through the closing `</style>` (the inline splash style block, not the main site stylesheet):

```css
    <!-- ═══ Splash Screen: Antigravity V9.0 — Spring Physics Particle System ═══ -->
    <style>
    #splash-canvas{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;cursor:pointer;transition:opacity 0.8s ease;}
    #splash-canvas.fade-out{opacity:0;pointer-events:none;}
    #enter-hint{position:fixed;bottom:40px;left:50%;transform:translateX(-50%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#999;letter-spacing:2px;z-index:10001;pointer-events:none;opacity:0;transition:opacity 0.8s ease;}
    #enter-hint.show{opacity:1;}
    </style>
```

Key changes from V8.0 CSS:
- Removed `#splash-logo`, `.logo-reveal-glow`, `@keyframes logo-reveal-glow`, `#splash-white`, `#splash-white.fade-out`, `#click-hint`, `@keyframes pulse-hint`
- Added `#enter-hint` with `opacity:0` + `.show` state (fades in after particles settle)
- Canvas fade-out transition: 0.6s → 0.8s

---

### Task 2: Replace Splash HTML Elements

**Files:**
- Modify: `public/index.html` lines ~3281-3297

- [ ] **Step 1: Replace V8.0 HTML elements with V9.0**

Find the section starting with `<!-- Splash V7.0: Mask Reveal — canvas mask over pristine logo -->` at ~line 3281. Replace all splash HTML elements (canvas, logo img, hidden div, white overlay, click hint) with V9.0 elements:

```html
    <!-- Splash V9.0: Antigravity Spring Physics — particles form the emblem on pure white canvas -->
    <canvas id="splash-canvas"></canvas>
    <div id="enter-hint">点击任意位置进入系统 - Click to Enter</div>

    <!-- Hidden pixel extraction (same as V8.0) -->
    <div style="position:absolute;left:-9999px;top:-9999px;width:528px;height:280px;overflow:hidden;pointer-events:none;">
      <img id="logo-src" src="logo.png" style="width:528px;height:280px;opacity:0;" crossorigin="anonymous">
      <canvas id="logo-canvas" width="528" height="280" style="width:528px;height:280px;"></canvas>
    </div>
```

Removed from V8.0 HTML:
- `<img id="splash-logo" src="logo.png" alt="校徽">` — no overlay image needed
- `<div id="splash-white"></div>` — no white cover needed
- `<div id="click-hint">轻触任意位置，汇聚校徽</div>` — replaced by `#enter-hint` with different timing

---

### Task 3: Replace Entire Splash JavaScript (V8.0 → V9.0)

**Files:**
- Modify: `public/index.html` lines ~5848-6086

This is the core change. Replace the entire V8.0 splash `<script>` block with V9.0.

- [ ] **Step 1: Replace V8.0 script with V9.0 Antigravity engine**

Find `<!-- ═══ Splash Singularity Force Animation V8.0: particle assembly + golden glow reveal ═══ -->` at ~line 5848. Replace from that comment through `<!-- ═══ End Splash V7.0 ═══ -->` at ~line 6086 with the following:

```html
    <!-- ═══ Splash Antigravity V9.0: Spring Physics + Mouse Repulsion ═══ -->
    <script>
    !function(){'use strict';

    // ─── Config ───────────────────────────────────────────────────────
    var SAMPLE_STEP=2,LOGO_W=528,LOGO_H=280;
    var MOUSE_RADIUS=100,MOUSE_FORCE=8,SPRING=0.05,FRICTION=0.92;
    var PARTICLE_RADIUS_MIN=1.5,PARTICLE_RADIUS_MAX=2;
    var HINT_DELAY=2500,FADE_MS=800;

    // ─── State ────────────────────────────────────────────────────────
    var canvas=document.getElementById('splash-canvas'),ctx=canvas.getContext('2d');
    var W=canvas.width=window.innerWidth,H=canvas.height=window.innerHeight;
    var enterHint=document.getElementById('enter-hint');
    var anchors=[],targets=[],particles=[];
    var mouseX=-9999,mouseY=-9999,dismissed=false;
    var lastTime=0;

    // ─── Utilities ────────────────────────────────────────────────────
    function hash(n){n=Math.sin(n)*43758.5453123;return n-Math.floor(n);}
    function lerp(a,b,t){return a+(b-a)*t;}

    // ─── Pixel Sampling ───────────────────────────────────────────────
    function sampleLogoPixels(step){
      var lc=document.getElementById('logo-canvas'),lctx=lc.getContext('2d');
      var img=document.getElementById('logo-src');
      return new Promise(function(resolve){
        function doSample(){
          lctx.clearRect(0,0,LOGO_W,LOGO_H);lctx.drawImage(img,0,0,LOGO_W,LOGO_H);
          var data=lctx.getImageData(0,0,LOGO_W,LOGO_H).data,result=[];
          for(var y=0;y<LOGO_H;y+=step)for(var x=0;x<LOGO_W;x+=step){
            var idx=(y*LOGO_W+x)*4,a=data[idx+3];
            if(a<=80)continue;
            var r=data[idx],g=data[idx+1],b=data[idx+2];
            if((r+g+b)/3<15)continue;
            result.push({sx:x,sy:y,sr:r,sg:g,sb:b});
          }
          resolve(result);
        }
        if(img.complete&&img.naturalWidth>0)doSample();else{img.onload=doSample;img.onerror=function(){resolve([]);};}
      });
    }
    function computeTargets(){
      var scaleX=W/LOGO_W,scaleY=H/LOGO_H,scale=Math.min(scaleX,scaleY)*0.85;
      var tx=(W-LOGO_W*scale)/2,ty=(H-LOGO_H*scale)/2;
      targets=anchors.map(function(a){return{tx:a.sx*scale+tx,ty:a.sy*scale+ty};});
    }
    function assignTargets(){
      var count=Math.min(particles.length,anchors.length),indices=[];
      for(var i=0;i<anchors.length;i++)indices.push(i);
      indices.sort(function(){return Math.random()-0.5;});
      for(var i=0;i<count;i++){
        var p=particles[i],ai=indices[i],a=anchors[ai],t=targets[ai];
        p.baseX=t.tx;p.baseY=t.ty;
        p.color='rgb('+Math.round(a.sr)+','+Math.round(a.sg)+','+Math.round(a.sb)+')';
      }
    }
    function createFallbackAnchors(){
      var cx=W/2,cy=H/2,rx=Math.min(W,280/528*W)*0.35,ry=rx*280/528;
      for(var ring=0;ring<3;ring++){
        var rr=Math.min(rx,ry)*(0.6+ring*0.2);
        for(var a=0;a<360;a+=2)anchors.push({sx:cx+Math.cos(a*Math.PI/180)*rr,sy:cy+Math.sin(a*Math.PI/180)*rr*0.53,sr:0,sg:102,sb:51});
      }
      for(var d=0;d<800;d++)anchors.push({sx:cx+(Math.random()-0.5)*rx*1.6,sy:cy+(Math.random()-0.5)*ry*1.6,sr:0,sg:80+Math.random()*40,sb:40+Math.random()*40});
      computeTargets();
    }

    // ─── Particle ─────────────────────────────────────────────────────
    function Particle(W,H){
      this.radius=PARTICLE_RADIUS_MIN+Math.random()*(PARTICLE_RADIUS_MAX-PARTICLE_RADIUS_MIN);
      var edge=Math.floor(Math.random()*4);
      if(edge===0){this.x=Math.random()*W;this.y=-20;}
      else if(edge===1){this.x=Math.random()*W;this.y=H+20;}
      else if(edge===2){this.x=-20;this.y=Math.random()*H;}
      else{this.x=W+20;this.y=Math.random()*H;}
      this.vx=0;this.vy=0;this.baseX=W/2;this.baseY=H/2;this.color='rgb(200,200,200)';
    }
    Particle.prototype.update=function(dt,mx,my){
      var dx=this.x-mx,dy=this.y-my,dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<MOUSE_RADIUS&&dist>0.1){
        var f=(MOUSE_RADIUS-dist)/MOUSE_RADIUS;
        this.vx+=(dx/dist)*f*MOUSE_FORCE*dt;
        this.vy+=(dy/dist)*f*MOUSE_FORCE*dt;
      }
      this.vx+=(this.baseX-this.x)*SPRING*dt;
      this.vy+=(this.baseY-this.y)*SPRING*dt;
      this.vx*=FRICTION;this.vy*=FRICTION;
      this.x+=this.vx;this.y+=this.vy;
    };
    Particle.prototype.draw=function(){
      ctx.beginPath();ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
      ctx.fillStyle=this.color;ctx.fill();
    };

    // ─── Animation Loop ───────────────────────────────────────────────
    function loop(ts){
      var dt=Math.min((ts-lastTime)/16.67,3);lastTime=ts;
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,W,H);
      for(var i=0;i<particles.length;i++){particles[i].update(dt,mouseX,mouseY);particles[i].draw();}
      if(!dismissed)requestAnimationFrame(loop);
    }

    // ─── Dismiss ──────────────────────────────────────────────────────
    function dismiss(){
      if(dismissed)return;dismissed=true;
      enterHint.classList.remove('show');
      canvas.classList.add('fade-out');
      setTimeout(function(){
        canvas.remove();enterHint.remove();
        var el=document.getElementById('logo-src');if(el&&el.parentNode)el.parentNode.remove();
        particles.length=0;anchors.length=0;targets.length=0;
      },FADE_MS);
    }

    // ─── Event Handlers ───────────────────────────────────────────────
    canvas.addEventListener('mousemove',function(e){mouseX=e.clientX;mouseY=e.clientY;});
    canvas.addEventListener('mouseleave',function(){mouseX=-9999;mouseY=-9999;});
    canvas.addEventListener('click',dismiss);
    canvas.addEventListener('touchstart',function(e){e.preventDefault();var t=e.touches[0];mouseX=t.clientX;mouseY=t.clientY;},{passive:false});
    canvas.addEventListener('touchmove',function(e){e.preventDefault();var t=e.touches[0];mouseX=t.clientX;mouseY=t.clientY;},{passive:false});
    canvas.addEventListener('touchend',function(e){e.preventDefault();dismiss();},{passive:false});
    window.addEventListener('resize',function(){
      W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;
      if(anchors.length>0){computeTargets();assignTargets();}
    });

    // ─── Init ─────────────────────────────────────────────────────────
    function init(){
      sampleLogoPixels(SAMPLE_STEP).then(function(sampled){
        anchors=sampled;
        console.log('[V9.0] Sampled '+anchors.length+' anchor pixels (step='+SAMPLE_STEP+')');
        if(anchors.length<500)createFallbackAnchors();
        computeTargets();
        for(var i=0;i<anchors.length;i++)particles.push(new Particle(W,H));
        assignTargets();
        requestAnimationFrame(loop);
        setTimeout(function(){enterHint.classList.add('show');},HINT_DELAY);
      });
    }
    init();
    }();
    </script>
    <!-- ═══ End Splash V9.0 ═══ -->
```

Key architectural changes from V8.0:
- **No phases**: V8.0 had `explosion→float→magnetic→reveal` with 4 state machines. V9.0 has ONE loop.
- **No `easeOutBack`, `noise2`, `noiseOffset`**: No random drift, no easing curves.
- **No `settled`, `snap`, `revealPhase`**: Particles are always live, always interactive.
- **No `triggerPageReveal()`**: Replaced by simple `dismiss()` that fades canvas + removes DOM.
- **Particle physics**: 4-step unified update (repulsion→spring→damping→position) vs V8.0's 3 separate update methods.
- **`PARTICLE_COUNT` removed**: Particle count = anchor count from sampling (~6,400), not a fixed number.
- **`sampleLogoPixels(step)`**: Now accepts step parameter instead of hard-coded every-pixel sampling.

---

### Task 4: Update the closing HTML comment

**Files:**
- Modify: `public/index.html` line ~6086

- [ ] **Step 1: Verify `<!-- ═══ End Splash V9.0 ═══ -->` is present**

This is already handled in Task 3's replacement code. The V8.0 comment `<!-- ═══ End Splash V7.0 ═══ -->` is replaced by `<!-- ═══ End Splash V9.0 ═══ -->`. No additional action needed — just verify the replacement covered it.

---

### Task 5: Test in Browser

- [ ] **Step 1: Verify server is running**

```bash
lsof -ti:3000 || echo "Server not running — start it first"
```

- [ ] **Step 2: Navigate to splash page**

Open `http://localhost:3000` in browser or via Playwright.

- [ ] **Step 3: Verify console output**

Expected:
```
[V9.0] Sampled 6439 anchor pixels (step=2)
```

No errors. No `[V8.0]` references.

- [ ] **Step 4: Verify entry animation**

- Particles burst from screen edges within first few frames
- Within ~1.5s, particles spring into center forming a recognizable emblem
- Spring motion is smooth, no jitter or oscillation (FRICTION=0.92 damping)

- [ ] **Step 5: Verify rest state**

- After particles settle: zero mouse → particles sit motionless at anchors
- Emblem is sharp and readable (6,400 particles at step=2)
- Canvas background is PURE white (#ffffff)
- No residual particles anywhere outside the emblem area

- [ ] **Step 6: Verify UX prompt**

- At 2.5s, `#enter-hint` smoothly fades in (opacity 0→1, 0.8s transition)
- Text reads "点击任意位置进入系统 - Click to Enter"
- Positioned at bottom-center, doesn't block interaction

- [ ] **Step 7: Verify mouse interaction**

- Move mouse over emblem: particles fluidly pushed away within ~100px radius
- Move mouse away: particles spring back smoothly (no oscillation)
- Rapid mouse movements don't cause particle explosion (damping prevents it)
- Mouse at screen edge: mouseX/Y = -9999, repulsion disabled, all particles at anchors

- [ ] **Step 8: Verify click dismiss**

- Click canvas: `#enter-hint` loses `.show` (fades out)
- Canvas fades to opacity 0 (0.8s transition)
- After 800ms: verify all splash DOM removed
  ```javascript
  document.getElementById('splash-canvas')  // null
  document.getElementById('enter-hint')      // null
  document.getElementById('logo-src')        // null
  ```
- Page content fully visible and interactive

- [ ] **Step 9: Verify touch**

- Touch target: particles repel from touch point
- Touch end: dismiss triggers

- [ ] **Step 10: Verify resize**

- Resize browser window
- Emblem re-centers
- Particles spring to new positions
- No particles left behind at old positions

- [ ] **Step 11: Verify edge cases**

- **Logo load failure**: Fallback green ellipse anchors generated
- **Double click**: `dismissed` guard prevents double dismiss
- **Rapid resize**: Multiple `computeTargets()` calls don't break state
- **No JavaScript errors** in console at any point

---

### Task 6: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add public/index.html
git commit -m "feat: V9.0 Antigravity spring physics splash screen

Replace V8.0 phase-based splash with pure spring physics engine.
- 6,400 particles from step=2 pixel sampling of logo.png
- Unified physics: mouse repulsion + Hooke spring + air damping
- No phases, no overlays, no golden glow
- Click-to-dismiss with enter-hint UX prompt
- Pure white background, flat 2D dots

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```
