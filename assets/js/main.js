//globals
var isMobile = false;
var precipLayerList;
var esriJSON;
var json_SS_flows;
var SSBasinChars;
var polyArray;
var state;
var NSS_ServiceInput;
var futureFlows = [];
var resultsArray = [];
var basinCharInputs = [];
var basinDelineationInputs = [];
var completedFlowRequests;
var overlayOperationErrors;
var crs;
var climateModelList = ['BNU_ESM','CNRM_CM5','CESM1_BGC','IPSL_CM5A','NorESM1_M'];
var modelNameList = [];
var SS_server_URL = 'https://test.streamstats.usgs.gov/';
var floodfreq_climate_URL = 'https://gis.wim.usgs.gov/';
var NSS_services_URL = 'https://test.streamstats.usgs.gov/';
var serverName;

/* Basemap Layers */
var esriStreets = L.esri.basemapLayer("Streets");
var esriStreetsModal = L.esri.basemapLayer("Streets");
var esriTopographic = L.esri.basemapLayer("Topographic");
var esriNationalGeographic = L.esri.basemapLayer("NationalGeographic");
var esriImagery = L.esri.basemapLayer("Imagery");

var USGStopoBaseMap = L.layerGroup([L.esri.tiledMapLayer("https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer", {
	maxZoom:15,
	minZoom:0
  }), L.esri.dynamicMapLayer("https://services.nationalmap.gov/arcgis/rest/services/USGSTopoLarge/MapServer", {
	maxZoom:19,
	minZoom:16
  })
]);

var USGSimageryTopoBaseMap = L.layerGroup([L.esri.tiledMapLayer("https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer", {
	maxZoom:15,
	minZoom:0
  }), L.esri.dynamicMapLayer("https://services.nationalmap.gov/arcgis/rest/services/USGSImageryTopoLarge/MapServer", {
	maxZoom:19,
	minZoom:16
  })
]);

//mapData layer
var mapDataLayer = L.esri.dynamicMapLayer(floodfreq_climate_URL + 'arcgis/rest/services/StreamStatsFuture/floodfreq_climate/MapServer');

//mobile test
if( screen.width <= 480 ) { isMobile = true;}

// Get url parameters
var params = {};
window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
  params[key] = decodeURIComponent(value);
});

var map = L.map("map", {
  minZoom: 7,
  zoom: params.zoom || 7,
  center: [params.lat || 42.7, params.lng || -76.2],
  layers: [esriStreets, mapDataLayer]
});

var modalMap = L.map("modalMap", {
  minZoom: 7,
  zoom: params.zoom || 7,
  center: [params.lat || 42.7, params.lng || -76.2],
  layers: [esriStreetsModal]
});

//bootstrap modals dont like leaflet, some trickery to get map to display
 $('.nav-tabs a[href="#maptab"]').on('click', function() {
	console.log('in modal tab click');
	setTimeout(function() {
		modalMap.invalidateSize();
		modalMap.fitBounds([[polyArray.bbox[1],polyArray.bbox[0]],[polyArray.bbox[3],polyArray.bbox[2]]]);
	  }, 100);

 });
 
var baseLayers = {
  "ESRI Streets": esriStreets,
  "ESRI Topographic": esriTopographic,
  "ESRI NationalGeographic": esriNationalGeographic,
  "ESRI Imagery": esriImagery,
  "USGS Topo Base Map": USGStopoBaseMap,
  "USGS Imagery Topo Base Map":USGSimageryTopoBaseMap
};

var overlays = {
};

var layerControl = L.control.layers(baseLayers, overlays).addTo(map);

//add blank layers to map
var basinLayer = L.featureGroup().addTo(modalMap);

//show initial map zoom level
$( ".mapZoom" ).html( "<b>Zoom Level: </b>" + map.getZoom());

//refresh sites on extent change
map.on('zoomend dragend', function(evt) {
	$( ".mapZoom" ).html( "<b>Zoom Level: </b>" + map.getZoom());
	if (isMobile) {
		$( ".latlng" ).html(map.getCenter().lng.toFixed(3) + ", " + map.getCenter().lat.toFixed(3));
	}
});

//show mouse coordinates
map.on('mousemove', function(evt) {
	$( ".latlng" ).html(evt.latlng.lng.toFixed(3) + ", " + evt.latlng.lat.toFixed(3));
});

//point delineation listener
map.on('zoomend', function () {
	if (map.getZoom() < 15) {
		$.growl('You are at zoom level ' + map.getZoom() + ' you must be at zoom level 15 or greater to delineate', {
			type: 'warning',
			placement: {
				from: "bottom",
				align: "right"
			},
		});
	}
	else {
		$.growl("Click the 'Delineate' button to start", {
			type: 'success',
			placement: {
				from: "bottom",
				align: "right"
			},
		});
	}
});

