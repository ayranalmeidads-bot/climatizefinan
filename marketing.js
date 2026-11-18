/* CLIMATIZE 2.4.2 — Editor de Marketing intuitivo e 100% local.
   Somente apresentação e composição de imagens. Não usa Supabase, APIs ou rede para fotos. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),canvas=$('mkt-canvas');if(!canvas)return;
 const ctx=canvas.getContext('2d',{alpha:false}),modal=$('mkt-editor'),editorCanvas=$('mkt-editor-canvas'),ec=editorCanvas.getContext('2d',{alpha:false}),fullCanvas=$('mkt-editor-full-canvas'),fc=fullCanvas.getContext('2d',{alpha:false});
 const fotos=[],edits=[];let brand=null,custom=null,selected=0,roundZones=[],mosaic=4,revision=0,editing=false,snapshot=null,returnFocus=null,fileDestination=null;
 const active=new Map();let lastDistance=0,moved=false,editSlot=null;
 const defaults=()=>({zoom:100,bright:100,contrast:100,sat:100,warm:0,high:0,rotate:0,dx:0,dy:0});
 const fields=['zoom','bright','contrast','sat','warm','high'];
 const msg=t=>{$('mkt-status').textContent=t;};
 const model=()=>{const n=Number($('mkt-layout').value)||1;return {n,reels:n>=4};};
 const edit=(i=selected)=>{edits[i]??=defaults();return edits[i];};
 function contentText(){const n=model().n;const fields=['mkt-titulo','mkt-subtitulo','mkt-chamada','mkt-responsavel','mkt-contato'];if(n===2)fields.push('mkt-antes','mkt-depois');if(n===5)fields.push('mkt-servicos');if(n===6)fields.push('mkt-beneficios');return fields.every(id=>!$(id).value.trim());}
 function slots(){const n=model().n,clean=contentText(),reels=n>=4,y=clean?($('mkt-logo').checked?260:95):reels?300:205,h=clean?(reels?($('mkt-logo').checked?1510:1690):($('mkt-logo').checked?1010:1130)):reels?840:735;
  if(n===2||n===3&&mosaic===2)return [[55,y,477,h],[548,y,477,h]];
  if(n===3&&mosaic===4)return [[55,y,477,(h-16)/2],[548,y,477,(h-16)/2],[55,y+(h+16)/2,477,(h-16)/2],[548,y+(h+16)/2,477,(h-16)/2]];
  if(n===3&&mosaic===6){const w=(970-28)/3,rh=(h-14)/2;return Array.from({length:6},(_,i)=>[55+(i%3)*(w+14),y+Math.floor(i/3)*(rh+14),w,rh]);}
  if(clean)return [[55,y,970,h]];if(n===5)return [[465,280,560,800]];if(n===6)return [[80,345,920,650]];
  return [[55,y,970,h]];
 }
 function roundRect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
 function fillRound(c,x,y,w,h,r,color){c.fillStyle=color;roundRect(c,x,y,w,h,r);c.fill();}
 function gradient(c,H,a,b){const g=c.createLinearGradient(0,0,1080,H);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
 function txt(v,x,y,size,color='#fff',weight='700',width=970,align='center'){ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=`${weight} ${size}px system-ui,Arial`;ctx.fillStyle=color;ctx.fillText(String(v||''),x,y,width);}
 function constrain(i,w,h){const img=fotos[i],e=edit(i);if(!img)return;const quarter=e.rotate%180!==0;
  const sw=quarter?img.height:img.width,sh=quarter?img.width:img.height;
  const scale=Math.max(w/sw,h/sh)*(e.zoom/100),maxX=Math.max(0,(sw*scale-w)/2),maxY=Math.max(0,(sh*scale-h)/2);
  e.dx=Math.max(-maxX/w,Math.min(maxX/w,e.dx));e.dy=Math.max(-maxY/h,Math.min(maxY/h,e.dy));
 }
 function paintPhoto(c,x,y,w,h,i,outline=true,showEmpty=true){
  c.save();roundRect(c,x,y,w,h,Math.min(22,w/12,h/12));c.clip();
  const bg=c.createLinearGradient(x,y,x+w,y+h);bg.addColorStop(0,'#237b96');bg.addColorStop(1,'#123446');c.fillStyle=bg;c.fillRect(x,y,w,h);
  const image=fotos[i];if(image){const e=edit(i);constrain(i,w,h);const turn=e.rotate%180!==0;
   const sw=turn?image.height:image.width,sh=turn?image.width:image.height,fit=Math.max(w/sw,h/sh)*(e.zoom/100);
   c.save();c.translate(x+w/2+e.dx*w,y+h/2+e.dy*h);c.rotate(e.rotate*Math.PI/180);
   c.filter=`brightness(${e.bright}%) contrast(${e.contrast}%) saturate(${e.sat}%) sepia(${Math.abs(e.warm)/3}%) hue-rotate(${e.warm>0?-8:8}deg)`;
   c.drawImage(image,-image.width*fit/2,-image.height*fit/2,image.width*fit,image.height*fit);c.filter='none';c.restore();
   if(e.high){c.globalCompositeOperation=e.high>0?'screen':'multiply';c.fillStyle=e.high>0?`rgba(255,255,255,${e.high/160})`:`rgba(9,30,39,${-e.high/110})`;c.fillRect(x,y,w,h);c.globalCompositeOperation='source-over';}
  }else if(showEmpty){c.fillStyle='#d7eff6';c.textBaseline='middle';c.textAlign='center';c.font=`bold ${Math.min(28,w/13)}px system-ui,Arial`;c.fillText('＋ ADICIONE SUA FOTO',x+w/2,y+h/2,w-30);}
  c.restore();if(outline){c.lineWidth=4;c.strokeStyle='#8dd1dd';roundRect(c,x,y,w,h,Math.min(22,w/12,h/12));c.stroke();}
 }
 function showLogo(){const im=custom||brand;if(!$('mkt-logo').checked||!im)return;const reels=model().reels,k=Math.min((reels?580:550)/im.width,(reels?205:145)/im.height);ctx.drawImage(im,(1080-im.width*k)/2,24,im.width*k,im.height*k);}
 function labelText(value,x,y,size,color='#fff',weight='700',width=970,align='center'){
  const s=String(value||'').trim();if(s)txt(s,x,y,size,color,weight,width,align);
 }
 function lines(id){return $(id).value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,6);}
 function draw(exporting=false){const {n,reels}=model(),H=reels?1920:1350,clean=contentText();canvas.width=1080;canvas.height=H;roundZones=slots();
  $('mkt-formato').value=reels?'reels':'feed';$('mkt-dimensoes').textContent=`1080 × ${H} px`;
  const cw=canvas.parentElement;cw.classList.toggle('is-reels',reels);cw.classList.toggle('safe-visible',reels&&$('mkt-seguranca').checked);
  const light=[1,2,3,5].includes(n);
  ctx.fillStyle=gradient(ctx,H,clean?'#e6f5f8':light?'#f5fdff':'#0c435a',clean?'#c8e8ed':light?'#cbecf1':'#071724');ctx.fillRect(0,0,1080,H);
  if(!clean){ctx.fillStyle=n===3?'#052d41':'#0e758b';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(400,0);ctx.lineTo(0,reels?500:370);ctx.fill();
   ctx.strokeStyle='#49cee0';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(0,reels?1250:1070);ctx.quadraticCurveTo(580,reels?1060:950,1080,reels?1260:1070);ctx.stroke();}
  roundZones.forEach(([x,y,w,h],i)=>paintPhoto(ctx,x,y,w,h,i,!clean,!exporting));
  const dark=light?'#0b3345':'#f6fdff',accent=light?'#08687b':'#72e8fa';
  const title=$('mkt-titulo').value.trim(),sub=$('mkt-subtitulo').value.trim(),call=$('mkt-chamada').value.trim();
  if(!clean){
   if(n===1){if(title||sub)fillRound(ctx,40,970,1000,sub?235:140,44,'#f2fcff');labelText(title,540,1030,65,'#103b50','850');labelText(sub,540,1120,34,'#377185','650');}
   if(n===2){[$('mkt-antes').value,$('mkt-depois').value].forEach((s,i)=>{if(!s.trim())return;fillRound(ctx,i?635:90,225,355,72,24,i?'#1aaac4':'#143c50');labelText(s,i?812:268,261,37);});labelText(title,540,1052,58,dark,'850');labelText(sub,540,1130,33,'#195366');}
   if(n===3){if(title||sub)fillRound(ctx,50,985,980,sub?190:115,42,'#08536b');labelText(title,540,1046,59);labelText(sub,540,1120,32,'#a7f3fc');}
   if(n===4){labelText(title,540,1240,76,'#fff','850');labelText(sub,540,1336,40,'#b1effa');}
   if(n===5){const services=lines('mkt-servicos');if(services.length){fillRound(ctx,45,290,398,825,30,'#064358');services.forEach((s,i)=>labelText('✓ '+s,244,390+i*135,31));}labelText(title,540,1235,62,dark,'850');labelText(sub,540,1325,35,'#155f75');}
   if(n===6){lines('mkt-beneficios').forEach((s,i)=>labelText('✓ '+s,540,1050+i*70,42,accent));labelText(title,540,1240,64);labelText(sub,540,1330,36,'#c0ecf4');}
   const ctaY=reels?1450:1219;if(call){fillRound(ctx,130,ctaY-40,820,78,39,n===1||n===2?'#137c94':'#13a6be');labelText(call,540,ctaY,43,'#fff','850');}
   if(reels){labelText($('mkt-responsavel').value,540,1534,34,'#d1f7fc');labelText($('mkt-contato').value,540,1590,38,'#d1f7fc');}
   else{const names=[$('mkt-responsavel').value,$('mkt-contato').value].map(v=>v.trim()).filter(Boolean);labelText(names.join(' · '),540,1312,26,'#115469');}
  }
  showLogo();ctx.strokeStyle=clean?'#71bdca':'#49d5e7';ctx.lineWidth=clean?4:8;ctx.strokeRect(12,12,1064,H-24);
 }
 function renderEditor(){if(!editing)return;draw();const z=slots()[selected];if(!z)return;const w=Math.round(z[2]),h=Math.round(z[3]);if(editorCanvas.width!==w||editorCanvas.height!==h){editorCanvas.width=w;editorCanvas.height=h;}
  paintPhoto(ec,0,0,w,h,selected,false);ec.save();ec.strokeStyle='rgba(255,255,255,.60)';ec.lineWidth=1;ec.setLineDash([10,12]);ec.strokeRect(w/3,h/3,w/3,h/3);ec.restore();
  fullCanvas.width=270;fullCanvas.height=Math.round(canvas.height/4);fc.drawImage(canvas,0,0,fullCanvas.width,fullCanvas.height);
  for(const f of fields){const val=edit()[f];$(('mkt-'+f)+'-value').textContent=val+(f==='zoom'||f==='bright'||f==='contrast'||f==='sat'?'%':'');$('mkt-'+f).value=val;}
 }
 function render(){draw();renderEditor();}
 function updateButtons(){const holder=$('mkt-slot-buttons');holder.replaceChildren();slots().forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.className='mkt-slot-button';b.textContent=`${fotos[i]?'✎ Editar':'＋ Adicionar'} foto ${i+1}`;b.setAttribute('aria-label',`${fotos[i]?'Editar':'Adicionar'} foto ${i+1}`);b.addEventListener('click',()=>chooseSlot(i));holder.append(b);});}
 async function imageFile(file){if(!file||!/^image\/(jpeg|png|webp|avif)$/i.test(file.type)||file.size>15*1024*1024)throw Error('Use fotos JPG, PNG, WebP ou AVIF de até 15 MB.');
  return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(url);resolve(im);};im.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Não foi possível abrir a foto.'));};im.src=url;});}
 async function logoLoad(){try{const im=new Image();await new Promise((ok,bad)=>{im.onload=ok;im.onerror=bad;im.src='climatize.png';});brand=im;draw();}catch{msg('A logo não foi carregada; é possível escolher outra.');}}
 async function filesInput(ev){const run=++revision,files=[...(ev.target.files||[])];if(!files.length)return;
  if(files.length>6){msg('Selecione no máximo 6 fotos por vez.');return;}
  try{const imgs=await Promise.all(files.map(imageFile));if(run!==revision)return;fotos.splice(0,fotos.length,...imgs);edits.splice(0,edits.length,...imgs.map(defaults));render();updateButtons();
    msg(`${imgs.length} foto(s) adicionada(s). Toque em cada foto da prévia para editar.`);}catch(e){msg(e.message);} }
 function openEditor(i){if(!fotos[i]){selected=i;fileDestination='empty';$('mkt-slot-file').value='';$('mkt-slot-file').click();return;}
  selected=i;editing=true;snapshot={i,photo:fotos[i],settings:{...edit(i)}};returnFocus=document.activeElement;
  $('mkt-editor-title').textContent=`Editar foto ${i+1}`;modal.hidden=false;document.body.classList.add('mkt-editor-open');renderEditor();$('mkt-editor-close').focus();}
 function chooseSlot(i){if(i>=slots().length)return;openEditor(i);}
 function closeEditor(accept){if(!editing)return;if(!accept&&snapshot){fotos[snapshot.i]=snapshot.photo;edits[snapshot.i]=snapshot.settings;}
  editing=false;snapshot=null;active.clear();lastDistance=0;modal.hidden=true;document.body.classList.remove('mkt-editor-open');render();updateButtons();
  if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;
  if(accept)msg(`Foto ${selected+1} ajustada com sucesso. A arte está pronta para continuar.`);}
 function updateEditorControl(f,val){edit()[f]=+val;if(f==='zoom'){const s=slots()[selected];constrain(selected,s[2],s[3]);}renderEditor();}
 function coordinate(e,target){const r=target.getBoundingClientRect();return{x:(e.clientX-r.left)*target.width/r.width,y:(e.clientY-r.top)*target.height/r.height};}
 const editorPos=e=>coordinate(e,editorCanvas);
 editorCanvas.addEventListener('pointerdown',e=>{if(!editing)return;e.preventDefault();active.set(e.pointerId,editorPos(e));editorCanvas.setPointerCapture(e.pointerId);moved=false;lastDistance=0;});
 editorCanvas.addEventListener('pointermove',e=>{if(!editing||!active.has(e.pointerId))return;e.preventDefault();const p=editorPos(e),prev=active.get(e.pointerId);active.set(e.pointerId,p);const d=edit(),w=editorCanvas.width,h=editorCanvas.height;
  if(active.size===2){const pts=[...active.values()],dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);if(lastDistance>0)d.zoom=Math.min(300,Math.max(100,Math.round(d.zoom*dist/lastDistance)));lastDistance=dist;}
  else{lastDistance=0;d.dx+=(p.x-prev.x)/w;d.dy+=(p.y-prev.y)/h;}
  constrain(selected,w,h);renderEditor();moved=true;});
 function release(e){active.delete(e.pointerId);lastDistance=0;}
 editorCanvas.addEventListener('pointerup',release);editorCanvas.addEventListener('pointercancel',release);
 canvas.addEventListener('click',e=>{const p=coordinate(e,canvas),i=roundZones.findIndex(([x,y,w,h])=>p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h);if(i>=0)chooseSlot(i);});
 canvas.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseSlot(0);}});
 $('mkt-editor-replace').addEventListener('click',()=>{fileDestination='replace';$('mkt-slot-file').value='';$('mkt-slot-file').click();});
 $('mkt-slot-file').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;const slot=selected,destination=fileDestination;
  try{const image=await imageFile(f);fotos[slot]=image;edits[slot]=defaults();render();updateButtons();if(destination==='empty')openEditor(slot);else renderEditor();msg(`Foto ${slot+1} carregada. Ajuste o enquadramento como preferir.`);}catch(ex){msg(ex.message);}
 });
 $('mkt-editor-turn').addEventListener('click',()=>{edit().rotate=(edit().rotate+90)%360;renderEditor();});
 $('mkt-restore').addEventListener('click',()=>{edits[selected]=defaults();renderEditor();});
 for(const f of fields)$('mkt-'+f).addEventListener('input',e=>updateEditorControl(f,e.target.value));
 $('mkt-editor-close').addEventListener('click',()=>closeEditor(false));$('mkt-editor-cancel').addEventListener('click',()=>closeEditor(false));$('mkt-editor-apply').addEventListener('click',()=>closeEditor(true));
 modal.addEventListener('click',e=>{if(e.target===modal)closeEditor(false);});
 document.addEventListener('keydown',e=>{if(!editing)return;if(e.key==='Escape'){e.preventDefault();closeEditor(false);}if(e.key==='Tab'){
  const els=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(el=>el.offsetParent!==null),first=els[0],last=els.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }});
 $('mkt-fotos').addEventListener('change',filesInput);
 $('mkt-logo-file').addEventListener('change',async e=>{try{custom=e.target.files?.[0]?await imageFile(e.target.files[0]):null;draw();}catch(ex){msg(ex.message);}});
 $('mkt-layout').addEventListener('change',()=>{refreshOptionalFields();draw();updateButtons();});
 $('mkt-mosaic-count').addEventListener('change',e=>{mosaic=+e.target.value;document.querySelectorAll('[name=mkt-mosaic-choice]').forEach(r=>r.checked=+r.value===mosaic);draw();updateButtons();});
 document.querySelectorAll('[name=mkt-mosaic-choice]').forEach(r=>r.addEventListener('change',e=>{if(!e.target.checked)return;mosaic=+e.target.value;$('mkt-mosaic-count').value=String(mosaic);draw();updateButtons();}));
 const textFields=['mkt-titulo','mkt-subtitulo','mkt-responsavel','mkt-contato','mkt-chamada','mkt-antes','mkt-depois','mkt-servicos','mkt-beneficios'];
 const defaultsText=Object.fromEntries(textFields.map(id=>[id,$(id).value]));
 function refreshOptionalFields(){const n=model().n;$('mkt-mosaic-wrap').hidden=n!==3;$('mkt-before-after-fields').hidden=n!==2;$('mkt-services-field').hidden=n!==5;$('mkt-benefits-field').hidden=n!==6;}
 for(const id of [...textFields,'mkt-logo','mkt-seguranca'])$(id).addEventListener('input',()=>draw());
 document.querySelectorAll('[data-mkt-preset]').forEach(button=>button.addEventListener('click',()=>{
  const mode=button.dataset.mktPreset;
  for(const id of textFields)$(id).value=mode==='complete'?defaultsText[id]:'';
  $('mkt-logo').checked=mode!=='photo';draw();msg(mode==='complete'?'Textos de exemplo restaurados.':'Composição limpa pronta. Você pode adicionar somente os textos desejados.');
 }));
 $('mkt-reset').addEventListener('click',()=>{revision++;fotos.length=0;edits.length=0;$('mkt-fotos').value='';draw();updateButtons();msg('Fotos removidas. Os textos e o modelo foram preservados.');});
 $('mkt-download').addEventListener('click',()=>{if(!fotos.some(Boolean)){msg('Adicione pelo menos uma foto antes de baixar.');return;}try{draw(true);canvas.toBlob(blob=>{if(!blob){msg('Falha ao gerar PNG.');draw();return;}
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Climatize_${model().reels?'Reels':'Feed'}_Modelo_${model().n}${model().n===3?'_'+mosaic+'fotos':''}_${new Date().toISOString().slice(0,10)}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);msg('PNG pronto para download.');draw();},'image/png');}catch(e){msg('Não foi possível gerar o arquivo: '+e.message);}});
 window.addEventListener('climatize:config',e=>{const m=e.detail?.marketing||{},templates=Array.isArray(m.templates)?m.templates:[1,2,3,4,5,6];document.querySelectorAll('#mkt-layout option').forEach(o=>{o.hidden=!templates.includes(+o.value);o.disabled=o.hidden;});
  if(!templates.includes(+$('mkt-layout').value))$('mkt-layout').value=String(templates[0]||1);
  if(m.cta&&$('mkt-chamada').value==='Solicite seu orçamento!')$('mkt-chamada').value=m.cta;
  if(m.name&&$('mkt-responsavel').value==='Allyson Rener')$('mkt-responsavel').value=m.name;
  if(m.phone&&$('mkt-contato').value==='(77) 99877-7658')$('mkt-contato').value=m.phone;
  refreshOptionalFields();draw();updateButtons();});
 refreshOptionalFields();draw();updateButtons();logoLoad();
})();
