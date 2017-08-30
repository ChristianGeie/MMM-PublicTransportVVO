Module.register("MMM-PublicTransportVVO", {

  // default values
  defaults: {
    name: "MMM-PublicTransportVVO",
    hidden: false,
    stationId: 33000037,
    baseurl: "http://widgets.vvo-online.de/abfahrtsmonitor/",
    stationuri: "Haltestelle.do?hst=",
    departureuri: "Abfahrten.do?hst=",
    colored: false,                       // show not reachable departures colored
    animationSpeed: 1 * 1000,             // 1 sec
    updateInterval: 30 * 1000,            // 30 sec
    fade: true,                           // fading out the bottom of the list
    fadePoint: 0.25,                      // start on 1/4th of the list.
    initialLoadDelay: 0,                  // how long should we wait to load data after starting
    retryDelay: 2500,                     // if request fails, do a retry after 2.5 sec
    marqueeLongDirections: true,          // we want a marquee for long direction strings
    delay: 2,                             // how long do you need to walk to the next station?
    showTableHeaders: true,               // show location and station in table header
    showTableHeadersAsSymbols: false,     // table headers as symbols or written?
    maxReachableDepartures: 7,
    TimeOrMinutes: "Time"
  },
	// create some variables to hold the station name and city based on the API result.
	fetchedStationCity: "",
  fetchedStationName: "",

    // Define required scripts.
  getScripts: function () {
		return ["moment.js"];
	},
    
  start: function () {
    Log.info("Starting module: " + this.name);

    this.departuresArray = [];
    this.loaded = false;

    this.scheduleStationUpdate(this.config.initialLoadDelay);
    this.scheduleDepartureUpdate(this.config.initialLoadDelay);

    this.updateTimer = null;

    // check some variables
    if(this.config.delay < 0) {
      this.config.delay = 0;
    }

    if (this.config.updateInterval < 30000) {
      this.config.updateInterval = 30000;
    }
  },

  getDom: function () {

  let wrapper = document.createElement("div");
  wrapper.className = "ptbWrapper";

	if (this.config.stationId === "") {
  	wrapper.innerHTML = this.name + ": " + this.translate("NO-STATIONID");
	 	wrapper.className = "dimmed light small";
	  return wrapper;
	}

  if (this.departuresArray.length === 0 && !this.loaded) {
    wrapper.innerHTML = (this.loaded) ? this.translate("EMPTY") : this.translate("LOADING");
    wrapper.className = "small light dimmed";
    return wrapper;
  }

  let heading = document.createElement("header");
  heading.innerHTML = this.fetchedStationCity + ", "+ this.fetchedStationName
  wrapper.appendChild(heading);

  // table header
  let table = document.createElement("table");
  table.className = "ptbTable small light";

  if (this.config.showTableHeaders) {
    let tHead = document.createElement("thead");

    let headerRow = document.createElement("tr");

    // Header Cell for line symbol
    let headerLine = document.createElement("td");

    if (this.config.showTableHeadersAsSymbols) {
      headerLine.className = "centeredTd";
      let lineIcon = document.createElement("span");
      lineIcon.className = "fa fa-tag";
      headerLine.appendChild(lineIcon);
    } else {
      headerLine.innerHTML = this.translate("LINE");
    }

    headerRow.appendChild(headerLine);

    // Header Cell for direction
    let headerDirection = document.createElement("td");

    if (this.config.showTableHeadersAsSymbols) {
      headerDirection.className = "centeredTd";
      let directionIcon = document.createElement("span");
      directionIcon.className = "fa fa-exchange";
      headerDirection.appendChild(directionIcon);
    } else {
      headerDirection.innerHTML = this.translate("DESTINATION");
    }

    headerRow.appendChild(headerDirection);

    // Header Cell for departure time
    let headerTime = document.createElement("td");

    if (this.config.showTableHeadersAsSymbols) {
      headerTime.className = "centeredTd";
      let timeIcon = document.createElement("span");
      timeIcon.className = "fa fa-clock-o";
      headerTime.appendChild(timeIcon);
    } else {
      headerTime.innerHTML = this.translate("DEPARTURE");
    }

    headerRow.appendChild(headerTime);

    headerRow.className = "bold dimmed";
    tHead.appendChild(headerRow);

    table.appendChild(tHead);
    }

    // create table body
    let tBody = document.createElement("tbody");

    // handle empty departures array
    if (this.departuresArray.length === 0) {
      let row = this.getNoDeparturesRow(this.translate("NO-DEPS"));

      tBody.appendChild(row);
      table.appendChild(tBody);
      wrapper.appendChild(table);
      return wrapper;
    }

    this.departuresArray.forEach((current, i) => {
    if (i < this.config.maxReachableDepartures) {
      let row = this.getRow(current);

      // fading out
      if (this.config.fade && this.config.fadePoint < 1) {
        if (this.config.fadePoint < 0) {
          this.config.fadePoint = 0;
        }
        var startingPoint = this.departuresArray.length * this.config.fadePoint;
        var steps = this.departuresArray.length - startingPoint;
        if (i >= startingPoint) {
          var currentStep = i - startingPoint;
          row.style.opacity = 1 - (1 / steps * currentStep);
        }
      }

      tBody.appendChild(row);
      }
    });

    table.appendChild(tBody);

    wrapper.appendChild(table);

    return wrapper;
  },

  /* getNoDeparturesRow()
	 * Print row with message, if we have no departures.
	 *
	 * argument message - text to display.
	 */
  getNoDeparturesRow: function (message) {
    let row = document.createElement("tr");
    let cell = document.createElement("td");
    cell.colSpan = 4;

    cell.innerHTML = message;

    row.appendChild(cell);

    return row;
  },

  getRow: function (current) {

    let row = document.createElement("tr");

    // cell for line
    let lineCell = document.createElement("td");
    lineCell.className = "centeredTd noPadding lineCell";
    lineCell.innerHTML = current.departurenumber;
    row.appendChild(lineCell);

    // cell for direction
    let directionCell = document.createElement("td");
    directionCell.className = "directionCell bright";

    if (this.config.marqueeLongDirections && current.departuredirection.length >= 26) {
      directionCell.className = "directionCell bright marquee";
      let directionSpan = document.createElement("span");
      directionSpan.innerHTML = current.departuredirection;
      directionCell.appendChild(directionSpan);
    } else {
      directionCell.innerHTML = current.departuredirection;
    }
    row.appendChild(directionCell);

    // cell for time
    var Datum = new Date();
    var ms = Datum.getTime();
    let timeCell = document.createElement("td");
    timeCell.className = "centeredTd timeCell bright";
    if (this.config.delay > 0 && current.departuretime <= this.config.delay && this.config.colored) {
      timeCell.style.color = "red";
    }
    if (current.departuretime === "") {
      timeCell.innerHTML = this.translate("NOW");;
    } else {
        if (this.config.TimeOrMinutes==="Minutes") {
        timeCell.innerHTML = current.departuretime;
        } else {
        ms = ms + (current.departuretime * 60 * 1000);
        Datum.setTime(ms);
        timeCell.innerHTML=moment(Datum).format("HH:mm");
        };
;
    }
    row.appendChild(timeCell);

    return row;
  },

  /* scheduleStationUpdate()
	 * Schedule next station update.
	 *
	 * argument delay number - Milliseconds before next update. If empty, this.config.updateInterval is used.
	 */
	scheduleStationUpdate: function(delay) {
		var nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		var self = this;

    setTimeout(function() {
			self.getStationDetails();
		}, nextLoad);
	},

	/* getStationDetails(compliments)
	 * Requests new data.
	 * Calls processStationDetails on succesfull response.
	 */
  getStationDetails: function () {
    var url = this.config.baseurl + this.config.stationuri + this.config.stationId;
    var self = this;
    var retry = true;

    var StationDetailsRequest = new XMLHttpRequest();
    StationDetailsRequest.open("GET", url, true);
    StationDetailsRequest.onreadystatechange = function() {
    	if (this.readyState === 4) {
		  	if (this.status === 200) {
			  	self.processStationDetails(JSON.parse(this.response));
  			} else if (this.status === 401) {
          self.config.stationId = "";
          self.updateDom(self.config.animationSpeed);
          Log.error(self.name + ": Something was wrong.");
          retry = false;
        } else {
          Log.error(self.name + ": Could not load details.");
			  }

  			if (retry) {
	 				self.scheduleStationUpdate((self.loaded) ? -1 : self.config.retryDelay);
	  		}
		  }
    };
    StationDetailsRequest.send();
  },

	/* processStationDetails(data)
   * Uses the received data to set the various values.
	 *
   * argument data object - information received from the api.
   */
  processStationDetails: function(data) {
    this.fetchedStationCity = data[0][0][0];
    this.fetchedStationName = data[1][0][0];

	  this.updateDom(this.config.animationSpeed);
  },

  /* scheduleDepartureUpdate()
	 * Schedule next departure update.
	 *
	 * argument delay number - Milliseconds before next update. If empty, this.config.updateInterval is used.
	 */
  scheduleDepartureUpdate: function(delay) {
		var nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}

		var self = this;

    setTimeout(function() {
			self.getDepartureDetails();
		}, nextLoad);
	},

  /* getDepartureDetails(compliments)
	 * Requests new data.
	 * Calls processDepartureDetails on succesfull response.
	 */
  getDepartureDetails: function () {
    var url = this.config.baseurl + this.config.departureuri + this.config.stationId;
    var self = this;
    var retry = true;

    var DepartureDetailsRequest = new XMLHttpRequest();
    DepartureDetailsRequest.open("GET", url, true);
    DepartureDetailsRequest.onreadystatechange = function() {
    	if (this.readyState === 4) {
		  	if (this.status === 200) {
			  	self.processDepartureDetails(JSON.parse(this.response));
				} else {
				  Log.error(self.name + ": Could not load details.");
			  }

				if (retry) {
  				self.scheduleDepartureUpdate((self.loaded) ? -1 : self.config.retryDelay);
	  		}
		  }
    };
    DepartureDetailsRequest.send();
  },

  /* processDepartureDetails(data)
   * Uses the received data to set the various values.
	 *
   * argument data object - information received from the api.
   */
  processDepartureDetails: function(data) {
    this.departuresArray = [];

		for (var i = 0, count = data.length; i < count; i++) {
			var departuresArray = data[i];
			this.departuresArray.push({
				departurenumber: departuresArray[0],
				departuredirection: departuresArray[1],
				departuretime: departuresArray[2]
			});
		}
	  this.loaded = true;
	  this.updateDom(this.config.animationSpeed);
  },

  getStyles: function () {
    return ['style.css'];
  },

  getTranslations: function() {
    return {
        en: "translations/en.json",
        de: "translations/de.json"
    };
  },
});
