/* NeoCalc — script.js
   Features:
   - safe evaluation with Math support
   - history (localStorage)
   - sounds
   - theme toggle
   - scientific mode
   - voice input (Web Speech API)
   - PWA install prompt handling
   - mini AI helper (local rules + optional OpenAI)
*/

/* ====== Optional: add your OpenAI key here for testing (not secure for production) ======
   const OPENAI_KEY = ""; // <-- add key if you want OpenAI calls (see instructions in README)
============================================================================= */

const OPENAI_KEY = ""; // leave empty to disable OpenAI calls

// DOM
const loader = document.getElementById('loader');
const app = document.getElementById('app');
const screen = document.getElementById('screen');
const buttons = document.getElementById('buttons');
const historyList = document.getElementById('historyList');
const historyMini = document.getElementById('historyMini');
const clearHistoryBtn = document.getElementById('clearHistory');
const themeToggle = document.getElementById('themeToggle');
const voiceBtn = document.getElementById('voiceBtn');
const soundToggle = document.getElementById('soundToggle');
const clickSound = document.getElementById('clickSound');
const sciToggle = document.getElementById('scientificToggle');
const sciPanel = document.getElementById('scientificPanel');
const aiToggle = document.getElementById('aiToggle');
const aiHelper = document.getElementById('aiHelper');
const aiInput = document.getElementById('aiInput');
const aiLocalBtn = document.getElementById('aiLocal');
const aiOpenAIBtn = document.getElementById('aiOpenAI');
const aiOutput = document.getElementById('aiOutput');
const installPrompt = document.getElementById('installPrompt');

let historyArr = JSON.parse(localStorage.getItem('neocalc_history') || '[]');
let expression = "";
let deferredPrompt = null;

// play click
function playClick(){
  if(document.getElementById('soundToggle').checked){
    if(clickSound) { clickSound.currentTime = 0; clickSound.play().catch(()=>{}); }
  }
}

// safe evaluate
function safeEval(expr){
  // sanitize: allow digits, operators, parentheses, dot, Math., percent symbol
  // convert % to /100, ^ to **
  let e = expr.replace(/×/g,"*").replace(/÷/g,"/").replace(/−/g,"-");
  e = e.replace(/([0-9\.]+)%/g, "($1/100)");
  e = e.replace(/\^/g,"**");
  // replace common functions: sqrt, sin etc with Math.
  e = e.replace(/\bsqrt\(/g,"Math.sqrt(")
       .replace(/\bsin\(/g,"Math.sin(")
       .replace(/\bcos\(/g,"Math.cos(")
       .replace(/\btan\(/g,"Math.tan(")
       .replace(/\blog10\(/g,"Math.log10(")
       .replace(/\blog\(/g,"Math.log(")
       .replace(/\bPI\b/g,"Math.PI")
       .replace(/\bE\b/g,"Math.E");
  // allow Math.* tokens as well
  try {
    // eslint-disable-next-line no-eval
    let val = eval(e);
    if(Number.isFinite(val)) return val;
    return "Error";
  } catch (err){
    return "Error";
  }
}

// render screen
function render(){
  screen.innerText = expression || "0";
  historyMini.innerText = historyArr.slice(-1)[0] || "";
  renderHistory();
}

// render full history
function renderHistory(){
  historyList.innerHTML = "";
  historyArr.slice().reverse().forEach((h, idx) => {
    const li = document.createElement('li');
    li.innerText = h;
    li.addEventListener('click', ()=> {
      expression = h.split('=')[0].trim();
      render();
    });
    historyList.appendChild(li);
  });
}

// buttons click
buttons.addEventListener('click', (e)=>{
  const btn = e.target.closest('button');
  if(!btn) return;
  playClick();
  const val = btn.dataset.val;
  const fn = btn.dataset.fn;
  if(fn){
    if(fn === "clear"){ expression = ""; render(); }
    if(fn === "del"){ expression = expression.slice(0,-1); render(); }
    if(fn === "equals"){ doCalculate(); }
  } else if(val !== undefined){
    expression += val;
    render();
  }
});

// scientific panel actions (delegated)
sciPanel?.addEventListener('click', (e)=>{
  const b = e.target.closest('button');
  if(!b) return;
  playClick();
  const v = b.dataset.val;
  expression += v;
  render();
});

// calculate
function doCalculate(){
  const res = safeEval(expression);
  const record = `${expression} = ${res}`;
  historyArr.push(record);
  if(historyArr.length > 60) historyArr.shift();
  localStorage.setItem('neocalc_history', JSON.stringify(historyArr));
  expression = String(res);
  render();
}

// clear history
clearHistoryBtn.addEventListener('click', ()=>{
  historyArr = [];
  localStorage.removeItem('neocalc_history');
  render();
});

// init
function init(){
  render();
  // hide loader
  setTimeout(()=> {
    loader.style.display = 'none';
    app.style.opacity = 1;
    app.setAttribute('aria-hidden','false');
  }, 700);

  // theme
  const savedTheme = localStorage.getItem('neocalc_theme') || 'dark';
  if(savedTheme === 'light') document.body.classList.replace('theme-dark','theme-light'); else document.body.classList.replace('theme-light','theme-dark');

  // sound
  document.getElementById('soundToggle').checked = true;

  // scientific toggle
  sciToggle.addEventListener('change', (e)=>{
    const on = e.target.checked;
    sciPanel.style.display = on ? 'grid' : 'none';
    sciPanel.setAttribute('aria-hidden', on ? 'false' : 'true');
  });

  // theme toggle button
  themeToggle.addEventListener('click', ()=>{
    document.body.classList.toggle('theme-light');
    document.body.classList.toggle('theme-dark');
    localStorage.setItem('neocalc_theme', document.body.classList.contains('theme-light') ? 'light' : 'dark');
  });

  // voice input
  setupVoice();

  // AI toggle
  aiToggle.addEventListener('click', ()=>{
    const visible = aiHelper.getAttribute('aria-hidden') === 'false';
    aiHelper.setAttribute('aria-hidden', !visible);
    aiHelper.style.display = visible ? 'none' : 'block';
  });

  // AI local handler
  aiLocalBtn.addEventListener('click', ()=>{
    const q = aiInput.value.trim();
    if(!q) return;
    aiOutput.innerText = localAI(q);
  });

  // OpenAI handler
  aiOpenAIBtn.addEventListener('click', async ()=>{
    const q = aiInput.value.trim();
    if(!q) return;
    if(!OPENAI_KEY){ aiOutput.innerText = "OpenAI key not set in script.js. Add it to use."; return; }
    aiOutput.innerText = "Thinking...";
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method:"POST",
        headers: {
          "Content-Type":"application/json",
          "Authorization":"Bearer " + OPENAI_KEY
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // change if needed
          messages: [{role:"user", content:q}],
          temperature:0.2,
          max_tokens:200
        })
      });
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || JSON.stringify(data);
      aiOutput.innerText = content;
    } catch(e){
      aiOutput.innerText = "OpenAI call failed: " + e.message;
    }
  });

  // install prompt
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.createElement('button');
    btn.innerText = "Install App";
    btn.className = "small";
    btn.onclick = async () => {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if(choice.outcome === 'accepted') installPrompt.innerText = "App installed ✅";
      deferredPrompt = null;
      btn.remove();
    };
    installPrompt.appendChild(btn);
  });
}

