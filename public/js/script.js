const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
let photoList = [];
let currentPhoto = 0;
let messageData = {};
let typeTimer;
let poppedCount = 0;

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    let detail = 'Something went wrong.';
    try { detail = (await response.json()).error || detail; } catch {}
    throw new Error(detail);
  }
  return response.status === 204 ? null : response.json();
}

async function loadMessage() {
  try {
    messageData = await api('/api/message');
    $('#heroName').textContent = messageData.name;
    $('#letterHeading').textContent = messageData.heading;
    document.title = `Happy Birthday, ${messageData.name}!`;
  } catch { showToast('Message could not be loaded.'); }
}

const fxCanvas = $('#fxCanvas');
const ctx = fxCanvas.getContext('2d');
let particles = [];
function resizeCanvas() { fxCanvas.width = innerWidth; fxCanvas.height = innerHeight; }
resizeCanvas(); addEventListener('resize', resizeCanvas);
function burst(x, y, count = 40, colors = ['#ec5d91','#f1c875','#b99bea','#fff','#ff9db5']) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < count; i++) particles.push({x,y,vx:(Math.random()-0.5)*12,vy:(Math.random()-0.9)*12,size:4+Math.random()*7,color:colors[i%colors.length],life:1,shape:Math.random()>.5?'rect':'circle'});
}
function animateParticles() {
  ctx.clearRect(0,0,fxCanvas.width,fxCanvas.height);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) { p.x+=p.vx; p.y+=p.vy; p.vy+=.12; p.life-=.018; ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=p.color; ctx.beginPath(); if(p.shape==='circle')ctx.arc(p.x,p.y,p.size/2,0,Math.PI*2); else ctx.rect(p.x,p.y,p.size,p.size*.55); ctx.fill(); }
  ctx.globalAlpha=1; requestAnimationFrame(animateParticles);
}
animateParticles();

function showToast(text) { const el=$('#balloonMessage'); el.textContent=text; el.classList.add('show'); clearTimeout(el.timer); el.timer=setTimeout(()=>el.classList.remove('show'),2800); }
const wishes=['May every wish today find its way to you.','Your smile makes every room brighter.','Here is to laughter, love, and beautiful new memories.','You deserve a year as wonderful as you are.','Keep shining in your own beautiful way.','Today is proof that the world is better with you in it.'];
function releaseBalloons(amount=8) {
  const field=$('#balloonField'); const colors=['#ef709b','#9b7bc4','#f0b852','#7fc7b4','#d66b75','#9aa7dc'];
  for(let i=0;i<amount;i++){
    const balloon=document.createElement('button'); balloon.className='balloon'; balloon.setAttribute('aria-label','Pop birthday balloon');
    balloon.classList.add('balloon-released');
    const safeLeft = innerWidth < 700 ? 8 + Math.random()*78 : 8 + Math.random()*84;
    balloon.style.left=`${safeLeft}%`;
    balloon.style.bottom=`${65 + Math.random()*75}px`;
    balloon.style.background=colors[i%colors.length];
    balloon.style.width=`${innerWidth < 700 ? 54 : 58+Math.random()*18}px`;
    balloon.style.height=`${innerWidth < 700 ? 68 : 72+Math.random()*16}px`;
    balloon.style.setProperty('--drift',`${-100+Math.random()*200}px`);
    balloon.style.animationDelay=`${i*.12}s`;
    balloon.addEventListener('click',()=>popBalloon(balloon)); field.appendChild(balloon);
  }
}
function popBalloon(balloon){ if(balloon.classList.contains('pop'))return; balloon.classList.add('pop'); const rect=balloon.getBoundingClientRect(); burst(rect.left+rect.width/2,rect.top+rect.height/2,35); const wish=wishes[Math.floor(Math.random()*wishes.length)]; poppedCount++; $('#popCount').textContent=poppedCount; const wishCard=document.querySelector('.wish-card'); wishCard.classList.remove('wish-updated'); void wishCard.offsetWidth; $('#balloonMessage').textContent=wish; wishCard.classList.add('wish-updated'); showToast(wish); setTimeout(()=>balloon.remove(),350); }

$('#openSurprise').addEventListener('click',()=>{
  $('#welcome').classList.add('opening'); setTimeout(()=>{$('#welcome').style.display='none';$('#surprise').classList.remove('hidden');releaseBalloons(12);window.scrollTo(0,0);},700);
  burst(innerWidth/2,innerHeight*.35,140);
});
$('#releaseBalloons').addEventListener('click',()=>releaseBalloons(10));
$('#replayBtn').addEventListener('click',()=>{window.scrollTo({top:0,behavior:'smooth'});$('#wishBtn').click();});