$('.resetButton').on('click', function() {
	esriJSON = '';
	SSBasinChars = '';
	futureBasinChars = '';
	state = '';
	basinCharInputs = [];
	basinDelineationInputs = [];
	futureFlows = [];
	completedFlowRequests = 0;
	overlayOperationErrors = 0;
	resultsArray = [];

	$('#delineateModal').modal('hide');

	$('#editCharacteristics').hide();
	//$('#estimateFlows').hide();
	$('#exportToCSV').hide();
	$('#recalcChars').hide();
	$('#reDelineate').hide();
	$('#updatePrecip').hide();
	$('#exportButton').hide();
	$('#showFlowsButton').hide();

	$('#flowTable').html('<p>You must select a climate scenario and click "Estimate Flows"</p>');
	$('#SSBasinCharResults').html('');
	$('#futurePrecipResults').html('');
	$('#precipStatus').html('');
	$('#summaryInfo').html('');

	$('#pointProgress').html('<div class="loading-indicator"><div id="pointProgressBarMain" class="progress"><div id="pointProgressBarColor" class="progress-bar" style="width: 100%;"><span id="pointProgressText">Not started</span></div></div></div><div>Time elapsed: <span id="regionTime"></span></div>');
	$('#delineationProgress').html('<div class="loading-indicator"><div id="delineationProgressBarMain" class="progress"><div id="delineationProgressBarColor" class="progress-bar" style="width: 100%;"><span id="delineationProgressText">Not started</span></div></div></div><div>Time elapsed: <span id="delineationTime"></span></div>');
	$('#basinCharProgress').html('<div class="loading-indicator"><div id="basinCharProgressBarMain" class="progress"><div id="basinCharProgressBarColor" class="progress-bar" style="width: 100%;"><span id="basinCharProgressText">Not started</span></div></div></div><div>Time elapsed: <span id="basinCharTime"></span></div>');
	$('#streamStatsFlowsProgress').html('<div class="loading-indicator"><div id="streamStatsFlowsProgressBarMain" class="progress"><div id="streamStatsFlowsProgressBarColor" class="progress-bar" style="width: 100%;"><span id="streamStatsFlowsProgressText">Not started</span></div></div></div><div>Time elapsed: <span id="streamStatsFlowsTime"></span></div>');

	//change cursor to default
	$('#map').css('cursor', 'default');
	$('#delineateButton').removeClass('active');

	$('.nav-tabs a[href="#progress"]').tab('show');

	basinLayer.clearLayers();

	map.setView([42.7,-76.2],7);
});

$('#showFlowsButton').on('click', function() {
	$('.nav-tabs a[href="#flows"]').tab('show');
});

$('#reDelineate').on('click', function() {
	$('#delineationProgress').html('<div class="loading-indicator"><div id="delineationProgressBarMain" class="progress"><div id="delineationProgressBarColor" class="progress-bar" style="width: 100%;"><span id="delineationProgressText">Not started</span></div></div></div><div>Time elapsed: <span id="delineationTime"></span></div>')

	$('#reDelineate').hide();

	getBasinDelineation(basinDelineationInputs)
});

$('#recalcChars').on('click', function() {
	$('#basinCharProgress').html('<div class="loading-indicator"><div id="basinCharProgressBarMain" class="progress"><div id="basinCharProgressBarColor" class="progress-bar" style="width: 100%;"><span id="basinCharProgressText">Not started</span></div></div></div><div>Time elapsed: <span id="basinCharTime"></span></div>')

	$('#recalcChars').hide();

	getBasinCharacterisitics(basinCharInputs);
});


