const slides = [...document.querySelectorAll('.slide')];
const dots = [...document.querySelectorAll('.dot')];
let current = 0;
let timer;

function showSlide(index){
  if (!slides.length) return;
  current = index;
  slides.forEach((slide,i)=>slide.classList.toggle('active',i===index));
  dots.forEach((dot,i)=>dot.classList.toggle('active',i===index));
}

dots.forEach(dot=>{
  dot.addEventListener('click',()=>{
    showSlide(Number(dot.dataset.slide));
    restartTimer();
  });
});

function restartTimer(){
  if (!slides.length) return;
  clearInterval(timer);
  timer=setInterval(()=>showSlide((current+1)%slides.length),6500);
}
restartTimer();

function byId(id){ return document.getElementById(id); }

const decreaseFont = byId('decreaseFont');
const normalFont = byId('normalFont');
const increaseFont = byId('increaseFont');
const contrast = byId('contrast');

if (decreaseFont) decreaseFont.addEventListener('click',()=>document.body.style.fontSize='14px');
if (normalFont) normalFont.addEventListener('click',()=>document.body.style.fontSize='');
if (increaseFont) increaseFont.addEventListener('click',()=>document.body.style.fontSize='19px');
if (contrast) contrast.addEventListener('click',()=>document.body.classList.toggle('high-contrast'));

const english = byId('english');
const hindi = byId('hindi');

if (english) english.addEventListener('click',()=>setLanguage('en'));
if (hindi) hindi.addEventListener('click',()=>setLanguage('hi'));

function setLanguage(lang){
  document.querySelectorAll('.lang').forEach(x=>x.classList.remove('active'));
  const selected = byId(lang==='en'?'english':'hindi');
  if (selected) selected.classList.add('active');
  toast(lang==='hi' ? 'Hindi mode selected for the prototype.' : 'English mode selected.');
}

document.querySelectorAll('.service-card').forEach(card=>{
  card.addEventListener('click',()=>toast(card.dataset.message));
});

document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    toast(`${tab.textContent} section selected.`);
  });
});

function toast(message){
  const box=byId('toast');
  if (!box) return;
  box.textContent=message;
  box.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer=setTimeout(()=>box.classList.remove('show'),2200);
}
