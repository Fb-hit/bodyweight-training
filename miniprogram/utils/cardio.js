const sports = ['跑步', '骑行', '跳绳', '爬楼', '原地快步', '其他'];
const intensities = ['未评估', '较轻', '中等', '高强度'];
const settings = [
 {key:'fast', label:'快段', options:[10, 20, 30, 45, 60, 90, 120, 180, 240], unit:'秒'},
 {key:'recovery', label:'恢复段', options:[15, 30, 45, 60, 90, 120, 180, 240], unit:'秒'},
 {key:'rounds', label:'轮数', options:[3, 4, 5, 6, 8, 10, 12, 15, 20], unit:'轮'},
 {key:'warmup', label:'热身', options:[0, 2, 3, 5, 8, 10], unit:'分钟'},
 {key:'cooldown', label:'放松', options:[0, 2, 3, 5, 8, 10], unit:'分钟'}
];
const defaults = {sport:sports[0], fast:30, recovery:60, rounds:6, warmup:3, cooldown:2};
const labels = {warmup:'热身', fast:'快段', recovery:'恢复', cooldown:'放松'};

function plan(config){
 const phases = [];
 if(config.warmup) phases.push({type:'warmup', seconds:config.warmup * 60, round:0});
 for(let round=1; round<=config.rounds; round++){
  phases.push({type:'fast', seconds:config.fast, round});
  if(round<config.rounds) phases.push({type:'recovery', seconds:config.recovery, round});
 }
 if(config.cooldown) phases.push({type:'cooldown', seconds:config.cooldown * 60, round:0});
 return phases;
}

function progress(phases, elapsedMs){
 let used = 0, fastMs = 0, roundsDone = 0;
 for(const [index, phase] of phases.entries()){
  const duration = phase.seconds * 1000;
  const spent = Math.min(duration, Math.max(0, elapsedMs - used));
  used += spent;
  if(phase.type==='fast'){
   fastMs += spent;
   if(spent===duration) roundsDone++;
  }
  if(spent<duration){
   return {index, phase, next:phases[index+1], remaining:Math.ceil((duration-spent)/1000),
    elapsedMs:used, fastMs, roundsDone, done:false};
  }
 }
 return {elapsedMs:used, fastMs, roundsDone, done:true};
}

function clock(seconds){
 return String(Math.floor(seconds/60)).padStart(2,'0') + ':' + String(seconds%60).padStart(2,'0');
}

function duration(seconds){
 const minutes = Math.floor(seconds/60);
 const rest = seconds%60;
 return minutes ? minutes+' 分'+(rest ? ' '+rest+' 秒' : '') : rest+' 秒';
}

module.exports = {sports, intensities, settings, defaults, labels, plan, progress, clock, duration};