$('#delineateButton').on('click', function() {

	//check zoom level
	if (map.getZoom() < 15){
		$.growl('You are at zoom level ' + map.getZoom() + ' you must be at zoom level 15 or greater to delineate', {
			type: 'warning',
			placement: {
				from: "bottom",
				align: "right"
			},
		});
	}

	//if zoom level is ok
	else {
		//make delineate button active
		$(this).toggleClass('active');

		//check that its active before going forward
		if ($( "#delineateButton" ).hasClass( "active" )) {

			$.growl("Click on a blue stream cell to delineate", {
				type: 'success',
				placement: {
					from: "bottom",
					align: "right"
				},
			});

			//change cursor to crosshair
			$('#map').css('cursor', 'crosshair');

			//turn on click listener
			map.on('click', function requestCallback(e) {

				var lat = e.latlng.lat.toFixed(5);
				var lng = e.latlng.lng.toFixed(5);
				
				//First query is for region ID
				mapDataLayer.identify()
				.on(map)
				.at(e.latlng)
				.layers('all:1')
				.returnGeometry(false)
				.tolerance(2)
				.run(function(error, results){

					console.log('NY region query results: ', results);

					//set region ID variable
					if (results.features[0]) {
						
						regionID = results.features[0].properties.FF_Region;
						console.log('Got region: ',regionID);
						
						if (regionID == 0) { 
						
							state = "VT";

							mapDataLayer.identify()
							.on(map)
							.at(e.latlng)
							.layers('all:4')
							.returnGeometry(false)
							.tolerance(2)
							.run(function(error, featureCollection, response){
								
								console.log('Vermont point query response: ', response)

								$.each(response.results, function (index, value) {
									
									if (value.attributes["Pixel Value"] == 1) {
																			
										//show modal
										$('#delineateModal').modal('show');

										//get current time
										var ajaxStartTime = Date.now();

										//start region progress bar
										$('#pointProgressBarMain').addClass('progress-striped active');
										$('#pointProgressBarColor').addClass('progress-bar-info');
										$('#pointProgressText').text('In progress');
									
										state = 'VT';

										//set region ID variable for vermont
										regionID = "0";

										console.log('Got region: ',regionID);

										//update progress bar
										$('#pointProgressBarMain').removeClass('progress-striped active');
										$('#pointProgressBarColor').removeClass('progress-bar-info');
										$('#pointProgressBarColor').addClass('progress-bar-success');
										$('#pointProgressText').text('Complete');

										//get region time
										$('#regionTime').text((Date.now()-ajaxStartTime)/1000 + ' seconds');
										
										//get basin delineation
										basinDelineationInputs = [lng,lat,regionID, state];
										getBasinDelineation(basinDelineationInputs)
									}
									
									else {
										console.log('Point is not on a stream cell');
										$.growl("You didn't click on a stream cell, please try again", {
											type: 'warning',
											placement: {
												from: "bottom",
												align: "right"
											},
										});
									}
								});
							});
						}
						
						else {
							
							state = "NY";
							
							//check for a stream cell
							mapDataLayer.identify()
							.on(map)
							.at(e.latlng)
							.layers('all:3')
							.returnGeometry(false)
							.tolerance(3)
							.run(function(error, featureCollection, response){
								
								console.log('New York point query response: ', response)

								$.each(response.results, function (index, value) {

									//otherwise query for stream cell check
									if (value.attributes["Pixel Value"] == 1) {
										
										//show modal
										$('#delineateModal').modal('show');

										//get current time
										var ajaxStartTime = Date.now();

										//start region progress bar
										$('#pointProgressBarMain').addClass('progress-striped active');
										$('#pointProgressBarColor').addClass('progress-bar-info');
										$('#pointProgressText').text('In progress');

										console.log('Point is on stream cell in: ', state);

										//add a marker to the map at clicked point
										var delineatedPoint = L.marker([e.latlng.lat,e.latlng.lng]);
										basinLayer.addLayer(delineatedPoint);

										//turn off click listener
										map.off('click', requestCallback);

										//update progress bar
										$('#pointProgressBarMain').removeClass('progress-striped active');
										$('#pointProgressBarColor').removeClass('progress-bar-info');
										$('#pointProgressBarColor').addClass('progress-bar-success');
										$('#pointProgressText').text('Complete');

										//get region time
										$('#regionTime').text((Date.now()-ajaxStartTime)/1000 + ' seconds');
										
										//get basin delineation
										basinDelineationInputs = [lng,lat,regionID, state];
										getBasinDelineation(basinDelineationInputs)

									}
									
									else {
										console.log('Point is not on a stream cell');
										$.growl("You didn't click on a stream cell, please try again", {
											type: 'warning',
											placement: {
												from: "bottom",
												align: "right"
											},
										});
									}
								});
							});
						}
					}
				}); //end region query
			});
		}
	}
});

