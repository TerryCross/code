

function addEdit_GM_DataCommand(scriptname) {  // call after submenuModule for def of GM_registerMenuCommand.

	// Scripts using this need header item: // @grant for each of the value commands: listValues, getValue, setValue, deleteValue, 
	// Use by calling this function passing in the user script name, this will add to the GM command menu, page 
	// context menu "Edit data stored for this script, [scriptname]".

	that=addEditGMDataCommand;
	GM.registerMenuCommand("Edit data stored for this script, "+scriptname,async function(){try{
		var wrapper=$("#aedc-wrapper");
		if(wrapper.length) wrapper.remove(); // old one left there.

		var allNames=await GM.listValues(), roll="";
		console.log("all Names in script GM store:",allNames);
		var namevalues_before=new Map(), namevalues_after=new Map();

		for (let name of allNames) {
			namevalues_before.set(name,await GM.getValue(name)); 
			console.log("set map name:",name," to: ",namevalues_before.get(name));
		}
		// await allNames.forEach(async name=> { 
		// 	namevalues_before.set(name,await GM.getValue(name)); 
		// 	console.log("set map name:",name," to: ",namevalues_before.get(name));
		// });
		
		console.log("Have MAP size:",namevalues_before.size,namevalues_before, "len",namevalues_before.length);

		var built_text=await allNames.reduce(async (acc_namevalues,curr_name,i)=>{
			var value=await GM.getValue(curr_name);
			//console.log("Value in store:",value);
			return (await acc_namevalues)+`<b>${ordinal(i+1)} Name:</b><br><div class=aedcName>${curr_name}</div><br>
	<b>Value:</b><br><div class=aedcValue>${value}</div><br>`;
		},"");

		var div=$(`<div id="sfs-wh-maindiv"><u><b>Name/Value List</u><br><br></b>${scriptname} GM stored values (reload to remove, repeat menu command to refresh name/values).<br>The below names/values are editable.  Number of name/value pairs: ${allNames.length}<br><br>${built_text}<b>END.</b><br><br><br> </div>`)
			.prependTo("body");

		console.log("Added to body",$(".aedcName,.aedcValue",div));
		
		$(".aedcName,.aedcValue",div).attr("contenteditable","true");
		div.wrap("<div id=aedc-wrapper>");
		wrapper=$("#aedc-wrapper");

		addClickButtonTo(wrapper,"Save edited Name/Value pairs......",async e=>{try{
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
			alert("Saved data.");
			//var merged_map=new Map([...namevalues_before,...namevalues_after]);
			//console.log("Merged MAP:",merged_map);
		}catch(e){logError("Button error",e);}});

		div[0].scrollIntoView();
		//div.css("transform","translateZ(0)");
		wrapper.css({
			zIndex:2147483647, position: "absolute", 
			backgroundColor:"whitesmoke", padding:"20px", top:0, //width:"100%",
			fontSize:"medium", maxWidth: "intrinsic", width: "-moz-max-content"
		});

	}catch(e){logError("Error in addEditGMDataCommand,",e);}}); // end GM_registerMenuCommand()

	function parse(str){ try { return JSON.parse(str); } catch(e){} };	
	function ordinal(n) { var sfx = ["th","st","nd","rd"];var val = n%100;return n + (sfx[(val-20)%10] || sfx[val] || sfx[0]);}
	function addClickButtonTo(elem,buttonLabel,cb) {
		var style="position:fixed; background-color:green;color:whitesmoke; cursor:pointer;border:#f0f0f0 20px ridge";
		return $("<div class='sfs-button' title='Click to save or to remove list of name/values.\n\nAdding newlines to unquoted names does not affect them,\nsince JSON ignores newlines and space except when in a string type.' style='left:400px; bottom:50px; "+style+"'>"+buttonLabel+"</div>")
			.appendTo(elem)
			.click(function (e) { e.preventDefault();cb(e);	});
	}
	
	function pairup_array(ar) { // converts 1d to 2d, eg, [1,2,3,4] ==> [[1,2],[3,4]]
		var res_ar=[];
		ar.reduce((prev_curr,curr,curr_i)=>{ if(curr_i%2) res_ar.push([prev_curr,curr]);return curr;  });
		return res_ar;
	}
	
} //end addEditGMDataCommand()