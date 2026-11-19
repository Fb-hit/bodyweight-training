const exercises=[
 ['wall','墙面俯卧撑','推','墙面','让身体保持一条线。','双手推墙回到起始位。','high'],
 ['high','高位上斜俯卧撑','推','稳定台面','手撑稳固台面，身体保持一条线。','胸口靠近台面后推回。','low','wall'],
 ['low','低位上斜俯卧撑','推','稳定台面','选稳固且较低的支撑。','下放时保持躯干稳定。','floor','high'],
 ['floor','地面俯卧撑','推','地面','双手撑地，身体保持一条线。','控制下放，再把地面推开。','','low'],
 ['band','弹力带划船','拉','弹力带','确认带子状态和固定方式可靠。','肘向后拉，回程保持控制。'],
 ['bar','低杠划船','拉','公园低杠','使用稳固的训练低杠。','胸口向杠靠近，回程慢放。'],
 ['chair','椅子坐站','蹲','稳定椅子','双脚踩实，坐向稳固椅面。','脚掌发力站起，再慢慢坐下。','squat'],
 ['squat','自重深蹲','蹲','地面','膝盖大致朝脚尖方向。','下蹲到能稳定控制的深度后站起。','','chair'],
 ['bridge','臀桥','髋','地面','仰卧屈膝，双脚踩稳。','抬髋时控制躯干，再慢慢放下。'],
 ['bug','简化死虫','核心','地面','仰卧屈膝，保持躯干稳定。','一侧脚跟缓慢点地，交替完成。'],
 ['side','膝支撑侧桥','核心','地面','肘放在肩下，屈膝支撑。','抬髋，保持身体稳定。']
].map(([id,name,group,gear,cue1,cue2,up,down])=>({id,name,group,gear,cue1,cue2,up:up||'',down:down||'',unit:id==='side'?'秒':'次',min:id==='side'?10:6,max:id==='side'?25:12}));
const byId=id=>exercises.find(e=>e.id===id);
const defaults={goal:'开始运动',level:'零基础',minutes:15,days:2,gear:'弹力带',core:false};
const optionsFor=(group,s)=>exercises.filter(e=>e.group===group&&(group!=='拉'||e.gear===s.gear));
function makeItems(s,choices,core=false){
 const start=s.level==='有基础'?['low','squat']:['high','chair'];
 const ids=core?['bug','side']:[start[0],s.gear==='弹力带'?'band':s.gear==='公园低杠'?'bar':null,start[1],...(s.minutes===25?['bridge']:[])];
 return ids.map((id,i)=>{
  const group=id?byId(id).group:'拉';
  const selected=!core&&optionsFor(group,s).some(x=>x.id===choices[group])?choices[group]:id;
  return {id:selected,group,sets:[],skipped:false,target:2,slot:i};
 });
}
function qualifies(item){
 if(!item)return false;
 const e=byId(item.id), last=item.sets[item.sets.length-1];
 return e&&item.sets.length===item.target&&item.sets.every(s=>s.reps>=e.max&&s.stable)&&['2–3 次','4 次以上'].includes(last?.effort);
}
function advise(item,s,history){
 const e=byId(item.id),last=item.sets[item.sets.length-1];
 if(s.stopped)return {type:'暂停调整',text:'你记录了不适，先停止相关动作，评估后再安排。'};
 if(!e||item.skipped||!last)return {type:'先确认条件',text:'本次缺少可比较记录，下次先选择能完成的动作。'};
 if(s.recovery==='较差'||item.sets.some(x=>!x.stable||x.reps<e.min)){
   return {type:'降低难度',text:'本次动作控制、次数或恢复未达到目标。下次减少训练量，或换更容易的变式。',next:e.down};
 }
 const prev=history.find(h=>h.core===s.core&&h.items.some(x=>x.group===item.group));
 const previousItem=prev?.items.find(x=>x.group===item.group&&x.id===item.id);
 if(e.up&&s.recovery==='正常'&&prev?.recovery==='正常'&&!prev.stopped&&qualifies(item)&&qualifies(previousItem)){
  return {type:'小幅进阶',text:'连续两次用同一变式完成目标次数且仍有余力，可以试更难的变式。',next:e.up};
 }
 if(item.sets.length===item.target&&last.reps<e.max&&['2–3 次','4 次以上'].includes(last.effort))
  return {type:e.unit==='秒'?'加一点时间':'加 1 次',text:e.unit==='秒'?'下次在保持稳定的前提下，试着多保持几秒。':'下次可选一组多做 1 次，保持动作可控。'};
 return {type:'保持',text:'下次沿用同一变式和目标，按实际情况记录。'};
}

const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>dateKey(new Date());
const labels={complete:'已完成',partial:'部分完成',none:'未训练'};
const groups=h=>h.items.reduce((n,item)=>n+item.sets.length,0);
const isCardio=h=>h.type==='cardio';
const status=h=>h.completed?'complete':(isCardio(h)?h.seconds>0:groups(h)>0)?'partial':'none';
function calendar(year,month,history,selectedDate){
 const first=new Date(year,month,1),end=new Date(year,month+1,0).getDate();
 const offset=(first.getDay()+6)%7, states={}, cardioDays=new Set();
 history.forEach(h=>{
  const s=status(h);
  if(s==='none')return;
  if(states[h.date]!=='complete')states[h.date]=s;
  if(isCardio(h))cardioDays.add(h.date);
 });
 const cells=Array.from({length:offset},(_,i)=>({key:'empty'+i,empty:true}));
 for(let day=1;day<=end;day++){
  const key=dateKey(new Date(year,month,day)),state=states[key]||'none';
  const cardio=cardioDays.has(key);
  cells.push({key,day,state,cardio,selected:key===selectedDate,today:key===today(),label:key+'，'+labels[state]+(cardio?'，有氧':'')});
 }
 return cells;
}
function weekHistory(history){
 const now=new Date(),monday=new Date(now);
 monday.setDate(now.getDate()-(now.getDay()+6)%7);
 const from=dateKey(monday),to=dateKey(now);
 return history.filter(h=>h.date>=from&&h.date<=to);
}
module.exports={exercises,byId,defaults,optionsFor,makeItems,advise,dateKey,today,labels,groups,isCardio,status,calendar,weekHistory};
