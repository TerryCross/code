/* sfs-utils.js v0.1.5 */

// ==UserLibrary==
// @pseudoHeader
// @name        SFS Utils
// @version     0.1.5
// ==/UserLibrary==

// Script must have a version of: 
//
//           // @require     https://raw.githubusercontent.com/SloaneFox/code/master/gm4-polyfill-1.0.1.js
//
// in header to use this module userscript.  Also for use of cmdrepl console function below grant of GM register command is required.

// See below for functions:
//    function log(arguments);  // prints correct line number under GM4, due to scope wrapper the given one is incorrect.
//    function cmdrepl(e,immediate_flag);  //  Launch a js console from any place in the code &/or register one from a menu.  Set immediate to launch console directly, without it it registers a menu item to launch a cmd console. 
//    function logNewNodes();    // Logs to console any new nodes (uses a mutation observer).
//    var sname;   // Set to GM info's script.name.
//    function GMDataEditor(scriptname); // Adds menu command to edit GM storage of given userscript.

function logError(msg,e,...extras) { console.error("Error,",msg,".  After offset is on line:",Elineno(e),", offset used:",-sfs_ut_offset,"Error msg:",e.message,"Stack:\n",e.stack, extras); }
function typeofObj(unknown_obj){ return ({}).toString.call(unknown_obj).substr(8).slice(0,-1); }
function Elineno(e) { return e.lineNumber-sfs_ut_offset; }

function objInfo(obj) {

	switch(typeofObj(obj)) {
		
	case "Event": return "Event:"+obj.type+" "+objInfo(obj.target);
	case "Function": return obj.toString().substr(0,200);
	case "String":
	case "Number": return obj;
	default: 		
		var node=obj;
		if(node.jquery) node=node[0];
		if (!node) return "<empty>";
		return (node.tagName||node.nodeName)+" "+(node.id?"#"+node.id:"")
			+(node.className?node.className:"").replace(/\b(?=\w)/g,".");
	}
}

function log() { // Prints lineno of logging not this lineno.   //if (!Plat_Chrome) old_GM_log(t);};
	var args=Array.from(arguments), lineno=parseInt(logStack(0,1))-sfs_ut_offset, pnewline,
		locator="\t\t\t[ "+lineno +":"+ sname+ " "+( window!=parent? ("wname:"+window.name? window.name:"-") +" @"+location+", rstate: "+document.readyState:"") + " ]";
	args.push(locator);
	console.log.apply(console, args);
	// In general it is console.log("%c a msg and another %c meggss","float:right","float:left;",anobj,"text","etc");

	function logStack(fileToo, lineno_of_callee) { // deepest first.
		var res="", e=new Error;
		var s=e.stack.split("\n");                        //if (fileToo) res="Stack of callers:\n\t\t"; //+s[1].split("@")[0]+"():\n\t\t"
		if (lineno_of_callee) return (s[2].match(/:\d+(?=:)/)||[""])[0].substr(1); // Just give line number of one who called the function that called this, ie, geives lineno -f callee.
		for (var i=1;i<s.length-1;i++)
			res+=s[i].split("@")[0]+"() "+s[i].split(":").slice(-2)+"\n";
		return !fileToo ? res : {Stack:s[0]+"\n"+res}; 
	}
};

if (log.lineoffset==undefined) { // cos ff58 has linon at 360 + script lineno.
	var ver=0,offset=0,ver_pos=navigator.userAgent.indexOf("Firefox/");
	if (ver_pos!=-1) {
		let v=parseInt(navigator.userAgent.substr(ver_pos+8));
		if (v>=58 && v<60) offset=360; 
		if (v>=60)         offset=492;
		if (v>=63)         offset=504;
	}
	log.lineoffset=offset;
}

const sfs_ut_offset=offset;

function logNewNodes() {
	new MutationObserver((mutations, observer) => {try{
		for (m of mutations) for (n of m.addedNodes) {
			console.log("Node added",n.nodeName,(n.nodeType!=3 ? n : n.textContent.substr(0,40)+"..."));
			if(n.nodeName=="IFRAME") { 
				$(n).removeAttr("sandbox"); 
				n.addEventListener('load', function (e) {console.log("Loaded IFRAME",location,n,"this:",this);});
			}
		}
	}catch(e){console.error("logNewNodes error",e.lineNumber,e);}})
		.observe(document.documentElement, {childList: true,subtree:true});
}

