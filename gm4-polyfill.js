/* gm4-polyfill.js v1.0.2 */

// ==UserLibrary==
// @pseudoHeader
// @version     1.0.2
// @name        GM4 PolyFill
// ==/UserLibrary==

/*  
	This script helps newer (GM4) userscripts to run on older GM versions (GM versions < 4 or Tampermonkey etc.).
	Not vice versa.  Instead to run an old script on the newer GM.<fname> style requires rewrite (adding awaits) &/or some other polyfill.
	
	However, if this polyfill script finds eg, GM_addStyle is undefined despite the fact that GM_addStyle
	should exist in older GM versions it will go ahead and define GM_addStyle() and GM.addStyle() to boot.
	same goes for GM_registerMenuCommand() and GM_getResourceText().  These definition are then set in
    the GM object as, eg GM.addStyle().  This is because GM4 removed these function.
	
	This helper script bridges backwardly compatibility between the Greasemonkey 4 APIs and
	existing/legacy APIs.  Say for example your user script includes
   
	// @grant GM_getValue
   
   And you'd like to be compatible with both Greasemonkey 3 and Greasemonkey 4
   (and for that matter all versions of Violentmonkey, Tampermonkey, and any other
   user script engine).  Add:
   
   // @grant GM.getValue
   // @require     https://raw.githubusercontent.com/SloaneFox/code/master/gm4-polyfill.js
   
   Eg, this will define GM.getValue in older GM versions, so updated code will be backward compatible
   to older GM versions.  It will not define GM_getValue in newer GM versions.
   Missing functions from the new GM api are added, hence GM.registerMenuCommand() & GM.addStyle() are defined, as
   is GM_addStyle(), they append given style string to <head?.

   Include above and recode userscript to the new (GM-dot) APIs, which return promises.  If your script
   is running in an engine that does not provide the new asynchronous APIs, this
   helper will add them, based on the old APIs.
   
   If you use `await` at the top level, you'll need to wrap your script in an
   `async` function to be compatible with any user script engine besides
   Greasemonkey 4.
   
   var gValue;
   async function init_globals() { gValue = await GM.getValue('x'); }
   async main() { await init_globals(); }
   addEventListener("load",main);

*/
 
if (typeof GM == 'undefined')
	eval("var GM = {};");  // Defined in the closure given when loaded/injected prevents intra-script clobbering.  Eval needed due to GM's declaration as a const in scope wrapper .


if (typeof GM_addStyle == 'undefined') {
	this.GM_addStyle = (key_gm4polyf,id) => {
		'use strict';
		let head = document.getElementsByTagName('head')[0];
		if (head) {
			let style = document.createElement('style');
			style.setAttribute('type', 'text/css');
			if(id) style.setAttribute('id', id);
			style.textContent = key_gm4polyf;
			head.appendChild(style);
			return style;
		}
		return null;
	};
}

GM.addStyle=this.GM_addStyle;

if (typeof GM_getResourceText == 'undefined')
	this.GM_getResourceText = async aResourceName =>
	( await fetch(await GM.getResourceUrl(aResourceName)) ).text(); 

if (typeof GM_registerMenuCommand=="function" && /is not supported[^]{0,100}$/.test(GM_registerMenuCommand.toString()))  // regexp, '[^]{0,100}' means any char, including newlines, 0 to 100 times.
	GM_registerMenuCommand=undefined;

GM.registerMenuCommand = function (caption, commandFunc, accessKey_in_polyfill) {
	let body=document.body;
	if (!body) throw "GM registerMenuCommand aint got no body in document, call again later.";
	let contextMenu = body.getAttribute('contextmenu');
	let menu = (contextMenu ? document.querySelector('menu#' + contextMenu) : null);
	if (!menu) {
		menu = document.createElement('menu');
		menu.setAttribute('id', 'gm-registered-menu');
		menu.setAttribute('type', 'context');
		body.insertBefore(menu,body.firstChild);
		body.setAttribute('contextmenu', 'gm-registered-menu');
	}
	let menuItem = document.createElement('menuitem');
	menuItem.setAttribute("label",caption);
	menuItem.addEventListener('click', commandFunc, true);
	menu.appendChild(menuItem);
	return menuItem;    // The real GM_registerMenuCommand returns undefined.  Here user can change eg, label attribute of returned menuItem.
};

if (typeof GM_registerMenuCommand == 'undefined') {
	this.GM_registerMenuCommand=GM.registerMenuCommand;
}

Object.entries({
	'log': console.log.bind(console),
	'info': typeof GM_info == "undefined" ? null : GM_info 
}).forEach(([newKey, old]) => {
	if (old && (typeof GM[newKey] == 'undefined')) {
		GM[newKey] = old;
	}
});

Object.entries({          // Object.entries() returns a 2-d array of all the given object's name value pairs.
	'GM_addStyle': 'addStyle',
	'GM_deleteValue': 'deleteValue',
	'GM_getResourceURL': 'getResourceUrl',
	'GM_getValue': 'getValue',
	'GM_listValues': 'listValues',
	'GM_notification': 'notification',
	'GM_openInTab': 'openInTab',
	'GM_registerMenuCommand': 'registerMenuCommand',
	'GM_setClipboard': 'setClipboard',
	'GM_setValue': 'setValue',
	'GM_xmlhttpRequest': 'xmlHttpRequest',
	'GM_getResourceText': 'getResourceText'
}).forEach( ([oldKey, newKey]) => {         // Enables eg, "await GM.getValue" to run ok on pre GM4. But not vice versa, ie, it defines no GM_getValue in newer GM.
	let old = window[oldKey];
	if (old && (typeof GM[newKey] == 'undefined')) {
		GM[newKey] = function(...args) {
			return new Promise(function(resolve, reject) { try {
				resolve(old.apply(window, args));
			} catch (e) { reject(e); }
														 });
		};
	} 
});//forEach()

this.GM=GM; // exports GM object, eg, if js is included dynamically via local eval(fetch(<this-file>))
