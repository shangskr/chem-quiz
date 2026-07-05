var questions=[],quiz=[],answers=[],answered=[],currentIdx=0,mode='random',finished=false,seqStartQid=0,saveId=null,quizLabel='';
var flagged=[],fontSize=localStorage.getItem('chem_font_size')||'medium',examTimer=null,examTimeLeft=0;
var LOCAL_KEY='chem_local_data';
var passphrase='',savedData=null;

function showAlert(msg){
  var wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;top:0;left:0;width:100%;display:flex;justify-content:center;pointer-events:none;z-index:9999';
  var el=document.createElement('div');
  el.textContent=msg;
  el.style.cssText='margin-top:20px;background:var(--card);color:var(--text);padding:10px 24px;border-radius:8px;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,.15);border:1px solid var(--border);max-width:80vw;text-align:center;opacity:0;transition:opacity .25s';
  wrap.appendChild(el);
  document.body.appendChild(wrap);
  requestAnimationFrame(function(){el.style.opacity='1'});
  setTimeout(function(){el.style.opacity='0';setTimeout(function(){if(wrap.parentNode)wrap.parentNode.removeChild(wrap)},250)},2000)
}

function showConfirm(msg){
  return new Promise(function(resolve){
    var overlay=document.createElement('div');overlay.className='modal-overlay';
    overlay.innerHTML='<div class="modal-box"><div class="modal-msg">'+escBr(msg)+'</div><div class="modal-acts"><button class="btn btn-outline" id="modalNo">取消</button><button class="btn btn-primary" id="modalYes">确定</button></div></div>';
    document.body.appendChild(overlay);
    document.getElementById('modalYes').onclick=function(){document.body.removeChild(overlay);resolve(true)};
    document.getElementById('modalNo').onclick=function(){document.body.removeChild(overlay);resolve(false)};
    overlay.onclick=function(e){if(e.target===overlay){document.body.removeChild(overlay);resolve(false)}}
  })
}

function escBr(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}

function onPassphraseChange(){
  document.getElementById('keyMsg').textContent='输入口令后点击"加载"同步进度'
}

async function loadProgress(){
  var p=document.getElementById('passphrase').value.trim();
  if(!p){await showAlert('请输入口令');return}
  passphrase=p;
  var el=document.getElementById('keyMsg');el.textContent='同步中…';
  try{
    var r=await fetch('/api/progress?passphrase='+encodeURIComponent(passphrase));
    var j=await r.json();
    if(j.data){savedData=j.data;localStorage.setItem(LOCAL_KEY,JSON.stringify(savedData));applyTheme();renderSavedList();renderStats()
      el.textContent='✓ 同步成功，共 '+savedData.saves.length+' 个保存的进度'}
    else{savedData={passphrase:passphrase,saves:[],theme:'light',stats:{random:{judge:{total:0,correct:0},single:{total:0,correct:0},multi:{total:0,correct:0}},seq:{judge:{total:0,correct:0},single:{total:0,correct:0},multi:{total:0,correct:0}},exam:{judge:{total:0,correct:0},single:{total:0,correct:0},multi:{total:0,correct:0}}}};renderSavedList();renderStats()
      el.textContent='✓ 已创建新进度，现在可以开始答题了'}
    document.getElementById('resetBtn').style.display=''
  }catch(e){el.textContent='✗ 同步失败：'+e.message;savedData=null}
}

async function clearFlags(){
  if(!savedData||!savedData.flaggedQids||!savedData.flaggedQids.length)return;
  if(!(await showConfirm('确定清除所有标记的题目吗？')))return;
  savedData.flaggedQids=[];
  await syncCloud();renderStats();showAlert('已清除所有标记')
}

async function clearCache(){
  if(!(await showConfirm('确定清除本地缓存吗？\n将清除答题进度、学习统计和主题设置，错题本保留。')))return;
  quiz=[];stopTimer();
  if(!savedData)savedData={passphrase:passphrase||'',saves:[],theme:'light'};
  savedData.saves=[];savedData.stats={random:{judge:{total:0,correct:0},single:{total:0,correct:0},multi:{total:0,correct:0}},seq:{judge:{total:0,correct:0},single:{total:0,correct:0},multi:{total:0,correct:0}},exam:{judge:{total:0,correct:0},single:{total:0,correct:0},multi:{total:0,correct:0}}};
  localStorage.removeItem('chem_theme');localStorage.removeItem('chem_font_size');
  setFontSize('medium');applyTheme();
  localStorage.setItem(LOCAL_KEY,JSON.stringify(savedData));
  document.getElementById('passphrase').value='';
  renderSavedList();renderStats();
  showAlert('本地答题进度和统计已清除')
}

function showHelp(){
  var overlay=document.createElement('div');overlay.className='modal-overlay';
  overlay.innerHTML='<div class="modal-box" style="max-width:440px"><div class="modal-msg"><b>缓存与同步机制</b></div><div style="font-size:13px;line-height:1.8;margin-bottom:18px;color:var(--text)"><b>清除缓存</b>：清除本地答题进度、学习统计、主题和字号设置。<br>保留：错题本标记、口令缓存。<br><br><b>清除标记</b>：仅清除错题本中的标记题目。<br><br><b>口令同步机制</b>：<br>· 每选一题自动保存到本地<br>· 退出答题或交卷时同步到云端<br>· 加载口令时从服务端拉取最新数据<br><br><b>口令用户</b>：<br>· 清除缓存仅影响本地，云端不受影响<br>· 清除标记同步清除云端标记<br>· 学习统计要点击统计面板下方"清除云端统计"按钮删除<br>· 进度列表右侧"删除"可删除单条云端进度<br>· 口令行"重置"清除所有本地+云端数据并退出登录<br><br><b>普通用户</b>：<br>· 所有数据仅保存在本地浏览器<br>· 清除缓存后不可恢复</div><div class="modal-acts"><button class="btn btn-primary" id="helpOk">知道了</button></div></div>';
  document.body.appendChild(overlay);
  document.getElementById('helpOk').onclick=function(){document.body.removeChild(overlay)};
  overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay)}
}