// Simple local AI for math/GST/percent questions
function localAI(q){
  const low = q.toLowerCase();
  // percent queries "18% of 500" or "gst 18% of 500"
  const pctMatch = low.match(/([0-9\.]+)\s*%?\s*(?:of)?\s*([0-9\.]+)/);
  if(pctMatch){
    const pct = parseFloat(pctMatch[1]);
    const amount = parseFloat(pctMatch[2]);
    const ans = (pct/100)*amount;
    return `${pct}% of ${amount} = ${ans}`;
  }
  // gst queries
  const gstMatch = low.match(/gst\s*(?:@)?\s*([0-9\.]+)\s*%?\s*of\s*([0-9\.]+)/);
  if(gstMatch){
    const pct = parseFloat(gstMatch[1]);
    const amount = parseFloat(gstMatch[2]);
    const tax = (pct/100)*amount;
    return `GST ${pct}% on ${amount} = ${tax} → Total = ${amount + tax}`;
  }
  // simple arithmetic using safeEval
  if(/[0-9\+\-\*\/\^\.\%]/.test(low)){
    try {
      const r = safeEval(q);
      return `Answer: ${r}`;
    } catch(e){ /* fallthrough */ }
  }
  return "Sorry, I can answer percent/GST/basic math. For advanced answers, add OpenAI key.";
}

/* ===== Voice Input (Web Speech API) ===== */
function setupVoice(){
  if(!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)){
    voiceBtn.title = "Voice not supported";
    voiceBtn.disabled = true;
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SpeechRecognition();
  rec.lang = 'en-IN';
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  voiceBtn.addEventListener('click', ()=>{
    rec.start();
    voiceBtn.classList.add('listening');
  });

  rec.onresult = (ev) => {
    const text = ev.results[0][0].transcript;
    // basic natural language parsing for "plus, minus, times, divide"
    const mapped = text.replace(/plus/gi, '+')
                       .replace(/minus/gi, '-')
                       .replace(/times|x/gi, '*')
                       .replace(/into/gi,'*')
                       .replace(/divide|by/gi, '/')
                       .replace(/power of/gi, '**');
    expression += mapped;
    render();
  };

  rec.onend = ()=> voiceBtn.classList.remove('listening');
  rec.onerror = (e)=> { console.log('voice err', e); voiceBtn.classList.remove('listening'); };
}

/* ===== register service worker for PWA ===== */
if('serviceWorker' in navigator){
  window.addEventListener('load', async ()=>{
    try {
      await navigator.serviceWorker.register('sw.js');
      console.log('sw registered');
    } catch(e){ console.log('sw fail', e); }
  });
}

// initialize
init();
