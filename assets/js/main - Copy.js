//globals
var isMobile = false;
var precipLayerList;
var esriJSON;
var SSBasinChars;
var futureBasinChars;
var polyArray;
var state;
var pourPoint;
var futureFlowsArray;
var basinCharInputs = [];
var basinDelineationInputs = [];

/* Basemap Layers */
var mapquestOSM = L.tileLayer("https://{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png", {
  maxZoom: 19,
  subdomains: ["otile1", "otile2", "otile3", "otile4"],
  attribution: 'Tiles courtesy of <a href="https://www.mapquest.com/" target="_blank">MapQuest</a> <img src="https://developer.mapquest.com/content/osm/mq_logo.png">. Map data (c) <a href="https://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> contributors, CC-BY-SA.'
});
var mapquestOSMmodal = L.tileLayer("https://{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png", {
  maxZoom: 19,
  subdomains: ["otile1", "otile2", "otile3", "otile4"],
  attribution: 'Tiles courtesy of <a href="https://www.mapquest.com/" target="_blank">MapQuest</a> <img src="https://developer.mapquest.com/content/osm/mq_logo.png">. Map data (c) <a href="https://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> contributors, CC-BY-SA.'
});
var mapquestOAM = L.tileLayer("https://{s}.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpg", {
  maxZoom: 18,
  subdomains: ["oatile1", "oatile2", "oatile3", "oatile4"],
  attribution: 'Tiles courtesy of <a href="https://www.mapquest.com/" target="_blank">MapQuest</a>. Portions Courtesy NASA/JPL-Caltech and U.S. Depart. of Agriculture, Farm Service Agency'
});
var mapquestHYB = L.layerGroup([L.tileLayer("https://{s}.mqcdn.com/tiles/1.0.0/sat/{z}/{x}/{y}.jpg", {
  maxZoom: 18,
  subdomains: ["oatile1", "oatile2", "oatile3", "oatile4"]
}), L.tileLayer("https://{s}.mqcdn.com/tiles/1.0.0/hyb/{z}/{x}/{y}.png", {
  maxZoom: 19,
  subdomains: ["oatile1", "oatile2", "oatile3", "oatile4"],
  attribution: 'Labels courtesy of <a href="https://www.mapquest.com/" target="_blank">MapQuest</a> <img src="https://developer.mapquest.com/content/osm/mq_logo.png">. Map data (c) <a href="https://www.openstreetmap.org/" target="_blank">OpenStreetMap</a> contributors, CC-BY-SA. Portions Courtesy NASA/JPL-Caltech and U.S. Depart. of Agriculture, Farm Service Agency'
})]);

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

var USGShydroNHDBaseMap = L.layerGroup([L.esri.tiledMapLayer("https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroNHD/MapServer", {
	maxZoom:15,
	minZoom:0
  }), L.esri.dynamicMapLayer("https://services.nationalmap.gov/arcgis/rest/services/USGSHydroNHDLarge/MapServer", {
	maxZoom:19,
	minZoom:16
  })
]);

//streamstats stream grid layer
var streamGridService = L.esri.dynamicMapLayer('https://54.225.181.217:6080/arcgis/rest/services/StreamStats/streamgrids/MapServer', {opacity: 0.8 });

//regions layer
var regionsLayer = L.esri.imageMapLayer('https://54.225.181.217:6080/arcgis/rest/services/StreamStats/regionsNY/ImageServer', {layers: [1] });

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
  layers: [mapquestOSM, streamGridService]
});

var modalMap = L.map("modalMap", {
  minZoom: 7,
  zoom: params.zoom || 7,
  center: [params.lat || 42.7, params.lng || -76.2], 
  layers: [mapquestOSMmodal]
});

//bootstrap modals dont like leaflet, some trickery to get map to display
 $('.nav-tabs a[href="#maptab"]').on('click', function() {
	console.log('in modal tab click');
	setTimeout(function() {
		modalMap.invalidateSize();
		modalMap.fitBounds([[polyArray.features[0].bbox[1],polyArray.features[0].bbox[0]],[polyArray.features[0].bbox[3],polyArray.features[0].bbox[2]]]);
	  }, 100);
	  
 });

