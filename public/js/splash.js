
    !function(){'use strict';

    // ─── Config ───────────────────────────────────────────────────────
    var SAMPLE_STEP=2,LOGO_W=528,LOGO_H=280;
    var MOUSE_RADIUS=100,MOUSE_FORCE=8,SPRING=0.03,FRICTION=0.92;
    var PARTICLE_RADIUS_MIN=1.5,PARTICLE_RADIUS_MAX=2;
    var HINT_DELAY=2500,FADE_MS=800;

    // ─── State ────────────────────────────────────────────────────────
    var canvas=document.getElementById('splash-canvas'),ctx=canvas.getContext('2d');
    var W=canvas.width=window.innerWidth,H=canvas.height=window.innerHeight;
    var enterHint=document.getElementById('enter-hint');
    var anchors=[],targets=[],particles=[];
    var mouseX=-9999,mouseY=-9999,dismissed=false;
    var lastTime=0;

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
      if(dismissed)return;
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