var adminKey=localStorage.getItem('chem_admin_key')||'';

function adminLogout(){
  adminKey='';localStorage.removeItem('chem_admin_key')
}

function renderAdminStats(stats,container,mode){
  var s=stats||{};
  if(s.judge){s.exam={judge:s.judge,single:s.single,multi:s.multi};delete s.judge;delete s.single;delete s.multi}
  var modes=[{key:'random',label:'刷题模式'},{key:'seq',label:'顺序模式'},{key:'exam',label:'考试模式'}];
  var types=[{key:'judge',label:'判断题'},{key:'single',label:'单选题'},{key:'multi',label:'多选题'}];
  var cur=mode||container._statMode||Object.keys(s).find(function(k){return modes.some(function(m){return m.key===k})})||'random';
  container._statMode=cur;
  if(!s[cur])cur='random';
  var data=s[cur]||{};
  var total=0,correct=0;
  types.forEach(function(t){var d=data[t.key]||{total:0,correct:0};total+=d.total;correct+=d.correct});
  var opct=total?(correct/total*100).toFixed(1):'-';
  var h='<div class="stat-tabs" style="border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:8px">';
  modes.forEach(function(m){
    var cnt=0;types.forEach(function(t){var d=(s[m.key]||{})[t.key]||{total:0,correct:0};cnt+=d.total});
    h+='<div class="stat-tab'+(cur===m.key?' active':'')+'" style="cursor:pointer;padding:4px 10px;font-size:13px;border-radius:4px;display:inline-block;'+(cur===m.key?'background:var(--primary);color:#fff':'color:var(--text)')+'" onclick="renderAdminStats('+JSON.stringify(stats).replace(/"/g,'&quot;')+',this.parentElement.parentElement,this.getAttribute(\'data-mode\'))" data-mode="'+m.key+'">'+m.label+(cnt?' <span style="opacity:.7">('+cnt+')</span>':'')+'</div>'
  });
  h+='</div>';
  if(!total){container.innerHTML=h+'<div style="font-size:13px;color:var(--text2);text-align:center;padding:8px 0">暂无数据</div>';return}
  h+='<div style="display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap">';
  h+='<div style="text-align:center;padding:6px 14px;background:var(--bg);border-radius:7px;border:1px solid var(--border);min-width:64px"><div style="font-size:18px;font-weight:700;color:var(--primary)">'+total+'</div><div style="font-size:12px;color:var(--text2)">总答题</div></div>';
  h+='<div style="text-align:center;padding:6px 14px;background:var(--bg);border-radius:7px;border:1px solid var(--border);min-width:64px"><div style="font-size:18px;font-weight:700;color:var(--correct)">'+correct+'</div><div style="font-size:12px;color:var(--text2)">正确</div></div>';
  h+='<div style="text-align:center;padding:6px 14px;background:var(--bg);border-radius:7px;border:1px solid var(--border);min-width:64px"><div style="font-size:18px;font-weight:700;color:var(--wrong)">'+(total-correct)+'</div><div style="font-size:12px;color:var(--text2)">错误</div></div>';
  h+='<div style="text-align:center;padding:6px 14px;background:var(--bg);border-radius:7px;border:1px solid var(--border);min-width:64px"><div style="font-size:18px;font-weight:700;color:var(--primary)">'+opct+'%</div><div style="font-size:12px;color:var(--text2)">正确率</div></div>';
  h+='</div>';
  types.forEach(function(t){
    var d=data[t.key]||{total:0,correct:0},pct=d.total?(d.correct/d.total*100).toFixed(1):'-';
    var barW=d.total?Math.round(d.correct/d.total*100):0,barC=barW>=80?'var(--correct)':barW>=60?'var(--primary)':'var(--wrong)';
    h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;font-size:13px">';
    h+='<span style="min-width:52px;color:var(--text2)">'+t.label+'</span>';
    h+='<div style="flex:1;height:8px;background:var(--bar-bg);border-radius:4px;overflow:hidden"><div style="width:'+barW+'%;height:100%;background:'+barC+';border-radius:4px;transition:width .3s"></div></div>';
    h+='<span style="min-width:60px;text-align:right;color:var(--text)"><b>'+pct+'%</b> ('+d.correct+'/'+d.total+')</span></div>'
  });
  container.innerHTML=h
}

function showAdmin(){
  var overlay=document.createElement('div');overlay.className='modal-overlay';
  overlay.innerHTML='<div class="modal-box" style="max-width:780px;width:92vw"><div class="modal-msg">管理员面板</div><div style="margin-bottom:12px;display:flex;gap:8px"><input type="password" id="adminKeyInput" placeholder="输入 ADMIN_KEY" style="flex:1;padding:8px 12px;border:1.5px solid var(--border);border-radius:6px;font-size:14px;background:var(--input-bg);color:var(--text);outline:none;box-sizing:border-box"><button class="btn btn-sm btn-del" id="adminLogoutBtn" style="display:none" onclick="adminLogout();document.getElementById(\'adminKeyInput\').value=\'\';document.getElementById(\'adminLogoutBtn\').style.display=\'none\';document.getElementById(\'adminUserList\').innerHTML=\'\'">退出</button></div><div id="adminUserList" style="max-height:65vh;overflow-y:auto;font-size:13px"></div><div class="modal-acts"><button class="btn btn-primary" id="adminLogin">登录</button><button class="btn btn-outline" id="adminCancel">关闭</button></div></div>';
  document.body.appendChild(overlay);
  var input=document.getElementById('adminKeyInput');
  var listEl=document.getElementById('adminUserList');
  document.getElementById('adminCancel').onclick=function(){document.body.removeChild(overlay)};
  document.getElementById('adminLogin').onclick=function(){input.onkeydown({key:'Enter'})};
  overlay.onclick=function(e){if(e.target===overlay)document.body.removeChild(overlay)};
  if(adminKey){input.value=adminKey;document.getElementById('adminLogoutBtn').style.display=''}
  input.onkeydown=async function(e){
    if(e.key!=='Enter')return;
    var key=input.value.trim();
    if(!key)return;
    input.disabled=true;listEl.innerHTML='<div style="color:var(--text2);padding:12px;text-align:center">加载中…</div>';
    try{
      var r=await fetch('/api/admin?key='+encodeURIComponent(key));
      var j=await r.json();
      if(!r.ok){listEl.innerHTML='<div style="color:var(--wrong);padding:12px">'+(j.error==='Forbidden'?'密钥错误':j.error||'加载失败')+'</div>';input.disabled=false;return}
      adminKey=key;localStorage.setItem('chem_admin_key',key);document.getElementById('adminLogoutBtn').style.display='';
      if(!j.users||!j.users.length){listEl.innerHTML='<div style="color:var(--text2);padding:12px;text-align:center">暂无用户数据</div>';input.disabled=false;return}
      var html='';
      j.users.forEach(function(u,ui){
        var saves=u.saves||0,flagged=u.flagged||0;
        var statStr=document.createElement('div');
        renderAdminStats(u.stats,statStr);
        html+='<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;overflow:hidden;background:var(--card)">';
        html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;cursor:pointer;user-select:none" onclick="var n=this.nextElementSibling;if(n.style.display===\'none\'){n.style.display=\'\'}else{n.style.display=\'none\'};this.querySelector(\'.admin-arrow\').textContent=n.style.display===\'none\'?\'\u25BC\':\'\u25B2\'">';
        html+='<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><strong style="font-size:14px">'+escHtml(u.passphrase)+'</strong><span style="font-size:12px;color:var(--text2)">进度 '+saves+'</span>'+(flagged?'<span style="font-size:12px;color:var(--wrong)">标记 '+flagged+'</span>':'')+'</div>';
        html+='<div style="display:flex;gap:6px;align-items:center"><button class="btn btn-sm btn-del" style="font-size:11px;padding:3px 10px;min-height:auto" onclick="event.stopPropagation();adminDeleteUser(\''+u.id+'\')">删除</button><span class="admin-arrow" style="font-size:12px;color:var(--text2);margin-left:4px">&#9660;</span></div></div>';
        html+='<div style="display:none;padding:12px 14px;border-top:1px solid var(--border);background:var(--bg)" id="adminStats_'+ui+'">'+statStr.innerHTML+'</div></div>'
      });
      listEl.innerHTML=html;
    }catch(e){listEl.innerHTML='<div style="color:var(--wrong);padding:12px">请求失败：'+e.message+'</div>'}
    input.disabled=false
  };
  input.focus()
}

async function adminDeleteUser(id){
  if(!(await showConfirm('确定删除该用户的所有数据吗？')))return;
  try{
    var input=document.getElementById('adminKeyInput');
    var r=await fetch('/api/admin?key='+encodeURIComponent(input.value.trim())+'&id='+encodeURIComponent(id),{method:'DELETE'});
    var j=await r.json();
    if(r.ok){showAlert('已删除');input.onkeydown({key:'Enter'})}
    else showAlert(j.error||'删除失败')
  }catch(e){showAlert('删除失败：'+e.message)}
}

function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

async function resetPassphrase(){
  if(!passphrase||!savedData)return;
  if(!(await showConfirm('确定要清除【'+passphrase+'】下的所有进度吗？\n此操作不可撤销。')))return;
  if(!(await showConfirm('再次确认：所有答题记录将被永久删除。')))return;
  try{
    await fetch('/api/progress?passphrase='+encodeURIComponent(passphrase),{method:'DELETE'});
    savedData=null;passphrase='';
    document.getElementById('passphrase').value='';
    document.getElementById('resetBtn').style.display='none';
    document.getElementById('keyMsg').textContent='已重置，可以输入新口令重新开始';
    localStorage.removeItem('chem_passphrase');
    renderSavedList()
  }catch(e){showAlert('重置失败：'+e.message)}
}

async function apiSave(){
  if(!passphrase||!savedData)return;
  var cloudData={passphrase:passphrase,data:{passphrase:savedData.passphrase,saves:savedData.saves,flaggedQids:savedData.flaggedQids||[],theme:savedData.theme||'light',stats:savedData.stats||{}}};
  try{await fetch('/api/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cloudData)})}catch(e){}
}

async function apiDelete(keyId){
  if(!passphrase||!savedData)return;
  savedData.saves=savedData.saves.filter(function(e){return e.id!==keyId});
  await apiSave();renderSavedList()
}

function toggleNav(){
  var g=document.getElementById('navigator'),t=document.getElementById('navArrow');
  g.classList.toggle('show');
  t.textContent=g.classList.contains('show')?'▲':'▼'
}

function renderNav(){
  var el=document.getElementById('navigator');
  if(!quiz.length){el.classList.remove('show');return}
  var h='';
  quiz.forEach(function(q,i){
    var cls='nav-dot';
    if(i===currentIdx)cls+=' current';
    var icon='';
    if(finished){
      if(checkAns(i)){cls+=' correct';icon='\u2713'}
      else{cls+=' wrong';icon='\u2717'}
    }else if(mode==='exam'){if(Array.isArray(answers[i])?answers[i].length>0:answers[i]!=='')cls+=' answered'}else if(answered[i]){
      if(checkAns(i)){cls+=' correct';icon='\u2713'}
      else{cls+=' wrong';icon='\u2717'}
    }
    if(flagged[i])cls+=' flagged';
    h+='<div class="'+cls+'" onclick="goToQuestion('+i+')">'+icon+(flagged[i]?'\u2691':'')+(i+1)+'</div>'
  });
  el.innerHTML=h
}

function goToQuestion(idx){
  if(idx<0||idx>=quiz.length)return;
  currentIdx=idx;showQuestion()
}

function toggleFlag(){
  if(!quiz.length||finished)return;
  flagged[currentIdx]=!flagged[currentIdx];
  if(savedData){
    if(!savedData.flaggedQids)savedData.flaggedQids=[];
    var qid=quiz[currentIdx].id;
    if(flagged[currentIdx]){if(savedData.flaggedQids.indexOf(qid)===-1)savedData.flaggedQids.push(qid)}
    else{savedData.flaggedQids=savedData.flaggedQids.filter(function(f){return f!==qid})}
    saveLocal(true)
  }
  renderNav();updateFlagBtn()
}

function updateFlagBtn(){
  var btn=document.getElementById('flagBtn');
  if(!btn)return;
  if(flagged[currentIdx]){btn.classList.add('flagged');btn.textContent='\u2691 已标记'}
  else{btn.classList.remove('flagged');btn.textContent='\u2690 标记'}
}

function setFontSize(s){
  fontSize=s;document.documentElement.setAttribute('data-font',s);
  localStorage.setItem('chem_font_size',s);
  document.querySelectorAll('.fs-btn').forEach(function(el){el.classList.toggle('active',el.dataset.size===s)})
}

function startTimer(min){
  examTimeLeft=min*60;
  updateTimerDisplay();
  if(examTimer)clearInterval(examTimer);
  examTimer=setInterval(function(){
    examTimeLeft--;
    updateTimerDisplay();
    if(examTimeLeft<=0){clearInterval(examTimer);examTimer=null;submitEarly()}
  },1000)
}

function stopTimer(){
  if(examTimer){clearInterval(examTimer);examTimer=null}
}

function updateTimerDisplay(){
  var el=document.getElementById('timerDisplay');
  if(!el)return;
  if(!examTimer&&examTimeLeft===0){el.style.display='none';return}
  el.style.display='';
  var m=Math.floor(examTimeLeft/60),s=examTimeLeft%60;
  el.textContent='\u23F1 '+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  el.classList.toggle('warning',examTimeLeft<300)
}

function updateStats(){
  if(!savedData||!savedData.stats)savedData.stats={};
  if(window._noStats)return;
  var m=mode==='random'?'random':mode==='seq'?'seq':mode==='exam'?'exam':'random';
  if(!savedData.stats[m])savedData.stats[m]={judge:{total:0,correct:0},single:{total:0,correct:0},multi:{total:0,correct:0}};
  quiz.forEach(function(q,i){
    var v=answers[i],has=Array.isArray(v)?v.length>0:v!=='';
    if(!has)return;
    var k=q.type==='判断题'?'judge':q.type==='单选题'?'single':'multi';
    savedData.stats[m][k].total++;
    if(checkAns(i))savedData.stats[m][k].correct++
  });
  saveLocal(true)
}

function renderStats(){
  var el=document.getElementById('statsContent');
  if(!el)return;
  var hasFlag=savedData&&savedData.flaggedQids&&savedData.flaggedQids.length;
  var cf=document.getElementById('clearFlagBtn');
  if(cf)cf.style.display=hasFlag?'':'none';
  var s=savedData&&savedData.stats;
  if(!s||!Object.keys(s).length){el.innerHTML='<div class="empty-saved">暂无统计数据，答题后自动生成</div>';return}
  if(s.judge){s.exam={judge:s.judge,single:s.single,multi:s.multi};delete s.judge;delete s.single;delete s.multi}
  var modes=[{key:'random',label:'刷题模式'},{key:'seq',label:'顺序模式'},{key:'exam',label:'考试模式'}];
  var cur=window._statMode||'random';
  if(!s[cur])cur=modes.find(function(m){return s[m.key]})&&modes.find(function(m){return s[m.key]}).key||'random';
  var types=[{key:'judge',label:'判断题'},{key:'single',label:'单选题'},{key:'multi',label:'多选题'}];
  var data=s[cur]||{};
  var total=0,correct=0;
  types.forEach(function(t){var d=data[t.key]||{total:0,correct:0};total+=d.total;correct+=d.correct});
  var opct=total?(correct/total*100).toFixed(1):'-';
  var h='<div class="stat-tabs">';
  modes.forEach(function(m){
    var cnt=0;types.forEach(function(t){var d=(s[m.key]||{})[t.key]||{total:0,correct:0};cnt+=d.total});
    h+='<div class="stat-tab'+(cur===m.key?' active':'')+'" onclick="switchStatMode(\''+m.key+'\')">'+m.label+(cnt?' <span>('+cnt+')</span>':'')+'</div>'
  });
  h+='</div>';
  if(!total){h+='<div class="empty-saved">该模式暂无数据</div>';el.innerHTML=h;return}
  h+='<div class="stat-grid" style="margin-bottom:10px">';
  h+='<div class="stat-box"><div class="num" style="color:var(--primary)">'+total+'</div><div class="lbl">总答题</div></div>';
  h+='<div class="stat-box"><div class="num" style="color:var(--correct)">'+correct+'</div><div class="lbl">正确</div></div>';
  h+='<div class="stat-box"><div class="num" style="color:var(--wrong)">'+(total-correct)+'</div><div class="lbl">错误</div></div>';
  h+='<div class="stat-box"><div class="num" style="color:var(--primary)">'+opct+'%</div><div class="lbl">正确率</div></div>';
  h+='</div>';
  types.forEach(function(t){
    var d=data[t.key]||{total:0,correct:0},pct=d.total?(d.correct/d.total*100).toFixed(1):'-';
    var barW=d.total?Math.round(d.correct/d.total*100):0,barC=barW>=80?'var(--correct)':barW>=60?'var(--primary)':'var(--wrong)';
    h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:13px">';
    h+='<span style="min-width:52px;color:var(--text2)">'+t.label+'</span>';
    h+='<div style="flex:1;height:8px;background:var(--bar-bg);border-radius:4px;overflow:hidden"><div style="width:'+barW+'%;height:100%;background:'+barC+';border-radius:4px;transition:width .3s"></div></div>';
    h+='<span style="min-width:60px;text-align:right;color:var(--text)"><b>'+pct+'%</b> ('+d.correct+'/'+d.total+')</span>';
    h+='</div>'
  });
  if(passphrase)h+='<div style="text-align:center;margin-top:10px"><button class="btn btn-sm btn-del" onclick="clearCloudStats()">清除云端统计</button></div>';
  el.innerHTML=h
}

function switchStatMode(m){window._statMode=m;renderStats()}

async function clearCloudStats(){
  if(!(await showConfirm('确定清除云端的全部学习统计吗？\n本地统计不受影响。')))return;
  savedData.stats={random:{judge:{total:0,correct:0},single:{total:0,correct:0},multi:{total:0,correct:0}},seq:{judge:{total:0,correct:0},single:{total:0,correct:0},multi:{total:0,correct:0}},exam:{judge:{total:0,correct:0},single:{total:0,correct:0},multi:{total:0,correct:0}}};
  await apiSave();renderStats();showAlert('已清除云端统计')
}

function startFlaggedReview(){
  var fqids=savedData&&savedData.flaggedQids?savedData.flaggedQids:[];
  if(!fqids.length){showAlert('没有标记的题目');return}
  var pool=questions.filter(function(q){return fqids.indexOf(q.id)!==-1});
  if(!pool.length){showAlert('标记的题目已被过滤掉，请检查题型选择');return}
  quiz=pool;answers=quiz.map(function(q){return q.type==='多选题'?[]:''});
  answered=quiz.map(function(){return false});flagged=quiz.map(function(){return false});
  currentIdx=0;finished=false;window._noStats=true;
  mode='random';quizLabel='错题本';saveId=Date.now().toString();
  setFontSize(fontSize);stopTimer();
  document.getElementById('submitBtn').style.display='';
  document.getElementById('flagBtn').style.display='';
  document.getElementById('backToResultBtn').style.display='none';
  document.getElementById('navToggle').style.display='';
  saveLocal(true);showPage('quiz');showQuestion()
}

function startWrongReview(){
  var wrongIdx=[];
  quiz.forEach(function(q,i){
    var v=answers[i],has=mode==='exam'?(Array.isArray(v)?v.length>0:v!==''):answered[i];
    if(has&&!checkAns(i))wrongIdx.push(i)
  });
  if(!wrongIdx.length){showAlert('没有错题需要重做');return}
  quiz=wrongIdx.map(function(i){return quiz[i]});
  answers=quiz.map(function(q){return q.type==='多选题'?[]:''});
  answered=quiz.map(function(){return false});
  flagged=quiz.map(function(){return false});
  currentIdx=0;finished=false;window._noStats=true;
  mode='random';quizLabel='错题作答';saveId=Date.now().toString();
  setFontSize(fontSize);stopTimer();
  document.getElementById('submitBtn').style.display='';
  document.getElementById('flagBtn').style.display='';
  document.getElementById('backToResultBtn').style.display='none';
  document.getElementById('navToggle').style.display='';
  saveLocal(true);showPage('quiz');showQuestion()
}

function toggleResQ(el){
  el.classList.toggle('expanded')
}

function toggleAllResQ(btn){
  if(typeof btn==='string')btn=null;
  if(!btn)btn=document.querySelector('#pageResult .res-acts .btn-outline[onclick*="toggleAllResQ"]');
  var all=document.querySelectorAll('.res-q'),expanded=all.length&&all[0].classList.contains('expanded');
  all.forEach(function(el){el.classList.toggle('expanded',!expanded)});
  if(btn)btn.textContent=!expanded?'收起全部题目':'展开全部题目'
}

function init(){
  if(typeof QUESTIONS==='undefined'){document.getElementById('pageHome').innerHTML+='<div style="color:#c45a5a;margin-top:10px">错误：questions.js 未加载</div>';return}
  questions=QUESTIONS;document.getElementById('totalQ').textContent=questions.length;applyTheme();
  window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',function(){
    if(!localStorage.getItem('chem_theme'))applyTheme()
  });
  var cached=localStorage.getItem('chem_passphrase');
  if(cached){document.getElementById('passphrase').value=cached;loadProgress()}
  else{
    var localData=localStorage.getItem(LOCAL_KEY);
    if(localData){savedData=JSON.parse(localData);renderSavedList()}
    else renderSavedList()
  }
  setFontSize(fontSize);
  setTimeout(renderStats,100)
}

init();

function toggleTheme(){
  var d=document.documentElement,now=d.getAttribute('data-theme')==='dark';
  if(now){d.removeAttribute('data-theme');localStorage.setItem('chem_theme','light')}
  else{d.setAttribute('data-theme','dark');localStorage.setItem('chem_theme','dark')}
  applyTheme()
}

function applyTheme(){
  var d=document.documentElement,ls=localStorage.getItem('chem_theme');
  var isDark=ls?ls==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;
  if(isDark){d.setAttribute('data-theme','dark');document.getElementById('themeBtn').textContent='\u{1F319}'}
  else{d.removeAttribute('data-theme');document.getElementById('themeBtn').textContent='\u2600\uFE0F'}
}

function setMode(m){mode=m;document.querySelectorAll('.mode-tab').forEach(function(e){e.classList.toggle('active',e.dataset.mode===m)});
['settingsRandom','settingsSeq','settingsExam'].forEach(function(id){document.getElementById(id).style.display=(id.replace('settings','').toLowerCase()===m)?'block':'none'})}

async function startQuiz(){
  delete window._noStats;
  var p=document.getElementById('passphrase').value.trim();
  if(p){
    if(!savedData){await showAlert('请先点击"加载"同步进度');return}
  }else{
    if(!(await showConfirm('未输入口令，答题数据将仅保存到本地浏览器，退出后需在本设备查看。\n\n是否继续？')))return;
    if(!savedData||savedData.passphrase)savedData={passphrase:'',saves:[],theme:'light'}
  }
  var count,pool;
  if(mode==='random'){
    count=Math.min(parseInt(document.getElementById('rCount').value)||100,questions.length);
    pool=filterPool('r');
    if(!pool.length){await showAlert('请至少选择一种题型');return}
    quiz=shuffle(pool).slice(0,Math.min(count,pool.length));seqStartQid=0
  }else if(mode==='seq'){
    count=parseInt(document.getElementById('sCount').value)||100;
    var start=parseInt(document.getElementById('sStart').value)||1;
    pool=filterPool('s');
    if(!pool.length){await showAlert('请至少选择一种题型');return}
    var si=pool.findIndex(function(q){return q.id===start});
    if(si===-1){await showAlert('未找到题号 #'+start+'（可能被题型过滤掉了）');return}
    quiz=pool.slice(si,si+count);seqStartQid=quiz.length?quiz[0].id:0
  }else{
    count=Math.min(parseInt(document.getElementById('eCount').value)||100,questions.length);
    pool=filterPool('e');
    if(!pool.length){await showAlert('请至少选择一种题型');return}
    quiz=shuffle(pool).slice(0,Math.min(count,pool.length));seqStartQid=0
  }
  answers=quiz.map(function(q){return q.type==='多选题'?[]:''});answered=quiz.map(function(){return false});
  flagged=quiz.map(function(){return false});
  currentIdx=0;finished=false;saveId=Date.now().toString();
  if(passphrase)localStorage.setItem('chem_passphrase',passphrase);
  setFontSize(fontSize);
  quizLabel=mode==='random'?'刷题':mode==='seq'?'顺序':'考试';
  if(mode==='exam'){var t=parseInt(document.getElementById('eTime').value)||60;startTimer(t)}
  else stopTimer();
  document.getElementById('submitBtn').style.display='';
  document.getElementById('flagBtn').style.display='';
  document.getElementById('backToResultBtn').style.display='none';
  document.getElementById('navToggle').style.display='';
  saveLocal(true);showPage('quiz');showQuestion()
}

function filterPool(p){var j=document.getElementById(p+'Judge').checked,s=document.getElementById(p+'Single').checked,m=document.getElementById(p+'Multi').checked;
return questions.filter(function(q){return(q.type==='判断题'&&j)||(q.type==='单选题'&&s)||(q.type==='多选题'&&m)})}

function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}return a}

