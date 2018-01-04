/* gm4-polyfill.js v0.1.2

  This helper script bridges compatibility between the Greasemonkey 4 APIs and
  existing/legacy APIs.  Say for example your user script includes
  
  // @grant GM_getValue
  
  And you'd like to be compatible with both Greasemonkey 3 and Greasemonkey 4
  (and for that matter all versions of Violentmonkey, Tampermonkey, and any other
  user script engine).  Add:
  
  // @grant GM.getValue
  // @require https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
  
  And switch to the new (GM-dot) APIs, which return promises.  If your script
  is running in an engine that does not provide the new asynchronous APIs, this
  helper will add them, based on the old APIs.
  
  If you use `await` at the top level, you'll need to wrap your script in an
  `async` function to be compatible with any user script engine besides
  Greasemonkey 4.
  
  (async () => {
  let x = await GM.getValue('x');
  })();
  
  Modified due error rasied on first Object.entries code below becuase GM_info was undefined, raised in GM4 firefox 57.
*/

if (typeof GM == 'undefined') {
    GM = {};
}


if (typeof GM_addStyle == 'undefined') {
    this.GM_addStyle = (aCss) => {
	'use strict';
	let head = document.getElementsByTagName('head')[0];
	if (head) {
	    let style = document.createElement('style');
	    style.setAttribute('type', 'text/css');
	    style.textContent = aCss;
	    head.appendChild(style);
	    return style;
	}
	return null;
    };
}

if (typeof GM_registerMenuCommand=="function" && /is not supported[^]{0,100}$/.test(GM_registerMenuCommand.toString()))
    GM_registerMenuCommand=undefined;

if (typeof GM_registerMenuCommand == 'undefined') {
    console.log("def GM_registerMenuCommand as body attr context menu");
    this.GM_registerMenuCommand = (caption, commandFunc, accessKey) => {
	let body=document.body;
	if (!body) {
	    console.error('gm4-polyfill.js, GM_registerMenuCommand aint got no body.');
	    return;
	}
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
	menu.insertBefore(menuItem,menu.firstChild);
    }; // end this.GM_registerMenuCommand().
}


Object.entries({
    'log': console.log
}).forEach(([newKey, old]) => {
    if (old && (typeof GM[newKey] == 'undefined')) {
	GM[newKey] = old;
    }
});


Object.entries({
    'GM_addStyle': 'addStyle',
    'GM_info': 'info',
    'GM_deleteValue': 'deleteValue',
    'GM_getResourceURL': 'getResourceUrl',
    'GM_getValue': 'getValue',
    'GM_listValues': 'listValues',
    'GM_notification': 'notification',
    'GM_openInTab': 'openInTab',
    'GM_registerMenuCommand': 'registerMenuCommand',
    'GM_setClipboard': 'setClipboard',
    'GM_setValue': 'setValue',
    'GM_xmlhttpRequest': 'xmlHttpRequest'
}).forEach(([oldKey, newKey]) => {
    let old = this[oldKey];
    if (old && (typeof GM[newKey] == 'undefined')) {
	GM[newKey] = function() {
	    return new Promise((resolve, reject) => {
		try {
		    resolve(old.apply(this, arguments));
		} catch (e) {
		    reject(e);
		}
	    });
	};
    }
});