function getBasinDelineation(basinDelineationInputs) {

	var lng = basinDelineationInputs[0];
	var lat = basinDelineationInputs[1];
	var regionID = basinDelineationInputs[2];
	state = basinDelineationInputs[3];

	//start delineation progress bar
	$('#delineationProgressBarMain').addClass('progress-striped active');
	$('#delineationProgressBarColor').addClass('progress-bar-info');
	$('#delineationProgressText').text('In progress');

	//clear existing table
	$('#SSBasinCharResults').html('');

	//build request URL
	var requestURL = SS_server_URL + "streamstatsservices/watershed.geojson?rcode=" + state + "&xlocation=" + lng + "&ylocation=" + lat + "&crs=4326&includeparameters=false&includefeatures=globalwatershed";

	//get current time
	var ajaxStartTime = Date.now()

	//do first call just for basin boundary
	$.ajax({
		type: "GET",
		url: requestURL,
		dataType: "json",
		success: function(json, status, xhr){
			
			//make sure there is some data
			if (json.featurecollection[0]) {
				
				console.log("Success delineating basin");
				
				serverName = xhr.getResponseHeader("usgswim-hostname");
				
				//find global watershed
				$(json.featurecollection).each(function (index,basin) {
					
					console.log("Delineation: ", basin);
					
					crs = basin.feature.crs;
					
					if (basin.feature.features.length > 1) {
						console.log("This is a global delineation");
					}
						
					$(basin.feature.features).each(function (index,feature) {
						
						console.log("Geometry found: ", feature);
							
						//get main json feature if global or not
						if (feature.properties.GlobalWshd == 1 || feature.properties.GLOBALWSHD == 1) {
							
							//check for multiple rings and splice off single cell blocks
							for (var index = feature.geometry.coordinates.length - 1; index >= 0; index--) {
								if (feature.geometry.coordinates[index].length <= 4) {
									console.log('ring length: ',feature.geometry.coordinates[index].length);
									feature.geometry.coordinates.splice(index,1)
								}
							};
		
							//create basin polygon from cleaned up globalWatershed feature only
							polyArray = feature;

							//console.log('GeoJSON after cleanup: ', polyArray);
						}
					});
				});

				//create leaflet geojson feature
				var delineatedBasin = L.geoJson(polyArray);
				basinLayer.addLayer(delineatedBasin);

				//look up streamstats parameter list for region (0 is vermont)
				var paramURLstring = regionBasedStats['region' + regionID];

				//update progress bar
				$('#delineationProgressBarMain').removeClass('progress-striped active');
				$('#delineationProgressBarColor').removeClass('progress-bar-info');
				$('#delineationProgressBarColor').addClass('progress-bar-success');
				$('#delineationProgressText').text('Complete');

				//delieation time
				$('#delineationTime').text((Date.now()-ajaxStartTime)/1000 + ' seconds');

				//get basin characteristics
				basinCharInputs = [json.workspaceID,paramURLstring, lng, lat, regionID, state, polyArray];
				getBasinCharacterisitics(basinCharInputs);
			}

			else {
				console.log("error delineating basin: Zero length delineation response");

				$('#reDelineate').show();

				$('#delineationProgress').html('<div class="alert alert-danger" role="alert"><strong>Delineate Basin Failed: </strong>No basin was returned</div>');
			}

		},
		error: function (request, status, error) {
			console.log("Error delineating basin", request, status, error);

			$('#reDelineate').show();

			$('#delineationProgress').html('<div class="alert alert-danger" role="alert"><strong>Delineate Basin Failed: </strong>' + error + '</div>');
		}
	});
}

function getBasinCharacterisitics(basinCharInputs) {

	var workspaceID = basinCharInputs[0];
	var paramURLstring = basinCharInputs[1];
	var lng = basinCharInputs[2];
	var lat = basinCharInputs[3];
	var regionID = basinCharInputs[4];
	var state = basinCharInputs[5];
	var delineatedBasin = basinCharInputs[6];

	//start basin characteristics progress bar
	$('#basinCharProgressBarMain').addClass('progress-striped active');
	$('#basinCharProgressBarColor').addClass('progress-bar-info');
	$('#basinCharProgressText').text('In progress');
	
	
	//do hostname stuff
	var requestURL = SS_server_URL + "streamstatsservices/parameters.json?rcode=" + state + "&workspaceID=" + workspaceID + "&includeparameters=" + paramURLstring;

	//get current time
	var ajaxStartTime = Date.now();

	//move basin json to global variable
	esriJSON = '{"rings":' + JSON.stringify(delineatedBasin.geometry.coordinates) + ',"spatialReference":{"wkid":' + crs.properties.code + '}}'

	//do ajax call from streamstats for main basin characteristics
	$.ajax({
		type: "GET",
		url: requestURL,
		dataType: "json",
		success: function(json){
			
			//move results to global json object
			SSBasinChars = json.parameters;

			//do check to make sure all chars are computed
			var badValues = false;
			$(SSBasinChars).each(function () {
				//if (typeof this.value === 'undefined' || this.value === -100000) {
				if (typeof this.value === 'undefined') {
					badValues = true;
				}
			});

			//make sure some basin characteristics are returned
			if (SSBasinChars.length >= 1 && !badValues) {
				pushCharacteristicList(lat,lng,regionID,SSBasinChars, workspaceID, ajaxStartTime);
			}

			else {
				console.log("Error getting one or more streamstats parameters: zero length or invalid response");

				$('#recalcChars').show();

				$('#basinCharProgress').html('<div class="alert alert-danger" role="alert"><strong>Calculate Regional Basic Chacteristics Failed: </strong>One or more parameters were not calculated</div>');

				return;
			}

		},
		error: function (request, status, error) {
			console.log("Error getting streamstats parameters", request, status, error);

			$('#recalcChars').show();

			$('#basinCharProgress').html('<div class="alert alert-danger" role="alert"><strong>Calculate Regional Basic Chacteristics Failed: </strong>' + error + '</div>');
		}
	});
}