function showQuestion(){
  var q=quiz[currentIdx],tot=quiz.length,hasAns=answered[currentIdx],isExam=mode==='exam',isMulti=q.type==='多选题';
  document.getElementById('progFill').style.width=((currentIdx+1)/tot*100)+'%';
  document.getElementById('progText').textContent=quizLabel+' '+(currentIdx+1)+' / '+tot+' 题';
  var tag=q.type,tc='';
  if(q.type==='判断题')tc='判断';else if(q.type==='单选题')tc='单选';else tc='多选';
  var html='<div class="q-header"><span class="q-num">#'+q.id+'</span><span class="q-tag">'+tc+'</span></div><div class="q-text">'+q.text+'</div><div class="opts" id="optC">';
  var uv=answers[currentIdx],ca=q.answer;
  q.options.forEach(function(opt){
    var sel=false;if(isExam){sel=isMulti?uv.includes(opt.label):uv===opt.label}
    var cls='opt',mk=opt.label;
    if(isExam&&finished){
      cls+=' disabled';
      var iu=isMulti?uv.includes(opt.label):uv===opt.label,ic=ca.split(';').map(function(s){return s.trim()}).includes(opt.label);
      if(iu&&ic){cls+=' correct';mk='\u2713'}else if(iu&&!ic){cls+=' wrong';mk='\u2717'}else if(!iu&&ic){cls+=' reveal';mk='\u2713'}
    }else if(isExam){
      if(sel)cls+=' selected';
    }else{
      if(hasAns){cls+=' disabled';
        var iu=isMulti?uv.includes(opt.label):uv===opt.label,ic=ca.split(';').map(function(s){return s.trim()}).includes(opt.label);
        if(iu&&ic){cls+=' correct';mk='\u2713'}else if(iu&&!ic){cls+=' wrong';mk='\u2717'}else if(!iu&&ic){cls+=' reveal';mk='\u2713'}
      }else{sel=isMulti?uv.includes(opt.label):uv===opt.label;if(sel)cls+=' selected'}
    }
    html+='<div class="'+cls+'" data-l="'+opt.label+'" onclick="pick(\''+opt.label+'\')"><div class="opt-marker">'+mk+'</div><div class="opt-text">'+opt.text+'</div></div>'
  });
  if(isMulti&&!hasAns&&!isExam)html+='<div class="note">多选题：选择所有正确项后点击"确认答案"</div>';
  html+='</div>';
  if(!isExam&&hasAns){
    var ik=checkAns(currentIdx);
    if(ik)html+='<div class="fb fb-ok">\u2713 回答正确</div>';
    else html+='<div class="fb fb-no">\u2717 回答错误 &middot; 正确答案：<strong>'+ca.replace(/;/g,'、')+'</strong></div>'
  }else if(!isExam&&isMulti)html+='<div style="text-align:center;margin-top:12px"><button class="btn btn-primary" onclick="confirmMulti()" style="min-width:140px">确认答案</button></div>';
  document.getElementById('qCard').innerHTML=html;
  document.getElementById('prevBtn').disabled=currentIdx===0;
  document.getElementById('nextBtn').textContent=currentIdx===tot-1&&!isExam?'查看结果':'下一题';
  if(isExam&&!finished&&currentIdx===tot-1)document.getElementById('nextBtn').disabled=true;
  else document.getElementById('nextBtn').disabled=!(isExam||hasAns)&&!finished;
  renderNav();updateFlagBtn();
  document.getElementById('flagBtn').style.display=finished?'none':'';

}

