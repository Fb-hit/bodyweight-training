
const t=require('../../utils/training');
const cardio=require('../../utils/cardio');
const poseLabels=require('../../utils/pose-labels');
const key='bodyweight-native-v1';
const empty=()=>({settings:null,draft:null,history:[],choices:{},shift:'',cardioSettings:null,cardioDraft:null});
const clone=value=>JSON.parse(JSON.stringify(value));
const last=array=>array[array.length-1];
const effortOptions=['不确定','0–1 次','2–3 次','4 次以上'];
const categories=['全部','推','拉','蹲','髋','核心'];
const tabs=[{id:'today',name:'今天'},{id:'plan',name:'计划'},{id:'library',name:'动作库'},{id:'mine',name:'我的'}];
const fields=[
 {key:'goal',label:'训练目标',choices:['开始运动','增肌']},
 {key:'level',label:'训练经验',choices:['零基础','有基础']},
 {key:'minutes',label:'每次用时',choices:[15,25],suffix:' 分钟'},
 {key:'days',label:'每周次数',choices:[2,3],suffix:' 次'},
 {key:'gear',label:'拉力器械',choices:['无器械','弹力带','公园低杠']}
];
const describe=e=>e?{...e,art:'/assets/'+e.id+'.svg',poses:poseLabels[e.id],frames:poseLabels[e.id].map((label,i)=>({label,src:'/assets/'+e.id+'-'+(i+1)+'.svg'}))}:null;
const moveTitle=item=>t.byId(item.id)?.name||'待补水平拉';
function read(){
 try {
  const saved=wx.getStorageSync(key);
  return saved&&Array.isArray(saved.history)?{...empty(),...saved}:empty();
 }catch{return empty();}
}
Page({
 data:{screen:'today',tabs,fields,categories,effortOptions,weekdays:['一','二','三','四','五','六','日'],filter:'全部',reps:8,effort:'不确定',stable:true,rest:0,sheet:null,selectedDate:'',
  cardioSports:cardio.sports,cardioIntensities:cardio.intensities,cardioIntensity:cardio.intensities[0]},
 onLoad(){
  this.state=read();
  this.month=new Date();
  this.month.setDate(1);
  this.filterDate='';
  this.form={...t.defaults,...this.state.settings};
  this.summary=null;
  this.summaryBack='today';
  this.cardioStartedAt=null;
  this.cardioPhases=this.state.cardioDraft?cardio.plan(this.state.cardioDraft.config):[];
  this.sync();
 },
 onShow(){
  this.updateRest();
  this.updateCardio();
  this.timer=setInterval(()=>{this.updateRest();this.updateCardio();},250);
 },
 onHide(){
  clearInterval(this.timer);
  if(this.cardioStartedAt!==null)this.freezeCardio(false);
 },
 onUnload(){this.onHide();},
 commit(next){
  try{wx.setStorageSync(key,next);}
  catch{wx.showToast({title:'保存失败，请重试',icon:'none'});return false;}
  this.state=next;return true;
 },
 updateRest(){
  const rest=Math.max(0,Math.ceil(((this.state?.draft?.restUntil||0)-Date.now())/1000));
  if(this.data.screen==='train'&&rest!==this.data.rest)this.setData({rest});
 },
 sync(extra={}){
  const s=this.state;
  const settings=s.settings||t.defaults;
  const draft=s.draft;
  const item=draft?.items[draft.index]||null;
  const exercise=t.byId(item?.id);
  const year=this.month.getFullYear(),month=this.month.getMonth(), monthKey=t.dateKey(this.month).slice(0,7);
  const monthly=s.history.filter(h=>h.date.startsWith(monthKey));
  const week=t.weekHistory(s.history);
  const strengthWeek=week.filter(h=>!t.isCardio(h)), cardioWeek=week.filter(t.isCardio);
  const visible=monthly.filter(h=>!this.filterDate||h.date===this.filterDate).map(h=>{
   const state=t.status(h);
   return {...h,state,statusText:state==='none'?'未记录组数':t.labels[state],
    title:t.isCardio(h)?h.sport+' · 有氧':h.core?'核心加练':'主训练'};
  });
  const main=t.makeItems(settings,s.choices).map((i,k)=>({...i,number:k+1,name:moveTitle(i),gear:t.byId(i.id)?.gear||'需要弹力带或训练低杠'}));
  const history=this.summary;
  this.setData({
   settings,configured:!!s.settings,planTitle:settings.minutes===25?'25 分钟基础增肌':'15 分钟入门',shift:s.shift&&s.shift>t.today()?s.shift:'',
   main,ongoing:!!draft,exercise:describe(exercise),item,reviewSets:item?item.sets.map((set,index)=>({...set,number:index+1})):[],review:!!item&&item.sets.length>=item.target,
   exerciseIndex:draft?Math.min(draft.index+1,draft.items.length):0,previous:!!draft&&draft.index>0,totalMoves:draft?.items.length||0,isCore:!!draft?.core,
   rest:Math.max(0,Math.ceil(((draft?.restUntil||0)-Date.now())/1000)),
   moves:draft?draft.items.map((move,i)=>({...move,index:i,number:i+1,name:moveTitle(move),status:move.skipped?'已跳过 · 可补做':move.sets.length>=move.target?'已完成':'已记录 '+move.sets.length+' / '+move.target+' 组'})):[],
   library:t.exercises.filter(x=>this.data.filter==='全部'||x.group===this.data.filter).map(describe),form:this.form,
   weekDone:strengthWeek.filter(h=>!h.core&&h.completed).length,coverage:[...new Set(strengthWeek.flatMap(h=>h.items.filter(i=>i.sets.length).map(i=>i.group)))].join(' · '),
   cardioOngoing:!!s.cardioDraft, cardioEnded:!!s.cardioDraft?.ended,
   cardioWeekCount:cardioWeek.length, cardioWeekFast:cardio.duration(cardioWeek.reduce((n,h)=>n+(h.intensity==='高强度'?h.fastSeconds:0),0)),
   monthTitle:year+'年'+(month+1)+'月',days:t.calendar(year,month,monthly,this.filterDate),records:visible,selectedDate:this.filterDate,
   summary:!history?null:t.isCardio(history)?this.cardioDetails(history):{...history,totalGroups:t.groups(history),completedMoves:history.items.filter(i=>i.sets.length>=i.target).length,
    advice:history.advice.map(a=>({...a,name:t.byId(a.id)?.name||'动作',nextName:t.byId(a.next)?.name||''}))},
   summaryBack:this.summaryBack,...extra
  });
 },
 show(screen){
  if(screen==='setup')this.form={...t.defaults,...this.state.settings};
  this.sync({screen,sheet:null});
  wx.pageScrollTo({scrollTop:0,duration:0});
 },
 nav(e){this.show(e.currentTarget.dataset.screen);},
 cardioEntry(){
  const draft=this.state.cardioDraft;
  if(draft?.ended){this.showCardioReview(draft);return;}
  if(draft){this.show('cardioTimer');this.updateCardio();return;}
  this.setCardioForm({...cardio.defaults,...this.state.cardioSettings});
  this.show('cardioSetup');
 },
 setCardioForm(form){
  const seconds=cardio.plan(form).reduce((total,phase)=>total+phase.seconds,0);
  const fields=cardio.settings.map(field=>({...field,selected:field.options.indexOf(form[field.key]),
   value:form[field.key]===0?'不计时':form[field.key]+' '+field.unit}));
  this.setData({cardioForm:form,cardioFields:fields,cardioPlanTime:cardio.duration(seconds)});
 },
 chooseCardioSport(e){
  this.setCardioForm({...this.data.cardioForm,sport:e.currentTarget.dataset.sport});
 },
 chooseCardioSetting(e){
  const key=e.currentTarget.dataset.key;
  const field=cardio.settings.find(setting=>setting.key===key);
  const value=field?.options[Number(e.detail.value)];
  if(value!==undefined)this.setCardioForm({...this.data.cardioForm,[key]:value});
 },
 startCardio(){
  if(this.state.cardioDraft)return;
  const config=this.data.cardioForm;
  const draft={id:'cardio-'+Date.now().toString(36),date:t.today(),config,elapsedMs:0,ended:false};
  if(!this.commit({...this.state,cardioSettings:config,cardioDraft:draft}))return;
  this.cardioPhases=cardio.plan(config);
  this.setData({cardioIntensity:cardio.intensities[0]});
  this.show('cardioTimer');
  this.resumeCardio();
 },
 cardioProgress(){
  const draft=this.state.cardioDraft;
  const elapsed=this.cardioStartedAt===null?0:Math.max(0,Date.now()-this.cardioStartedAt);
  return cardio.progress(this.cardioPhases,draft.elapsedMs+elapsed);
 },
 resumeCardio(){
  if(this.cardioStartedAt!==null||!this.state.cardioDraft||this.state.cardioDraft.ended)return;
  this.cardioStartedAt=Date.now();
  wx.setKeepScreenOn?.({keepScreenOn:true});
  this.updateCardio();
 },
 pauseCardio(){
  if(this.cardioStartedAt===null)return;
  this.freezeCardio(false);
  this.updateCardio();
 },
 freezeCardio(ended){
  const progress=this.cardioProgress();
  this.cardioStartedAt=null;
  wx.setKeepScreenOn?.({keepScreenOn:false});
  const draft={...this.state.cardioDraft,elapsedMs:progress.elapsedMs,ended};
  const next={...this.state,cardioDraft:draft};
  if(!this.commit(next))this.state=next;
  return draft;
 },
 updateCardio(){
  if(this.data.screen!=='cardioTimer'||!this.state.cardioDraft)return;
  const p=this.cardioProgress();
  if(p.done){this.endCardio();return;}
  const running=this.cardioStartedAt!==null;
  const previous=this.data.cardioTimer;
  if(previous?.index===p.index&&previous.remaining===p.remaining&&previous.running===running)return;
  if(running&&p.remaining<=3&&p.remaining>0&&
   (previous?.index!==p.index||previous.remaining>3))wx.vibrateShort?.({type:'light'});
  this.setData({cardioTimer:{
   running,index:p.index,remaining:p.remaining,time:cardio.clock(p.remaining),
   progress:100*p.remaining/p.phase.seconds,
   type:p.phase.type,label:cardio.labels[p.phase.type],round:p.phase.round,
   roundsDone:p.roundsDone,config:this.state.cardioDraft.config,
   next:p.next?cardio.labels[p.next.type]:'训练结束'
  }});
 },
 toggleCardio(){if(this.cardioStartedAt===null)this.resumeCardio();else this.pauseCardio();},
 leaveCardio(){this.pauseCardio();this.show('today');},
 endCardio(){
  if(!this.state.cardioDraft||this.state.cardioDraft.ended)return;
  this.showCardioReview(this.freezeCardio(true));
 },
 showCardioReview(draft){
  this.show('cardioReview');
  this.setData({cardioResult:this.cardioDetails(this.cardioRecord(draft))});
 },
 cardioRecord(draft){
  const progress=cardio.progress(this.cardioPhases,draft.elapsedMs);
  return {id:draft.id,date:draft.date,type:'cardio',sport:draft.config.sport,
   seconds:Math.floor(progress.elapsedMs/1000),fastSeconds:Math.floor(progress.fastMs/1000),
   roundsDone:progress.roundsDone,rounds:draft.config.rounds,
   completed:progress.roundsDone===draft.config.rounds,intensity:this.data.cardioIntensity};
 },
 cardioDetails(record){
  return {...record,totalTime:cardio.duration(record.seconds),fastTime:cardio.duration(record.fastSeconds)};
 },
 chooseCardioIntensity(e){
  this.setData({cardioIntensity:e.currentTarget.dataset.value});
 },
 saveCardio(){
  const draft=this.state.cardioDraft;
  if(!draft?.ended)return;
  const record=this.cardioRecord(draft);
  if(!record.seconds)return;
  if(this.commit({...this.state,history:[record,...this.state.history],cardioDraft:null})){
   this.summary=record;this.summaryBack='today';this.show('cardioSummary');
  }
 },
 discardCardio(){
  const draft=this.state.cardioDraft;
  if(!draft?.ended)return;
  wx.showModal({title:'放弃本次有氧记录？',confirmText:'放弃',confirmColor:'#913d31',success:r=>{
   if(r.confirm&&this.state.cardioDraft?.id===draft.id&&this.commit({...this.state,cardioDraft:null}))this.show('today');
  }});
 },
 back(){this.show(['summary','cardioSummary'].includes(this.data.screen)?this.summaryBack:'today');},
 formChoice(e){
  const {field,value}=e.currentTarget.dataset;
  this.form={...this.form,[field]:['minutes','days'].includes(field)?Number(value):value};
  this.setData({form:this.form});
 },
 createPlan(){
  const next={...this.state,settings:this.form,choices:{},shift:''};
  if(this.commit(next))this.show('today');
 },
 toggleCore(){
  const settings=this.state.settings||t.defaults;
  if(this.commit({...this.state,settings:{...settings,core:!settings.core}}))this.sync();
 },
 shift(){
  const date=new Date();date.setDate(date.getDate()+1);
  if(this.commit({...this.state,shift:t.dateKey(date)})){this.sync();wx.showToast({title:'下一节已顺延',icon:'none'});}
 },
 filter(e){this.setData({filter:e.currentTarget.dataset.group});this.sync();},
 start(e){
  const s=this.state,core=e.currentTarget.dataset.core==='yes';
  if(!s.draft){
   const items=t.makeItems(s.settings||t.defaults,s.choices,core);
   if(!this.commit({...s,draft:{id:Date.now().toString(36),date:t.today(),core,example:!s.settings,items,index:0,restUntil:0}}))return;
  }
  this.seed();this.show('train');
 },
 seed(){
  const d=this.state.draft,i=d?.items[d.index], exercise=t.byId(i?.id);
  const prev=exercise?this.state.history.filter(h=>!t.isCardio(h)).flatMap(h=>h.items).find(x=>x.id===exercise.id&&x.sets.length):null;
  this.setData({reps:last(i?.sets||[])?.reps??prev?.sets[i.sets.length]?.reps??(exercise?.unit==='秒'?15:8),effort:'不确定',stable:true});
 },
 adjust(e){this.setData({reps:Math.min(99,Math.max(1,this.data.reps+Number(e.currentTarget.dataset.delta)))});},
 setEffort(e){this.setData({effort:e.currentTarget.dataset.value});},
 setStable(e){this.setData({stable:e.detail.value});},
 advance(d){
  while(d.index<d.items.length&&(d.items[d.index].skipped||d.items[d.index].sets.length>=d.items[d.index].target))d.index++;
 },
 record(){
  const next=clone(this.state),d=next.draft,i=d?.items[d.index];
  if(!i?.id||i.sets.length>=i.target)return;
  i.sets.push({reps:this.data.reps,effort:this.data.effort,stable:this.data.stable});
  d.restUntil=Date.now()+60000;
  this.advance(d);
  if(this.commit(next)){this.seed();this.sync();wx.pageScrollTo({scrollTop:0,duration:0});}
 },
 timerToggle(){
  const next=clone(this.state);
  if(!next.draft)return;
  next.draft.restUntil=this.data.rest?0:Date.now()+60000;
  if(this.commit(next))this.sync();
 },
 skip(){
  const next=clone(this.state),d=next.draft,i=d?.items[d.index];
  if(!i)return;
  i.skipped=true;this.advance(d);
  if(this.commit(next)){this.seed();this.sync({sheet:null});wx.pageScrollTo({scrollTop:0,duration:0});}
 },
 jump(index){
  const next=clone(this.state),d=next.draft,i=d?.items[index];
  if(!i)return;
  d.index=index;i.skipped=false;
  if(this.commit(next)){this.seed();this.sync({sheet:null});wx.pageScrollTo({scrollTop:0,duration:0});}
 },
 goMove(e){this.jump(Number(e.currentTarget.dataset.index));},
 previous(){if(this.state.draft)this.jump(this.state.draft.index-1);},
 forward(){
  const next=clone(this.state);
  if(!next.draft)return;
  this.advance(next.draft);
  if(this.commit(next)){this.seed();this.sync();}
 },
 listMoves(){this.setData({sheet:{type:'moves',title:'本次训练动作'}});},
 showArt(e){
  const exercise=describe(t.byId(e.currentTarget.dataset.id));
  if(exercise)this.setData({sheet:{type:'art',title:exercise.name,exercise}});
  else this.setData({sheet:{type:'gap',title:'待补水平拉'}});
 },
 closeSheet(){this.setData({sheet:null});},
 noop(){},
 replace(){
  const d=this.state.draft,item=d?.items[d.index];
  if(!item)return;
  if(item.sets.length){wx.showToast({title:'已有组记录，可先跳过',icon:'none'});return;}
  const choices=t.optionsFor(item.group,this.state.settings||t.defaults).filter(x=>x.id!==item.id);
  this.setData({sheet:{type:'replace',title:'替换动作',choices}});
 },
 choose(e){
  const id=e.currentTarget.dataset.id,next=clone(this.state),d=next.draft,i=d?.items[d.index];
  if(!i||i.sets.length||!t.byId(id)||!this.data.sheet?.choices?.some(x=>x.id===id))return;
  i.id=id;if(!d.core)next.choices[i.group]=id;
  if(this.commit(next)){this.seed();this.sync({sheet:null});}
 },
 stop(){
  wx.showModal({title:'现在结束训练？',content:'已完成的组会保存为部分训练。',confirmText:'结束训练',success:r=>{if(r.confirm)this.finish(true,'较差');}});
 },
 finishTap(e){this.finish(false,e.currentTarget.dataset.recovery);},
 finish(stopped,recovery){
  const next=clone(this.state),d=next.draft;
  if(!d)return;
  d.stopped=stopped;d.recovery=recovery;
  d.completed=!stopped&&d.items.every(i=>i.sets.length===i.target);
  const strengthHistory=next.history.filter(h=>!t.isCardio(h));
  d.advice=d.items.filter(i=>i.id).map(i=>({id:i.id,...t.advise(i,d,strengthHistory)}));
  next.history.unshift(d);next.draft=null;
  if(this.commit(next)){this.summary=d;this.summaryBack='today';this.show('summary');}
 },
 apply(e){
  const id=e.currentTarget.dataset.id,exercise=t.byId(id);
  if(exercise&&this.commit({...this.state,choices:{...this.state.choices,[exercise.group]:id}}))wx.showToast({title:'已调整下次训练',icon:'none'});
 },
 changeMonth(e){this.month.setMonth(this.month.getMonth()+Number(e.currentTarget.dataset.delta));this.filterDate='';this.sync();},
 selectDay(e){const day=e.currentTarget.dataset.day;this.filterDate=this.filterDate===day?'':day;this.sync();},
 clearDay(){this.filterDate='';this.sync();},
 openRecord(e){
  const record=this.state.history.find(h=>h.id===e.currentTarget.dataset.id);
  if(record){this.summary=record;this.summaryBack='mine';this.show(t.isCardio(record)?'cardioSummary':'summary');}
 },
 remove(e){
  const id=e.currentTarget.dataset.id,record=this.state.history.find(h=>h.id===id);
  if(!record)return;
  const detail=t.isCardio(record)?record.sport+' '+cardio.duration(record.seconds):t.groups(record)+' 组';
  wx.showModal({title:'删除这条训练记录？',content:record.date+' · '+detail+'。删除后日历与统计将同步更新。',confirmText:'确认删除',confirmColor:'#913d31',success:r=>{
   if(r.confirm&&this.commit({...this.state,history:this.state.history.filter(h=>h.id!==id)}))this.sync();
  }});
 }
});