async function loadPhotos(){try{photoList=await api('/api/photos');renderGallery();}catch{showToast('Gallery could not be loaded.');}}
function renderGallery(){
  const gallery=$('#gallery');gallery.innerHTML='';$('#galleryEmpty').style.display=photoList.length?'none':'block';
  photoList.forEach((photo,index)=>{const card=document.createElement('figure');card.className='photo-card';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`Open photo: ${photo.caption||'Birthday memory'}`);card.innerHTML=`<img src="${photo.url}" alt="${escapeHtml(photo.caption||'Birthday memory')}" loading="lazy"><figcaption>${escapeHtml(photo.caption||'Birthday memory')}</figcaption><button class="delete-photo" type="button" aria-label="Remove photo"><span aria-hidden="true">×</span><span>Remove photo</span></button>`;const image=card.querySelector('img');image.addEventListener('load',()=>{const ratio=image.naturalWidth/image.naturalHeight;card.classList.remove('photo-portrait','photo-square','photo-landscape');card.classList.add(ratio>.1&&ratio<.9?'photo-portrait':ratio>=.9&&ratio<=1.1?'photo-square':'photo-landscape');});image.addEventListener('error',()=>{card.classList.add('photo-missing');image.alt='Photo preview unavailable';});const openPhoto=()=>{showGalleryWish(photo.caption);openLightbox(index);};image.addEventListener('click',openPhoto);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')openPhoto()});card.querySelector('.delete-photo').addEventListener('click',async e=>{e.stopPropagation();if(!confirm('Delete this photo?'))return;try{await api(`/api/photos/${photo.id}`,{method:'DELETE'});await loadPhotos();}catch(error){showToast(error.message)}});gallery.appendChild(card);});
}
function escapeHtml(value){const div=document.createElement('div');div.textContent=value;return div.innerHTML;}
const galleryMemoryWishes=['A beautiful memory worth celebrating.','This moment deserves another happy smile.','Your happiest memories are still waiting to happen.','Every picture tells a little piece of your story.','Today is another page in a beautiful life.'];
function showGalleryWish(caption){const banner=$('#galleryWish');if(!banner)return;const message=caption?.trim()||galleryMemoryWishes[Math.floor(Math.random()*galleryMemoryWishes.length)];banner.querySelector('p').textContent=message;banner.classList.remove('wish-visible','wish-pop');void banner.offsetWidth;banner.classList.add('wish-visible','wish-pop');burst(innerWidth*.5,innerHeight*.6,24,['#ec5d91','#f1c875','#b99bea','#ffffff']);}
const galleryObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){showGalleryWish('Every memory here is a reason to smile today.');galleryObserver.disconnect();}});},{threshold:.28});
const gallerySection=$('#gallerySection');if(gallerySection)galleryObserver.observe(gallerySection);
for(let slot=1;slot<=3;slot++){
  $(`#photoInput${slot}`).addEventListener('change',event=>{
    const file=event.target.files[0]; if(!file)return;
    const preview=$(`#photoPreview${slot}`); const label=$(`#photoPreview${slot}`).nextElementSibling;
    if(preview._objectUrl)URL.revokeObjectURL(preview._objectUrl);
    preview._objectUrl=URL.createObjectURL(file); preview.src=preview._objectUrl; preview.classList.add('has-preview'); preview.style.objectFit='contain'; if(label) label.textContent='Change photo';
  });
}
$('#uploadForm').addEventListener('submit',async event=>{
  event.preventDefault(); let uploaded=0;
  for(let slot=1;slot<=3;slot++){
    const file=$(`#photoInput${slot}`).files[0]; if(!file)continue;
    const form=new FormData(); form.append('photo',file); form.append('caption',$(`#captionInput${slot}`).value);
    try{await api('/api/photos',{method:'POST',body:form});uploaded++;}
    catch(error){showToast(error.message);return;}
  }
  if(!uploaded){showToast('Choose at least one photo first.');return;}
  event.target.reset();
  for(let slot=1;slot<=3;slot++){const preview=$(`#photoPreview${slot}`);preview.removeAttribute('src');preview.classList.remove('has-preview');const label=preview.nextElementSibling;if(label)label.textContent=`Choose photo ${slot}`;}
  await loadPhotos(); showToast(`${uploaded} photo${uploaded===1?'':'s'} added to your memories.`);
});
function openLightbox(index){currentPhoto=(index+photoList.length)%photoList.length;const photo=photoList[currentPhoto];$('#lightboxImage').src=photo.url;$('#lightboxCaption').textContent=photo.caption||'';$('#lightbox').classList.add('open');}
$('#closeLightbox').addEventListener('click',()=>$('#lightbox').classList.remove('open'));$('#prevPhoto').addEventListener('click',()=>openLightbox(currentPhoto-1));$('#nextPhoto').addEventListener('click',()=>openLightbox(currentPhoto+1));$('#lightbox').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('open')});addEventListener('keydown',e=>{if(e.key==='Escape')$('#lightbox').classList.remove('open');if(e.key==='ArrowLeft'&&photoList.length)openLightbox(currentPhoto-1);if(e.key==='ArrowRight'&&photoList.length)openLightbox(currentPhoto+1);});

