/* gm-popup-menus-1.3.6.js */
// ==UserLibrary==
// @pseudoHeader
// @version     1.3.6
// @name        GM Popup Menus
// @require     https://code.jquery.com/jquery-3.2.1.js
// @require     https://raw.githubusercontent.com/SloaneFox/code/master/gm4-polyfill.js
// @license     GPL-3.0
// @copyright   2017, slow! (https://openuserjs.org/users/slow!)
// @namespace   sfsOms
// @description Library for use in userscripts to overrid GM_registerMenuCommand to provide jquery dialog popup submenus.
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM.getValue
// @grant       GM.setValue
// @grant       GM4_registerMenuCommand
// @exclude     *
// ==/UserLibrary==

//
// @updated  Feb 2018.  Adapt to GM4, use new name "GM4_registerMenuCommand Submenu", the 4 indicating its use in GM4 onward.
// @updated  Dec 2017.  Use the submenuModule object to access document.activeElement that was set on webpage prior to menu click; use submenuModule.activeElement variable to access it.
// @updated  Nov 2016.  Chrome adaptation, color settings now per userscript menu.
// @updated  May 2016.  Bugfix for google image site, see createElement("style") below.  Also fix for iframes used as textareas x 2.
// @updated  Feb 2016.  1.1.2 Works also on Google Chromium.  Adds positioning of menu-command within submenu.
//
// Function: With this script all GM-menu-commands are given a separate submenu under
// Tools-->Greasemonkey-->User Scripts Commands...--><your script's menu name>...
// When clicked on this opens a submenu on the page with all your script's menu items that
// have been registered as usual by the use of GM_registerMenuCommand("name", function);
//
// This script is a 'library script,' for use only within a userscript, ie, a .user.js file.
// Two things are needed for this library to function. Firstly, put two @requires in the header of your userscript:
//
//   // @require  https://raw.githubusercontent.com/SloaneFox/code/master/gm4-polyfill.js
//   // @require  https://raw.githubusercontent.com/SloaneFox/code/master/GM4_registerMenuCommand_Submenu_JS_Module.js
//   -- note this results in the creation of an object called "submenuModule" within the js closure scope.  @grant additions
//      may also be required in the header of your script, the pseudo header only indicates which you must add to your script.
//
// Secondly, you must then put a call to this new object, "submenuModule"'s register() function in your script's code, making sure that
// this is early enough and is prior to the usual registering of any menu commands with GM_registerMenuCommand:
//
//    submenuModule.register("my script's menu cmd name", [hotkey], [title-color], [title-bg-and-menu-color] );
//
// The second argument is optional, 'm' is the default for hotkey.
// Unlike GM the shortcut also works from within iframes.  Optional color parameters must be in style similar to #ffeeff.
// The interface to the submenuModule also contains a function to remove elements from the menu,
//
//    submenuModule.unregister(name);       // name is a string and can be a regexp string.
// 
// The 'accessKey' parameter is not implemented yet.
// An addition to registering a menu is the ability to change the name
// of a command, eg,
//                   submenuModule.changeName(existingName,newName);
//
// Or to change the position within an existing list:
//
//                   submenuModule.positionAt(name, new_position);        // Zero counting is used.  Name is a string and can be a regexp string.
//
// If this is used in more than one script, GM menus will be grouped together, to disable this call submenuModule.ungroup(); prior to calling submenuModule.register().
// For proper grouping the scripts must also be run consecutively by setting the "Execution
// Order" in GM menu option "Manage User Scipts..." and then right clicking on the script to change the Execution Order.
// It may also be necessary to remove "// @run-at document-start" from script headers.
//
// Other functions/properties in the submenuModule interface are: stop(), open(), close(), ineffect (boolean).
//
// If openuserjs.org where this lib script is stored is down or busy and GM needs to update this script
// you may need to bracket the calls to submenuModule with try/catch.
// If not loaded by Require in script header ensure module is loaded using the correct "this" pointer.
//
// GM version 4 has removed the GM_registerMenuCommand function.  This library retains it and you'll see
// little need to update relevant code.  The user will see changes since the menu option under GM button 
// is gone.  Initiating menu will now use mouse context menu (right mouse button usually) on webpage
// When run on older GM versions this context menu can now also be used by coding with:
// 		var reg_args=["name",function];
//		if(!GM_registerMenuCommand(...reg_args))  GM.registerMenuCommand(...reg_args);
// This creates two menu items, once in the usual GM commands menu and in the webpage's mouse context menu.

if(!window.old_GM_reg) window.old_GM_reg=GM_registerMenuCommand||this.GM_registerMenuCommand;
var GM_registerMenuCommand;   //Uses closure to ensure a different function for each simulataneous userscript caller of this function.