// Call cmdreply to get js console at that point.   Pass reg in to register cmd console as a menu command.
// If cant register cmd, invoke immediately.

var sname= typeof GM != "undefined" ?  GM.info && GM.info.script.name : "noscript name";

async function cmdrepl(e={},immediate,...args) {               // When called from GM menu e is set to event.
	if(!immediate && !cmdrepl.regdone) {          // if (typeof GM_registerMenuCommand!="undefined" && document.body)
		cmdrepl.regdone=true;
		setTimeout(function(){ 
			//console.log("in sfs_utils GM.","abc"+GM_registerMenuCommand);
			GM_registerMenuCommand("JS repl",cmdrepl); GM.registerMenuCommand("JS repl",cmdrepl); // reg in both 
		},2000);
		return;
	}
	ls={}; 
	try { let tmp=localStorage.reply; ls=localStorage; } catch(e){}
	var res=e.message||sname+", enter command:",reply=ls.reply||"cmd";
	while(reply) {
		reply=prompt(res,reply);
		if(!reply) break;
		ls.reply=reply;                   
		try{ res=await eval(reply); console.log(reply,"==>",res);res="==>"+res; } catch(e) {console.log("cmd err",e); cmdrepl(e);}
	}
}


function GMDataEditor(scriptname) {  

	// Scripts using this need header item: // @grant for each of the value commands: listValues, getValue, setValue, deleteValue, 
	// Use by calling this function passing in the user script name, this will add to the GM command menu, page 
	// context menu, "Edit data stored for this script, [scriptname]".
	// Jquery is also required by this script, so include it as a userscript header require.

	if(typeof submenuModule != "undefined" && submenuModule.state!=null) GM_registerMenuCommand("Edit data stored for this script, "+scriptname,openEditor);
	else GM.registerMenuCommand("Edit data stored for this script, "+scriptname,openEditor);

	async function openEditor(){try{
		var wrapper=$("#aedc-wrapper");
		if(wrapper.length) wrapper.remove(); // old one left there.

		var allNames=await GM.listValues(), roll="";
		console.log("all Names in script GM store:",allNames);
		var namevalues_before=new Map(), namevalues_after=new Map();

		for (let name of allNames) {
			namevalues_before.set(name,await GM.getValue(name)); 
			//console.log("set map name:",name," to: ",namevalues_before.get(name));
		}
		// await allNames.forEach(async name=> { 
		// 	namevalues_before.set(name,await GM.getValue(name)); 
		// 	console.log("set map name:",name," to: ",namevalues_before.get(name));
		// });
		
		//console.log("Have MAP size:",namevalues_before.size,namevalues_before, "len",namevalues_before.length);

		var built_text=await allNames.reduce(async (acc_namevalues,curr_name,i)=>{
			var value=await GM.getValue(curr_name);
			return (await acc_namevalues)+`<b>${ordinal(i+1)} Name:</b><br><div class=aedcName>${curr_name}</div><br>
	<b>Value:</b><br><div class=aedcValue>${value}</div><br>`;
		},"");

		var div=$(`<div id="sfs-wh-maindiv"><u><b>Name/Value List</u><br><br></b>${scriptname} GM stored values (reload to remove, repeat menu command to refresh name/values).<br>The below names/values are editable.  Number of name/value pairs: ${allNames.length}<br><br>${built_text}<b>END.</b><br><br><br> </div>`)
			.prependTo("body");

		console.log("Added to body",$(".aedcName,.aedcValue",div));
		
		$(".aedcName,.aedcValue",div).attr("contenteditable","true");
		div.wrap("<div id=aedc-wrapper>");
		wrapper=$("#aedc-wrapper");

		var button=addClickButtonTo(wrapper,"Save edited Name/Value pairs......",async e=>{try{
			console.log("Len of name value class divs",$(".aedcName,.aedcValue",div).length);
			var reply=confirm("Save data, cancel to remove.");
			if(!reply) { $(e.target).parent().remove(); return; }
			var nv_texts_1dar=$(".aedcName,.aedcValue",div).get().map(el=>{
				//log(" NV map returning text:",el.textContent);
				return el.textContent;});
			namevalues_after=new Map(pairup_array(nv_texts_1dar));

			// 4 cases, 1: Name blanked (new val will be undef).  2: Value blanked (new val is "").
			//          3: Edit of value (new val is set).     4: Edit of name (undef old val for new name).

			for(let [old_name,old_value] of namevalues_before){
				var new_val=namevalues_after.get(old_name);
				if( ! new_val ) { await GM.deleteValue(old_name); continue; }
				if( new_val != old_value); {await GM.setValue(old_name,new_val);continue;}
			}
			for (let [new_name,new_val] of namevalues_after) {
				var old_val=namevalues_before.get(new_name);
				if (new_name && !old_val && new_val) { 
					await GM.setValue(new_name,new_val);
					console.log("Change in NM, \nNew name:",new_name,"\nNew val",new_val,"\nOld val:",old_val);
				}
			}
			// End the 4 cases.
			// 
			var merged_map=new Map([...namevalues_before,...namevalues_after]);
			console.log("Merged MAP:",merged_map);
			alert("Saved data.");
		}catch(e){console.error("Button error",e);}},"Click here to save or to remove/quit.","prepend"); //end invoke of addClickButtonTo

		div[0].scrollIntoView();
		button[0].scrollIntoView();
		//div.css("transform","translateZ(0)");
		wrapper.css({
			zIndex:2147483647, position: "absolute", 
			backgroundColor:"whitesmoke", padding:"20px", top:0, //width:"100%",
			fontSize:"medium", maxWidth: "intrinsic", width: "-moz-max-content"
		});

	}catch(e){console.error("Error in GMDataEditor,",e);}}; // end openEditor()

	function parse(str){ try { return JSON.parse(str); } catch(e){} };	
	function ordinal(n) { var sfx = ["th","st","nd","rd"];var val = n%100;return n + (sfx[(val-20)%10] || sfx[val] || sfx[0]);}
	// function addClickButtonTo(elem,buttonLabel,cb) {
	// 	var style="position:fixed; background-color:green;color:whitesmoke; cursor:pointer;border:#f0f0f0 20px ridge";
	// 	return $("<div class='sfs-button' title='Click to save or to remove list of name/values.\n\nAdding newlines to unquoted names does not affect them,\nsince JSON ignores newlines and space except when in a string type.' style='left:400px; bottom:50px; "+style+"'>"+buttonLabel+"</div>")
	// 		.appendTo(elem)
	// 		.click(function (e) { e.preventDefault();cb(e);	});
	// }
	function addClickButtonTo(elem, buttonLabel, cb, title, prepend) {
		var border_style=`border-top: solid 4px #8f8f8f;	border-bottom: solid 4px #1a1a1a;	border-left: solid 4px #4f4f4f;	border-right: solid 4px #4f4f4f;	border-radius: 20px;`;
		var pressed_effect=`.sfs-button:hover  {  background: linear-gradient(#4f4f4f,#1d1d1d);} .sfs-button:active {  background: linear-gradient(#000,#fff);  box-shadow: 0 5px #666;  transform: translateY(4px); }`; //(#4f4f4f,#1d1d1d);} 
		var btn_style=`height: 70px;  color: #171717; margin:10px; padding: 0 30px;  outline:none; 
                    background:linear-gradient(280deg, #1d1d1d 10%, #4f4f4f,#1d1d1d  85%);`;  //linear-gradient(#1d1d1d, #4f4f4f); 
		var text_style=`font-size: 30px;	line-height: 70px;	font-family: verdana, sans-serif;	font-weight: bold;	text-shadow: 0px 2px 3px #555;`;
		
		var btn_css=".sfs-button {"+btn_style+text_style+border_style+"} "+pressed_effect;
		if ( ! $("#sfs-add-btn-css").length) $("head").append($("<style id=sfs-add-btn-css>"+btn_css+"</style>"));
		var bdiv=$("<button class=sfs-button title='"+title+ "' >"+buttonLabel+"</button>");
		if(!prepend) elem.append(bdiv); else elem.prepend(bdiv);
		
		bdiv.click(function (e) { e.preventDefault();cb(e);	});       //.dblclick(function(e){elem.remove();});
		return bdiv;
	}
	
	function pairup_array(ar) { // converts 1d to 2d, eg, [1,2,3,4] ==> [[1,2],[3,4]]
		var res_ar=[];
		ar.reduce((prev_curr,curr,curr_i)=>{ if(curr_i%2) res_ar.push([prev_curr,curr]);return curr;  });
		return res_ar;
	}
} //end GMDataEditor()