function pushCharacteristicList(lat,lng,regionID,SSBasinChars, workspaceID, ajaxStartTime) {
	//console.log('inside promise after each -- SSbasinchars length: ',SSBasinChars.length) ;

	//add lat long, and region to basin chars object
	SSBasinChars.push({description: 'Latitude of pourpoint, in decimal degrees',name: 'LAT',value:Number(lat) });
	SSBasinChars.push({description: 'Longitude of pourpoint, in decimal degrees',name: 'LNG',value:Number(lng) });
	SSBasinChars.push({description: 'Flood frequency region for pourpoint',name: 'REGIONID',value:Number(regionID) });

	//append to results table
	$(SSBasinChars).each(function () {
		var unit = this.unit ? this.unit : '';
		$('#SSBasinCharResults').append("<tr><td class='col-md-10'>" + this.description.replace('.','') + "</td><td>" + this.value + "</td><td>" + unit + "</td></tr>");
	});

	//create export button
	var exportURL = SS_server_URL + "streamstatsservices/download?workspaceID=" + workspaceID;
	$('#exportButton').attr('href', exportURL);

	//update progress bar
	$('#basinCharProgressBarMain').removeClass('progress-striped active');
	$('#basinCharProgressBarColor').removeClass('progress-bar-info');
	$('#basinCharProgressBarColor').addClass('progress-bar-success');
	$('#basinCharProgressText').text('Complete');

	//basin char time
	$('#basinCharTime').text((Date.now()-ajaxStartTime)/1000 + ' seconds');

	//fire off standard SS flow calculation
	estimateSSFlows()
}

$('#tabList a').click(function (e) {
  e.preventDefault();
  $(this).tab('show');
})

$('#editCharacteristics').click(function (e) {
  $('.nav-tabs a[href="#output"]').tab('show');
})

$('#exportToCSV').click(function (e) {
	//console.log('resultsArray',resultsArray);

	exportToCsv('data.csv', resultsArray)
});

function estimateSSFlows() {

	//get current time
	var ajaxStartTime = Date.now()

	//start basin characteristics progress bar
	$('#streamStatsFlowsProgressBarMain').addClass('progress-striped active');
	$('#streamStatsFlowsProgressBarColor').addClass('progress-bar-info');
	$('#streamStatsFlowsProgressText').text('In progress');
	
	
	//get NSS scenario object template to make flow estimate call
	$.getJSON(NSS_services_URL + "nssservices/scenarios.json?statisticgroups=2&unitsystems=2&region=" + state, function (data) {
		
		//create a copy of object
		NSS_ServiceInput = JSON.parse(JSON.stringify(data));
		
		console.log("Original template response", data);
		
		//swap out computed paramter values
		for (var index = NSS_ServiceInput[0].RegressionRegions.length - 1; index >= 0; index--) {
			
			if (state == "NY") {
				var equationName = "2006_Full_Region_" + basinCharInputs[4]
				
				if (NSS_ServiceInput[0].RegressionRegions[index].Name == equationName) {
			
					//swap out computed paramter values
					$.each(NSS_ServiceInput[0].RegressionRegions[index].Parameters, function(index1,value1) {
						$.each(SSBasinChars, function(index2,value2) {
							if (value1.Code == value2.code) {
								//set value to computed value
								value1.Value = value2.value
							}
						});
					});
				}
				
				//delete any unwanted regressionregions
				else {
					NSS_ServiceInput[0].RegressionRegions.splice(index,1);
				}
			}
			
			if (state == "VT") {
				var equationName = "Statewide_Peak_Flow"
				
				if (NSS_ServiceInput[0].RegressionRegions[index].Name == equationName) {
			
					//swap out computed paramter values
					$.each(NSS_ServiceInput[0].RegressionRegions[index].Parameters, function(index1,value1) {
						$.each(SSBasinChars, function(index2,value2) {
							if (value1.Code == value2.code) {
								//set value to computed value
								value1.Value = value2.value
							}
						});
					});
				}
				
				//delete any unwanted regressionregions
				else {
					NSS_ServiceInput[0].RegressionRegions.splice(index,1);
				}
			}
		}
		
		console.log('Modified template response: ', NSS_ServiceInput);
	
		//SS based regression service call
		$.ajax({
			type: "POST",
			url: NSS_services_URL + "nssservices/scenarios/estimate.json?region=" + state + "&statisticgroups=2&unitsystems=2",
			contentType: "application/json",
			data: JSON.stringify(NSS_ServiceInput),
			dataType: "json",
			success: function(json_SS){
				json_SS_flows = json_SS;

				$.each(json_SS_flows[0].RegressionRegions[0].Results, function(index,value) {
					var interval = value.code.replace("PK","")
					var flow = value.Value;
					
					futureFlows.push([interval, [['StreamStats', flow]]]);
				});

				console.log("success getting SS flows", futureFlows);

				//update progress bar
				$('#streamStatsFlowsProgressBarMain').removeClass('progress-striped active');
				$('#streamStatsFlowsProgressBarColor').removeClass('progress-bar-info');
				$('#streamStatsFlowsProgressBarColor').addClass('progress-bar-success');
				$('#streamStatsFlowsProgressText').text('Complete');

				//delieation time
				$('#streamStatsFlowsTime').text((Date.now()-ajaxStartTime)/1000 + ' seconds');

				//show complete button
				$('#editCharacteristics').show();
				//$('#estimateFlows').show();
				$('#exportToCSV').show();
				$('#updatePrecip').show();
				$('#exportButton').show();


			},
			error: function (request, status, error) {
				console.log("Error calculating SS based flows", request, status, error);
				$('#flowTable').html('<h4>There was an error calculating SS based flows</h4>')

				//hide spinner
				//$('#estimateFlows').removeClass('active');

				//show the tab when complete
				//$('.nav-tabs a[href="#flows"]').tab('show');
			}
		});

	});
}

