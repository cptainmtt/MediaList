var XBMC_GUI = function() {

	// --- Private Variables --- //
	var guiComplete = false;
	var libraryRequestQueue = [];
	var setup = null;
	var autoFlipToWall = false;
	var GlobalTokensCounter = 0;
	var loadingTimeoutID, loadingIntervalID;
	//var queuedIDs = [];

	// --- Public Variables --- //
	var self = {
		joins:	{
			firstThumbnail:		1,	// mediaList->S(image)
			firstTitle:			21,	// mediaList->S(text)
			firstYear:			41,	// mediaList->S(text)
			firstWatched:		61,	// mediaList->D(button)
			mediaList:			1,	// L

			diagnostics:		1001,	// D(page)
			media_return_button:	1002,	// D(button)
		},
		XBMC:			null,
		listLoading:	false,
	};


	// --- Public Functions --- //
	self.setup = function(params) {

		try {
		self.XBMC = new XBMC_Controller();
		if ( (r = self.XBMC.Setup()) === false ) consolelog("Failed to create the XBMC_Controller object");

		} catch (e) { consolelog("Error running XBMC_Controller.Setup() - " + e) }

		// Clear lists from previous data for new XBMC instance to load new data
		//CF.setJoins([

		//]);

		var watchedJoins = [
			"d"+self.XBMC.joins.connected.join,
			"d"+self.joins.mediaList,
			"l"+self.joins.mediaList,
			"s"+self.joins.mediaList,
			CF.GlobalTokensJoin,
		];
		for (i = 1; i <= 8; i++) watchedJoins.push("l"+self.joins.mediaList + "::d" + i);

		CF.watch(CF.FeedbackMatchedEvent, "XBMC", "JSON Response", onJSONResponse);
		CF.watch(CF.JoinChangeEvent, watchedJoins, onJoinChange);

		CF.watch(CF.ConnectionStatusChangeEvent, "XBMC", onConnectionChange, true);

		setMediaListTitle(); // set to default
		CF.listRemove("l"+self.joins.mediaList); // doesnt trigger list join change event
		onJoinChange("l"+self.joins.mediaList, null, null); // manually trigger list join change event to start interval

		return r;
	};

	/*
	// Get media type from arguments provided as either tokens or a string
	// NOT CURRENTLY: Prioritise tokens over string
	// Sidemenu button sets "type" parameter which remains constant as "[basetype]"in the media title join whilst browsing the library
	// other buttons sets "[listtype]" which is used to pdate the media list title serial join
	// use listIndex and join arguments
	*/
	self.showMediaList = function(list, listIndex, join) {
		consolelog("showMediaList(): list = " + list + ", listIndex = " + listIndex + ", join = " + join);
		var tokens = {}, params = {};
		var cases = {
			string: function(arg) {
				//consolelog("string case: pre check params.type = " + params.type);
				if (arg.indexOf(":") != -1) {
					// arg = join
					params.join = arg.splice(-1); // get the number of the join (1-itemsPerRow(8))
					params.index = arg.slice(arg.indexOf(":")+1, arg.lastIndexOf(":"));
					consolelog("arg.slice(arg.indexOf(\":\"), arg.lastIndexOf(\":\")) = '" + arg.slice(arg.indexOf(":")+1, arg.lastIndexOf(":")) + "'");
				// check if passed type string if the type hasnt already been set
			} else if (!params.listtype) params.listtype = self.XBMC.checkMediaType(tokenize(arg, false), false); // don't return default type
				//consolelog("string case: post check params.basetype = " + params.basetype);
			},
			object: function(obj) { tokens = obj },
		};
		try {
		for ( var i = 0; i < arguments.length; i++ ) (cases[typeof arguments[i]]) ? cases[typeof arguments[i]](arguments[i]) : ""; // read arguments
		} catch (e) {
			consolelog("showMediaList(): exception caught in argument loop - " + e);
		}
		consolelog("\n\nshowMediaList(): initial arguments = --v, tokens = ------v", arguments, tokens);

		if ( tokens["[file]"] ) {
			// play file
			self.XBMC.PlayToken(tokens);
			// use fanart token to set bg? or set in now playing loop... delete token from buildMediaList if not in use
		} else {
			//set media page join = 1 // * (4)
			consolelog("showMediaList(): setting mediaList join = 1");
			CF.setJoin("d"+self.joins.mediaList, 1);

			// if params.basetype has been passed as argument then a base media type has been selected
			//if (params.basetype) params.listtype = params.basetype; // set params.listtype to pass to loadMediaList()
			//else if (tokens["[load]")) params.listtype = tokens["[load]"];
			params.listtype = params.type || params.listtype || tokens["[listtype]"]; // undefined if ! found
			// back button passes tokens["listtype"] only... sidemenu passes string => params.listtype, thumbnail passes tokens{"listtype"]??
			// basetype shoueld only be set if undefined in self.XBMC.currentList --> means the next line not so important...
			params.basetype = params.basetype || tokens["[basetype]"] || params.listtype; // undefined if ! found  -----> CHECK !! need default to tokens["basetype"] or params.listtype??
			consolelog("requestMediaList(): params.listtype = " + params.listtype + ", params.basetype = " + params.basetype);


			// check that a button has been clicked to load a list ie: not a page flip gesture(swipe)
			if (params.listtype) {
				// button was clicked

				// set the params to send to loadMediaList()
				params.listid = tokens["[listid]"] || null;
				params.baseid = tokens["[baseid]"] || null;

				// set the tokens to be save for the media list title
				var t = [];
			 	t["[listid]"] = params.listid;
				t["[baseid]"] = params.baseid;

				// set the media list title and tokens - triggers JoinChangeEvent to sync the local currentList object
				//CF.setJoins([
				//	{ join: "s"+self.joins.mediaListTitle,
				//	value: (params.listtype.toLowerCase() == "tvshows") ? "TV Shows" : params.listtype[0].toUpperCase() + params.listtype.substr(1), // capitalises te first letter --> TODO: format TV Shows correctly
				//	tokens: tokens }
				//]);

				consolelog("showMediaList(): pre loadMediaList tokens == ---v", tokens);
			}

			// get media type and id of media type to load if not passed by string already
			/*
			if ( !params.basetype ) {
				consolelog("showMediaList(): setting params from tokens");
				for ( key in tokens ) {
					// loops through tokens, removes square brackets before setting params keys
					if (tokens.hasOwnProperty(key)) params[key.slice(1, -1)] = tokens[key];
				}

				//params = { type: tokens["[type]"], id: tokens["[id]"] };
			} else if (!params.listtype) params.listtype = params.basetype;
			consolelog("showMediaList(): Found params = ---v", params);
			*/

			// set the tokens for the back button
			consolelog("Setting the return button tokens ---v");
			if (tokens["[return]"]) CF.setToken("d"+self.joins.media_return_button, "[return]", tokens["[return]"]); // triggers event to show/hide the back button

			consolelog("showMediaList(): self.XBMC.currentList.listtype != (params.basetype = self.XBMC.checkMediaType(" + params.listtype + ", false)) = " + (self.XBMC.currentList.listtype != (params.listtype = self.XBMC.checkMediaType(params.listtype, false))));
			consolelog("showMediaList(): " + self.XBMC.currentList.listtype + " != (" + params.listtype + " = self.XBMC.checkMediaType(" + params.listtype + ", false)) = " + (self.XBMC.currentList.listtype != (params.listtype = self.XBMC.checkMediaType(params.listtype, false))));
			// check if media list needs updating -- NOT WORKING! only works for base lists
			if (self.XBMC.currentList.listtype != (params.listtype = self.XBMC.checkMediaType(params.listtype, false)) ) {
				//clear the media list - triggers join change event to show loading elements
				console.log("showMediaList(): clearing the media list")
				CF.listRemove("l"+self.joins.mediaList);

				//set media page title join and tokens, set value to trigger join change event
				// param = {basetype, listtype, baseid, listid.....}
				setMediaListTitle(params);

				//consolelog("showMediaList(): updating the GlobalTokens - should fire on change event");
				//CF.setJoins([{join: CF.GlobalTokensJoin, value: GlobalTokensCounter++, tokens: params } ]);

				// load media info from XBMC (if req'd) --> moved to media title join change event
				//consolelog("Starting self.loadMediaList(" + params + " from showMediaList()");
				//console.log(params);
				//self.loadMediaList(params);
			} else {
				// change the list!!
			}
		}
	};

	/*
	// Hs available -> listIndex(rowNumber), join, use the last character of the join to  get the column number
	// Accepts arguments - type as string, force as boolean || object { type as string, force as boolean }
	// NEEDS thumbnail button tokens[type, load, id, baseid]	Ex: Episodes -> load = "episodes", id = seasonid, baseid: tvshowid, type = "tvshows"
	//								, base_index, base_join,	EX: Seasons  -> load = "seasons", id = tvshowid
	//								, index, join				EX: TV Shows -> load = "tvshows"
	// NEEDS return buttons tokens[type + id]					Ex: Episodes ->	load = "seasons",	 id = seasonid
	//															EX: Seasons  -> load = "tvshows"
	//															EX: Seasons  -> load = "tvshows" // sent by button press


	// reference ex: episode list array = mediaLibrary["tvshows"][tvshow_listIndex][join.slice(-1)][season_listIndex][season_join.slice(-1)]
	// reference ex: episode list array = mediaLibrary[thumbnail[type] || return[load]][base_index][base_join.slice(-1)][index][join.slice(-1)]

	// reference ex: season list array = mediaLibrary["tvshows"][tvshow_listIndex][tvshow_join.slice(-1)]
	// reference ex: episode list array = mediaLibrary[type][base_index][base_join.slice(-1)]


	//
	// programmed	try => mediaLibrary[tokens["[type]"] || tokens["[load"]][ mediaLibrary[tokens["[type]"] || tokens["[load"]].indexOf(tokens["[baseid]"] || tokens["[id]"]) ][season] == "EPISODES"
	//				try => mediaLibrary[tokens["[type]"] || tokens["[load"]][ mediaLibrary[tokens["[type]"] || tokens["[load"]].indexOf(tokens["[baseid]"] || tokens["[id]"]) ] == "SEASONS"
	//				try => mediaLibrary[tokens["[type]"] || tokens["[load"]] == "TVSHOWS"
	//				CATCH == NOT YET LOADED :)



	*/
	self.loadMediaList = function() {

		consolelog("loadMediaList() called with following arguments --v");
		console.log(arguments);
		var params = {};
		var cases = {
			object:		function(obj) { if ( self.XBMC.checkMediaType(tokenize(obj, false).listtype, false) ) params = obj },
			string:		function(str) { if ( !params.listtype ) params["listtype"] = self.XBMC.checkMediaType(str, false) },
			boolean:	function(bool) { if ( typeof params.force != "boolean" ) params["force"] = bool },
		};

		//loop through supplied arguments
		try {
		for( var i = 0; i < arguments.length; i++ ) cases[typeof arguments[i]](arguments[i]);
		} catch (e) {
			consolelog("loadMediaList(): exception caught in argument loop");
		}

		consolelog("loadmediaList(): params = ---v", params);

		if (arguments.length > 0) {
		//if (params.listtype) {
			// make sure all list variables are defined...
			p = tokenize(params, false);
			params = {};
			consolelog("p should not be an empty object unless params above is empty ---v", p);

			params.listtype = p.type || p.listtype || null;
			//  TODO !! self.XBMC.checkBaseMediaTypes()
			//params.basetype = p.basetype || self.XBMC.checkBaseMediaTypes(params.listtype); // defaults to list type as this it what is set when a string is passed - need check basetypes function?
			params.basetype = p.basetype || params.listtype; // defaults to list type as this it what is set when a string is passed - need check basetypes function?
			params.listid = p.listid || null;
			params.baseid = p.baseid || null;
			consolelog("order in params should be listtype, basetype, listid, baseid ---v", params);
		}


		//console.log(params);
		consolelog("loadMediaList() checking if the " + params.listtype + " is being forced to update from XBMC");
		if (params.force) {
			if ( params.baseid ) delete self.XBMC.mediaLibrary[params.basetype][params.baseid][params.listid]["list"]; // episodes/songs
			else if ( params.listid ) delete self.XBMC.mediaLibrary[params.basetype][params.listid]["list"]; // seasons, albums
			else delete self.XBMC.mediaLibrary[params.basetype]["list"]; // movies, tvshows, artists
			console.log("loadMediaList(): " + params.listtype + " list has been cleared by force" + ((params.listid) ? (" where listid = " + params.listid) : "") + ((params.baseid) ? (" and baseid = " + params.baseid) : ""));
		}


		// FIX empty mediaList check to include id and baseid
		// EXAMPLE: Check an episode list - tvshowid = 10, season = 2
		// mediaLibrary["tvshows"][tvshowid][season]
		// mediaLibrary["tvshows"].indexOf(tvshowid)[10][2]
		/*
		try {
			//if ( params.baseid ) listcheck = typeof self.XBMC.mediaLibrary[params.basetype][params.baseid][params.listid]["list"];
			//else if ( params.listid ) listcheck = typeof self.XBMC.mediaLibrary[params.basetype][params.listid]["list"];
			//else listcheck = typeof self.XBMC.mediaLibrary[params.basetype]["list"];
			listcheck = self.XBMC.getMediaList(params);
		} catch (e) {
			listcheck = false;
		} finally {
			consolelog("loadMediaList(): listcheck, skip update if !false => '" + listcheck + "'");
		}
		*/

		consolelog("self.XBMC.getMediaList(params, true) = ---v", self.XBMC.getMediaList(params, true));
		if (self.XBMC.getMediaList(params, true) && !params.force) params = undefined; // skip loading the list
			//consolelog("loadMediaList(): mediaLibrary[type] = --v");
			//console.log(self.XBMC.mediaLibrary[params.type]);

			consolelog("checking if params.listtype is valid to add to libraryRequestQueue");
			// mediaLibrary[type] needs loading are is being forced to reload
			//if (params.force) CF.listRemove("l"+self.joins.mediaList); // triggers join change event to show loading graphics WRONG! force does not mean show the list

		try {
			libraryRequestQueue = libraryRequestQueue || [];
			// string test
			consolelog("pre-check of listtype libraryRequestQueue object --v");
			console.log(libraryRequestQueue);
			//libraryRequestQueue[found = self.XBMC.checkMediaType(params.type, false)] = true; //params.force || false;
			listtype = self.XBMC.checkMediaType(params.listtype, false) || listtype.hasOwnProperty(); // throw exception
			consolelog("loadMediaList(): found " + listtype + " as string. adding " + listtype + " to libraryRequestQueue{}");
		} catch (e) {
			try {
				// array test
				// HOW PASS AS ARRAY?? how handle rest of arguments...?
				while(prop = params.listtype.shift()) {
					//libraryRequestQueue[self.XBMC.checkMediaType(prop, false)] = true; //params.force || false;
					var listtype = self.XBMC.checkMediaType(prop, false);
					break;
				}
				consolelog("passed array test");
			} catch (e) {
				try {
					// object test
					for (var prop in params.listtype) {
						//if( params.type.hasOwnProperty(prop) && (type = self.XBMC.checkMediaType(prop, false)) ) libraryRequestQueue[type] = true; //params.force || false;
						if( params.listtype.hasOwnProperty(prop) && (type = self.XBMC.checkMediaType(prop, false)) ) listtype = type;
					}
					consolelog("passed object test");

					// LAST CONSOLE MSG HERE
				} catch (e) {
					consolelog("Failed to find valid type in param argument");
				}
			}
		} finally {
			// ADD TO libraryRequestQueue TEST!!
			consolelog("listtype = " + listtype);
			try {
				if (listtype) {
					params.listtype = listtype;
					/*
					if (params.baseid) {
						libraryRequestQueue[listtype][params.baseid][params.listid] = libraryRequestQueue[listtype][params.baseid][params.listid] || {};
						libraryRequestQueue[listtype][params.baseid][params.listid]["[list]"] = true;
					} else if (params.listid) {
						libraryRequestQueue[listtype][params.baseid] = libraryRequestQueue[listtype][params.baseid] || {};
						libraryRequestQueue[listtype][params.baseid]["[list]"] = true;
					} else {
						libraryRequestQueue[listtype] = libraryRequestQueue[listtype] || {};
						libraryRequestQueue[listtype]["[list]"] = true;
					}
					*/
					//libraryRequestQueue[params.listtype + "-l" + (params.listid || "") + "-b" + (params.baseid || "")] = params;
					params_string = JSON.stringify(params);
					if (libraryRequestQueue.indexOf(params_string) == -1) {
						libraryRequestQueue.push(params_string);
						consolelog("List added to library request queue ---v", libraryRequestQueue);
					} else consolelog("List request already exists in library request queue...");
				} else {
					consolelog("No list was added to the request library queue - continuing to process the next list in the queue...");
				}
			} catch (e) {
					consolelog("Exception caught adding to the libraryRequestQueue. params = ---v", params, e);
			} finally {
				try {
					//if ( libraryRequestQueue[Object.keys(libraryRequestQueue)[0]] && self.XBMC.joins.connected.value ) {
					if ( self.XBMC.joins.connected.value && !self.listLoading ) {
						// get next request in queue
						params = JSON.parse(libraryRequestQueue[0]);

						self.listLoading = true;
						consolelog("set self.listLoading = " + self.listLoading);
						// load function to send json request
						self.XBMC.Get[params.listtype](params);
						consolelog("loadMediaList(): queueing json command to get a \"" + params.listtype + "\" list from XBMC...");
					}
				} catch (e) {
					// check runs now that have added delete libraryRequestQueue as no exception is thrown when libraryRequestQueue is undefined :( only when it is not declared(deleted)...
					consolelog("Finished loading media lists from XBMC...", new Error("libraryRequestQueue is empty :)"));
					//for (prop in (new Error()) { consolelog(prop); }


					//for (var prop in new Error()) {
					//	console.log(prop);
					//}
					//QueueInitMsg("finishing loading media lists from xbmc...");
				}
			}
		}

		//} else consolelog("loadMediaList(): no arguments passed - proceed to updatingList[] queue"); // NOT USED ANYMORE


		// check if updatingList has more items to load OR if the current mediaList is empty
		// DO I NEED TO CHECK IF XBMC IS CONNECTED OR JUST ADD TO JSON QUEUE? YES
		// If add to json queue (dont check connected), need to remove updating list  once json completed otherwise its like to run again when loadMediaList is called on connection
		// OR dont call loadMediaList on connection....
		// depends when you want to remove libraryRequestQueue... probably once response received from XBMC... -> so check connected before sending!!

		//if (libraryRequestQueue[Object.keys(libraryRequestQueue)[0]] || !self.XBMC.mediaLibrary[Object.keys(libraryRequestQueue)[0]] ) {
		// shouldnt need to check if mediaList is empty... loadMediaList should be called straight after mediaLibrary[type] is deleted...CHECK THIS IS CORRECT!


	};

	buildMediaList = function(json) {

		type = self.XBMC.checkMediaType(json.id, false);
		consolelog("buildMediaList(): type = " + type);

		try {
			if ( type && !json.hasOwnProperty("error") ) {
				//json = self.XBMC.mediaLibrary[type];
				var itemCount = 0;
				var rowCount = 0;
				var list = [];
				var rowItems = {};
				var maxPerRow = 8;
				//var tokens = {};
				var back = {}, listtype = null, listid = null, baseid = null, major, minor, thumbnail, fanart = null, playcount, file = null, resume, load = null; // declare, set scope and reset

				var cases = {};

				var queueItem = function(params) {
							// load the sub-list for this item

							// THIS IS WHERE THE SEASON/EPISODE LIST LOADING STOP!!! DICK!

							consolelog("buildMediaList() is calling loadMediaList(type: " + listtype + ", listid: " + listid + ", baseid: " + baseid + ")");

							// ADD BACK IN WHEN EVERYTHING WORKING
							self.loadMediaList(params);
				};

				var movies = function(i) {
					try {
						// "thumbnail", "fanart", "genre", "playcount", "mpaa", "rating", "runtime", "year", "file", "resume"
						//id			= json.result.movies[i].movieid;  // not required unless going to have a movie details action
						resume		= json.result.movies[i].resume;
						file		= json.result.movies[i].file;
						fanart		= json.result.movies[i].fanart;
						thumbnail	= json.result.movies[i].thumbnail;
						major		= json.result.movies[i].label;
						minor		= json.result.movies[i].year;
						playcount	= (json.result.movies[i].playcount > 0) ? 1 : 0;
						// no retun button shown
					} catch (e) {
						consolelog("buildMediaList(): Exception caught creating a movie item");
					}
				};

				var tvshows = function() {
					try {
						// result["thumbnail", "fanart", "title|label", "year", "episode", "art.fanart|poster", "file", "playcount", "watchedepisodes"]
						tvshowid = json.result.tvshows[i].tvshowid;

						//consolelog("Queueing seasons for tvshowid(" + tvshowid + ") to be loaded ...");
						if ( typeof self.XBMC.queuedIDs["seasons"] != "object" ) self.XBMC.queuedIDs["seasons"] = [];
						self.XBMC.queuedIDs["seasons"].push({"tvshowid": tvshowid});

						// set reference variables
						//consolelog("typeof self.XBMC.ref.tvshows = " + typeof self.XBMC.ref.tvshows);
						if (typeof self.XBMC.ref.tvshows == "undefined") self.XBMC.ref.tvshows = {};
						try {
							self.XBMC.ref.tvshows[tvshowid] = {"index": rowCount, "item": itemCount + 1};
						} catch (e) {
							consolelog("FAILED TO SET TV SHOWS REFERENCE VARIABLE");
						}
						fanart		= json.result.tvshows[i].fanart;
						thumbnail	= json.result.tvshows[i].thumbnail;
						major		= json.result.tvshows[i].title;
						minor		= json.result.tvshows[i].year;
						playcount	= (json.result.tvshows[i].watchedepisodes == json.result.tvshows[i].episode) ? 1 : 0;
						//basetype	= "tvshows";
						listtype	= "seasons";
						listid		= tvshowid;
						baseid		= null;
						back		= {listtype: "tvshows"};

						queueItem({listtype: listtype, listid: listid, baseid: baseid});

						// load all the alubms for this artist
						//self.loadMediaList({type: load, id: id});
					} catch (e) {
						consolelog("Failed to load a tv show - " + e);
					}
				};

				var seasons = function(i) {
					try {
						console.log(json.result);
						// "season", "tvshowid", "showtitle", "year", "playcount", "episode", "thumbnail", "file", "art", "watchedepisodes"
						// check to make sure there is at least one season available for tvshowid
						if (json.result.seasons[i].hasOwnProperty("tvshowid")) {
							var tvshowid = json.result.seasons[i].tvshowid;
							var season = json.result.seasons[i].season;

							consolelog("Queueing episodes in season(" + season + ") for tvshowid(" + tvshowid + ") to be loaded ...");
							if ( typeof self.XBMC.queuedIDs["episodes"] != "object" ) self.XBMC.queuedIDs["episodes"] = [];
							self.XBMC.queuedIDs["episodes"].push({"tvshowid": tvshowid, "season": season});
							//console.log(self.XBMC.queuedIDs["episodes"]);

							// set reference variables
							consolelog("typeof self.XBMC.ref.tvshows[" + tvshowid + "] = " + typeof self.XBMC.ref.tvshows[tvshowid]);
							consolelog("typeof self.XBMC.ref.tvshows[" + tvshowid + "][" + season + "] = " + typeof self.XBMC.ref.tvshows[tvshowid][season]);

							if (typeof self.XBMC.ref.tvshows[tvshowid][season] == "undefined") self.XBMC.ref.tvshows[tvshowid][season] = {};
							self.XBMC.ref.tvshows[tvshowid][season] = {"index": rowCount, "item": itemCount + 1};

							consolelog("typeof self.XBMC.ref.tvshows[" + tvshowid + "][" + season + "] = " + typeof self.XBMC.ref.tvshows[tvshowid][season]);

							consolelog("typeof self.XBMC.mediaList.tvshows[" + self.XBMC.ref.tvshows[tvshowid].index + "][\"seasons\"" + self.XBMC.ref.tvshows[tvshowid].item + "] = " + typeof self.XBMC.mediaList.tvshows[ self.XBMC.ref.tvshows[tvshowid].index ]["seasons" + self.XBMC.ref.tvshows[tvshowid].item]);
							//if ( typeof self.XBMC.mediaList.tvshows[ self.XBMC.ref.tvshows[tvshowid].index ]["seasons" + self.XBMC.ref.tvshows[tvshowid].item] == "object" ) {
								// add season info and tokens required to get the episode list...
								fanart		= json.result.seasons[i].art.fanart;
								thumbnail	= json.result.seasons[i].art.poster;
								major		= json.result.seasons[i].title;
								minor		= json.result.seasons[i].year;
								playcount	= (json.result.seasons[i].watchedepisodes == json.result.seasons[i].episode) ? 1 : 0;
								//basetype	= "tvshows"
								listtype	= "episodes";
								listid		= season;
								baseid		= tvshowid;
								back		= {listtype: "seasons", listid: tvshowid};

								// load all the episodes in the selected season for this tv show
								//self.loadMediaList({type: load, id: id, baseid: baseid});
								queueItem({listtype: listtype, listid: listid, baseid: baseid});
							//}
						} else consolelog("could not find tvshowid in json response... discarding item from list");
					} catch (e) {
						consolelog("Failed to load a tv show season. The tvshowid(" + tvshowid + ") doesnt exist - " + e);
					}
				};

				var episodes = function(i) {
					try {
						// "episode", "season", "tvshowid", "showtitle", "resume", "title", "year", "playcount", "thumbnail", "file", "art.posert|fanart", "watchedepisodes"
						var tvshowid = json.result.episodes[i].tvshowid;
						var season = json.result.episodes[i].season;

						consolelog("self.XBMC.mediaLibrary[\"tvshows\"][" + self.XBMC.ref["tvshows"][tvshowid].index + "][\"seasons\"" + self.XBMC.ref["tvshows"][tvshowid].item + "][" + self.XBMC.ref["tvshows"][tvshowid][season].index + "][\"episodes\"" + self.XBMC.ref["tvshows"][tvshowid][season].item + "]");
						//if ( typeof self.XBMC.mediaLibrary["tvshows"][self.XBMC.ref["tvshows"][tvshowid].index]["seasons" + self.XBMC.ref["tvshows"][tvshowid].item][self.XBMC.ref["tvshows"][tvshowid][season].index]["episodes" + self.XBMC.ref["tvshows"][tvshowid][season].item] == "object") {
							// add episode info...
							file		= json.result.episodes[i].file;
							fanart	 	= json.result.episodes[i].art.fanart;
							resume		= json.result.episodes[i].resume;
							thumbnail	= json.result.episodes[i].art.poster;
							major		= json.result.episodes[i].title;
							minor		= "S" + json.result.episodes[i].season + ":E" + json.result.episodes[i].episode;
							playcount	= (json.result.episodes[i].watchedepisodes == json.result.episodes[i].playcount) ? 1 : 0;
							//basetype	= "tvshows";
							//listtype	= null; // not req'd
							//id		= season; // not req'd
							//baseid	= tvshowid; // not req'd?
							//back		= {listtype: "seasons", id: season, baseid: tvshows}; // not req'd
						//}
					} catch (e) {
						consolelog("Failed to load a tv show episode. The episode in season(" + season + ") of tvshowid(" + tvshowid + ") don't exist? - " + e);
					}
				};

				var artists = function(i) {
					try {
						console.log(json.result.artists[i]);
						// "artist", "artistid", "thumbnail", "fanart", "formed", "label"
						artistid = json.result.artists[i].artistid;
						consolelog("Queueing albums for artist(" + artistid + ") to be loaded ...");
						if ( typeof self.XBMC.queuedIDs["albums"] != "object" ) self.XBMC.queuedIDs["albums"] = [];
						self.XBMC.queuedIDs["albums"].push({"artistid": artistid});
						//console.log(self.XBMC.queuedIDs["albums"]);

						// set reference variables
						//if (typeof self.XBMC.ref["artists"][artistid] == "undefined") self.XBMC.ref["artists"][artistid] = [];
						//self.XBMC.ref["artists"][artistid] = {"index": rowCount, "item": itemCount + 1};

						fanart		= json.result.artists[i].fanart;
						thumbnail	= json.result.artists[i].thumbnail;
						major		= json.result.artists[i].artist;
						minor		= json.result.artists[i].formed;
						//type		= "artists";
						listtype	= "albums";
						listid		= artistid;
						baseid		= null;
						back		= {listtype : "artists"};

						// load all the albums for this artist
						queueItem({listtype: listtype, listid: listid, baseid: baseid});

					} catch (e) {
						consolelog("Failed to load an artist - " + e);
					}
				};

				var albums = function(i) {
					try {
						// "artistid", "albumartistid", "albumid", "thumbnail", "title", "fanart", "year", "playcount"
						var artistid = json.result.albums[i].artistid;
						var albumid = json.result.albums[i].albumid;

						consolelog("Queueing songs on albumid(" + albumid + ") for artistid(" + artistid + ") to be loaded ...");
						if ( typeof self.XBMC.queuedIDs["songs"] != "object" ) self.XBMC.queuedIDs["songs"] = [];
						self.XBMC.queuedIDs["songs"].push({"artistid": artistid, "albumid": albumid});
						//console.log(self.XBMC.queuedIDs["songs"]);

						// set reference variables
						//if (typeof self.XBMC.ref["artists"][artistid][albumid] == "undefined") self.XBMC.ref["artists"][artistid] = [];
						//self.XBMC.ref["artists"][artistid][albumid] = {"index": rowCount, "item": itemCount + 1};

						// WHAT'S THIS IF DOING? - checking that the parent list has been loaded? who gives a fuck??!!
						//if ( typeof self.XBMC.mediaLibrary["artists"][ self.XBMC.ref.artists[artistid].index ]["albums" + self.XBMC.ref.artists[artistid].item] == "object" ) {
							//var leveloneid	= artistid;
							fanart		= json.result.albums[i].fanart;
							thumbnail	= json.result.albums[i].thumbnail;
							major		= json.result.albums[i].title;
							minor		= json.result.albums[i].year;
							playcount	= json.result.albums[i].playcount;
							//type		= "artists";
							listtype	= "songs";
							listid		= albumid;
							baseid		= artistid;
							back		= {listtype: "albums", id: artistid}; // info requred to load the artists list

							queueItem({listtype: listtype, listid: listid, baseid: baseid});
						//}
					} catch (e) {
						consolelog("Failed to load an album. The artistid(" + artistid + ") doesnt exist? - " + e);
					}
				};

				var songs = function(i) {
					try {
						// "thumbnail", "fanart", "title", "track", "file", "albumartistid", "albumid", "songid", "playcount", "album"
						var artistid = json.result.songs[i].artistid;
						var albumid = json.result.songs[i].albumid;

						consolelog("self.XBMC.mediaLibrary[\"artists\"][" + self.XBMC.ref.artists[artistid].index + "][\"albums\"" + self.XBMC.ref.artists[artistid].item + "][" + self.XBMC.ref.artists[artistid][albumid].index + "][\"songs\"" + self.XBMC.ref.artists[artistid][albumid].item + "]");
						//if ( typeof self.XBMC.mediaLibrary["artists"][self.XBMC.ref.artists[artistid].index]["albums" + self.XBMC.ref.artists[artistid].item][self.XBMC.ref.artists[artistid][albumid].index]["songs" + self.XBMC.ref.artists[artistid][albumid].item] == "object") {
							// add song info...

							//var leveloneid = artistid;
							//var leveltwoid = albumid;
							fanart		= json.result.songs[i].fanart;
							file		= file;
							thumbnail	= json.result.songs[i].thumbnail;
							major		= json.result.songs[i].track + ". " +json.result.songs[i].title;
							minor		= json.result.songs[i].album;
							playcount	= json.result.songs[i].playcount;
							//basetype		= "artists";
							//listtype		= null;		// not req'd
							//id		= albumid;	// not req'd
							//baseid	= artistid;	// not req'd
							//back		= {listtype: "albums", id: artistid}; // not req'd

							//queueItem();
						//}
					} catch (e) {
						consolelog("Failed to load a tv show episode list. The songs on season(" + season + ") of tvshowid(" + tvshowid + ") don't exist - " + e);
					}

					// load the sub-list for this item

					// THIS IS WHERE THE SEASON/EPISODE LIST LOADING STOP!!! DICK!

					//consolelog("buildMediaList() is calling loadMediaList(load: " + load + ", id: " + id + ", =

					//self.loadMediaList({type: (load) ? load : null, id: (id) ? id : null, baseid: (baseid) ? baseid : null});

				};


				addThumbnail = function(fake) {
					// fake == false => add a empty/hidden thumbnail
					var tokens = {};
					if (!fake) {
						if ( fanart ) {
							tokens["[fanart]"] = cleanImage(fanart);
							// CF.loadAsset(tokens["[fanart]"], CF.UTF8); // reeeeeeally doesnt like this :-!
						}
						if ( file )		tokens["[file]"]		= decode_utf8(file);
						if ( resume )	tokens["[resume]"]		= resume;
						//if ( basetype )		tokens["[basetype]"]	= basetype;						// fundamental type of list (movies, tvshows, artists, playlists) only set from sidemenu
						if ( listtype )	tokens["[listtype]"]	= listtype;						// media type to load for next list on thumbnail click
						//tokens["[listtype]"]	= type;						// media type to load for next list on thumbnail click
						if ( listid )	tokens["[listid]"]		= listid;						// used to locate first+seconds level objects in mediaLibrary[]
						if ( baseid )	tokens["[baseid]"]		= baseid;					// used to locate first level object in mediaLibrary[]
						if ( back )		tokens["[return]"]		= JSON.stringify( back ); 	// info for back button on next list
						tokens["[join]"]						= itemCount;
						tokens["[listIndex]"]					= rowCount;

						//tokens["[" + ((base) ? "base_" : "") + "join]"] = itemCount+1;
						//tokens["[" + ((base) ? "base_" : "") + "index]"] = rowCount;
						//if (base) tokens["[base_join]"] = itemCount+1;
						//if (base) tokens["[base_index]"] = rowCount;
					}

					rowItems["d"+(self.joins.firstWatched+itemCount)]	= (!fake) ? ((playcount > 0) ? 1 : 0) : "";
					rowItems["s"+(self.joins.firstTitle+itemCount)]		= (!fake) ? decode_utf8(major) : "";
					rowItems["s"+(self.joins.firstYear+itemCount)]		= (!fake) ? (decode_utf8((typeof minor == "number") ? minor.toString() : minor)) : "";
					rowItems["s"+(self.joins.firstThumbnail+itemCount)]	= (!fake) ? cleanImage(thumbnail) : "";
					rowItems["d"+(self.joins.firstThumbnail+itemCount)]	= { // button for selecting item
						"value": 0,
						"tokens": tokens
					};

					itemCount++;
				};

				var padRow = function() {
					// only pad if the row isnt empty
					if (itemCount < maxPerRow && rowItems.length > 0 ) {
						// hide/clear remaining items in row
						while (itemCount < maxPerRow) addThumbnail(false); // empty thumbnail

						// add last row to array
						list.push(rowItems);
					}
				};


				// create the cases object to call the req'd functions
				var cases = {
					movies: 	movies,
					tvshows:	tvshows,
					seasons:	seasons,
					episodes: 	episodes,
					artists:	artists,
					albums:		albums,
					songs:		songs
				};

				// base types lookup array
				var basetype = {
					movies:		"movies",
					tvshows:	"tvshows",
					seasons:	"tvshows",
					episodes:	"tvshows",
					artists:	"artists",
					albums:		"artists",
					songs:		"artists"
				};

				//consolelog("cases = --v");
				//console.log(cases);

				try {
					// create the list by looping thru the json response object
					for (var i = 0; i < json.result.limits.total; i++) {
						if (itemCount == maxPerRow) {
							itemCount = 0;
							rowCount++;

							list.push(rowItems);

							rowItems = {}; // reset horizontal row list
						}

						if (cases[type]){
							cases[type](i);		// build the thumbnail
							addThumbnail();		// add the thumbnail to the row

						}
					}
				} catch (e) {
					consolelog("buildMediaList(): Exception caught in json.result for loop... - ", e);

				}

				padRow(); // clean up last row (hide empty thumbnails)

				consolelog("Finished creating list for " + type);
				//self.XBMC.mediaLibrary[type] = list; // set here or in GT join change event??  join change event
				//consolelog("WHAT THE mediaLibrary[currentList] SHOULD LOOK LIKE!! --v");

				consolelog("list object = --v", list);

				// !! DONT ADD TO LIST HERE - THIS JUST BUILDS IT AND ADD'S TO GT... INTERVAL WATCHING mediaLibrary[type] ADD'S THE LIST !!
				//CF.listRemove("l"+self.joins.mediaList); // double check list is empty to avoid duplicating
				//CF.listAdd("l"+self.joins.mediaList, list); //add array to iviewer liste=

				// NEED TO HAVE LIST TITLE SET BEFORE HERE


				// set mediaList global token [type]
				CF.getJoin(CF.GlobalTokensJoin, function(j, v, t) {

					var l = {};
					try {
						l = JSON.parse(t["[" + basetype[type] + "]"]);
					} catch(e) {
						consolelog("loadMediaList(): Failed to get " + basetype[type] + " from GT join. Possibly not created yet...", "GT [" + basetype[type] + "] = '" + t["[" + basetype[type] + "]"] + "'", new Error("The GlobalToken [" + basetype[type] + "] is empty..."));
					} finally {

						// IS THERE A BETTER WAY TO DO THIS??

						switch(type) {
						case "seasons":
						case "albums":
							// check declared as object
							l["[" + basetype[type] + "]"] = l[ "[" + basetype[type] + "]"] || {};
							l["[" + basetype[type] + "]"]["[" + type + "]"] = l[ "[" + basetype[type] + "]"]["[" + type + "]"] || {};
							l["[" + basetype[type] + "]"]["[" + type + "]"][baseid] = l[ "[" + basetype[type] + "]"]["[" + type + "]"][baseid] || {};

							//l[ "base type" ][ "[seasons/albums]" ][ "tvshowid/artistid" ]
							l["[" + basetype[type] + "]"]["[" + type + "]"][listid]["list"] = list;
							break;
						case "episodes":
						case "songs":
							// check declared as object
							l["[" + basetype[type] + "]"] = l[ "[" + basetype[type] + "]"] || {};
							l["[" + basetype[type] + "]"]["[" + type + "]"] = l[ "[" + basetype[type] + "]"]["[" + type + "]"] || {};
							l["[" + basetype[type] + "]"]["[" + type + "]"][baseid] = l[ "[" + basetype[type] + "]"]["[" + type + "]"][baseid] || {};
							l["[" + basetype[type] + "]"]["[" + type + "]"][baseid][listid] = l[ "[" + basetype[type][listid] + "]"]["[" + type + "]"][baseid][listid] || {};

							//l[ "base type" ][ "[episodes/songs]" ][ "tvshowid/artistid" ][ "season/albumid" ]
							l["[" + basetype[type] + "]"]["[" + type + "]"][baseid][listid]["list"] = list;
							break;
						case "movies":
						case "tvshows":
						case "artists":
							l["[" + basetype[type] + "]"] = l[ "[" + basetype[type] + "]"] || {};
							consolelog("setting up [" + basetype[type] + "] token to be added to GT...");
							l["[" + basetype[type] + "]"]["list"] = list;
							consolelog("l == ---v", l);
							// delete the media type from the queue of lists to be loaded
							//if( delete libraryRequestQueue[type]["[list]"] ) {
							//	if (!libraryRequestQueue[type]) delete libraryRequestQueue[type];
							//}
							consolelog("!libraryRequestQueue[type] == " + !libraryRequestQueue[type]);
						};

						try {
							//gtok = {};
							consolelog("adding new list to GlobalTokens [" + basetype[type] + "] = ---v", l);
							// convert list from an object to a string for storage as a GlobalToken
							l["[" + basetype[type] + "]"] = JSON.stringify(l["[" + basetype[type] + "]"]);

							//consolelog("l[\"[\"" + basetype[type] + "\"]\"] = " + l["[" + basetype[type] + "]"]);
							CF.setJoins([
								// triggers join change event to update mediaLibrary[type]? hopefully AFTER the current list GT is changed... :-!
								{ join: CF.GlobalTokensJoin, value: GlobalTokensCounter++, tokens: l }
							]);

						} catch (e) {
							consolelog("buildMediaList(): error seting GT - tokens = ---v", tokens, e);
						} finally {

							// delete the media type from the queue of lists to be loaded
							//delete libraryRequestQueue[type]["queue" + baseid + listid];

							// clean up variables
							//list = []; // not needed

						}
					}

				});
			} else consolelog("buildMediaList(): error in json response or list type not valid");
		} catch (e) {
			consolelog("Blurrrrrr!!!");
		} finally {
			consolelog("removing query from library request queue ---v", libraryRequestQueue.shift());
			self.listLoading = false;
			consolelog("set self.listLoading = " + self.listLoading);

			// OR delete libraryRequestQueue[libraryReqeustQueue.indexOf(JSON.stringify())];

			// delete the type from the library request queue
			//consolelog("buildMediaList(): Deleting libraryRequestQueue[" + type + "] - check doesnt throw exception if not defined, ie: type = false");
			//delete libraryRequestQueue[type]["queue" + baseid + listid];
			try {
				// THIS MAY GET MOVE TO loadMediaList() ---v
				Object.keys(libraryRequestQueue).length || (libraryRequestQueue = []);
				consolelog("buildMediaList() - TESTING: Object.keys(libraryRequestQueue).length || libraryRequestQueue = {}", libraryRequestQueue);


				consolelog("buildMediaList() is requesting to load next media list in queue");
				self.loadMediaList(); // cycles through libraryRequestQueue until empty

				//consolelog("No more media lists need loading... deleting libraryRequestQueue...")
			} catch (e) {
				// does this ever get called??
				consolelog("WOW!! Exception caught at the end of buildMediaList() whilst removing or deleting libraryRequestQueue after creating a " + type + " list. May need to move self.loadMediaList() to catch block..?");
			}
		}
	};



	// --- Private Functions --- //

	function onJSONResponse(feedbackItem, matchedString) {
		//consolelog("json feeback received...\n " + matchedString);
		for (i = 0; i < matchedString.length; i++) {
			Switch1:
			switch (matchedString[i]){
				case "{":
					self.XBMC.jsonBraceCount++;
					valid = true;
					break Switch1;
				case "}":
					self.XBMC.jsonBraceCount--;
					break Switch1;
			}

			if (valid == true) self.XBMC.jsonBuffer += matchedString[i]; // add character to buffer

			if (valid != undefined && self.XBMC.jsonBraceCount == 0) {
				// complete JSON response - should parse correctly
				//consolelog("Found completed JSON response -> " + self.XBMC.jsonBuffer + "");
				try {
					var decoded = JSON.parse(self.XBMC.jsonBuffer);
					consolelog("Decoded json feedback = <see next line>");
					console.log(decoded);
					if (decoded.hasOwnProperty("error")) consolelog("Error in JSON response - " + decoded.error.message + ((decoded.error.hasOwnProperty("data")) ? ("\nMethod: " + decoded.error.data.method + "\nMessage: " + decoded.error.data.stack.message) : ""));
					else if (decoded === null) consolelog("Failed to parse JSON string :(");
				} catch (e) {
					consolelog("There was a problem parsing a received JSON command. It has been discarded. (decoded = " + decoded + ")\n - " + e);
				} finally {
					if (decoded) jsonCallback(decoded); // send to json callback function
					// now reset buffer and and start again...
					valid = undefined;
					//delete valid || consolelog("jsonResponse(): Failed to delete the \"valid\" varianble. valid = " + valid);
					self.XBMC.jsonBuffer = "";
					self.XBMC.jsonBraceCount = 0;
					self.XBMC.jsonWaitResponse = false;
				}

			}
		}
	}


	function jsonCallback(json) {
		// use the decoded data here
		//CFlogObject(json);
		//console.log(json);

		//consolelog("JSON Response from id = '" + json.id + "', method = '" + json.method + "' ->\n" + JSON.stringify(json));

		// Perform REGEX to find response type (movies, video, audio, etc) - TODO!!
		consolelog("XBMC Feedback JSON id = " + json.id);

		//if ( !json.hasOwnProperty("id") ) json.id = null;
		//if(json.hasOwnProperty("error")) console.log("Error received in JSON response... shouldnt have made it this far!!");
		//else {
		switch ( (json.hasOwnProperty("id") ? json.id : null) ) {
			case self.XBMC.ids.movies:
			case self.XBMC.ids.tvshows:
			case self.XBMC.ids.artists:
			case self.XBMC.ids.seasons:
			case self.XBMC.ids.albums:
				//self.XBMC.mediaLibrary[self.XBMC.checkMediaType(json.id, false)] = json;

				buildMediaList(json);
				//type = self.XBMC.checkMediaType(json.id, false)
				//if (type) {
					//mediaLibrary[type] = json; // kills loading interval as interval exits once mediaLibrary[type] != undefined
					//buildMediaList(json); // why set json twice...??
				//}
				break;
			case self.XBMC.ids.seasons:
			case self.XBMC.ids.albums:
				// 2nd level operation
				if (type = self.XBMC.checkMediaType(json.id)) {
					if (self.XBMC.queuedIDs.hasOwnProperty(type) && self.XBMC.queuedIDs[type].length > 0) {

					} else{

					}
				}
				break;
			case self.XBMC.ids.episodes:
			case self.XBMC.ids.songs:
				// 3rd level operation


				break;
			case self.joins.mediaList:
				//self.XBMC.buildMovies(self.joinMovies, json);
				// Update the wall list
				break;
			case undefined:
				// XBMC sent JSON response without request
				console.log(json);
				break;
			default:
				console.log(json);
				if ( json.hasOwnProperty("result") ) {
					consolelog("json.result = " + json.result);
					switch(json.result) {
						case "pong":
							// not needed if using connected join?
							CFlog("Ping response received");
							CF.setJoin("d"+self.XBMC.joins.connected.join, 1); // force connected join update
							break;
						default:
							//console.log(json);
							consolelog("typeof result.hasOwnProperty = " + (typeof json.result.hasOwnProperty));
							CFlog("Nothing required from JSON response in jsonCallback()");
					}
				}
		}
		//}
	}


	function onJoinChange(join, value, tokens) {
		consolelog("onJoinChange(" + join + ", " + value + ", " + tokens + ")");
		switch (join) {
			case "d"+self.XBMC.joins.connected.join:
				self.XBMC.joins.connected.value = value;
				if (value == 1) {
					consolelog("XBMC is connected!");
					if ( self.XBMC.jsonQueue.length > 0 ) self.XBMC.json(); // re trigger the json queue loop
					if (!self.XBMC.mediaLibrary[self.XBMC.currentList.listtype]) {
						consolelog("Connected join change event is requesting loadMediaList(currentList)");
						self.loadMediaList(self.XBMC.currentList);  // re-loads list from XBMC
					}
				}
				break;
			case CF.GlobalTokensJoin:
				//CF.getJoin(CF.GlobalTokensJoin, function(j, v, t) {
					console.log("GT token at start of JoinChangeEvent ---v", tokens);
					try {
						var prevList = self.XBMC.currentList;
						self.XBMC.currentList = (tokens["[currentList]"]) ? JSON.parse(tokens["[currentList]"]) : {listtype: "movies", basetype: "movies"};
						consolelog("GT JoinChangeEvent: loaded local currentList from GT = --v");
						console.log(self.XBMC.currentList);
					} catch (e) {
						consolelog("The [currentList] global token was not retrieved - " + e);
					}

					// update the local mediaList arrays
					//prevMediaList = self.XBMC.mediaLibrary[self.XBMC.currentList.basetype];  // only works for items supplied in forEach array
					prevMediaList = self.XBMC.getMediaList();
					var basetypes = ["artists", "movies", "tvshows"];
					for ( var i = 0; i < basetypes.length; i++) {
						try {
							// need to get the current list object only ie: if viewing an album(list of songs) ie: mediaLibrary["artists"][artistid][albumid] -- dont worry about this here
							//self.XBMC.mediaLibrary[value] = (tokens["[" + value + "]"]) ? JSON.parse(tokens["[" + value + "]"]) : undefined;
							self.XBMC.mediaLibrary[basetypes[i]] = JSON.parse(tokens["[" + basetypes[i] + "]"]);
							consolelog("GT JoinChangeEvent: mediaLibrary[" + basetypes[i] + "] loaded from GT ---v", self.XBMC.mediaLibrary[basetypes[i]]);
							//consolelog("GT JoinChangeEvent: loaded mediaList = --v");
							//console.log(self.XBMC.mediaLibrary[self.XBMC.currentList.listtype]);

							if ( self.XBMC.currentList.basetype == basetypes[i] ) {
								consolelog("checking listInfo() before adding to list...");
								// lists not being reloaded if mediaLibrary[currentList] exists...
								CF.listInfo("l"+self.joins.mediaList, function(list, items) {
									// add array to list if
									// 1. the list is empty
									// 2. the previous list is different to the current list (may need CF.listRemove...
									// 3. the mediaLibrary[] has changed
									// 3. the mediaLibrary[] is not empty
									var currentListString = "", prevListString = "";

									// check if currentList's are different
									// exception thrown if either are null
									// need to get the current list object only ie: if viewing an album(list of songs) ie: mediaLibrary["artists"][artistid][albumid]
									consolelog("listInfo(): self.XBMC.currentList = ---v", self.XBMC.currentList);
									if (self.XBMC.currentList) {
										try {
											prevListString = JSON.stringify(self.XBMC.getMediaList(prevList, true));
											currentListString = JSON.stringify(self.XBMC.getMediaList());
										} catch (e) {
											consolelog("Failed to set the  previous and current media list compare string", e);
										}
									}

									consolelog("Should the list join be updated? => " +
												(prevListString != currentListString) +
												", items = " + items + ", !items = " + !items, self.XBMC.getMediaList());
									//consolelog("currentListString = " + currentListString, "prevListString = " + prevListString);
									if (	(
												//self.XBMC.currentList.listtype != prevList.type || // redundant if checking the media list array
												(prevListString != currentListString) ||
												!items)
											//&& self.XBMC.mediaLibrary[self.XBMC.currentList.listtype]
											//&& currentListString	// checks if the list mediaList object for the selected media type is not empty
										&& self.XBMC.getMediaList()
										)
										 {

										if (items) {
											consolelog("Clearing the media list join", new Error());
											CF.listRemove(list); // clear the list if not already done - triggers JoinChangeEvent
										}

										// update the list - CHECK TIMING
										// OPTION #1: remove list here - need to set currentList(set from title change event) ASAP when changing lists
										// OPTION #2: add list here and use list join change to kill loading loop :))) !!! list must be remove before media list title set....
										// OPTION #2 currently in use
										consolelog("Filling list join with " + self.XBMC.currentList.listtype, self.XBMC.getMediaList());

										// THIS IS GETTING CALLED WHILE THE MEDIALIBRARY IS EMPTY....

										CF.listAdd("l"+self.joins.mediaList, self.XBMC.getMediaList());
									}
								});
							}
						} catch (e) {
							consolelog("The [" + basetypes[i] + "] global token was not retrieved. removing the local mediaLibrary - " + e);
							delete self.XBMC.mediaLibrary[basetypes[i]];
						} finally {

						}

					}
					/*
					["artists", "movies", "tvshows"].forEach(function(value, key) {
						try {
							// need to get the current list object only ie: if viewing an album(list of songs) ie: mediaLibrary["artists"][artistid][albumid] -- dont worry about this here
							//self.XBMC.mediaLibrary[value] = (tokens["[" + value + "]"]) ? JSON.parse(tokens["[" + value + "]"]) : undefined;
							self.XBMC.mediaLibrary[value] = JSON.parse(tokens["[" + value + "]"]);
							consolelog("GT JoinChangeEvent: mediaLibrary[" + value + "] loaded from GT ---v", self.XBMC.mediaLibrary[value]);
							//consolelog("GT JoinChangeEvent: loaded mediaList = --v");
							//console.log(self.XBMC.mediaLibrary[self.XBMC.currentList.listtype]);
						} catch (e) {
							consolelog("The [" + value + "] global token was not retrieved. removing the local mediaLibrary - " + e);
							delete self.XBMC.mediaLibrary[value];
						}
					});
					*/

					//CF.setJoin("d"+self.joins.media_return_button, (["movies", "tvshows", "artists"].indexOf(self.XBMC.currentList.listtype) == -1) ? 1 : 0);
				//});

				break;
			case "d"+self.joins.mediaList:
				CF.setJoin("d"+self.joins.diagnostics, (value) ? 0 : 1);
				break;
			case "s"+self.joins.mediaList:
				// save currentList
				consolelog("Media list title JoinChangeEvent is saving the [currentList] Global Token = " + JSON.stringify(self.XBMC.currentList));
				// set [currentList] token correcting order of properties
				CF.setJoins([
					{join: CF.GlobalTokensJoin,
					value: GlobalTokensCounter++,
					tokens: { "[currentList]": JSON.stringify({listtype: tokens["[listtype]"], basetype: tokens["[basetype]"], listid: tokens["[listid]"], baseid: tokens["[baseid]"]}) }},
				]);
				consolelog("Starting self.loadMediaList(params) from the media list title JoinChangeEvent using params ---v", tokens);
				self.loadMediaList(tokens);
				break;
			case "l"+self.joins.mediaList:
				// media list changed

				CF.listInfo(join, function(list, count) {
					consolelog("JoinChangeEvent(l1): media list (" + join + ") has " + count + " items in it");
					if (count == 0) {
						consolelog("JoinChangeEvent(l1): The media list has been cleared (not by me!). I Will start the loading timeout and interval...");
						/*
						var graphics = [
							{ join: "s"+self.joins.media_loading_base,	opacity: 0},
							{ join: "d"+self.joins.media_loading_progress,	opacity: 0},
							{ join: "s"+self.joins.media_loading_text,	opacity: 0},
							{ join: "s"+self.joins.media_loading_dotone,	opacity: 0},
							{ join: "s"+self.joins.media_loading_dottwo,	opacity: 0},
							{ join: "s"+self.joins.media_loading_dotthree,	opacity: 0},
						];
						*/
						// check timer not already started and the the media list being viewed is empty ----> NEEDS UPDATING TO CHECK baseid, listid, listtype
					// CURRENTLY ONLY CHECKING IF BASE LIST IS LOADED
					//try {

						if ( !loadingTimeoutID && !self.XBMC.getMediaList() ) {
							// start loading timeout and interval
							loadingTimeoutID = setTimeout(function() {
								// clear the loading interval
								//clearInterval(loadingIntervalID);
								//clear the loadingIntervalID;
								loadingTimeoutID = undefined;

								// hide the loading graphics
								//for ( i = 0; i < graphics.length; i++ ) graphics[i].opacity = 0;
								//CF.setProperties(graphics, 0, 2, CF.AnimationCurveLinear, function(js) {
									// change the opacity of the no media found image
									//CF.setProperties({"s"+self.joins.no_media_found, opacity: 1}, 0, 2);
								//});


								consolelog("JoinChangeEvent(l1): media loading timeout expired...");
							}, 30 * 1000); // 30 secs
						}
						// show the loading graphics
						/*
						for ( i = 0; i < graphics.length; i++ ) graphics[i].opacity = 1;
						CF.setProperties(graphics, 0, 2, CF.AnimationCurveLinear, function() {
								// animate the loading graphic
								var animate = function() {
									CF.setProperties({join: "s"+self.joins.media_loading_progress, x: -313}, 0.25, 0, CF.AnimationCurveLinear, function(js) {
										if (loadingTimeoutID) {
											CF.setProperties({join: js, x: 313}, 0, 2, CF.AniamtionCurveLinear, function(js) {
												animate();
											});
										}
									});
								};
								animate();
						});
						*/
					} else {
						// list created
						consolelog("JoinChangeEvent(l1): " + count + " " + self.XBMC.currentList.listtype + " have been added to the list");
						// stop the loading timeout
						consolelog("JoinChangeEvent(l1): clearing the media loading timeout");
						clearTimeout(loadingTimeoutID);
						delete loadingTimeoutID;

						// stop the loading interval
						//clearInterval(loadingIntervalID);
						//delete loadingIntervalID;

						// hide the loading graphics
						//for ( i = 0; i < graphics.length; i++ ) graphics[i].opacity = 0;
						//CF.setProperties(graphics, 0, 2, CF.AnimationCurveLinear, function(js) {
						//});
						// change the opacity of the no media found image
						//CF.setProperties({"s"+self.joins.no_media_found, opacity: 0}, 0, 2);



						//CF.flipToPage("XBMC_Wall_List"); // TEMPORARY - remove when not reqd
						//autoFlipToWall = false; // reset // TEMPORARY - remove when not reqd
					}
				});

				break;
		}
	}

	function onConnectionChange(system, connected, remote) {
		// On connected==true, the remote is a string
		// for example: "192.168.0.16:5050"
		// When getting initial status, if the system is not connected, remote is null.
		if (connected) {
			consolelog("System " + system + " connected with " + remote);
			CF.setJoins([
				{join: "d"+self.joins.diagnostics, value: 1},
				{join: "d"+self.joins.mediaList, value: 0},
			]);

		} else {
			if (remote === null) consolelog("Initial status: system " + system + " is not connected.");
			else consolelog("System " + system + " disconnected from " + remote);
		}
	}

	function setMediaListTitle(params) {
		if (!params) params = self.XBMC.currentList;
		consolelog("s+mediaList JoinChangeEvent: params = ---v", params);
		params = tokenize(params, true);
		title = ( params["[listtype]"].toLowerCase() == "tvshows" ) ? "TV Shows" : params["[listtype]"][0].toUpperCase() + params["[listtype]"].substr(1); // proper case
		consolelog("Setting the media list title serial join to \"" + title + "\" using setMediaListTitle(params), called from showMediaList()");
		CF.setJoins([
			{join: "s"+self.joins.mediaList, value: title, tokens: params },
			{join: "d"+self.joins.media_return_button, value: (["movies", "tvshows", "artists"].indexOf(params["[listtype]"]) == -1) ? 1 : 0 }
		]);
	}

	function tokenize(obj, force) {
		var newprop = "";
		try {
			for (prop in obj) {
				if (obj.hasOwnProperty(prop) && typeof prop == "string") {
					if ( prop[0] == "[" && prop.slice(-1) == "]" && force !== true ) newprop = prop.slice(1, -1); // skip if forcing add of square brackets
					else if ( prop[0] != "[" && prop.slice(-1) != "]" && force !== false ) newprop = "[" + prop + "]"; // skid if forcing remove of square brackets

					if (newprop) ( obj[newprop] = obj[prop], delete obj[prop] );
				}
			}
		} catch (e) {
			consolelog("Parameter passed to tokenize is not an object", e);
		} finally {
			return obj;
		}
	}

	// function for decoding string with accents
	function decode_utf8(string) {
		return decodeURIComponent(escape(string));
	};

	function cleanImage(img) {
		try {
			if (img == "") return img;
			else return self.XBMC.GetURL("HTTP") + "image/" + encodeURIComponent(img);
		} catch (e) {
			console.log ("Exception caught in cleanImage() - " + e);
			return img;
		}
	};

	function consolelog() {
		if (CF.debug) for (var i = 0; i < arguments.length; i++) {
			try {
				stack = arguments[i].stack.substring(arguments[i].stack.indexOf("at ") + 3, arguments[i].stack.substr(arguments[i].stack.indexOf("at ") + 3).indexOf(")\n") + arguments[i].stack.indexOf("at ") + 3);
				arguments[i] = "\\---> " + arguments[i] + " - \n" + ((stack) ? stack : "");
			} catch (e) {} finally {
				console.log((typeof arguments[i] == "object") ? arguments[i] : "XBMC_GUI: " + arguments[i]);
			}
		}
	}

	function CFlog() {
		if (CF.debug) for (var i = 0; i < arguments.length; i++) CF.log("XBMC_GUI: " + arguments[i]);
	}

	// --- Initialisation --- //
	return self;
}