function pick(l){if(answered[currentIdx]&&mode!=='exam'||finished)return;var q=quiz[currentIdx],im=q.type==='多选题',v=answers[currentIdx];if(im&&!Array.isArray(v)){v=[];answers[currentIdx]=v}
if(mode==='exam'){
  if(im){var idx=v.indexOf(l);if(idx===-1){v.push(l);v.sort()}else v.splice(idx,1);
    document.querySelectorAll('#optC .opt').forEach(function(e){e.classList.toggle('selected',v.includes(e.dataset.l))})}
  else{answers[currentIdx]=l;document.querySelectorAll('#optC .opt').forEach(function(e){e.classList.toggle('selected',e.dataset.l===l)})}
   document.getElementById('nextBtn').disabled=false;saveLocal(true);renderNav();return
}
if(im){var idx=v.indexOf(l);if(idx===-1){v.push(l);v.sort()}else v.splice(idx,1);
  document.querySelectorAll('#optC .opt').forEach(function(e){e.classList.toggle('selected',!answered[currentIdx]&&v.includes(e.dataset.l))})}
else{answers[currentIdx]=l;submitAnswer()}}

function confirmSingle(){if(answers[currentIdx]===''||answered[currentIdx])return;submitAnswer()}
async function confirmMulti(){var v=answers[currentIdx];if(!Array.isArray(v)||!v.length){await showAlert('请至少选择一个选项');return}submitAnswer()}