var baseLayers = {
  "Street Map": mapquestOSM,
  "Aerial Imagery": mapquestOAM,
  "Imagery with Streets": mapquestHYB,
  "USGS Topo Base Map": USGStopoBaseMap,
  "USGS Imagery Topo Base Map":USGSimageryTopoBaseMap,
  "USGS Hydro NHD Base Map":USGShydroNHDBaseMap
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
	
	$('#delineateModal').modal('hide');
	
	$('#editCharacteristics').hide();
	$('#estimateFlows').hide();
	$('#exportToCSV').hide();
	$('#recalcChars').hide();
	$('#reDelineate').hide();
	$('#updatePrecip').hide();
	$('#exportButton').hide();
	
	$('#flowTable').html('<p>You must select a climate scenario and click "Estimate Flows"</p>');
	$('#SSBasinCharResults').html('');
	$('#futurePrecipResults').html('');
	
	$('#pointProgress').html('<div class="loading-indicator"><div id="pointProgressBarMain" class="progress"><div id="pointProgressBarColor" class="progress-bar" style="width: 100%;"><span id="pointProgressText">Not started</span></div></div></div><div>Time elapsed: <span id="regionTime"></span></div>');
	$('#delineationProgress').html('<div class="loading-indicator"><div id="delineationProgressBarMain" class="progress"><div id="delineationProgressBarColor" class="progress-bar" style="width: 100%;"><span id="delineationProgressText">Not started</span></div></div></div><div>Time elapsed: <span id="delineationTime"></span></div>');
	$('#basinCharProgress').html('<div class="loading-indicator"><div id="basinCharProgressBarMain" class="progress"><div id="basinCharProgressBarColor" class="progress-bar" style="width: 100%;"><span id="basinCharProgressText">Not started</span></div></div></div><div>Time elapsed: <span id="basinCharTime"></span></div>');
	
	//change cursor to crosshair
	$('#map').css('cursor', 'hand');
	$('#delineateButton').removeClass('active');
	
	$('.nav-tabs a[href="#progress"]').tab('show');
	
	basinLayer.clearLayers();
	
	map.setView([42.7,-76.2],7);
});

$('#reDelineate').on('click', function() {
	$('#delineationProgress').html('<div class="loading-indicator"><div id="delineationProgressBarMain" class="progress"><div id="delineationProgressBarColor" class="progress-bar" style="width: 100%;"><span id="delineationProgressText">Not started</span></div></div></div><div>Time elapsed: <span id="delineationTime"></span></div>')
	
	getBasinDelineation(basinDelineationInputs)
});

