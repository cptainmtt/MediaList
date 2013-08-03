var joins = {
	pages:	{
		home:			2,	// D(main page)
		tv:			3,	// D(main page)
		xbmc:			4,	// D(main page)
		yatse:			5, 	// D(main page)
		ystse_settings:		6,	// D(main page)
	},
	controls:		101,	// D(subpage)
	activities:		102,	// D(subpage)
	diagnostics:		103,	// D(subpage)
	volume:		{
		level:			200,	// A + S(text)
		knob:			201,	// S(image)
		indicator_start:	201,	// D(buttons): volume indicator joins 201 -> 231
		touch:			202,	// S(image)
	},
	playing:		240,	// D(button)
	mute:			241,	// D(button)
	repeat:			242,	// D(button)
	shuffle:		243,	// D(button)
	subtitles:		244,	// D(button)
	init:		{
				join:		245,	// S(text)
				queue:		[],
	},
};

function onPreloadingComplete() {
	CF.unwatch(CF.PreloadingCompleteEvent);
	CF.log("PRELOADING COMPLETE");
}

CF.userMain = function() {
		CF.watch(CF.PreloadingCompleteEvent, onPreloadingComplete);

		var obj = {};
		obj.id = 100;
		obj.returnid = 200;
		//var a = {};
		CF.logObject((a={}, a[obj.id] = obj.returnid, a));


		myXBMC = new XBMC_GUI(); // create using default settings
		try {
			myXBMC.setup();
		} catch (e) { console.log("myXBMC global error caught in CF.userMain() - " + e) }


		console.log("TESTING...");
		var notdefined;
		delete notdefined;
//		console.log("Object.keys(notdefined)[0] = " + Object.keys(notdefined)[0]); //  dows throw exception!


};