function submitAnswer(){answered[currentIdx]=true;saveLocal(true);showQuestion()}

function checkAns(idx){var q=quiz[idx],v=answers[idx];
if(q.type==='多选题'){var u=[...(v||[])].sort().join(';'),c=q.answer.split(';').map(function(s){return s.trim()}).sort().join(';');return u===c}
return String(v).trim().toUpperCase()===String(q.answer).trim().toUpperCase()}

function goNext(){
  if(currentIdx<quiz.length-1){currentIdx++;showQuestion()}
  else if(finished)showPage('result');else if(mode==='exam')submitEarly();else finishQuiz()
}
function goPrev(){if(currentIdx>0){currentIdx--;showQuestion()}}

async function finishQuiz(){showResult();syncCloud()}

async function submitEarly(){
  var tot=quiz.length,done=answered.filter(Boolean).length;
  if(mode!=='exam'&&done<tot&&!(await showConfirm('已完成 '+done+'/'+tot+' 题，剩余 '+(tot-done)+' 题未答。确定要结束吗？')))return;
  stopTimer();showResult();syncCloud()
}

function showResult(){
  finished=true;stopTimer();
  var correct=0,wrong=0,totalScore=0,unanswered=0,details=[];
  quiz.forEach(function(q,i){
    var v=answers[i],isC=false,has=mode==='exam'?(Array.isArray(v)?v.length>0:v!==''):answered[i];
    if(has){
      if(q.type==='多选题'){var u=[...(v||[])].sort().join(';'),c=q.answer.split(';').map(function(s){return s.trim()}).sort().join(';');isC=u===c}
      else isC=String(v).trim().toUpperCase()===String(q.answer).trim().toUpperCase()
    }
    if(!has)unanswered++;else if(isC){correct++;totalScore+=q.score}else wrong++;
    details.push({id:q.id,type:q.type,text:q.text,userAnswer:has?(Array.isArray(v)?v.join(';'):v):'(未答)',correctAnswer:q.answer,isCorrect:isC,hasAnswer:has})
  });
  document.getElementById('resScore').textContent=totalScore+(mode==='exam'?'':'');
  document.getElementById('resDet').textContent='共 '+quiz.length+' 题 · 正确 '+correct+' 题 · 错误 '+wrong+' 题'+(unanswered?' · 未答 '+unanswered+' 题':'')+' · 正确率 '+(quiz.length-unanswered?(correct/(quiz.length-unanswered)*100).toFixed(1):'0')+'%';
  document.getElementById('resStats').innerHTML='<div class="stat-box"><div class="num" style="color:var(--primary)">'+quiz.length+'</div><div class="lbl">总题数</div></div><div class="stat-box"><div class="num" style="color:var(--correct)">'+correct+'</div><div class="lbl">正确</div></div><div class="stat-box"><div class="num" style="color:var(--wrong)">'+wrong+'</div><div class="lbl">错误</div></div><div class="stat-box"><div class="num" style="color:var(--primary)">'+totalScore+'</div><div class="lbl">得分</div></div>';
  var tbl='<table><tr><th>#</th><th>类型</th><th>题目</th><th>你的答案</th><th>正确答案</th><th>结果</th></tr>';
  details.forEach(function(d){var s=d.isCorrect?'<span class="tg-ok">&#10003;</span>':'<span class="tg-no">&#10007;</span>';
    tbl+='<tr><td>'+d.id+'</td><td>'+d.type+'</td><td class="res-q" onclick="toggleResQ(this)" title="点击展开/收起">'+escBr(d.text)+'</td><td>'+d.userAnswer+'</td><td>'+(d.isCorrect?'-':d.correctAnswer)+'</td><td>'+(d.hasAnswer?s:'<span style="color:var(--text2)">-</span>')+'</td></tr>'});
  tbl+='</table>';document.getElementById('resTbl').innerHTML=tbl;
  document.getElementById('wrongReviewWrap').style.display=wrong>0?'':'none';
  var toggleBtn=document.querySelector('#pageResult .res-acts .btn-outline[onclick*="toggleAllResQ"]');
  if(toggleBtn)toggleBtn.textContent='展开全部题目';
  showPage('result');
  updateStats();renderStats()
}