var submenuModule=(function() { try {  // a module, js pattern module, returns interfaceObj.  ownSubmenu() is a closure returning
	// an interface object in scope of 'this'.  Side effect alters GM_registerMenuCommand.  Not window.submenuModule clash of multiusage.
	var sify=JSON.stringify, ownSubmenu, ownSubmenuList, xbutton, body, state=null;
	var coord_id=1, $, nlist=1, scriptName, altHotkey=77, thishere, list_orig_height, chromeButton, queue;
	var regmutex, osmlisel="li.osm-button",lis, uw=unsafeWindow, cmd, ln="\u2501", menuwrap, shrink_factor, header;
	var iframe=window!=window.parent, lmarg=window.innerWidth*0.04, blank_textContent=false;    //77==m, 0.04==4%.
	var init=async function(script_name, hotkey, title_color, itsBackgroundColor) //is submenuModule.register() 
	{ try {
		scriptName=script_name||"";
		regmutex=new mutexlock(); // Lock is just to ensure init is complete before user commands are registered.
		GM_registerMenuCommand=registerInOwnSubmenu;
		await preInit();
		queue.push(coord_id);		queue.sort();     // In GM execution order.  Some may not call register();
		$=ensurejQuery(); //console.log("GM4_rMC Jquery version:",$.fn.jquery);
		if (hotkey) altHotkey=hotkey.charCodeAt(0)-32;
		createOwnSubmenu(hotkey, title_color, itsBackgroundColor); //html setup
		ownSubmenu.hide();		    ownSubmenu.find(".osmXbutton").click(closeSubmenu);		ownSubmenu.append(ownSubmenuList);
		if (window.plat_chrome)     setUpChromeButton();
		interfaceObj.ineffect=true; document.addEventListener("coord_resize",coord_resize);
		$(window).on("keydown",function(e) { if (e.altKey&&e.keyCode==altHotkey) {  openSubmenu(); return false;}}); // alt-m or hotkey shortcut
		$(docready);	state="init";
		$(document).on("coord_GM_menu", coord_GM_menu);
		if (document.readyState=="complete") docload();	else $(docload); //start-at may mean no body yet.  $(func) is same as window.ready(func), also runs function even if already ready.
		regmutex.unlock();
	} catch(e){
		console.info("GM4_registerMenuCommand_Submenu_JS_Module.  Failed to load/init submenuModule, "+script_name,e,"this is:",this);
		if (old_GM_reg) GM_registerMenuCommand=old_GM_reg; // revert on failure
	} }, //init().   
	docready=function() { // Setup menuwrapper and add own submenu div.  Prior to docload, have body.
		body=$("body");
		menuwrap=$("#osm-menuwrap");
		menuwrap.hide();
		if (!menuwrap.length) {
			var point_of_attachment=body, gm_button=$("#GM_menu_button"), pos_css="left:15%;top:15%;";
			if (gm_button.length) { point_of_attachment=gm_button; pos_css="right:30px;"; }
			point_of_attachment.append(menuwrap=$("<div id=osm-menuwrap style='position:fixed;"+pos_css+"z-index:2147483647 ;display:table;'></div>"));
		}
		menuwrap.append(ownSubmenu);
		//console.log("Check on body ",body.children().length," is osm:",body.children().is("#osm-menuwrap"));
		
		if  (iframe && (body.attr("contenteditable") == "true"  ||
						(body.text() == "" || (body.children().length <= 3 && body.children().is("#osm-menuwrap")) ) ) )
		{   //Pages commonly post all text content of such bodies (often in iframes), so blank the menu text, titles give text instead.
			blank_textContent=true; //&& iframe
			ownSubmenu.find(".menu-title, .osmXbutton, "+osmlisel).text("");
			ownSubmenu.prop("title",scriptName+" (double click to close)");
			menuwrap.attr("osm-blankit","true");
		}
		if (menuwrap.attr("osm-blankit")) { menuwrap.find(".menu-title, .osmXbutton, "+osmlisel).text("");blank_textContent=true; }
	},
	docload=function() {       //Problem in ordering original GM menu, if init not called from one script within 2 secs.
		var tout=uw.osm_queue.length==uw.osm_max ? 0 : 2000;
		setTimeout(function(msec){ //wait for other scripts to init for grouping.
			if (uw.osm_shutdoor) return;
			console.log(scriptName,coord_id,"shut door on queue:",uw.osm_queue,"max:",uw.osm_max);
			handleIframeSize(); // NB, only one client handles this and below.
			makeDraggable($(".osm-box"));
			uw.osm_shutdoor=true;
			uw.osm_max=uw.osm_queue.length; //Don't wait for one that never init.s.
			for (let i=0;i<uw.osm_max;i++) dispatch("coord_GM_menu",uw.osm_queue[i]); // emits one event for each coord_id ir oder from 1 up.
		},tout); /// close inits after this time passed??
	},
	coord_GM_menu=function(e){  // Custom Event handler
		var detail=e.originalEvent.detail,menu;
		
		if(Number(detail)) { if (detail!=coord_id) return; }// Only handle event directed by coord order.
		else if (detail && detail.chromeButton) { if (interfaceObj.isOpen) closeSubmenu(); else {console.log("OPEN submenu detail"); openSubmenu();} return;} //Behaviour, instead, if in queue then either just init or is open.
		
		if (!coord_GM_menu.done) coord_GM_menu.done=true; else return;
		groupBracketing();
		var str=(scriptName||"Submenu")+".....", sp="\u2001",  vln="\u2503"; // ┃ 2503, 2500, 2502 for thin, //graphic-space 3000
		if (!uw.osm_menu_grouping) vln="███";                                // nchars("\u2588",3); //2b1b
		if(!old_GM_reg(vln+" "+str, openSubmenu))  // Register in both GM menu and contextmenu.
			GM.registerMenuCommand(vln+" "+str, openSubmenu);                //GM will not register commands from an iframe.               //\u2502, 03 also
		groupBracketing(true);
		if (uw.osm_queue.length>=3)
			menuwrap.css({top:10,left:lmarg});
		//queue.splice(queue.indexOf(coord_id),1); //removes from queue, must be there first!
	},
	registerInOwnSubmenu=async function(name,func,accessKey) {
		await regmutex.lock;
		if (/^\s*function\s*\(\s*\)\s*{\s*}/.test(func.toString())) return;
		var li=$("<li class=osm-button title='"+name+"' tabindex="+(nlist++==1 ? 1:"''")
				 +" style='margin-top:2px;font-size:small;display:block;'>"+name+"</li>");
		if (blank_textContent) li.text("");
		li.click(function(e){
			var ae=window.document.activeElement;
			//console.log("In registerInOwnSubmenu ae is",ae);
			closeSubmenu(true);
			//body.trigger("click");
			dispatch("coord_resize",{please:"close"});
			setTimeout(func,100); return false; } );
		ownSubmenuList.append(li);
	},
	openSubmenu=function() {
		interfaceObj.activeElement=document.activeElement;
		if (interfaceObj.isOpen) return; interfaceObj.isOpen=true;
		var diagdist=Infinity;
		if (uw.osm_queue.indexOf(coord_id)==-1) uw.osm_queue.push(coord_id);
		lis=ownSubmenuList.find("li");
		menuwrap.show();
		ownSubmenu.show(300, function(){ // called on completion; slowly changes opacity. jQuery creates an undisplayed table during this for some reason.  If error in thread this may leave elements half open.
			var size=[menuwrap.width()|0,menuwrap.height()|0];
			//console.log(scriptName,"On openSubmenu after menu show, size WxH:",size,"mwrap:",menuwrap[0]);
			userResizeIframe(size);
			if (!list_orig_height) list_orig_height=ownSubmenuList.height();
			setTimeout(coord_resize,50); //dispatch("coord_resize"); //			coord_resize();
			if (coord_id!=uw.osm_queue.slice(-1)) return; //Last menu to open focuses menu at top left.
			var boxes=$("div.osm-box").each(function() { var p=$(this);p.data("diagdist",p.position().left*10+p.position().top);});
			uw.osm_queue.sort(function(a,b){ return boxes.filter("#ownSubmenu"+a).data("diagdist") - boxes.filter("#ownSubmenu"+b).data("diagdist"); });
			if (uw.osm_last_focus) { uw.osm_last_focus.focus(); }
			else { boxes.filter("#ownSubmenu"+uw.osm_queue[0]).focus(); }
		}); //.show()
		ownSubmenu.on("focus.osm",function(e){
			//console.log("ownSubmenu.on ficus, ae",document.activeElement);
			ownSubmenuList.focus();});
		ownSubmenu.on("dblclick.osm",function(e){
			if ($(".osm-header",ownSubmenu).text()=="")	closeSubmenu();
			else toggleMenu();});
		ownSubmenuList.on("focus.osm",function(e){ $(":first",this).focus();});
		lis.on("focus.osm",function(e){
			//console.log("lis.on ficus, ae",document.activeElement);
			var t=$(e.target);
			window.status=t.text();
			//lis.removeClass("osm-selected");
			t.addClass("osm-selected"); t.removeClass("osm-not-selected");
			uw.osm_last_focus=e.target;
		});
		lis.on("blur.osm",function(e){
			var t=$(e.target);
			$("li.osm-not-selected").removeClass("osm-not-selected");
			t.removeClass("osm-selected");
		});
		body.on("click.osm",function(e){
			var t=$(e.target);
			e.target.focus(); //needed on chromium.
			if (t.is("li.osm-button") || (t.closest("div.osm-box").length==0 && t.closest("div#GM_menu_button").length==0) && ! /menuitem/i.test(t[0].tagName)) {
				//console.log("body click on target",t[0].tagName,"if osm-button or not child of osm & button");
				closeSubmenu(e.clientX==0 && e.clientY==0);
			} // close if body clicked but not bubbled from a menu item.
		});
		body.on("keydown.osm", keyhandler);
	},  //openSubmenu()
	keyhandler=function(e){
		//console.log(scriptName+" keyhandler "+e.which+" coord_id:"+coord_id+" activeCoord_id "+activeCoord_id(),"act.el:", document.activeElement, iframe, document.documentElement);
		
		switch(e.which) {
		case 27: if ((coord_id==activeCoord_id()) || !coord_id || !activeCoord_id()) closeSubmenu(); else return true; break; //escape
		case 9:  //tab
			var cid=activeCoord_id();
			var q=uw.osm_queue.slice(), pos=q.indexOf(cid);if (pos==-1) pos=0;
			if (q.length==1) return arrowSelect(e.shiftKey?-1:1);
			if (e.shiftKey) q.unshift(q.pop()); //rotate last to start //circular linked list
			else q.push(q.shift());             //rotate first to end
			pos=q.slice(pos,(pos+1));
			if (chromeButton) $("#ownSubmenu"+pos)[0].tabIndex=0;
			$("#ownSubmenu"+pos).focus(); //.find("li:first");
			break;
		case 40: return arrowSelect(1);break; //down
		case 38: return arrowSelect(-1); break; //up
		case 13: $(document.activeElement).click(); break;//enter
		default: return true;
		}
		e.stopImmediatePropagation(); 
		return false; //calls preventDefault(), and stopPropagation(), which only stops parent handlers not ones directly on this level.
	}, //keyhandler()
	closeSubmenu=function(now) {
		userRevertIframeSize();
		interfaceObj.isOpen=false;
		toggleMenu("close"); //in case it's maximized
		uw.osm_queue.splice(uw.osm_queue.indexOf(coord_id),1); openSubmenu.push=true;
		if (now===true) { ownSubmenu.hide(); dispatch("coord_resize");} //document.dispatchEvent(new Event("coord_resize"));}
		else ownSubmenu.hide(400,function() {
			dispatch("coord_resize");}); //document.dispatchEvent(new Event("coord_resize")); });
		ownSubmenu.off(".osm");
		ownSubmenuList.off(".osm");
		body.off(".osm");
		lis=ownSubmenuList.find("li");
		lis.off(".osm");
		lis.removeClass("osm-selected osm-not-selected");
		var lastf=uw.osm_last_focus;
		$("#ownSubmenu"+uw.osm_queue[0]).focus();
		uw.osm_last_focus=lastf;
		if (uw.osm_queue.length==0) uw.osm_allclosed=true;
		return false;
	},
	coord_resize=function(e,ex,ex2) { 
		if ( ! interfaceObj.isOpen) return;
		//console.log("coord_resize()", scriptName,ex,ex2, "Event:",e,( e ? ["Details",e.detail,e.originalEvent] : "no e"));
		if (e && e.detail) { closeSubmenu(); return; }
		var portalh=Math.min(window.innerHeight,$(window).height())-10, available_height, available_width, portalw=Math.min(window.innerWidth,$(window).width()-lmarg);
		available_height = portalh - ownSubmenu.position().top - shrink_factor*(header.height() + 22); //$.height ignores "box-sizing: border-box" which normally includes paddings & borders but not margins.
		var new_h=Math.max(Math.min(75,list_orig_height), Math.min(available_height, list_orig_height)); //position relative to window not document, use: ownSubmenuList.offset().top - $(window).scrollTop(). viewport height.
		if (new_h != ownSubmenuList.height()) {
			ownSubmenuList.height(new_h);
			var newsh=Math.min(portalh/menuwrap.height(), portalw/menuwrap.width());
			uw.osm_shrink_factor[0]=Math.max(newsh,0.5);
			menuwrap.css({transform:"scale("+shrink_factor+")", transformOrigin:"top left"});//factor no effect of height() values but fully affects position() values.
			if (!chromeButton) menuwrap.css({top:10,left:lmarg});
		}
	},
	arrowSelect=function(step){ //-1 prev, +1 next
		var ae=$(document.activeElement);
		//console.log("arrow ",ae,", li's length:",lis.length,"step",step,"index:",lis.index(ae));
		if ( ! ae.is(lis)) return true;
		var theli=lis.eq((lis.index(ae)+step)%lis.length);
		if (chromeButton) theli[0].tabIndex=0;
		theli[0].focus(); //relies on -1 as last el.
		return false;
	},
	groupBracketing=function(closing_bracket) {
		if (!uw.osm_menu_grouping) return; var args,opening_bracket=true; // GM_registerMenuCommand has no effect in an iframe anyhow.
		if (!closing_bracket && coord_id==uw.osm_queue[0])  //Only menu at top of the queue opens gm command marker.
			args=["┏"+nchars(ln,17)+"┓" , function(){alert(coord_id+" "+location);}];
		else opening_bracket=false;
		if (closing_bracket && coord_id==uw.osm_queue.slice(-1)) 
			args=["┗"+nchars(ln,17)+"┛", function(){}];
		else closing_bracket=false;
		if(args) {
			var menuitem=old_GM_reg(...args);           //\u005f, low line.  \u2501, "━"]
			if(!menuitem) menuitem=GM.registerMenuCommand(...args);
			menuitem=$(menuitem);
			if(menuitem.length) {
				if(opening_bracket) menuitem[0].id="sfs_GM4_menu_opener";
				else if (closing_bracket) {
					menuitem.parent().prepend($("#sfs_GM4_menu_opener").add(menuitem.prevUntil("#sfs_GM4_menu_opener").addBack()));
				}
			}
		}
	},
	toggleMenu=function(close) { //toglle maximization.
		if (close && ! toggleMenu.tf) return;
		if(!toggleMenu.tf) { //enlage
			$(".osm-header",ownSubmenu).css("background","red");
			toggleMenu.old_height=ownSubmenuList.height();
			ownSubmenuList.height("auto");
			menuwrap.css({transform:"scale(1)"});
			ownSubmenu.css({transform:" translate("+ (-ownSubmenu.position().left) +"px, "
							+ (-ownSubmenu.position().top) +"px)"
							+" scale("+Math.min(
								(window.innerWidth-lmarg)/(24+ownSubmenu.width()),            //+","
								(window.innerHeight-10)/(24+ownSubmenu.height())
							)
							+")",       //24 since jq gives bare height not content-box, can get $().css("height") for net height but has "px" appended.
							transformOrigin :"top left", zIndex:2147483648});
		}
		else { //revert size
			$(".osm-header",ownSubmenu).css("background","none");
			ownSubmenu.css({transform: "scale(1)",zIndex:2147483647});
			menuwrap.css({transform:"scale("+shrink_factor+")"});
			ownSubmenuList.height(toggleMenu.old_height);
		}
		toggleMenu.tf?toggleMenu.tf=0:toggleMenu.tf=1;
	}, 
	rmitem=function(name) {
		var match=matchItem(name);
		match.remove();
	},
	mvitem=function(oldname,newname,positionAt) {  // oldname is regexp.
		var foundli=matchItem(oldname);
		oldname=foundli.text();
		if(typeof newname != "string") newname=oldname.replace(...newname);
		if (oldname!=newname) { foundli.text(newname); foundli.prop("title",newname); } // renames it.
		if (positionAt!=="" && !isNaN(positionAt)) {
			var liatpos=ownSubmenuList.find("li").eq(positionAt);
			if (liatpos.length) {
				liatpos.before(foundli);
				foundli.attr("tabindex",positionAt);
			} ownSubmenuList.append(foundli); //move to end.
		} //else stay in position.
	},
	positionAt=async function(name, newpos) { //name is regexp
		await regmutex.lock;
		mvitem(name,name,newpos);
	},
	matchItem=function(name) {
		var regex = new RegExp(name); // expression here
		return $(osmlisel,ownSubmenuList).filter(function () {
			return regex.test($(this).text()); 
		});
	},
	revert=function(){
		GM_registerMenuCommand=old_GM_reg;
		interfaceObj.ineffect=false;
		//TD, closeSubmenu and register all command functions with GM_
	},
	unGroup=function() { uw.osm_menu_grouping=false; },
	activeCoord_id=function(){ return $(document.activeElement).closest(".osm-box").data("coord_id");},

	////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//Overview of layout shape of pseudo HTML Tree:
	//                               <div id=osm-menuwrap>                                 // var menuwrap
	//                                 <div id=ownSubmenu(coord_id) class=osm-box>         // var ownSubmenu
	//                                   <div class=osm-header>                                    // var header
	//	                                        <\b> <\b>  <\b>    
	//                                   <ul id=ownSubmenuList>                          // var ownSubmenuList
	//                                       <li class=osm-button id=ownSubmenuList(coord_id)> // var osmlisel
	//                                       <li>...</>..<li>s                            ////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////
	
	createOwnSubmenu=function(hotkey, title_color, li_text_color) { // li_text_color is also menu frame background, color must be in string form, eg, '#ffffff'
		//if (val.startsWith("rgb")) val="#"+val.replace(/[^\d,]/g,"").split(/,/).map(x=>Number(x).toString(16)).join("");
		
		var style_id= (title_color || li_text_color) ? "#ownSubmenu"+coord_id 	 : "";
		var selected_bg_color= !li_text_color ? "#f69c55" : modColor(li_text_color+"+0x096399"),
			selected_color=modColor(selected_bg_color+"^0xffffff"); //, 0x33);
		
		title_color=title_color||"#3f005e", li_text_color=li_text_color||"#ffffee"; // bg of title is li text color, bg of li text is lighter form of title color.
		
		var title_color_limited=modColor(title_color,0x33); //limitminmax to between 0x33 and 0xcc (0xff-0x33).
		if (title_color_limited != title_color) console.log("limited ",title_color, "to ",title_color_limited);
		title_color=title_color_limited;
		var title_bg=li_text_color,	    //li_bg_color=modColor(title_color+( modColor(title_color,true)<0x7fffff ? "+" : "-")+"0x5fa361"),                 //("0x"+title_color.substr(1) - - 0x5fa361).toString(16), //#9ea3bf, two minuses make a plus
			li_bg_color,                    //=modColor(title_color+"+0x5fa361"),
			shadow_color=modColor(li_text_color+"^ 0xffffff",null,0.3);         //("0x"+li_text_color.substr(1) - 0x777790).toString(16);
		li_bg_color=modColor(title_color+" ^ 0xa1a3e1");
		xbutton="<b class=osmXbutton style='float:right;margin-top:-7px;color:"+title_color+";margin-right:-4px;"
			+"font-size:xx-small;'>&#x2715;</b>";         // #2715 is an 'x'
		
		//console.log("Colors: title_color:",title_color,"li_text_color:", li_text_color,"computed: li_bg_color:",li_bg_color,"shadow_color:",shadow_color," selected_color",selected_color,"selected_bg_color",selected_bg_color);
		ownSubmenu=$("<div id=ownSubmenu"+coord_id+" draggable=true class=osm-box data-coord_id="+coord_id
					 +" script-name='"+scriptName+coord_id+"' tabindex='' "
					 + "style='z-index:2147483647;"
					 //+"background-color: "+(backgroundColor||"#ffffee;")+"; color:"+(color||"#3f005e")+";"
					 + "background-color: "+li_text_color+"; color:"+title_color+";"
					 + "text-align:center;padding:10px; resize:both; overflow:auto;cursor:move;"
					 + "border: solid 2px "+shadow_color+";"             // #88885e;"
					 + "border-radius: 10px; "
					 + "box-shadow: 10px 10px 5px "+shadow_color+";"     // box-sizing: border-box;"
					 + "display: inline-block; "                         //float:left;"
					 //+"overflow-y: auto;overflow-x:hidden;"
					 + "position:relative;"
					 + "padding: 10px;"                            //max-width:40%"
					 + "cursor:default;"
					 //		     +"height: 60%;"
					 +"'><div class=osm-header title='Double click to maximize (toggle), Esc to remove (focus with a click here first).  "+location+".' style='box-sizing: border-box;cursor:default; min-height: 5px;'>"
					 + xbutton
					 + "<b class=menu-title style='font-weight:bold; line-height:1; " // "color: #3f005e; "
					 + "font-family: \"Squada One\",\"Helvetica Neue\",Helvetica,Arial,sans-serif; "
					 + "font-size: 18px;'>"
					 + scriptName
					 + (hotkey ?  ", alt-"+String.fromCharCode(altHotkey+32) : ", alt-m")
					 + "</b>"+xbutton
					 + "</div></div>");
		ownSubmenuList=$("<ul id=ownSubmenuList"+coord_id+ " tabindex='' style='list-style:none;padding:0;margin:0;"
						 +"text-align:center;overflow-y:auto;overflow-x:hidden;"
						 +"cursor:pointer; box-sizing: border-box;"
						 +"'></ul>");
		addStyle(style_id+" li.osm-button:hover, "+style_id+" ul li.osm-selected {color: "+selected_color+"; background: "+selected_bg_color+" none repeat scroll 0 0;z-index:2147483647;overflow:visible; }" // #f69c55
				 +"\n"+style_id+" ul li.osm-not-selected { background: "+li_bg_color+" none repeat scroll 0 0 !important; } "
				 +"\n"+style_id+" li.osm-button {  color:"+li_text_color+"; background: "+li_bg_color+" none repeat scroll 0 0; "             // #ffffee #9ea3bf;
				 +"\n                 z-index:2147483647;font-family:Helvetica; min-height:10px;min-width: 100px;"
				 +"\n                 padding:0; margin:0; width:100%;white-space:nowrap;}",  "osm-licolors"+style_id.substr(1)    //2nd param is id of style elem.
				 +"");
		ownSubmenu.find("b.osmXbutton:first").css("float","left");
		header=ownSubmenu.find(".osm-header");
	},
	ensurejQuery=function() {
		var jq=this.jQuery||window.jQuery;
		if(jq) return jq;
		if (!this.jqcode) {
			//this.jqcode=httpGet("https://code.jquery.com/jquery-latest.js");
			this.jqcode=httpGet("https://code.jquery.com/jquery-3.2.1.js");
			if (GM.setValue) GM.setValue("osm_jqueryCode",jqcode);
		}
		eval(this.jqcode);
		return jQuery.noConflict(true);
	},
	makeDraggable=function(jel){
		if( !jel.length || jel.data("dragged")) return;
		jel.data("dragged",true);
		var that=makeDraggable;
		jel.attr("draggable","true");
		jel.on("dragstart",handleDrag); //function(e){
		if(!that.addedListeners) {
			that.addedListeners=true;
			$(document).on("dragover drop",handleDrag);
		}
		function handleDrag(e) {
			e=e.originalEvent;
			switch(e.type) {
			case "dragstart":
				var offset=$(e.target).offset();         // Point relative to box on which clicked.
				that.offset_diff={top: e.clientY - offset.top, left:e.clientX - offset.left};
				that.target=e.target;
				e.dataTransfer.setData("text/plain",null);
				break;
			case "dragover": if(that.target) return false; // allow drop to occur at this spot.
			case "drop":
				if (!that.target) return;
				$(that.target).offset({ top: e.clientY - that.offset_diff.top,
										left: e.clientX - that.offset_diff.left});
				that.target=null;
				return false;
			}
		}
	},

	httpGet=function(theUrl, CB) {
		var xmlHttp=new XMLHttpRequest();
		xmlHttp.onload=CB;
		xmlHttp.open("GET", theUrl, CB ? true:false); // false for synchronous request, not recommended but do once only on first use, then cache in GM.setValue.
		xmlHttp.send(null);
		return xmlHttp.responseText;
	},
	modColor=function(hexstr,limit_minmax,darken_factor) { // return color1 <operator> color2 <operator> colorN, or return hex number if only one color.
		var rgb_ar, res, part_res, character_class_hexdigit="[\\da-fA-F]", re=RegExp(( "("+character_class_hexdigit+"{2})" ).repeat(3),"g"),
			str_split_to_rgb=()=>(hexstr=hexstr.replace(/#/g,"0x"), rgb_ar=[1,2,3].map(x=>hexstr.replace(re,"$"+x))) ;
		str_split_to_rgb();
		if (darken_factor) { // darken but maintain color.
			hexstr=modColor(hexstr,limit_minmax);
			str_split_to_rgb();
			rgb_ar.forEach((el,i,arr)=>arr[i]=arr[i]*darken_factor|0); 	    //var min=darken_factor*rgb_ar.reduce((p,c)=>c<p?c:p)|0;  rgb_ar.forEach((el,i,arr)=>arr[i]-=min);
		}
		res=rgb_ar.reduce((prev,curr)=> {
			part_res=eval(curr);
			if (limit_minmax)
				part_res=Math.max(Math.min(part_res, 0xff - limit_minmax ), 0);        // ), limit_minmax); //limits only max values
			else
				part_res=part_res<0 ? 0xff+part_res : part_res>0xff ? part_res%0xff : part_res;
			part_res=part_res.toString(16);
			return prev+"0".repeat(2-part_res.length)+part_res; //repeat pads zeroes on the left side
		} ,"");
		return "#"+res; 
	},
	addStyle=function(style_text, id) {
		if ($("#"+id).length==0) $("head").prepend("<style id="+id+">"+style_text+"</style>");
	},
	nchars=function(char,n) { var roll=""; while(n--) roll+=char; return roll; },
	toString=function(e) { return "[object submenuModule]"; },
	setUpChromeButton=function() {
		chromeButton=true;
		var div=$("#GM_menu_button");
		var right_pos=GM.getValue ? GM.getValue("GMmenuLeftRight", true) : localStorage.GMmenuLeftRight;
		var par = document.body ? document.body : document.documentElement, 
			full_name="GreaseMonkey \u27a4 User Script Commands \u00bb", short_name="GM\u00bb";
		if (div.length==0) {
			div=$("<div id=GM_menu_button style='border: 3px outset #ccc;position: fixed;"
				  +"opacity:  1; z-index: 2147483647;top: 5px; padding: 0 0 0 0;height: 16px; "
				  +"max-height: 15px; max-width: 15px;" 
				  +(right_pos ? "right: 5px;" : "left: 40px;")
				  +"'></div>");
			par.appendChild(div[0]);
			var img=$("<img class=GM_menuman style='border:none; margin:0; padding:0; cssFloat:left;'"
					  +" src=data:image/gif;base64,AAABAAEADxAAAAEAIAAoBAAAFgAAACgAAAAPAAAAIAAAAAEAIAAAAAAAAAAAABMLAAATCwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAADgAAABAAAAAQAAAAEAAAAA4AAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAfw8ANGiHADx42wBAf/8AQH//AEB//wBAf/8AQH//ADx42wA0aIcAQH8PAAAAAAAAAAAAAAAAAEB/LwBAf98jZp//YKrX/4/b//+T3P//lNz//5Pc//+Q2///YarX/yNmn/8AQH/fAEB/LwAAAAAAAAAAAEB/vzR5r/+M2v//ktv//5jd//+c3///nt///53f//+Z3v//lNz//43a//80ea//AEB/vwAAAAAAQH8PAEB//4PQ9/9+v+D/L0Vj/x4qX/8qOIT/KjmY/yo4if8fKmX/L0Vn/4DA4P+D0Pf/AEB//wAAAAAAQH8PEVOP/43a//9Se5D/gbXS/6bi//+t5P//seX//67l//+o4v//grbT/1R8kv+O2v//AEB//wAAAAAAJElfCEJ6/4XR9/+W3f//oOD//2mVn/9wlZ//uuj//3GXn/9rlJ//o+H//5ne//+G0ff/CEJ6/wAkSV8TPmXfO3em/1CXx/+W3f//oOD//wAmAP8AHQD/uOf//wAmAP8AHQD/ouH//5ne//9Rl8f/Q3+s/xM+Zd87bZP/O3em/z6Dt/+U3P//nN///0BvQP8QPBD/ruT//0BvQP8QPBD/n9///5bd//8+g7f/Q3+s/zttk/8yaJP/S4ax/yNmn/+P2///l93//2Gon/9lop//peH//2apn/9iop//md7//5Hb//8jZp//S4ax/zJok/8JQ3vvMm2d/wBAf/+D0Pf/kNv//5bd//+a3v//dbff/5re//+X3f//ktv//4TQ9/8AQH//Mm2d/wlDe+8APn1PAD99rwA/fq8rcKf/g9D3/47a//9boc//AEB//1uhz/+O2v//g9D3/ytwp/8AP36vAD99rwA+fU8AAAAAAAAAAAAAAAAAQH/PAEB//xFTj/8ANGf/ADBf/wAyY/8AOnP/ADpz/wAqU/8AIEA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEB/jwBAf/8AQH//AC5b/wAgQP8AIED/AChP/wA6dL8AJEnfACBADwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAfx8AQH+PAEB/3wA2a/8AJEf/ACBA/wAgQH8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAfy8AQH9vAC5crwAiRN8AAAAAAAAAAAAAAAD/////4A///8AH//+AA///gAP//4AD//+AAwAAAAEAAAABAAAAAQAAAAEAAIADAADgDwAA8AcAAPwfAAD/zwAA"
					  +"></img>");
			var subdiv=$("<div></div>");
			subdiv.append(img);
			div.append(subdiv);
			subdiv[0].addEventListener("click", function (e) {
				if (e.button==0) {
					//document.dispatchEvent(new CustomEvent("coord_GM_menu",{detail:{chromeButton:true}}));
					dispatch("coord_GM_menu",{chromeButton:true});
				}
				else if (e.button==2) div.style.display="none";
				else if (e.button==1){
					// this.style.left = this.style.left ? '' : lpix;
					// this.style.right = this.parentNode.style.right ? '' : '10px';
					// GM.setValue("GMmenuLeftRight", ( this.parentNode.style.right ? true : false )
				} 
			}, false);
			div[0].title="GreaseMonkey.  Click here to open/close GreaseMonkey scripts' menu.  Middle Click to move icon other side.  Right Click to remove icon.";
		} // end if ! div.length
		
	},    //setUpChromeButton.
	dispatch=function(event,subcmd) {
		if (subcmd) event=new CustomEvent(event,{detail:subcmd});
		else event=new Event(event);
		//console.log("DISPATCH", scriptName, ", subcmd:",subcmd, "Event:",event);
		document.dispatchEvent(event);
	},

	handleIframeSize=function(){
		window.addEventListener("message", postMessageHandler,false);
	},
	userResizeIframe=function(size){
		if(!iframe) return;
		window.parent.postMessage( { type:"sfs-iframe-resize", size:size,full_origin:location.href },"*");
	},
	userRevertIframeSize=function(){
		if(!iframe) return;
		window.parent.postMessage( { type:"sfs-iframe-resize", revert:true,full_origin:location.href },"*");
	},
	resizeIframe=function(iframeEl,target_size,revert) { // target_size array is of form, [width,height]
		var ursize=JSON.parse(iframeEl[0].dataset.ursize||"[]"), topslice, target_css={position:"relative",zIndex:999999};
		if (!revert) {
			ursize.push( [ iframeEl.width(), iframeEl.height(), iframeEl.css(["position","zIndex"]) ] ); // .css returns an name-val object
			target_size[0]*=1.5;target_size[1]*=1.5;
			let badpelsi=iframeEl.parents().map((i,pel)=>{ 
				pel=$(pel); 
				if(pel.css("overflow")=="hidden" && (pel.width()<target_size[0] || pel.height()<target_size[1])) {
					pel.css("overflow","visible");		return i; }});
			ursize[ursize.length-1].push(badpelsi.toArray());
		}
		topslice=ursize.slice(-1)[0]; // slice returns an array.
		if(revert) 	{  
			target_size=topslice;
			target_css=topslice[2];
			if(ursize.length==1) topslice[3].forEach(i=>iframeEl.parents().eq(i).css("overflow","hidden"));
		}
		console.log(revert ? "Revert" : "Resize Fx1.5" ,"to target size: ",target_size,"ursize", ursize,iframeEl);
		
		//Change
		if (topslice[0]<target_size[0]||revert) {iframeEl.width(target_size[0]|0);console.log("set width of iframe to:",target_size[0],"so now w:",iframeEl.width());}
		if (topslice[1]<target_size[1]||revert) iframeEl.height(target_size[1]|0);
		iframeEl.css(target_css);

		if(revert) ursize.pop();
		iframeEl[0].dataset.ursize=sify(ursize);
	},
	
	postMessageHandler=function(e){ try{
		//console.log("rmc.  Handle a PostMessage",{e:e},$("iframe, embed").length,"DATA",e.data,"END"); // no perm to access .toJson   //,"\nJSON:"+JSON.stringify(e.source)+"END.");
		if ( ! e.data.type || e.data.type!="sfs-iframe-resize") return;
		var sources=[],foundEl;
		var bestmatch=-1,pmatch;
		$("iframe, embed").each(function(i,el){
			pmatch=strdiff(e.data.full_origin.replace(/https?:\/\//,""),el.src.replace(/https?:\/\//,""));
			console.log("pstrdiff match",pmatch," at index ",i, e.data.full_origin, el.src);
			if(pmatch==bestmatch && foundEl) foundEl.add(el);
			if(pmatch>bestmatch) { 
				bestmatch=pmatch;
				foundEl=$(el);
			}
		});
		//console.log("==");				//$(el).resizable();
		resizeIframe(foundEl,e.data.size,e.data.revert);
		if (iframe) {
			window.parent.postMessage({type:"sfs-iframe-resize",size:e.data.size,revert:e.data.revert},"*");
			//console.log("Post to parent from iframe, sent up",e);
			return;
		}
		//var iframeEl=$("iframe").filter(function(){ return this.contentWindow==e.source; });
		//handleClick({target:iframeEl[0],ctrlKey:true},"iframe_click");
		function strdiff(s1,s2) { var i;for (i=0; i<s1.length&&i<s2.length;i++) if(s1[i]!=s2[i]) return i-1; return i-1;}
	}catch(e){console.log("rmc.  Error in postMessageHandler",e.lineNumber,e);}},
	
	initUWonChrome=function() {
		function unsafeWindowObj() { //a singleton object.
			var ss=sessionStorage;
			var usw="StandinForUnsafeWindow";
			var singleton=this, readphase;
			this.underlying_obj={};
			if (!ss[usw]) ss[usw]="{}";
			this.read=function() {
				readphase=true;
				var robj=JSON.parse(ss[usw]);
				var roll=""; for (var i in robj) { roll+=i+" "; }
				for (var i in robj) this[i]=robj[i];  //eg,this[osm_count], invokes setters below.
				readphase=false;
				return this;
			};
			this.share=function(){
				if (readphase) return;
				ss[usw]=JSON.stringify(this.underlying_obj);
				dispatch("Storage-changed",{from_id:coord_id,newval:this.underlying_obj});
				//var newev=new window.CustomEvent("Storage-changed",{detail:{from_id:coord_id,newval:this.underlying_obj}});		document.dispatchEvent(newev);// target is document
			};  
			this.proxify=function(robj,member_list, obj_name) {
				member_list.forEach(function(member) {
					if (member.length)
						robj[member]=function() { 
							var res=window[toType(robj)].prototype[member].apply(singleton.underlying_obj[obj_name],arguments);
							singleton.share();
						};
					else 
						singleton.underlying_obj[obj_name]={
							uvalue:robj, //new objs, so always deref back to singleton.underlying_obj.
							get 0(){ return singleton.underlying_obj[obj_name].uvalue[0]; },
							set 0(v){ singleton.underlying_obj[obj_name].uvalue[0]=v;
									  singleton.share();
									  return v;},
							toString:function(){return this.toJSON().toString();}, toJSON:function(){return singleton.underlying_obj[obj_name].uvalue;}
						}; //end obj def.
				}); //forEach().
			}; //proxify().
			function storeHasChanged(e){
				if (e.detail && e.detail.from_id==coord_id) return;
				singleton.read();
			}
			document.addEventListener("Storage-changed",storeHasChanged,false);
		}; //unsafeWindowObj().
		
		unsafeWindowObj.prototype = {
			get osm_count() { return this.underlying_obj.osm_count;	},
			set osm_count(n) { this.underlying_obj.osm_count=n; this.share(); return n; },
			get osm_queue() { return this.underlying_obj.osm_queue;	},
			set osm_queue(arr) {
				this.proxify(arr,["push","splice","sort"],"osm_queue");
				this.underlying_obj.osm_queue=arr;
				this.share(); return arr;
			},
			get osm_shrink_factor() { return this.underlying_obj.osm_shrink_factor;	},
			set osm_shrink_factor(arr) { this.proxify(arr,[0],"osm_shrink_factor"); this.share(); return arr; },
			get osm_max() { return this.underlying_obj.osm_max; },
			set osm_max(v) { this.underlying_obj.osm_max=v; this.share(); }
		}; //end prototype.
		function toType(obj) { return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1]; }
		return (new unsafeWindowObj()).read();
	}; ////////////////////End of var comma module function def sequence.
	////////////Semicolon ends comma separated variable definitions of the various module functions.
	/////////////////////
	var getCoordid=function(){return coord_id;}; 
	String.prototype.trim = function (charset) { if (!charset) return this.replace(/^\s*|\s*$/g,""); else return this.replace( RegExp("^["+charset+"]*|["+charset+"]*$", "g" ) , "");}; //trim spaces or any set of characters.
	if (/Chrome/.test(navigator.userAgent)) window.plat_chrome=true;
	if (window.plat_chrome) uw=initUWonChrome();
	else uw=unsafeWindow;
	if (uw.osm_count) uw.osm_count++;
	else { uw.osm_count=1; uw.osm_max=1; uw.osm_queue=[]; uw.osm_shrink_factor=[1]; }
	coord_id=uw.osm_count; queue=uw.osm_queue;uw.osm_max=uw.osm_count;
	shrink_factor=uw.osm_shrink_factor; //need run order of coord_id. for GM_menu position.
	if (uw.osm_count==2) uw.osm_menu_grouping=true;
	///
	///
	/// Submenu Module Interface functions and properties:
	///
	var interfaceObj={ register:init, stop:revert, unregister:rmitem, open:openSubmenu, state:state,
					   close:closeSubmenu, unGroup:unGroup, ineffect:false, toString:toString, isOpen:false,
					   changeName:mvitem, positionAt:positionAt,
					   resizeIframe: userResizeIframe, revertIframeSize:userRevertIframeSize };
	return interfaceObj;  // the rest are func decls.  This is a return from global function: var submenuModule=(function(){
	
	function mutexlock() { this.lock=new Promise(r=>this.unlock=r);};// eg, mx=new mutexlock;...await mx.lock; (async...) mx.unlock(); // initial state is locked, once unlocked it cant be locked again.
	
	async function preInit(){ try { //cache font in base64
		if (!this.jQuery) this.jqcode= GM.getValue ? await GM.getValue("osm_jqueryCode","") : "";
		if (! document.getElementById("squadafont")) {
			var css=GM.getValue ? await GM.getValue("squada","") : "";
			if (!css) {
				console.log(coord_id,".  Get Squadafont from fonts.googleapis.com, for page/iframe at "+location);
				httpGet("https://fonts.googleapis.com/css?family=Squada+One",function(e){
					css=e.target.responseText;
					var xmlHttp=new XMLHttpRequest(), suburl=css.match(/\s*url\s*\((.*?)\)/)[1];
					xmlHttp.responseType = "arraybuffer";
					xmlHttp.onload=function(){
						var i=0, binstr="", bytes=new Uint8Array(xmlHttp.response);
						for (i=0; i < bytes.length; i++) binstr += String.fromCharCode(bytes[i]);
						css=css.replace(/\s*url\s*\(.*?\)/, "url(data:application/x-font-woff;charset=utf-8;base64,"+btoa(binstr)+")");
						if (GM.setValue) GM.setValue("squada",css);
						injectCss(css);
					};
					xmlHttp.open("GET", suburl); //must be asynch
					xmlHttp.send(null);
				});
			} //endif ! css
			injectCss(css);
			function injectCss(css) {
				var el=document.getElementById("squadafont");
				if (!el) {
					var sheet=document.createElement("style");
					sheet.textContent=css;
					sheet.id="squadafont";
					document.head.appendChild(sheet);
				}
				else if (! el.textContent) el.textContent=css;
			} //injectCss()
			
		} //endif !doc.getElementById(squadafont)
	} catch(e) { console.log("Cannot get font, error: "+e+", line:"+e.lineNumber+".");}} //preInit()
} catch(e){console.log("Error in submenuModule",e);}} )(); //var submenuModule=(function(){.

function logStack(fileToo) { // deepest first.
	var res="", e=new Error;
	var s=e.stack.split("\n");
	if (fileToo) res="Stack of callers:\n\t\t"; //+s[1].split("@")[0]+"():\n\t\t"
	for (var i=1;i<s.length-1;i++)
		res+=s[i].split("@")[0]+"() "+s[i].split(":").slice(-2)+"\n";
	return !fileToo ? res : {Stack:s[0]+"\n"+res}; 
}