const envelope=$('#envelope');let letterOpened=false;function openEnvelope(){if(letterOpened)return;letterOpened=true;envelope.classList.add('open');clearInterval(typeTimer);let index=0;const text=messageData.message||'Happy Birthday! May your special day be filled with joy, love, and beautiful moments.';$('#letterText').textContent='';typeTimer=setInterval(()=>{$('#letterText').textContent=text.slice(0,++index);if(index>=text.length){clearInterval(typeTimer);}},25);burst(innerWidth*.5,innerHeight*.62,35,['#ec5d91','#fff','#f1c875','#b99bea']);}
envelope.addEventListener('click',openEnvelope);envelope.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')openEnvelope()});$('#completeMessage').addEventListener('click',e=>{e.stopPropagation();openEnvelope();clearInterval(typeTimer);$('#letterText').textContent=messageData.message||'';});

const wishBtn=$('#wishBtn');wishBtn.addEventListener('click',()=>{const out=$('#candles').classList.toggle('out');if(out){$('#wishMessage').textContent='Your wish is on its way...';wishBtn.textContent='Light Candles Again 🕯️';burst(innerWidth*.5,innerHeight*.82,160);}else{$('#wishMessage').textContent='The candles are glowing again!';wishBtn.textContent='Make a Wish ✨';}});
const gift=$('#gift');function openGift(){gift.classList.add('open');$('#giftReveal').classList.remove('hidden');const rect=gift.getBoundingClientRect();burst(rect.left+rect.width/2,rect.top+rect.height/2,180);setTimeout(()=>$('#giftReveal').scrollIntoView({behavior:'smooth',block:'center'}),300);}gift.addEventListener('click',()=>{if(!gift.classList.contains('open'))openGift()});gift.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')openGift()});$('#replayGift').addEventListener('click',()=>{gift.classList.remove('open');$('#giftReveal').classList.add('hidden');setTimeout(openGift,500)});

const audio=$('#audio');const musicToggle=$('#musicToggle');audio.volume=.5;musicToggle.addEventListener('click',async()=>{try{if(audio.paused){await audio.play();musicToggle.textContent='Ⅱ';$('#musicPlayer').classList.add('playing');musicToggle.setAttribute('aria-label','Pause music');}else{audio.pause();musicToggle.textContent='▶';$('#musicPlayer').classList.remove('playing');musicToggle.setAttribute('aria-label','Play music');}}catch{showToast('Add your own audio file to enable music.')}});$('#volume').addEventListener('input',e=>audio.volume=e.target.value);audio.addEventListener('loadedmetadata',()=>updateTime());audio.addEventListener('timeupdate',()=>{if(audio.duration){$('#musicProgress').value=audio.currentTime/audio.duration*100;updateTime();}});audio.addEventListener('ended',()=>{musicToggle.textContent='▶';$('#musicPlayer').classList.remove('playing')});$('#musicProgress').addEventListener('input',e=>{if(audio.duration)audio.currentTime=e.target.value/100*audio.duration});function updateTime(){const format=s=>Number.isFinite(s)?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:'0:00';$('#musicTime').textContent=`${format(audio.currentTime)} / ${format(audio.duration)}`;}
$('#celebrateBtn').addEventListener('click',()=>{document.documentElement.requestFullscreen?.().catch(()=>{});burst(innerWidth/2,innerHeight/2,180);releaseBalloons(6);});

loadMessage();loadPhotos();releaseBalloons(4);