function reviewWrong(){
  showPage('quiz');finished=true;currentIdx=0;
  document.getElementById('submitBtn').style.display='none';
  document.getElementById('flagBtn').style.display='none';
  document.getElementById('backToResultBtn').style.display='';
  document.getElementById('navToggle').style.display='';
  showQuestion()
}

function backToResult(){
  showPage('result')
}

function saveLocal(noRender){
  try{
    var done=mode==='exam'?answers.every(function(v){return Array.isArray(v)?v.length>0:v!==''}):answered.filter(Boolean).length>=quiz.length;
    var entry={id:saveId,mode:mode,label:quizLabel,startQid:seqStartQid,total:quiz.length,idx:currentIdx,answers:answers,answered:answered,flagged:flagged,examTimeLeft:examTimeLeft,timestamp:Date.now(),qids:quiz.map(function(q){return q.id}),completed:done};
    if(!savedData){savedData={passphrase:passphrase||'',saves:[],theme:'light'}}
    var saves=savedData.saves;
    var exist=saves.findIndex(function(e){return e.id===saveId});
    if(exist===-1)saves.push(entry);
    else saves[exist]=entry;
    localStorage.setItem(LOCAL_KEY,JSON.stringify(savedData));
    if(!noRender)renderSavedList()
  }catch(e){}
}

