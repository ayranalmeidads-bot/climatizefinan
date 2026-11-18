/* CLIMATIZE 2.4 — seis moldes, edição local por foto, sem upload. */
(()=>{'use strict';const $=id=>document.getElementById(id),canvas=$('mkt-canvas');if(!canvas)return;const ctx=canvas.getContext('2d',{alpha:false});
 const fotos=[];const edits=[];let brand=null,custom=null,selected=0,roundZones=[],active=new Map(),previousPinch=0,revision=0;
 const defaults=()=>({zoom:100,bright:100,contrast:100,sat:100,warm:0,high:0,rotate:0,dx:0,dy:0});
 const el=['zoom','bright','contrast','sat','warm','high','rotate'];const k={zoom:'mkt-zoom',bright:'mkt-bright',contrast:'mkt-contrast',sat:'mkt-sat',warm:'mkt-warm',high:'mkt-high',rotate:'mkt-rotate'};
 function model(){const n=Number($('mkt-layout').value)||1;return {n,reels:n>=4};}
 function edit(){edits[selected]??=defaults();return edits[selected];}
 const msg=t=>$('mkt-status').textContent=t;
 function fillRound(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
 function gradient(a,b){const g=ctx.createLinearGradient(0,0,1080,canvas.height);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
 function txt(value,x,y,size,color='#fff',weight='700',width=970,align='center'){ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=`${weight} ${size}px system-ui,Arial`;ctx.fillStyle=color;ctx.fillText(String(value||''),x,y,width);}
 function imageFile(file){return new Promise((resolve,reject)=>{if(!file||!/^image\/(jpeg|png|webp|avif)$/i.test(file.type)||file.size>15*1024*1024)return reject(Error('Use imagens JPG, PNG, WebP ou AVIF de até 15 MB.'));const url=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(url);resolve(im);};im.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Não foi possível ler a foto.'));};im.src=url;});}
 async function logoLoad(){try{const im=new Image();await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src='climatize.png';});brand=im;draw();}catch{msg('Logo original indisponível. Você pode enviar a sua.');}}
 function photoSlots(n){const y=n>=4?300:205,h=n>=4?840:735; if(n===2)return [[55,y,477,h],[548,y,477,h]];
  if(n===3)return [[55,y,477,(h-16)/2],[548,y,477,(h-16)/2],[55,y+(h+16)/2,477,(h-16)/2],[548,y+(h+16)/2,477,(h-16)/2]];
  if(n===5)return [[465,280,560,800]];if(n===6)return [[80,345,920,650]];
  return [[55,y,970,h]];
 }
 function placePhoto(slot,i){const [x,y,w,h]=slot;ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,22);ctx.clip();
  fillRound(x,y,w,h,18,gradient('#287d97','#173341'));
  const image=fotos[i];if(image){const e=edits[i]??defaults(),rot=Number(e.rotate)||0,sw=rot%180===90?image.height:image.width,sh=rot%180===90?image.width:image.height;
   const fit=Math.max(w/sw,h/sh)*(e.zoom/100);const ox=e.dx*w,oy=e.dy*h;
   ctx.save();ctx.translate(x+w/2+ox,y+h/2+oy);ctx.rotate(rot*Math.PI/180);ctx.filter=`brightness(${e.bright}%) contrast(${e.contrast}%) saturate(${e.sat}%) sepia(${Math.abs(e.warm)/3}%) hue-rotate(${e.warm>0?-8:8}deg)`;
   ctx.drawImage(image,-image.width*fit/2,-image.height*fit/2,image.width*fit,image.height*fit);ctx.filter='none';ctx.restore();
   if(e.high){ctx.globalCompositeOperation=e.high>0?'screen':'multiply';ctx.fillStyle=e.high>0?`rgba(255,255,255,${e.high/160})`:`rgba(9,30,39,${-e.high/110})`;ctx.fillRect(x,y,w,h);ctx.globalCompositeOperation='source-over';}
  }else{txt('ADICIONE SUA FOTO',x+w/2,y+h/2,30,'#d7eef3','700',w-50);}
  ctx.restore();ctx.lineWidth=selected===i?7:3;ctx.strokeStyle=selected===i?'#b1fbff':'#8dd1dd';ctx.beginPath();ctx.roundRect(x,y,w,h,22);ctx.stroke();
 }
 function showLogo(n){const image=custom||brand;if(!$('mkt-logo').checked||!image)return;const maxW=n>=4?580:550,maxH=n>=4?205:145;const k=Math.min(maxW/image.width,maxH/image.height);ctx.drawImage(image,(1080-image.width*k)/2,24,image.width*k,image.height*k);}
 function draw(){const {n,reels}=model(),W=1080,H=reels?1920:1350;$('mkt-formato').value=reels?'reels':'feed';if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
 $('mkt-dimensoes').textContent=`${W} × ${H} px`;$('mkt-canvas').parentElement.classList.toggle('is-reels',reels);$('mkt-canvas').parentElement.classList.toggle('safe-visible',reels&&$('mkt-seguranca').checked);
 const isLight=n===1||n===2||n===3||n===5;ctx.fillStyle=gradient(isLight?'#f5fdff':'#0c435a',isLight?'#cbecf1':'#071724');ctx.fillRect(0,0,W,H);
 // identidade com curvas e diagonais, distinta por modelo
 ctx.fillStyle=n===3?'#052d41':'#0e758b';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(400,0);ctx.lineTo(0,reels?500:370);ctx.fill();
 ctx.strokeStyle='#49cee0';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(0,reels?1250:1070);ctx.quadraticCurveTo(580,reels?1060:950,1080,reels?1260:1070);ctx.stroke();
 roundZones=photoSlots(n);roundZones.forEach((z,i)=>placePhoto(z,i));
 const dark=isLight?'#0b3345':'#f6fdff';const accent=isLight?'#08687b':'#72e8fa';
 if(n===1){fillRound(40,970,1000,325,44,'#f2fcff');txt($('mkt-titulo').value||'Instalação de Ar-Condicionado',540,1030,65,'#103b50','850');txt($('mkt-subtitulo').value,540,1120,34,'#377185','650');}
 if(n===2){['ANTES','DEPOIS'].forEach((s,i)=>{fillRound(i?635:90,225,355,72,24,i?'#1aaac4':'#143c50');txt(s,i?812:268,261,37);});txt($('mkt-titulo').value||'Higienização com resultado!',540,1052,58,dark,'850');txt($('mkt-subtitulo').value,540,1130,33,'#195366');}
 if(n===3){fillRound(50,985,980,290,42,'#08536b');txt($('mkt-titulo').value||'Projetos e instalações',540,1046,59);txt($('mkt-subtitulo').value,540,1120,32,'#a7f3fc');}
 if(n===4){txt($('mkt-titulo').value||'Serviço concluído!',540,1240,76,'#fff','850');txt($('mkt-subtitulo').value,540,1336,40,'#b1effa');}
 if(n===5){fillRound(45,290,398,825,30,'#064358');txt('SERVIÇOS',244,366,50);['✓ INSTALAÇÃO','✓ MANUTENÇÃO','✓ HIGIENIZAÇÃO','✓ REOPERAÇÃO'].forEach((s,i)=>txt(s,244,465+i*135,31));txt($('mkt-titulo').value||'Mais conforto para seu ambiente!',540,1235,62,dark,'850');txt($('mkt-subtitulo').value,540,1325,35,'#155f75');}
 if(n===6){txt('✓ Qualidade   ✓ Eficiência',540,1130,46,accent);txt($('mkt-titulo').value||'Confiança em cada serviço',540,1240,64);txt($('mkt-subtitulo').value,540,1330,36,'#c0ecf4');}
 // CTA e contato em área protegida para Reels
 const ctaY=reels?1450:1219;fillRound(130,ctaY-40,820,78,39,n===1||n===2?'#137c94':'#13a6be');txt($('mkt-chamada').value||'Solicite seu orçamento!',540,ctaY,43,'#fff','850');
 if(reels){txt($('mkt-responsavel').value,540,1534,34,'#d1f7fc');txt($('mkt-contato').value,540,1590,38,'#d1f7fc');}
 else{txt($('mkt-responsavel').value+'  ·  '+$('mkt-contato').value,540,1312,26,'#115469');}
 showLogo(n);ctx.strokeStyle='#49d5e7';ctx.lineWidth=8;ctx.strokeRect(12,12,W-24,H-24);
 }
 function sync(){const e=edit();for(const name of el)$(k[name]).value=e[name];const needed=photoSlots(model().n).length;const select=$('mkt-photo-slot');select.replaceChildren();for(let i=0;i<needed;i++){const opt=document.createElement('option');opt.value=String(i);opt.textContent=`Foto ${i+1}`;select.append(opt);}selected=Math.min(selected,needed-1);select.value=String(selected);}
 async function loadPhotos(ev){const run=++revision,files=Array.from(ev.target.files||[]);if(files.length>4){msg('O limite é de quatro imagens.');return;}try{const imgs=await Promise.all(files.map(imageFile));if(run!==revision)return;fotos.splice(0,fotos.length,...imgs);edits.splice(0,edits.length,...imgs.map(defaults));selected=0;sync();draw();msg(`${imgs.length} foto(s) pronta(s) para editar. Clique na prévia ou arraste para enquadrar.`);}catch(e){msg(e.message);}}
 $('mkt-fotos').addEventListener('change',loadPhotos);$('mkt-logo-file').addEventListener('change',async e=>{try{custom=e.target.files[0]?await imageFile(e.target.files[0]):null;draw();}catch(ex){msg(ex.message);}});
 $('mkt-layout').addEventListener('change',()=>{selected=0;sync();draw();});$('mkt-photo-slot').addEventListener('change',e=>{selected=+e.target.value;sync();draw();});
 for(const name of el)$(k[name]).addEventListener('input',e=>{edit()[name]=name==='rotate'?+e.target.value:+e.target.value;draw();});
 $('mkt-restore').addEventListener('click',()=>{edits[selected]=defaults();sync();draw();});
 for(const id of ['mkt-titulo','mkt-subtitulo','mkt-responsavel','mkt-contato','mkt-chamada','mkt-logo','mkt-seguranca'])$(id).addEventListener('input',draw);
 $('mkt-reset').addEventListener('click',()=>{revision++;fotos.splice(0);edits.splice(0);$('mkt-fotos').value='';selected=0;sync();draw();msg('Fotos removidas.');});
 const pos=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};
 canvas.addEventListener('pointerdown',e=>{const p=pos(e);const i=roundZones.findIndex(([x,y,w,h])=>p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h);if(i>=0){selected=i;sync();draw();}active.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!active.has(e.pointerId))return;const p=pos(e),prev=active.get(e.pointerId);active.set(e.pointerId,p);const z=roundZones[selected];if(!z||!fotos[selected])return;
  if(active.size===2){const pts=[...active.values()];const d=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);if(previousPinch>0)edit().zoom=Math.max(100,Math.min(300,edit().zoom*d/previousPinch));previousPinch=d;sync();}else{edit().dx=Math.max(-1.4,Math.min(1.4,edit().dx+(p.x-prev.x)/z[2]));edit().dy=Math.max(-1.4,Math.min(1.4,edit().dy+(p.y-prev.y)/z[3]));}draw();});
 function release(e){active.delete(e.pointerId);previousPinch=0;}canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
 $('mkt-download').addEventListener('click',()=>{try{draw();canvas.toBlob(b=>{if(!b){msg('Falha ao gerar PNG.');return;}const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=`Climatize_${model().reels?'Reels':'Feed'}_Modelo_${model().n}_${new Date().toISOString().slice(0,10)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);msg('Arquivo PNG preparado para download.');},'image/png');}catch(e){msg('Falha: '+e.message);}});
 window.addEventListener('climatize:config',e=>{const m=e.detail?.marketing||{};const templates=Array.isArray(m.templates)?m.templates:[1,2,3,4,5,6];document.querySelectorAll('#mkt-layout option').forEach(o=>{o.hidden=!templates.includes(+o.value);o.disabled=o.hidden;});if(!templates.includes(+$('mkt-layout').value))$('mkt-layout').value=String(templates[0]||1);if(m.cta && $('mkt-chamada').value==='Solicite seu orçamento!')$('mkt-chamada').value=m.cta;
 if(m.name && $('mkt-responsavel').value==='Allyson Rener')$('mkt-responsavel').value=m.name;
 if(m.phone && $('mkt-contato').value==='(77) 99877-7658')$('mkt-contato').value=m.phone;sync();draw();});
 sync();draw();logoLoad();
})();