function estimateFutureFlows(modelCode, futurePrecip, futureBasinChars) {

	console.log('showing futureflows',modelCode, futurePrecip, futureBasinChars);

	//find precip
	$.each(futureBasinChars, function() {

		//console.log('in future basin chars precip runoff loop',this);

		//calculate precip for every basin
		if (this.code == "PRECIP" || this.code == "PRECPRIS10") {
			//grab current precip value before overwriting
			var currentPrecip = Number(this.value);

			//update values for precip
			this.value = futurePrecip;
			this.description = modelCode;

			$('#futurePrecipResults').append("<tr><td class='col-md-10'>Mean Annual Precipitation [" + this.description.replace('.','') + "]</td><td>" + this.value.toFixed(0) + "</td><td>inches</td></tr>");

			//if it has runoff make the computation
			if (hasRunoff(futureBasinChars)) {

				console.log('basin has runoff');

				//loop over new future basin chars
				$.each(futureBasinChars, function() {

					//look for runoff
					if (this.code == "MAR") {

						var currentRunoff = this.value;
						var computedET = currentPrecip - currentRunoff;
						//var computedRunoff = futurePrecip - computedET;
						var ETratio = computedET / currentPrecip;
						var computedETratioRunoff = Number(futurePrecip - (ETratio * futurePrecip));

						//update values for MAR in futurebasinchars object
						this.value = computedETratioRunoff;
						this.description = modelCode;

						$('#futurePrecipResults').append("<tr><td class='col-md-10'>Mean Annual Runoff [" + this.description.replace('.','') + "]</td><td>" + this.value.toFixed(0) + "</td><td>inches</td></tr>");

					}
				});
			}
		}
	});

	//swap out computed paramter values with future values
	$.each(NSS_ServiceInput[0].RegressionRegions[0].Parameters, function(index1,value1) {
		$.each(futureBasinChars, function(index2,value2) {
			if (value1.Code == value2.code) {
				//set value to computed value
				value1.Value = value2.value
			}
		});
	});

	//Future based regression service call
	$.ajax({
		type: "POST",
		url: NSS_services_URL + "nssservices/scenarios/estimate.json?region=" + state + "&statisticgroups=2&unitsystems=2",
		contentType: "application/json",
		data: JSON.stringify(NSS_ServiceInput),
		dataType: "json",
		success: function(json_future){
			console.log("success getting future flows for: ",modelCode);
		
			$.each(json_future[0].RegressionRegions[0].Results, function(index,value) {
				var interval = value.code.replace("PK","")
				var flow = value.Value;
				//console.log('test',interval, flow);

				$.each(futureFlows, function(i,v) {
					//console.log('here',v[0],v);
					if (v[0] == interval) {
						v[1].push([modelCode, flow]);
					}
				});
			});

			completedFlowRequests++;

			//only continue if 5 flow requests completed
			if (completedFlowRequests == 5) {
				updateFlowTable();
			}

		},
		error: function (request, status, error) {
			console.log("error calculating future based flows", request, status, error);
			$('#flowTable').html('<h4>There was an error calculating future based flows</h4>')
		},
		complete: function() {

		}
	});
}