async function syncCloud(){saveLocal(true);if(passphrase)await apiSave();renderSavedList()}

async function clearSaved(id){
  try{
    if(id){
      if(passphrase){await apiDelete(id);return}
      savedData.saves=savedData.saves.filter(function(e){return e.id!==id});
      localStorage.setItem(LOCAL_KEY,JSON.stringify(savedData));renderSavedList();return
    }
    if(!savedData)return;
    savedData.saves=savedData.saves.filter(function(e){return e.id!==saveId});
    if(passphrase){await apiSave()}
    else{localStorage.setItem(LOCAL_KEY,JSON.stringify(savedData))}
    renderSavedList()
  }catch(e){}
}

function renderSavedList(){
  try{
    var el=document.getElementById('savedList');
    if(!savedData||!savedData.saves||!savedData.saves.length){el.innerHTML='<div class="empty-saved">暂无保存的进度</div>';return}
    var h='';
    savedData.saves.slice().sort(function(a,b){return b.timestamp-a.timestamp}).forEach(function(s){
      var d=new Date(s.timestamp),ms=s.label||'刷题',t=s.startQid?'#'+s.startQid+'\u2192 ':'';
      if(s.mode==='exam')ms='考试';
      if(s.mode==='seq'&&!s.label)ms='顺序';
      var ds=d.getMonth()+1+'/'+d.getDate()+' '+d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
      var complete=!!s.completed,btn=complete?'查看结果':'继续',st=complete?'完成':t+s.idx+'/'+s.total+' 题',fl=(s.flagged||[]).filter(Boolean).length;
      h+='<div class="saved-item"><div class="saved-info"><strong>'+ms+'</strong> '+st+(fl?' · ⚑'+fl:'')+' &middot; '+ds+'</div><div class="saved-actions"><button class="btn btn-sm btn-primary" onclick="resumeSave(\''+s.id+'\')">'+btn+'</button><button class="btn-del" onclick="clearSaved(\''+s.id+'\')">删除</button></div></div>'
    });
    el.innerHTML=h
  }catch(e){}
}