$('#recalcChars').on('click', function() {
	$('#basinCharProgress').html('<div class="loading-indicator"><div id="basinCharProgressBarMain" class="progress"><div id="basinCharProgressBarColor" class="progress-bar" style="width: 100%;"><span id="basinCharProgressText">Not started</span></div></div></div><div>Time elapsed: <span id="basinCharTime"></span></div>')
	
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
		
				//check to make sure map has the stream grid layer
				if (map.hasLayer(streamGridService)) {
					
					pourPoint = e.latlng;
					console.log(pourPoint);
			
					L.esri.Tasks.identifyFeatures({
						url: 'https://54.225.181.217:6080/arcgis/rest/services/StreamStats/streamgrids/MapServer'
					})
					.on(map)
					.at(e.latlng)
					.layers('all')
					.returnGeometry(false)
					.tolerance(2)
					.run(function(error, featureCollection, response){
					
						$.each(response.results, function (index, value) {
							console.log(index,value);
							if(value.attributes["Pixel Value"] ==1) {
													
								//show modal
								$('#delineateModal').modal('show');

								//get current time
								var ajaxStartTime = Date.now();
							
								//start region progress bar
								$('#pointProgressBarMain').addClass('progress-striped active');
								$('#pointProgressBarColor').addClass('progress-bar-info');
								$('#pointProgressText').text('In progress');
								
								//get state code from stream cell identification
								state = value.layerName.split('_')[1].toUpperCase();
								console.log('Point is on stream cell in: ', state);
								
								//get clickpoint
								var lat = e.latlng.lat.toFixed(5);
								var lng = e.latlng.lng.toFixed(5);
								
								//add a marker to the map at clicked point
								var delineatedPoint = L.marker([e.latlng.lat,e.latlng.lng]);
								basinLayer.addLayer(delineatedPoint);
								
								//turn off click listener
								map.off('click', requestCallback);
														
								if (state == "VT") {				
								
										//set region ID variable for vermont
										regionID = "0";
										
										console.log('Got region: ',regionID);
								
									//get basin delineation
									getBasinDelineation(lng,lat,regionID, state)

								}
								
								//if state is NY then we need to do region query
								else if (state == "NY") {
								
									//next query for region ID
									regionsLayer.identify().at(e.latlng).run(function(error, results){

										//set region ID variable
										regionID = results.pixel.properties.value;
										console.log('Got region: ',regionID);
							
										//get basin delineation
										basinDelineationInputs = [lng,lat,regionID, state];
										getBasinDelineation(basinDelineationInputs)

									}); //end region query
								}
								
								//update progress bar
								$('#pointProgressBarMain').removeClass('progress-striped active');
								$('#pointProgressBarColor').removeClass('progress-bar-info');
								$('#pointProgressBarColor').addClass('progress-bar-success');
								$('#pointProgressText').text('Complete');
								
								//get region time
								$('#regionTime').text((Date.now()-ajaxStartTime)/1000 + ' seconds');
								
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
			});
		}
	}
});

function getBasinDelineation(basinDelineationInputs) {
	
	var lng = basinDelineationInputs[0];
	var lat = basinDelineationInputs[1];
	var regionID = basinDelineationInputs[2];
	var state = basinDelineationInputs[3];

	//start delineation progress bar
	$('#delineationProgressBarMain').addClass('progress-striped active');
	$('#delineationProgressBarColor').addClass('progress-bar-info');
	$('#delineationProgressText').text('In progress');
	
	//clear existing table
	$('#SSBasinCharResults').html('');

	//build request URL
	var requestURL = "https://ssdev.cr.usgs.gov/streamstatsservices/watershed.geojson?rcode=" + state + "&xlocation=" + lng + "&ylocation=" + lat + "&crs=4326&includeparameters=false&includefeatures=globalwatershed";
	
	//get current time
	var ajaxStartTime = Date.now()
	
	//do first call just for basin boundary
	$.ajax({
		type: "GET",
		url: requestURL,
		dataType: "json",
		success: function(json){	
			if (json.featurecollection[0]) {
		
				//console.log(json);
				console.log("success delineating basin");
				
				//create basin polygon from geometry
				polyArray = json.featurecollection[0].feature;
				
				//create leaflet geojson feature
				console.log(polyArray);
				//if polyArray.
				var delineatedBasin = L.geoJson(polyArray);
				basinLayer.addLayer(delineatedBasin);
				
				//zoom to polygon
				//modalMap.fitBounds([[polyArray.bbox[1],polyArray.bbox[0]],[polyArray.bbox[3],polyArray.bbox[2]]]);
				
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
				
				$('#delineationProgress').html('<div class="alert alert-danger" role="alert"><strong>Delineate Basin Failed: </strong>Zero length delineation response</div>');
			}
		
		},
		error: function (request, status, error) {
			console.log("error delineating basin", request, status, error);
			
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
	
	//build request URL
	var requestURL = "https://ssdev.cr.usgs.gov/streamstatsservices/parameters.json?rcode=" + state + "&workspaceID=" + workspaceID + "&includeparameters=" + paramURLstring;

	//get current time
	var ajaxStartTime = Date.now();
	
	//move basin json to global variable
	esriJSON = '{"rings":' + JSON.stringify(delineatedBasin.features[0].geometry.coordinates) + ',"spatialReference":{"wkid":' + delineatedBasin.crs.properties.code + '}}'

	//do ajax call from streamstats for main basin characteristics
	$.ajax({
		type: "GET",
		url: requestURL,
		dataType: "json",
		success: function(json){	
			//console.log(json);
			console.log("success getting streamstats parameters");
			
			//move results to global json object
			SSBasinChars = json.parameters;
			console.log(SSBasinChars,'SSbasinchars length: ',SSBasinChars.length)
			
			//make sure some basin characteristics are returned
			if (SSBasinChars.length >= 1) {
			
				//if state is NY then we need to do additional basin char request for precip and wetland
				if (state == "VT") {	
					console.log('state check ',state);
					var paramArray = [['0','WETLAND','Percent of area covered by lakes, ponds and wetlands'],['1','PRECIP','Mean annual precipitation in inches']];
					var count = paramArray.length;
					
					$(paramArray).each(function (index, value) {
						console.log('vtloop',index,value);
						//build REST url for each of the grid layers
						var requestURL = 'https://54.225.181.217:6080/arcgis/rest/services/StreamStats/vtSSgrids/MapServer/exts/SpatialOverlayRESTSOE/layers/' + value[0] + '/SpatialOverlay';
						
						//do ajax call for future precip layer, needs to happen even if only runoff value is needed for this region
						$.ajax({
							type: "POST",
							url: requestURL,
							data: 'FieldName(Feature Layer)=""&Polygon=' + esriJSON + '&f=pjson',
							dataType: "json",
							success: function(json){	
								console.log("success getting vermont basin chars",value[1],json.results.Mean);
												
								if (value[1] == 'WETLAND') SSBasinChars.push({description: value[2],name: value[1],code:value[1],value:Number((json.results.Mean)*100).toFixed(2) });
								else SSBasinChars.push({description: value[2],name: value[1],code:value[1],value:Number(json.results.Mean).toFixed(2) });
								
								//decrement count by one until it gets to zero when this if will be true ie. !zero	
								if (!--count) {
									pushCharacteristicList(lat,lng,regionID,SSBasinChars, workspaceID, ajaxStartTime);
								}
							}
						});
					});
				}
				
				//point is in New York
				else {
					pushCharacteristicList(lat,lng,regionID,SSBasinChars, workspaceID, ajaxStartTime);
				}
			

			}
			
			else {
				console.log("error getting streamstats parameters: zero length response");
				
				$('#recalcChars').show();
				
				$('#basinCharProgress').html('<div class="alert alert-danger" role="alert"><strong>Calculate Regional Basic Chacteristics Failed: </strong>Zero length parameter response</div>');
				
				return;
			}
			
		},
		error: function (request, status, error) {
			console.log("error getting streamstats parameters", request, status, error);
			
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

	//create results table
	var paramsTable = $('<table class="table table-condensed"><tr><th>StreamStats Parameter</th><th>Value</th></tr></table>');
	$(SSBasinChars).each(function () {
		paramsTable.append("<tr><td class='col-md-10'>" + this.description.replace('.','') + "</td><td>" + this.value + "</td></tr>");
	});		
	
	//overwrite results
	$('#SSBasinCharResults').html(paramsTable);	
	
	//create export button
	var exportURL = "https://ssdev.cr.usgs.gov/streamstatsservices/download?workspaceID=" + workspaceID;
	$('#exportButton').attr('href', exportURL);
	
	//update progress bar
	$('#basinCharProgressBarMain').removeClass('progress-striped active');
	$('#basinCharProgressBarColor').removeClass('progress-bar-info');
	$('#basinCharProgressBarColor').addClass('progress-bar-success');
	$('#basinCharProgressText').text('Complete');
	
	//basin char time
	$('#basinCharTime').text((Date.now()-ajaxStartTime)/1000 + ' seconds');
	
	//show complete button
	$('#editCharacteristics').show();
	$('#estimateFlows').show();
	$('#exportToCSV').show();
	$('#updatePrecip').show();
	$('#exportButton').show();
}

$('#tabList a').click(function (e) {
  e.preventDefault();
  $(this).tab('show');
})

$('#editCharacteristics').click(function (e) {
  $('.nav-tabs a[href="#output"]').tab('show');
})

$('#exportToCSV').click(function (e) {
	console.log('flowArray',futureFlowsArray);
	
	exportToCsv('data.csv', futureFlowsArray)
});

$('#estimateFlows').click(function (e) {

	//make sure we have future basin chars
	if (futureBasinChars) {
		
		//show loader
		$('#estimateFlows').addClass('active');

		//SS based regression service call
		$.ajax({
			type: "POST",
			url: "https://commons.wim.usgs.gov/regressionservice/models/QHigh/estimate?state=" + state,
			data: JSON.stringify(parseParameterObject(SSBasinChars)),
			dataType: "json",
			contentType: "application/json",
			success: function(json_SS){	
				console.log("success getting SS flows",json_SS, SSBasinChars);
				
				//nested Future based regression service call
				$.ajax({
					type: "POST",
					url: "https://commons.wim.usgs.gov/regressionservice/models/QHigh/estimate?state=" + state,
					data: JSON.stringify(parseParameterObject(futureBasinChars)),
					dataType: "json",
					contentType: "application/json",
					success: function(json_future){	
						console.log("success getting future flows",json_future, futureBasinChars);
						
						//need to sort the results
						futureFlowsArray = [];
						for (var interval in json_SS.ExceedanceProbabilities)
							futureFlowsArray.push([interval, json_SS.ExceedanceProbabilities[interval], json_future.ExceedanceProbabilities[interval], ((json_future.ExceedanceProbabilities[interval]- json_SS.ExceedanceProbabilities[interval])/json_SS.ExceedanceProbabilities[interval] * 100)])
						futureFlowsArray.sort(function(a, b) {return a[1] - b[1]})
						
						//create results table
						var flowTable = $('<table class="table table-condensed"><tr><th>Recurrance Interval (years)</th><th>StreamStats Discharge (cfs)</th><th>Predicted Future Discharge (cfs)</th><th>Percent Change</th></tr></table>');//.addClass('table  table-hover table-striped table-responsive table-condensed');
						$.each(futureFlowsArray, function (key,val) {
							console.log(val);
							flowTable.append("<tr><td class='col-md-5'>" + val[0] + "</td><td>" + val[1].toFixed(0) + "</td><td>" + val[2].toFixed(0) + "</td><td>" + val[3].toFixed(0) + "</td></tr>");
						});	
						
						//write to markup
						$('#flowTable').html(flowTable);
						
						
					},
					error: function (request, status, error) {
						console.log("error calculating future based flows", request, status, error);
						$('#flowTable').html('<h4>There was an error calculating future based flows</h4>')
						
						//hide spinner
						$('#estimateFlows').removeClass('active');
					
						//show the tab when complete
						$('.nav-tabs a[href="#flows"]').tab('show');
					},
					complete: function() {
						//hide spinner
						$('#estimateFlows').removeClass('active');
					
						//show the tab when complete
						$('.nav-tabs a[href="#flows"]').tab('show');
					}
				});
			},
			error: function (request, status, error) {
				console.log("error calculating SS based flows", request, status, error);
				$('#flowTable').html('<h4>There was an error calculating SS based flows</h4>')
				
				//hide spinner
				$('#estimateFlows').removeClass('active');
			
				//show the tab when complete
				$('.nav-tabs a[href="#flows"]').tab('show');
			}
		});
	}
	
	else {
		$.growl('You must click the "Update Climate Parameter" button on the "Output" tab before you can estimate flows', {
			type: 'warning',
			placement: {
				from: "bottom",
				align: "right"
			},
			z_index:9999
		});
	}
})

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

        var csvFile = 'Latitude,' + pourPoint.lat.toFixed(4) + '\nLongitude,' + pourPoint.lng.toFixed(4) +'\n\nRecurrance Interval,StreamStats Discharge (cfs),Predicted Future Discharge (cfs),Percent Change\n';
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
$.getJSON('https://54.225.181.217:6080/arcgis/rest/services/StreamStats/climateChangeGrids/MapServer/exts/SpatialOverlayRESTSOE?f=pjson', function (data) {
	console.log('Got climate grid list');
	precipLayerList = data.layers;
});

$('#updatePrecip').on('click', function(event) {

	//clear future precip
	futureBasinChars = '';

	//start spinner
	$(this).addClass('active');
	
	//disable estimate flows button
	$('#estimateFlows').prop('disabled', true);

	//get model name string
	var dropdownList = ['gasscenario','climatemodel','timewindow'];
	var modelNameList = [];
	$.each(dropdownList, function(i,v) {
		modelNameList.push( $('#' + this).attr("value"));
	});
	
	var precipLookup = modelNameList.join('_');
	
	//get short code for modelID using lookup object modelData
	var modelID;
	$.each(modelData, function() {
		if (this.Mod_Name == precipLookup) { modelID = this.Model_ID };
	});
		
	//get arcgis server layerID
	$.each(precipLayerList, function() {
		
		//if we are on the currently selected climate model
		if (this.name.replace('Merge','') == String(modelID)) {  
			
			//reset meanET
			var meanET = -999;
		
			//build REST url for each of the grid layers
			var requestURL = 'https://54.225.181.217:6080/arcgis/rest/services/StreamStats/climateChangeGrids/MapServer/exts/SpatialOverlayRESTSOE/layers/' + modelID + '/SpatialOverlay';
			

			//do ajax call for future precip layer, needs to happen even if only runoff value is needed for this region
			$.ajax({
				type: "POST",
				url: requestURL,
				data: 'FieldName(Feature Layer)=""&Polygon=' + esriJSON + '&f=pjson',
				dataType: "json",
				success: function(json){	
					console.log("success getting future precip");
					
					//get future precip value
					var futurePrecip = Number(json.results.Mean);
					
					//make a copy of original basin characteristics
					futureBasinChars = JSON.parse( JSON.stringify( SSBasinChars ) );
									
					//find precip
					$.each(futureBasinChars, function() {
					
						//update value in future basin chars with calculated future precip
						if (this.name == "PRECIP") {
							//grab current precip value before overwriting
							var currentPrecip = Number(this.value);
							
							//update values for precip
							this.value = futurePrecip;
							this.description = precipLookup;
							
							//add to markup, if only need precip then we are done
							$('#futurePrecipResults').html("<table class='table table-condensed'><tr><th>Future Climate Parameter <small>[" + this.description + "]</small></th><th>Value</th></tr><tr class='success'><td class='col-md-10'>Mean annual precipitation in inches</td><td>" + futurePrecip.toFixed(2) + "</td></tr></table>");
							
							var scenario = this.description;
							var scenarioList = scenario.split('_')
							var greenHouseGasScenario = scenarioList[0];
							var climateModel = scenarioList[2] + '-' + scenarioList[3];
							var timePeriod = '20' + scenarioList[4] + '-20' + scenarioList[5];
							
							$('#modelName').html("<strong>Greenhouse gas scenario:</strong> "+ greenHouseGasScenario+"</br><strong>Climate model:</strong> "+ climateModel +"</br><strong>Time Period: </strong>"+ timePeriod +"</br></br><strong>Latitude </strong>"+ pourPoint.lat.toFixed(4) + "</br><strong>Longitude: </strong>"+ pourPoint.lng.toFixed(4));
							
							//otherwise, do runoff stuff
							if (hasRunoff(futureBasinChars)) {
						
								//loop over new future basin chars
								$.each(futureBasinChars, function() {

									//look for runoff
									if (this.name == "MAR") {

										var currentRunoff = this.value;
										var computedET = currentPrecip - currentRunoff;
										//var computedRunoff = futurePrecip - computedET;
										var ETratio = computedET / currentPrecip;
										var computedETratioRunoff = Number(futurePrecip - (ETratio * futurePrecip));

										//console.log(currentRunoff, "  ", currentPrecip, "  ",futurePrecip, "  ",computedET, "  ", ETratio, "  ",computedETratioRunoff);
										
										//update values for MAR in futurebasinchars object
										this.value = computedETratioRunoff;
										this.description = precipLookup;

										//add to markup
										$('#futurePrecipResults').html("<table class='table table-condensed'><tr><th>Future Climate Parameter <small>[" + this.description + "]</small></th><th>Value</th></tr><tr class='success'><td class='col-md-10'>Mean annual runoff in inches</td><td>" + computedETratioRunoff.toFixed(2) + "</td></tr></table>");
									}
								});
							}
						}
					});
				
				//future precip error callback
				},
				error: function (request, status, error) {
					console.log("error getting future precip", request, status, error);
					$('#delineationHeader').html('<h4>There was an error</h4>')
				},
				complete: function () {
					//hide spinner
					$('#updatePrecip').removeClass('active');
					
					//disable estimate flows button
					$('#estimateFlows').prop('disabled', false);
				}						
			});
		}
	});
});

function hasRunoff(SSBasinChars) {
	var i = null;
    for (i = 0; SSBasinChars.length > i; i += 1) {
        if (SSBasinChars[i].name === "MAR") {
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