function exportToCsv(filename, rows) {
        var processRow = function (row) {
			var finalVal = '';
            for (var j = 0; j < row.length; j++) {
                var innerValue = row[j] === null ? '' : row[j].toString();
                if (row[j] instanceof Date) {
                    innerValue = row[j].toLocaleString();
                };
                var result = innerValue.replace(/"/g, '""');
                if (result.search(/("|,|\n)/g) >= 0)
                    result = '"' + result + '"';
                if (j > 0)
                    finalVal += ',';
                finalVal += result;
            }
            return finalVal + '\n';
        };

		var csvFile = 'Latitude,' + basinCharInputs[3] + '\nLongitude,' + basinCharInputs[2] + '\nFlood Frequency Region,' + basinCharInputs[4]+ '\nGreenhouse gas scenario,' + modelNameList[0] + '\nTime Period,20' + modelNameList[1].split('_')[0] + ' - 20' + modelNameList[1].split('_')[1] + '\nClimate Models,"BNU_ESM, CNRM_CM5, CESM1_BGC, IPSL_CM5A, NorESM1_M"\n\nRecurrence Interval (yrs),StreamStats Discharge (cfs),Predicted Future Discharge (cfs) [Mean],Predicted Future Discharge (cfs) [Median],Predicted Future Discharge (cfs) [Max],Predicted Future Discharge (cfs) [Min],Predicted Future Discharge (% change) [Mean],Predicted Future Discharge (% change) [Median],Predicted Future Discharge (% change) [Max],Predicted Future Discharge (% change) [Min]\n'

        //var csvFile = 'Latitude,' + pourPoint.lat.toFixed(4) + '\nLongitude,' + pourPoint.lng.toFixed(4) +'\n\nRecurrence Interval,StreamStats Discharge (cfs),Predicted Future Discharge (cfs),Percent Change\n';
        for (var i = 0; i < rows.length; i++) {
            csvFile += processRow(rows[i]);
        }

        var blob = new Blob([csvFile], { type: 'text/csv;charset=utf-8;' });
        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, filename);
        } else {
            var link = document.createElement("a");
			var url = URL.createObjectURL(blob);
            if (link.download !== undefined) { // feature detection
                // Browsers that support HTML5 download attribute
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
			else {
				window.open(url);
			}
        }
    }

function parseParameterObject(object) {

	//get regionID
	$.each(object, function() {
		if (this.name == "REGION") {
			var regionID = this.value;
		}
	});

	//if vermont, dont include region in json
	if (regionID == '0') {
		var regressionParameters = {
			Parameters:object
		}
	}
	else {
		var regressionParameters = {
			Region:regionID,
			Parameters:object
		}
	}

	return regressionParameters;
}

//loop over all available future precip layers
$.getJSON(floodfreq_climate_URL + 'arcgis/rest/services/StreamStatsFuture/floodfreq_climate/MapServer/exts/SpatialOverlayRESTSOE?f=pjson', function (data) {
	console.log('Got climate grid list');
	precipLayerList = data.layers;
});

$('#updatePrecip').on('click', function(event) {

	//clear future precip
	futureBasinChars = '';
	$('#futurePrecipResults').html('');

	//clear future flows but keep ss flows
	//console.log('about to clear futureflows', futureFlows);
	$.each(futureFlows, function(i,v) {
		v[1].splice(1, 5);
	});
	//console.log('after clear', futureFlows);

	//start spinner
	$(this).addClass('active');

	//set up arrays
	var dropdownList = ['gasscenario','timewindow'];
	modelNameList = [];

	//get values from dropdowns
	$.each(dropdownList, function(i,v) {
		modelNameList.push( $('#' + this).attr("value"));
	});

	//reset counters
	completedFlowRequests = 0;
	overlayOperationErrors = 0;

	//create array of model names
	$.each(climateModelList, function(i,v) {

		var modelCode = modelNameList[0] + '_' + v + '_' + modelNameList[1];

		//get short code for modelID using lookup object modelData
		var modelID;

		$.each(modelData, function() {
			if (this.Mod_Name == modelCode) {
				//console.log(this, modelCode);
				modelID = this.Model_ID
			};
		});

		//outer loop gets arcgis server layerID
		$.each(precipLayerList, function() {

			//if we are on the currently selected climate model
			if (this.name.replace('Merge','') == String(modelID)) {
				
				console.log("Found a matching precip layer: ", modelCode, "layerID: ", modelID);

				//reset meanET
				var meanET = -999;

				//build REST url for each of the grid layers
				var requestURL = floodfreq_climate_URL + 'arcgis/rest/services/StreamStatsFuture/floodfreq_climate/MapServer/exts/SpatialOverlayRESTSOE/layers/' + this.id + '/SpatialOverlay';

				$('#precipStatus').html('<div id="precipStatus" class="alert alert-info" role="alert">Calculating precip for: <strong>' + modelCode + '...</strong></div>')

				//do ajax call for future precip layer
				$.ajax({
					type: "POST",
					url: requestURL,
					data: 'FieldName(Feature Layer)=""&Polygon=' + esriJSON + '&f=pjson',
					dataType: "json",
					//make calls synchronous
					async: false,
					success: function(json){
					
						//check for a generic error
						if (!json.error) {

							//console.log("success getting future precip", json);

							//get future precip value
							var futurePrecip = Number(json.results.Mean);

							//make a copy of original basin characteristics
							var futureBasinChars = JSON.parse( JSON.stringify( SSBasinChars ) );

							//estimate flows
							estimateFutureFlows(modelCode, futurePrecip, futureBasinChars);
							
							if (json.results.Message.indexOf("centroid") > -1) {
								console.log("Centroid operation was used");
								overlayOperationErrors++;
							}
							
							else {
								console.log("Raster overlay operation was used");
							}
						}

						else {
							$('#precipStatus').html('<div id="precipStatus" class="alert alert-warning" role="alert">There was an error calculting precip for: <strong>' + modelCode + '...</strong></div>')

							completedFlowRequests++;
							overlayOperationErrors++;
						}
						
						console.log('Completed Overlays: ', completedFlowRequests, ' Errors: ',  overlayOperationErrors);

					//future precip error callback
					},
					error: function (request, status, error) {
						console.log("error getting future precip", request, status, error);
						$('#delineationHeader').html('<h4>There was an error</h4>')
					},
					complete: function () {
						console.log('spatial overlay complete');


					}
				});


			}
		});
	});
});

function updateFlowTable() {

	$('#flowTable').html('');
	resultsArray = [];

	//hide spinner
	$('#updatePrecip').removeClass('active');
	$('#precipStatus').html('')
	
	//clear results and show warning
	if (overlayOperationErrors > 0) {
		$('#precipStatus').html('<div id="precipStatus" class="alert alert-danger" role="alert">WARNING: One or more overlays was calculated using a basin centroid value</div>')
	}

	else {
		$('#precipStatus').html('<div id="precipStatus" class="alert alert-success" role="alert">Overlays calculated successfully</div>')
	}

	//make sure array is sorted by recurrence interval
	futureFlows.sort(function(a, b) {return a[0] - b[0]})
	//console.log('in updateflowtable',futureFlows);

	//build the results array
	$.each(futureFlows, function(interval,value) {
		if (value[1][0][1] != "NaN") {
			$('#flowTable').append("<tr><td>" + value[0]+ "</td><td>" + value[1][0][1].toFixed(0) + "</td><td>" + mean([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]]).toFixed(0) + "</td><td>" + median([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]]).toFixed(0) + "</td><td>" + max([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]]).toFixed(0) + "</td><td>" + min([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]]).toFixed(0) + "</td><td>" + ((mean([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]])- value[1][0][1])/value[1][0][1] * 100).toFixed(0) + "</td><td>" + ((median([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]])- value[1][0][1])/value[1][0][1] * 100).toFixed(0) + "</td><td>" + ((max([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]])- value[1][0][1])/value[1][0][1] * 100).toFixed(0) + "</td><td>" + ((min([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]])- value[1][0][1])/value[1][0][1] * 100).toFixed(0) + "</td></tr>");

			resultsArray.push([value[0],value[1][0][1].toFixed(0),mean([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]]).toFixed(0) ,median([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]]).toFixed(0) ,max([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]]).toFixed(0) ,min([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]]).toFixed(0) ,((mean([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]])- value[1][0][1])/value[1][0][1] * 100).toFixed(0) ,((median([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]])- value[1][0][1])/value[1][0][1] * 100).toFixed(0) ,((max([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]])- value[1][0][1])/value[1][0][1] * 100).toFixed(0),((min([value[1][1][1],value[1][2][1],value[1][3][1],value[1][4][1],value[1][5][1]])- value[1][0][1])/value[1][0][1] * 100).toFixed(0)])
		}
	});


	//write some summary info
	$('#summaryInfo').html('<p><span><strong>Latitude: </strong>' + basinCharInputs[3] + '<span></br><span><strong>Longitude: </strong>' + basinCharInputs[2] + '<span></br><span><strong>Flood Frequency Region: </strong>' + basinCharInputs[4] + '<span></br></p> <p><span><strong>Greenhouse gas scenario: </strong>' + modelNameList[0] + '<span></br><span><strong>Time Period: </strong>20' + modelNameList[1].split('_')[0] + ' - 20' + modelNameList[1].split('_')[1] + '<span></br></p><p><strong>Statistics aggregated using 5 climate models: </strong>BNU_ESM, CNRM_CM5, CESM1_BGC, IPSL_CM5A, NorESM1_M</p>');

	//show flows tab
	$('#showFlowsButton').show();

}