async function resumeSave(id){
  try{
    if(!savedData||!savedData.saves){await showAlert('请先输入口令加载进度');return}
    var saved=savedData.saves.find(function(e){return e.id===id});
    if(!saved){await showAlert('进度数据不存在');return}
    var pool;
    if(saved.mode==='seq'){
      var incJudge=document.getElementById('sJudge').checked,incSingle=document.getElementById('sSingle').checked,incMulti=document.getElementById('sMulti').checked;
      pool=questions.filter(function(q){return(q.type==='判断题'&&incJudge)||(q.type==='单选题'&&incSingle)||(q.type==='多选题'&&incMulti)});
      var si=pool.findIndex(function(q){return q.id===saved.startQid});
      if(si===-1){await showAlert('题型过滤条件变更，无法恢复，请重新开始');return}
      quiz=pool.slice(si,si+saved.total)
    }else{
      var incJudge=document.getElementById('rJudge').checked,incSingle=document.getElementById('rSingle').checked,incMulti=document.getElementById('rMulti').checked;
      if(mode==='exam'){incJudge=document.getElementById('eJudge').checked;incSingle=document.getElementById('eSingle').checked;incMulti=document.getElementById('eMulti').checked}
      pool=questions.filter(function(q){return(q.type==='判断题'&&incJudge)||(q.type==='单选题'&&incSingle)||(q.type==='多选题'&&incMulti)});
      quiz=pool.filter(function(q){return saved.qids.indexOf(q.id)!==-1});
      if(quiz.length!==saved.qids.length){await showAlert('题库或题型过滤条件已变更，部分题目无法恢复');if(!quiz.length){await clearSaved(id);return}}
    }
    mode=saved.mode;quizLabel=saved.label||'刷题';seqStartQid=saved.startQid;saveId=id;answers=saved.answers;answered=saved.answered;flagged=saved.flagged||quiz.map(function(){return false});
    currentIdx=Math.min(saved.idx,quiz.length-1);    finished=!!saved.completed;
    var lastAns=saved.mode==='exam'?(Array.isArray(answers[currentIdx])?answers[currentIdx].length>0:answers[currentIdx]!==''):answered[currentIdx];
    if(saved.completed||(currentIdx>=quiz.length-1&&lastAns)){showResult();return}
    examTimeLeft=saved.examTimeLeft||0;
    if(mode==='exam'&&examTimeLeft>0&&!finished){updateTimerDisplay();if(examTimer)clearInterval(examTimer);examTimer=setInterval(function(){examTimeLeft--;updateTimerDisplay();if(examTimeLeft<=0){clearInterval(examTimer);examTimer=null;submitEarly()}},1000)}
    document.getElementById('submitBtn').style.display=finished?'none':'';
    document.getElementById('flagBtn').style.display=finished?'none':'';
    document.getElementById('backToResultBtn').style.display=finished?'':'none';
    document.getElementById('navToggle').style.display=finished?'none':'';
    showPage('quiz');showQuestion()
  }catch(e){await showAlert('读取进度失败，已删除');await clearSaved(id)}
}

function showPage(n){
  document.getElementById('pageHome').style.display=n==='home'?'block':'none';
  document.getElementById('pageQuiz').style.display=n==='quiz'?'block':'none';
  document.getElementById('pageResult').style.display=n==='result'?'block':'none'
}

function goHome(){showPage('home');renderStats()}

async function quitQuiz(){
  if(mode!=='exam'&&!(await showConfirm('确定退出？进度已自动保存')))return;
  stopTimer();syncCloud();showPage('home');renderStats()
}

document.addEventListener('keydown',function(e){
  if(document.getElementById('pageQuiz').style.display!=='block')return;
  if(e.key==='ArrowLeft'&&!e.ctrlKey&&!e.metaKey){goPrev();e.preventDefault()}
  if(e.key==='ArrowRight'&&!e.ctrlKey&&!e.metaKey){goNext();e.preventDefault()}
  if(e.key==='Enter'&&!finished&&mode!=='exam'){var q=quiz[currentIdx];if(q&&q.type!=='多选题')confirmSingle();e.preventDefault()
  }
})
window.addEventListener('beforeunload',function(){if(quiz.length)saveLocal(true)})
