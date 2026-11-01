const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const cr=(a,b)=>{const[x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)};
const L={ink:'#16263f',ink2:'#21395c',muted:'#5a6478',link:'#1d4ed8',teal:'#0e7490',ok:'#166534',warn:'#9a3412',danger:'#b42318',
 white:'#ffffff',page:'#f4f6fa',s2:'#f8fafd',linkSoft:'#e8f0ff',tealSoft:'#e6f6fa',okSoft:'#ecfdf3',warnSoft:'#fff7ed',dangerSoft:'#fef3f2'};
const D={ink:'#f4f6fa',ink2:'#dce4f0',muted:'#a9b8ce',link:'#8fb4ff',teal:'#5fd0e6',ok:'#6ee7a0',warn:'#fdba74',danger:'#fda29b',
 surf:'#16263f',page:'#0f1a2c',s2:'#1b2f4d',linkSoft:'#1d3358',tealSoft:'#11364a',okSoft:'#12342a',warnSoft:'#3a2a1a',dangerSoft:'#3b1f20'};
const pairs=[
['light','ink on white',L.ink,L.white],['light','ink on page',L.ink,L.page],['light','ink2 on white',L.ink2,L.white],['light','muted on white',L.muted,L.white],['light','muted on page',L.muted,L.page],['light','muted on s2',L.muted,L.s2],
['light','link on white',L.link,L.white],['light','link on linkSoft (chip)',L.link,L.linkSoft],['light','teal on white',L.teal,L.white],['light','teal on tealSoft (chip)',L.teal,L.tealSoft],['light','ink2 on tealSoft (why box)',L.ink2,L.tealSoft],
['light','warn on warnSoft',L.warn,L.warnSoft],['light','ink2 on warnSoft',L.ink2,L.warnSoft],['light','danger on dangerSoft',L.danger,L.dangerSoft],['light','ink2 on dangerSoft',L.ink2,L.dangerSoft],['light','white on link (primary btn)','#ffffff',L.link],['light','white on link hover','#ffffff','#1e40af'],
['dark','ink on surface',D.ink,D.surf],['dark','ink on page',D.ink,D.page],['dark','muted on surface',D.muted,D.surf],['dark','muted on page',D.muted,D.page],['dark','link on surface',D.link,D.surf],['dark','link on linkSoft',D.link,D.linkSoft],
['dark','teal on tealSoft',D.teal,D.tealSoft],['dark','warn on warnSoft',D.warn,D.warnSoft],['dark','danger on dangerSoft',D.danger,D.dangerSoft],['dark','ink2 on tealSoft',D.ink2,D.tealSoft],
];
let fail=0;for(const[m,n,f,b]of pairs){const r=cr(f,b);const ok=r>=4.5;if(!ok)fail++;console.log(`${ok?'PASS':'FAIL'} ${m.padEnd(5)} ${n.padEnd(30)} ${r.toFixed(2)}`)}
console.log(fail?`${fail} FAILED`:'all pass');process.exit(fail?1:0);
