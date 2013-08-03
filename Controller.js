var XBMC_Controller = function(params) {
	if (typeof params != "object" || !params.hasOwnProperty("xbmc") || !params.hasOwnProperty("mysql")) params = {xbmc: {}, mysql: {}};

	var mediaListIDs = [];

	var self = {
				config:		{
					name:		{
							join:		5051,
							value:		params.xbmc.name || "rPi",
					},
					ip:		{
							join:		5052,
							value:		params.xbmc.ip || "192.168.0.101",
					},
					port:		{
							join:		5053,
							value:		params.xbmc.port || "9090",
					},
					mac:		{
							join:		5054,
							value:		params.xbmc.mac || "C8-60-00-01-E2-A2",
					},
					username:	{
							join:		5055,
							value:		params.xbmc.username || "xbmc",
					},
					password:	{
							join:		5056,
							value:		params.xbmc.password || "xbmc",
					},
					mysqlenabled:	{
							join:		5057,
							value:		((params.mysql.enabled) ? 1 : 0),
					},
					mysqlip:	{
							join:		5058,
							value:		params.mysql.ip || "192.168.10.100",
					},
					mysqlmac:	{
							join:		5059,
							value:		params.mysql.mac || "00:22:4D:7B:38:36",
					},
		},
		Get:			[],
		joins:			{
			connected:	{
					join:		1000,
					value:		null,
			},
			movies:		2,
			tvshows:	3,
			seasons:	4,
			episodes:	5,
			artists:	6,
			albums:		7,
			songs:		8,
		},
		ids:			{
			movies:		"VideoLibrary.GetMovies",
			tvshows:	"VideoLibrary.GetTVShows",
			seasons:	"VideoLibrary.GetSeasons",
			episodes:	"VideoLibrary.GetEpisodes",
			artists:	"AudioLibrary.GetArtists",
			albums:		"AudioLibrary.GetAlbums",
			songs:		"AudioLibrary.GetSongs",
		},
		player:			{
			speed:		null,
			id:		null,
			item:		{
							id:		null,
							type:		null,
				},
		},
		jsonValid:		false,
		jsonBuffer:		"",
		jsonString:		"",
		jsonBraceCount:		0,
		jsonQueue:		[],
		jsonLoopID:		null,
		jsonWaitResponse:	false,
		systemName:		"XBMC",
		listsComplete:		false,
		queuedIDs:		[],
		configJoins:		[],
		ref:			{}, // may need to be [] - used to store reference for getting list of specific media type
		currentList:		{
					basetype:	"movies",
					listtype:	"movies",	// default list page
					listid:		null,
					baseid:		null,
		},
		mediaLibrary:		[],
		mediaListTypes:		["movies", "tvshows", "seasons", "episodes", "artists", "albums", "songs"],
		mediaListTypesObj:	{ movies: "movies", tvshows: "tvshows", seasons: "seasons", episodes: "episodes", artists: "artists", albums: "albums", songs: "songs"},
/*
		in_array:		function(str, arr) {
						try {
							if (typeof arr != "object") return false;
							else if (JSON.stringify(self.mediaListTypes) == JSON.stringify(arr) && str.substr(5, 11).toLowerCase() == "library.get") str = str.substr(16);
							str = str.toLowerCase();

							for (var i = 0; i < arr.length; i++) {
								// returns the string as found in the mediaListArray
								if ( arr[i] == str ) return arr[i];
							}
						} catch (e) { consolelog("Exception caught in XBMC_Controller.in_array(" + str + ", " + JSON.stringify(arr) + ") - " + e) }

						return false;
					},
*/
		in_array:		function() {
						params = {
							string: undefined,
							object: self.mediaListTypes,	// default array to search
							boolean: true,			// set to false to perform a strict search (won't return currentList.type as default)
						};

						for(var i = 0; i < arguments.length; i++) params[typeof arguments[i]] = arguments[i]; // override default params

						try {
							params.string = params.string.toLowerCase() || false;
							if (typeof params.object != "object") return (params.boolean) ? currentList || false : false;
							//else if (JSON.stringify(self.mediaListTypes) == JSON.stringify(params.object) && params.string.substr(5, 11).toLowerCase() == "library.get") params.string = params.string.substr(16); // remove "Library.Get" from search term if exists
							else if (self.mediaListTypes == params.object && params.string.substr(5, 11) == "library.get") params.string = params.string.substr(16); // remove "Library.Get" from search term if exists

							for (var i = 0; i < params.object.length; i++) {
								// returns the string as found in the mediaListArray
								if ( params.object[i] == params.string ) return params.object[i];
							}
						} catch (e) { consolelog("Exception caught in XBMC_Controller.in_array(" + params.string + ", " + JSON.stringify(params.object) + ") - " + e) }

						return (params.boolean) ? self.currentList || false : false; // return false if currentList.type is empty or strict search requested using boolean param
		},
		is_array:			function isArray(o) {
							return Object.prototype.toString.call(o) === "[object Array]";
		},
		checkMediaType:		function() {
						// search term === typeof string !
						params = {
							string: "",			// return currentList.type || false if no search term supplied
							object: self.mediaListTypesObj,	// default array to search
							boolean: true,			// set to false to perform a strict search (won't return currentList.type as default)
						};

						for(var i = 0; i < arguments.length; i++) params[typeof arguments[i]] = arguments[i]; // override default params

						try {
							params.string = params.string.toLowerCase() || self.currentList.type || false;
							// remove "Library.Get" from search term if checking against default mediaListTypes object
							if (JSON.stringify(self.mediaListTypesObj) == JSON.stringify(params.object) && params.string.substr(5, 11) == "library.get") params.string = params.string.substr(16); // 16 = Audio/VideoLibrary.Get
						} catch (e) {
							consolelog("XBMC.checkMediaType(): Invalid search string (" + params.string + ") passed");
						}
						return (self.mediaListTypesObj[params.string]) || ((params.boolean) ? self.currentList.type || false : false);
		},
	};

	try {
	for ( var i = 0; i < self.mediaListTypes; i++) self.mediaLibrary[self.mediaListTypes[i]] = null;
	} catch (e) { consolelog("error initiating XBMC_Controller.mediaList - " + e) }

	var setup = false;

	//mediaListIDs[self.ids.movies] = "movies";
	//mediaListIDs[self.ids.tvshows] = "tvshows";
	//mediaListIDs[self.ids.artists] = "artists";


	// --- Private Functions --- //


	function consolelog(msg) {
		if (CF.debug) console.log("XBMC_Controller: " + msg);
	}

	function CFlog(msg) {
		if (CF.debug) CF.log("XBMC_Controller: " + msg);
	}

	function getMediaProperties(type) {
		switch (type.toLowerCase()) {
			case "movies":
				return ["title", "thumbnail", "fanart", "genre", "playcount", "mpaa", "rating", "runtime", "year", "file", "resume"];
			case "tvshows":
				return ["thumbnail", "fanart", "title", "year", "episode", "art", "file", "playcount", "watchedepisodes"];
			case "seasons":
				return ["season", "tvshowid", "showtitle", "playcount", "episode", "thumbnail", "art", "watchedepisodes"];
			case "episodes":
				return ["uniqueid", "season", "tvshowid", "thumbnail", "showtitle", "firstaired", "episode", "resume", "file", "title", "playcount", "art"];
			case "artists":
				return ["thumbnail", "fanart", "formed"];
			case "albums":
				return ["artistid", "title", "thumbnail", "fanart", "year", "type", "playcount"];
			case "songs":
				return ["fanart", "thumbnail", "title", "track", "file", "albumartist", "artistid", "albumartistid", "albumid", "playcount"];
			default:
				return false;
		}
	}

	// --- Public Functions --- //
	self.Setup = function() {



	};

	// params = { basetype, listtype, baseid, listid }
	self.getMediaList = function(params, strict) {

		if (!params && !strict) params = self.currentList;
		consolelog("getMediaList(): params.basetype = " + params.basetype);
		// add force delete if exists in params?  TO BE TESTED ONCE REST IS WORKING
		try {
			//if (params.force) delete self.mediaLibrary[params.basetype][params.baseid][params.listid]["list"];
			return self.mediaLibrary[params.basetype][params.baseid][params.listid]["list"]; // episodes, songs
		} catch (e) {
			try {
				//if (params.force) delete self.mediaLibrary[params.basetype][params.listid]["list"];
				return self.mediaLibrary[params.basetype][params.listid]["list"]; // seasons, albums
			} catch (e) {
				try {
					//if (params.force) delete self.mediaLibrary[params.basetype]["list"];

					return self.mediaLibrary[params.basetype]["list"]; //movies, tvshows, artists
					console.log("base mediaLibrary = --v", self.mediaLibrary[params.basetype]["list"] || "not defined");
				} catch (e) {
					consolelog("XBMC.getMediaList(): no " + params.listtype + " list found" + ((params.listid) ? (" with listid = " + params.listid) : ""));
					return false;
				}
			}
		}
	};

	self.json = function(method, params, id) {
		//consolelog("method = " + method + ", params = " + params + ", id = " + id);

		if (typeof method != "undefined") {
			var json = {
				"jsonrpc": "2.0",
				"method": method,
				"params": ((typeof params == "undefined") ? {} : params),
				"id": (typeof id == "undefined") ? 0 : id
			};
			self.jsonQueue.push(json);
		} else if (!self.jsonQueue.length) {
			console.log("Discarding invalid json query...");
		}

		if (self.jsonWaitResponse == false && self.jsonQueue.length > 0 && self.joins.connected.value == 1) {
			json = self.jsonQueue.shift();
			consolelog("Sending JSON query => " + JSON.stringify(json));
			CF.send("XBMC", JSON.stringify(json));
			self.jsonWaitResponse = true;
		} else if (self.jsonQueue.length > 0 && typeof timerID == "undefined") {
			var timerID = setTimeout(function() {
				delete timerID;
				self.json();
			}, 250);
		}
	};

	self.GetListArray = function(type) {
		try {
		if ( (type = self.checkMediaType(type)) ) return self.mediaLibrary[type];
		else return [];
		} catch (e) { consolelog("error in XBMC_Controller.GetListArray() - " + e) }
	};

	self.SetListArray = function(type, arr) {
		//if (typeof arr != "object") arr = [];  // catche to reset list when no array supplied
		//consolelog("SetListArray(" + type + ", arr) array --v");
		//console.log(arr);
		consolelog("SetListArray(): typeof arr = " + typeof arr);
		try {
			if ( (type = self.checkMediaType(type)) ) self.mediaLibrary[type] = (typeof arr == "object") ? arr : [];
			consolelog("SetListArray(): mediaLibrary[\""+ type + "\"] updated --v");
			console.log(self.mediaLibrary[type]);
		} catch (e) { consolelog("error in XBMC_Controller.SetListArray() - " + e) }

		if ( !self.listsComplete ) {
			self.listsComplete = true;
			for ( i = 0; i < self.mediaListTypes.length; i++ ) {
				if (typeof self.mediaLibrary[self.mediaListTypes[i]] != "object" ||
					(self.queuedIDs.hasOwnProperty(self.mediaListTypes[i]) && self.queuedIDs[self.mediaListTypes[i]].length > 0)
						) self.listsComplete = false;
				else CF.setJoin("d"+self.joins[self.mediaListTypes[i]], 1);
			}
		}

	};


	// --- PUBLIC XBMC actions --- //
	self.Ping = function() {
		self.json("JSONRPC.Ping", {}, null);
	};

	self.Get["movies"] = function(params) {
		if (typeof params != "object") params = {};
		consolelog("JSON command 'VideoLibrary.GetMovies' compiled and sent to queue");
		self.json("VideoLibrary.GetMovies", { "sort": {"order": ((typeof params.order == "string") ? params.order : "ascending"), "method": ((typeof params.method == "string") ? params.method : "label")}, "properties": getMediaProperties("movies")}, (params.id) ? params.id : self.ids.movies);
	};

	self.Get["tvshows"] = function(params) {
		if (typeof params != "object") params = {};
		self.json("VideoLibrary.GetTVShows", {"sort": { "order": ((typeof params.order == "string") ? params.order : "ascending"), "method": ((typeof method == "string") ? method : "label")}, "properties": getMediaProperties("tvshows")}, (params.jsonid) ? params.jsonid : self.ids.tvshows); // for Frodo
	};

	self.Get["seasons"] = function() {
		//if (typeof params != "object") params = {};

		//season = params.queuedIDs["seasons"].shift();
		//if (typeof season == "undefined") season = {"tvshowid": ""};
		var params = {};
		var cases = {
			string: function(s) { params.push(s) },
			object:	(function(o) { params = o }),
		}

		for (var i = 0; i < arguments.length; i++) if ( cases[typeof arguments[i]] ) cases[typeof arguments[i]](arguments[i]);
		consolelog("Get[seasons](): params.length = " + params.length);

		self.json("VideoLibrary.GetSeasons", { "tvshowid" : params.id || params[0], "sort": { "order": ((typeof params.order == "string") ? params.order : "ascending"), "method": ((typeof params.method == "string") ? params.method : "title")}, "properties": getMediaProperties("seasons")}, ((params.jsonid) ? params.jsonid : self.ids.seasons)); // for Frodo
	};

	self.Get["episodes"] = function(params) {
		if (typeof params != "object") params = {};

		//if (params.hasOwnProperty("queuedIDs")) {
		//	episode = params.queuedIDs["episodes"].shift() || {"tvshowid": "", "season": ""};
		//}

		if (typeof episode == "undefined") episode = {"tvshowid": "", "season": ""};

		self.json("VideoLibrary.GetEpisodes", {"sort": { "order": ((typeof params.order == "string") ? params.order : "ascending"), "method": ((typeof params.method == "string") ? params.method : "label")}, "tvshowid": params.returnid || params[1], "season": params.id || params[0], "properties": getMediaProperties("episodes")}, ((params.jsonid) ? params.jsonid : self.ids.episodes)); // for Frodo
	};

	self.Get["artists"] = function(params) {
		if (typeof params != "object") params = {};
		//self.json("AudioLibrary.GetArtists", {"albumartistsonly": true, "sort": { "order": ((typeof params.order == "string") ? order : "ascending"), "method": ((typeof params.method == "string") ? method : "label") }, "properties": getMediaProperties("artists")}, ((typeof params.id != "undefined") ? params.id : self.ids.artists));
		self.json("AudioLibrary.GetArtists", { "fields": ["artistid", "label"] }, ((typeof id != "undefined") ? id : self.ids.artists));
	};

	self.Get["albums"] = function(params) {
		if (typeof params != "object") params = {};

		//album = params.queuedIDs["albums"].shift();
		if (typeof album == "undefined") album = {"artistid": ""};

		self.json("AudioLibrary.GetAlbums", { "filter":{"artistid": params[0]}, "properties": getMediaProperties("albums") }, (params.jsonid) ? params.jsonid : self.ids.albums);			// Frodo
		//self.json("AudioLibrary.GetAlbums", { "properties": getMediaProperties("albums") }, ((typeof id != "undefined") ? id : self.ids.albums));			// Frodo
	};

	self.Get["songs"] = function(params) {
		if (typeof params != "object") params = {};

		//song = params.queuedIDs["songs"].shift();
		if (typeof song == "undefined") song = {"artistid": "", "albumid": ""};

		self.json("AudioLibrary.GetSongs", { "filter":{"albumid": song.albumid}, "sort": {"order": "ascending", "method": "track"}, "properties": getMediaProperties("songs")}, ((typeof params.id == "number") ? params.id : self.ids.songs));
		//self.json("AudioLibrary.GetSongs", { "sort": {"order": "ascending", "method": "artist"}, "properties": getMediaProperties("songs")}, ((typeof id != "undefined") ? id : self.ids.songs));

	};

	self.PlayToken = function(tokens) {
		console.log(tokens);
		if ( tokens["[file]"] && tokens["[type]"] ) {
			self.player.id = ( ["artists", "albums", "songs"].indexOf(tokens["[type]"]) != -1 ) ? 0 : 1;
			self.json("Player.Open", { "item":{"file": tokens["[file]"]} }, "");
			self.json("Playlist.Add", { "playlistid": self.player.id, "item":{ "file": tokens["[file]"]}}, "");
			//self.getVideoPlayerStatus();		// Set feedback status on Play/Pause button
			consolelog("PlayToken(): Starting playback of " + tokens["[file]"]);
		} else consolelog("PlayToken(): [file] & [type] tokens not found :(");

	};

	self.PlayVideo = function(file) {
		if (file !== undefined) {
			self.json("Player.Open", { "item":{"file": file} }, "");
			self.json("Playlist.Add", { "playlistid":1, "item":{ "file": file}}, "");
			self.player.id = 1; // video
			//self.getVideoPlayerStatus();		// Set feedback status on Play/Pause button
		}
	};

	self.PlayAudio = function(file) {
			if (file !== undefined) {
				self.json("Player.Open", { "item":{"file": file} }, "");
				self.json("Playlist.Add", { "playlistid":0, "item":{ "file": file}}, "");
				self.player.id = 0; // audio
				//self.getVideoPlayerStatus();		// Set feedback status on Play/Pause button
			}
	};


	self.GetURL = function(type) {
		var host;
		host = type.toLowerCase() + "://" +
			((self.config.username === null) ? "" : self.config.username.value) +
			((self.config.password === null) ? "" : ":" + self.config.password.value) +
			((self.config.username === null) ? "" : "@") + self.config.ip.value + ":" +
			((type.toUpperCase() == "HTTP") ? "8080" : self.config.port.value) +
			"/";
		return host;
	};


	// --- Initialisation --- //
	//return ( (setup = self.setup()) === true ) ? self : false; // return false if setup not completed... needs testing
	return self;

};
