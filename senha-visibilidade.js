/* Climatize Beta 1.0 · mostrar/ocultar senha em campos existentes e diálogos dinâmicos. */
(()=>{'use strict';
 let next=0;
 function install(input){
  if(!input || input.closest('.cl-pwd-wrap') || input.dataset.clNoReveal==='true')return;
  const wrap=document.createElement('span');wrap.className='cl-pwd-wrap';
  input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
  if(!input.id)input.id='cl-pwd-field-'+(++next);
  const button=document.createElement('button');button.type='button';button.className='cl-pwd-toggle';
  button.textContent='Mostrar';button.setAttribute('aria-pressed','false');
  button.setAttribute('aria-label','Mostrar senha');button.setAttribute('aria-controls',input.id);
  button.addEventListener('click',()=>{
   const show=input.type==='password';input.type=show?'text':'password';
   button.textContent=show?'Ocultar':'Mostrar';button.setAttribute('aria-pressed',String(show));
   button.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');
  });
  wrap.appendChild(button);
 }
 function scan(root=document){
  if(root.nodeType!==1&&root.nodeType!==9)return;
  if(root.matches?.('input[type="password"]'))install(root);
  root.querySelectorAll?.('input[type="password"]').forEach(install);
 }
 function init(){scan();const observer=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(scan)));observer.observe(document.body,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