function min(numbers){
    return Math.min.apply( Math, numbers );
}

function max(numbers){
    return Math.max.apply( Math, numbers );
}

function mean(numbers) {
    // mean of [3, 5, 4, 4, 1, 1, 2, 3] is 2.875
    var total = 0,
        i;
    for (i = 0; i < numbers.length; i += 1) {
        total += numbers[i];
    }
    return total / numbers.length;
}
function median(numbers) {
    // median of [3, 5, 4, 4, 1, 1, 2, 3] = 3
    var median = 0,
        numsLen = numbers.length;
    numbers.sort();
    if (numsLen % 2 === 0) { // is even
        // average of two middle numbers
        median = (numbers[numsLen / 2 - 1] + numbers[numsLen / 2]) / 2;
    } else { // is odd
        // middle number only
        median = numbers[(numsLen - 1) / 2];
    }
    return median;
}

function hasRunoff(SSBasinChars) {
	var i = null;
    for (i = 0; SSBasinChars.length > i; i += 1) {
        if (SSBasinChars[i].code === "MAR") {
            return true;
        }
    }
	return false;
}

$( document.body ).on( 'click', '.dropdown-menu li a', function( event ) {

	//update future precip dropdown with current value
	var $target = $( event.currentTarget );
	$target.closest( '.btn-group' )
	 .find( '[data-bind="label"]' ).addClass('active').attr('value',$target.attr('value')).text( $target.text() )
		.end()
	 .children( '.dropdown-toggle' ).dropdown( 'toggle' );
	return false;

});
