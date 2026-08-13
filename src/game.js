(function () {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const TILE = 24, COLS = 36, ROWS = 22, OX = (W - COLS * TILE) / 2, SURFACE = 168;
  const keys = new Set();
  const ui = {
    start: document.getElementById('startPanel'), end: document.getElementById('endPanel'), upgrade: document.getElementById('upgradePanel'),
    stock: document.getElementById('stockValue'), grid: document.getElementById('upgradeGrid'), endTitle: document.getElementById('endTitle'), endText: document.getElementById('endText')
  };
  const upgrades = [
    ['drill','钻头','挖掘伤害 +50%',3],['engine','引擎','移动速度 +20%',3],['cargo','货仓','容量增加 2',4],
    ['cannon','火炮','炮弹伤害 +35%',4],['rail','炮轨','转向与冷却改善',3],['core','核心站','修复 25 点生命',4]
  ];
  let game, last = 0;

  function reset() {
    const map = [];
    for (let y=0;y<ROWS;y++) { map[y]=[]; for(let x=0;x<COLS;x++) {
      const hard = y > 7 && ((x*13+y*7)%9<3); map[y][x]={type:hard?'rock':'soil',hp:hard?3:1,max:hard?3:1,ore:false};
    }}
    for(let y=0;y<ROWS;y++) map[y][17].hp=0;
    [[15,2],[20,3],[12,5],[23,6],[8,9],[28,10],[14,13],[21,15],[6,17],[30,18]].forEach(([x,y])=>map[y][x].ore=true);
    game={running:false,paused:false,mode:'mine',map,time:0,phaseTime:48,wave:1,maxWaves:3,stock:0,baseHp:100,message:'向下挖掘，寻找晶矿',messageTime:8,
      player:{x:17,y:0,px:OX+17*TILE+TILE/2,py:SURFACE+TILE/2,carry:0,capacity:3,speed:150,drill:1,moveCd:0},
      cannon:{angle:-Math.PI/2,heat:0,damage:1,turn:1}, enemies:[],shots:[],upgradeLevels:{drill:0,engine:0,cargo:0,cannon:0,rail:0,core:0}, kills:0};
    renderUpgrades();
  }
  function start(){reset();game.running=true;ui.start.classList.add('hidden');ui.end.classList.add('hidden');last=performance.now();requestAnimationFrame(loop)}
  function tileAt(x,y){return y>=0&&y<ROWS&&x>=0&&x<COLS?game.map[y][x]:null}
  function message(t){game.message=t;game.messageTime=4}
  function tryMove(dx,dy){
    const p=game.player,nx=p.x+dx,ny=p.y+dy;if(nx<0||nx>=COLS||ny<0||ny>=ROWS)return;
    const t=tileAt(nx,ny);if(t.hp>0){t.hp-=p.drill;if(t.hp<=0){t.hp=0;if(t.ore&&p.carry<p.capacity){p.carry++;t.ore=false;message('晶矿已装载，返回核心站存入')}}return}
    p.x=nx;p.y=ny;p.px=OX+nx*TILE+TILE/2;p.py=SURFACE+ny*TILE+TILE/2;
  }
  function updateMine(dt){
    const p=game.player;p.moveCd-=dt;let dx=0,dy=0;if(keys.has('a')||keys.has('arrowleft'))dx=-1;else if(keys.has('d')||keys.has('arrowright'))dx=1;else if(keys.has('w')||keys.has('arrowup'))dy=-1;else if(keys.has('s')||keys.has('arrowdown'))dy=1;
    if((dx||dy)&&p.moveCd<=0){tryMove(dx,dy);p.moveCd=.11/(p.speed/150)}
    if(p.y===0&&p.carry){game.stock+=p.carry;p.carry=0;message('晶矿已存入。按 E 选择升级')}
  }
  function spawnWave(){game.mode='defend';game.enemies=[];const n=3+game.wave*2;for(let i=0;i<n;i++)game.enemies.push({x:i%2?-70:W+70,y:138,hp:1+Math.floor(game.wave/2),side:i%2?1:-1,speed:42+game.wave*7,attack:0});message('敌袭！旋转炮口并按 Space 射击')}
  function updateDefense(dt){
    const c=game.cannon;if(keys.has('a')||keys.has('arrowleft'))c.angle-=1.8*c.turn*dt;if(keys.has('d')||keys.has('arrowright'))c.angle+=1.8*c.turn*dt;c.angle=Math.max(-Math.PI+.12,Math.min(-.12,c.angle));c.heat=Math.max(0,c.heat-dt*(.36+.18*(c.turn-1)));
    if(keys.has(' ')&&c.heat<.9){const bx=W/2+Math.cos(c.angle)*58,by=126+Math.sin(c.angle)*58;game.shots.push({x:bx,y:by,vx:Math.cos(c.angle)*520,vy:Math.sin(c.angle)*520});c.heat+=.16}
    game.shots.forEach(s=>{s.x+=s.vx*dt;s.y+=s.vy*dt});game.shots=game.shots.filter(s=>s.x>-30&&s.x<W+30&&s.y>-30&&s.y<H);
    for(const e of game.enemies){const dir=Math.sign(W/2-e.x);e.x+=dir*e.speed*dt;if(Math.abs(e.x-W/2)<76){e.attack-=dt;if(e.attack<=0){game.baseHp-=4+game.wave;e.attack=.75}}for(const s of game.shots){if(Math.hypot(s.x-e.x,s.y-e.y)<22){e.hp-=c.damage;s.y=-100}}}
    const before=game.enemies.length;game.enemies=game.enemies.filter(e=>e.hp>0);game.kills+=before-game.enemies.length;
    if(game.baseHp<=0)return finish(false);if(!game.enemies.length){if(game.wave>=game.maxWaves)return finish(true);game.wave++;game.mode='mine';game.phaseTime=42;message('威胁清除。继续下潜，下一波更强')}
  }
  function update(dt){if(!game.running||game.paused)return;game.time+=dt;game.messageTime=Math.max(0,game.messageTime-dt);if(game.mode==='mine'){game.phaseTime-=dt;updateMine(dt);if(game.phaseTime<=0)spawnWave()}else updateDefense(dt)}
  function finish(win){game.running=false;ui.endTitle.textContent=win?'原型循环完成':'核心站失守';ui.endText.textContent=win?`你守住了 ${game.maxWaves} 波进攻，消灭 ${game.kills} 个目标。下一里程碑将加入完整 6 波、三类敌人与地核晶体终局。`:`你抵挡到第 ${game.wave} 波。采矿更深，还是更早投资防御？`;ui.end.classList.remove('hidden')}
  function openUpgrade(){if(!game.running||game.mode!=='mine'||game.player.y!==0)return message('返回地表核心站才能升级');game.paused=true;ui.stock.textContent=game.stock;renderUpgrades();ui.upgrade.classList.remove('hidden')}
  function closeUpgrade(){ui.upgrade.classList.add('hidden');if(game)game.paused=false}
  function buy(id,base){const level=game.upgradeLevels[id],cost=base+level*3;if(level>=2||game.stock<cost)return;game.stock-=cost;game.upgradeLevels[id]++;if(id==='drill')game.player.drill+=.5;if(id==='engine')game.player.speed*=1.2;if(id==='cargo')game.player.capacity+=2;if(id==='cannon')game.cannon.damage+=.35;if(id==='rail')game.cannon.turn+=.35;if(id==='core')game.baseHp=Math.min(125,game.baseHp+25);ui.stock.textContent=game.stock;renderUpgrades();message('升级完成，效果立即生效')}
  function renderUpgrades(){if(!game)return;ui.grid.innerHTML='';for(const [id,name,desc,base] of upgrades){const lv=game.upgradeLevels[id],cost=base+lv*3,b=document.createElement('button');b.className='upgrade';b.disabled=lv>=2||game.stock<cost;b.innerHTML=`<strong>${name} · ${lv}/2</strong><small>${desc}</small><span class="cost">${lv>=2?'已满级':cost+' 晶矿'}</span>`;b.onclick=()=>buy(id,base);ui.grid.appendChild(b)}}
  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)}
  function text(t,x,y,size=18,color='#eaf5f4',align='left'){ctx.fillStyle=color;ctx.font=`600 ${size}px system-ui`;ctx.textAlign=align;ctx.fillText(t,x,y)}
  function draw(){
    rect(0,0,W,H,'#07121a');const alarm=game.mode==='mine'&&game.phaseTime<12;rect(0,0,W,SURFACE,alarm?'#342028':'#102733');rect(0,SURFACE,W,H-SURFACE,'#1a1518');
    ctx.fillStyle='#17242b';ctx.beginPath();ctx.moveTo(0,148);for(let x=0;x<=W;x+=40)ctx.lineTo(x,140+(x%80?5:-5));ctx.lineTo(W,SURFACE);ctx.lineTo(0,SURFACE);ctx.fill();
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const t=game.map[y][x],px=OX+x*TILE,py=SURFACE+y*TILE;if(t.hp<=0){rect(px,py,TILE,TILE,'#090f13');continue}rect(px,py,TILE-1,TILE-1,t.type==='rock'?'#4a4448':'#34272a');if(t.hp<t.max){ctx.strokeStyle='#9b7772';ctx.beginPath();ctx.moveTo(px+5,py+3);ctx.lineTo(px+12,py+12);ctx.lineTo(px+7,py+21);ctx.stroke()}if(t.ore){ctx.fillStyle='#52e5cb';ctx.beginPath();ctx.arc(px+12,py+12,5,0,7);ctx.fill()}}
    const baseX=W/2;base(baseX);if(game.mode==='mine'){const p=game.player;ctx.fillStyle='#f1c76d';ctx.beginPath();ctx.arc(p.px,p.py,9,0,7);ctx.fill();rect(p.px-8,p.py-5,16,9,'#b86f45');for(let i=0;i<p.carry;i++){ctx.fillStyle='#55e6ca';ctx.beginPath();ctx.arc(p.px-14-i*8,p.py+12,4,0,7);ctx.fill()}}
    else{for(const e of game.enemies){ctx.fillStyle=e.hp>1?'#d85b58':'#e78b63';ctx.beginPath();ctx.arc(e.x,e.y,e.hp>1?19:14,0,7);ctx.fill();rect(e.x-16,e.y+10,32,5,'#542b31')}for(const s of game.shots){ctx.fillStyle='#76fff0';ctx.beginPath();ctx.arc(s.x,s.y,5,0,7);ctx.fill()}}
    drawHud(alarm);
  }
  function base(x){rect(x-58,80,116,72,'#1c3d47');rect(x-42,64,84,22,'#347181');ctx.strokeStyle='#57e5cd';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,126,54,Math.PI,0);ctx.stroke();const a=game.cannon.angle;ctx.strokeStyle='#f2cf75';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(x,126);ctx.lineTo(x+Math.cos(a)*54,126+Math.sin(a)*54);ctx.stroke();rect(x-72,150,144,6,'#4d6670')}
  function drawHud(alarm){rect(22,20,340,84,'#071018dd');text('COREWARD',38,45,12,'#55e6ca');text(`核心站 ${Math.max(0,Math.ceil(game.baseHp))}/100`,38,73,18);rect(190,59,150,12,'#243943');rect(190,59,150*Math.max(0,game.baseHp)/100,12,'#e46761');text(game.mode==='mine'?`第 ${game.wave} 波 · ${Math.max(0,Math.ceil(game.phaseTime))} 秒`:`第 ${game.wave} 波 · 防守中`,W-32,47,20,alarm?'#ff8278':'#eaf5f4','right');text(`携带 ${game.player.carry}/${game.player.capacity}  ·  库存 ${game.stock}`,W-32,76,15,'#9bb1ba','right');if(game.mode==='defend'){rect(W/2-80,20,160,9,'#26353a');rect(W/2-80,20,160*game.cannon.heat,9,game.cannon.heat>.8?'#ff6b65':'#efc66b')}if(game.messageTime>0){rect(W/2-270,H-58,540,38,'#061016dd');text(game.message,W/2,H-32,16,'#eef6f5','center')}}
  function loop(now){const dt=Math.min(.033,(now-last)/1000||0);last=now;update(dt);draw();if(game.running)requestAnimationFrame(loop)}
  addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys.add(k);if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(k==='e'){if(ui.upgrade.classList.contains('hidden'))openUpgrade();else closeUpgrade()}if(k==='escape')closeUpgrade()});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  document.getElementById('startButton').onclick=start;document.getElementById('restartButton').onclick=start;document.getElementById('closeUpgrade').onclick=closeUpgrade;reset();draw();
})();
