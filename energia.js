// Energia main class
var Energia = Class.$extend({
	
	// Variables to store state
	entities : [],
	selectedEntities : [],
	turnCount : 0,
	previousTurnTime : null, // Timestamp. Used to calculate the expired time since previous iteration so that the amount of pulsable resources, moving-distance etc can be calculated
	currentTurnTime : null, // Time at start of the current turn. This ensures an identical timeDelta between current and previous turn throughout the turn.
	timerID : null, // Global timer that pulses resources, moves entities etc

	// Constructor
	__init__ : function() {
	
		// Configuration
		this.timerDelay = 1000/60;  // in MilliSeconds. Resources and position will be calculated every [timerDelay] milliseconds.
							   // The timerDelay does *not* influence speed of movement etc, because position is based per second, not per iteration.
							   // The timerDelay thus only influences choppiness (and game-performance), not movement speed or pulse speed.
	
		// Classes
		var Entity = Class.$extend({

			__init__ : function() {
				// For custom properties use 'var obj = new Entity.fillData({value: 42});'
				this.position = { x : 0, y : 0 }; // in-game meters
				this.wayPoints = [];
				this.maxSpeed = 10; // in-game meters per second
				this.resources = { energy: 0, yellow: 0 };
				this.pulseRadius = 15; // in-game meters
				this.resourceStorageCapacity = { energy: 1000 };
				this.maxPulseAmount = { energy: 20 };
				// Used to determine resources at the start of a turn. Set in onStartOfTurn()
				this.resourcesAtStartOfTurn = null;
				// Used to see what has been sent/received at the end of a turn. Set during or at end of turn.
				this.resourcesAtEndOfTurn = null;
				this.resourcesPulsedDuringTurn = {};
				this.resourcesReceivedDuringTurn = {};
			},
			
			onStartOfTurn : function() {
				// Deep copy instance of resources
				this.resourcesAtStartOfTurn = jQuery.extend(true, {}, this.resources);
				this.resourcesAtEndOfTurn = null;
				this.resourcesPulsedDuringTurn = { energy: 0, yellow: 0 };
				this.resourcesReceivedDuringTurn = { energy: 0, yellow: 0 };
			},
			
			onEndOfTurn : function() {
				this.resourcesAtStartOfTurn = null;
				this.resourcesAtEndOfTurn = jQuery.extend(true, {}, this.resources);
			},
			
			fillData : function(data) {
				// fill the properties of this element recursively with the provided data
				for(key in data) {
					if (data[key] instanceof Object) {
						// If the current property is not an Object, then simply replace it with the data
						if(this[key] instanceof Object == false) {
							this[key] = data[key];
						} else {
							// Otherwise, integrate the objects by iterating over the data and calling fillData() with it
							fillData = this.fillData.bind(this[key]); // bind this[key] as 'this' to the fillData function, so the data will be saved to this[key]
							fillData(data[key]);
						}
					} else {
						// Simply set data
						this[key] = data[key];
					}
				}
				return this;
			},
			
			getConsumption : function(resource) {
				return 0;
			},
			
			getProduction : function(resource) {
				return 0;
			},

			die : function() {
				this.resources.energy = 0;
			},
			
			getPreferableAmountOfResourcesToReceive : function(resourceName) {
				// An entity wants as much as he can have
				return (this.resourceStorageCapacity[resourceName] - this.resources[resourceName]);
			},
			
			getPreferableAmountOfResourcesToPulse : function(resourceName, wantedAmount, entity2, wantedResources) {
				// We give fair amounts of energy to every requester
				// First, we check how much entity2 wants of the grand total of wanted Resources
				var percentageOfTotal = wantedAmount / wantedResources[resourceName].amountOfResources;
				// Then, we give them that percentage from our own resources
				// We always want to keep 10 of our resource AND we will not ever give more than maxPulseAmount
				var whatWeCanSendInTotalThisTurn = Math.min(Math.max(0,this.resourcesAtStartOfTurn[resourceName] - 10 - this.getConsumption(resourceName)), this.maxPulseAmount[resourceName]);
				var whatWeWillSend = percentageOfTotal * whatWeCanSendInTotalThisTurn;
				return whatWeWillSend;
			}
			
		});

		this.Consumer = Entity.$extend({

			getConsumption : function(resource) {
				if (resource == "energy") {
					return 10;
				} else {
					return 0;
				}
			},
			
			getProduction : function(resource) {
				return 0;
			}
		});
		
		this.MiddleStation = this.Consumer.$extend({

			getConsumption : function(resource) {
				if (resource == "energy") {
					return 2; // Only very few consumption
				} else {
					return 0;
				}
			},
			
			getProduction : function(resource) {
				return 0;
			}
		});

		this.Producer = Entity.$extend({

			getConsumption : function(resource) {
				if (resource == "energy") {
					return 10;
				} else {
					return 0;
				}
			},

		});
		
		this.EnergyProducer = this.Producer.$extend({

			getConsumption : function(resource) {
				if (resource == "energy") {
					return 10;
				} else {
					return 0;
				}
			},
			
			getProduction : function(resource) {
				if (resource == "energy") {
					return 30;
				} else {
					return 0;
				}
			},
			
			getPreferableAmountOfResourcesToReceive : function(resourceName) {
				// We don't need energy if we produce it
				if (resourceName == "energy") {
					return 0;
				} else {
					return (this.resourceStorageCapacity[resourceName] - this.resources[resourceName]);
				}
			},

		});
		
		// Build 10 consuming entities, with varying position
		// Build 1 producing entity, with initially 0 energy
		// Only those entities within the radius of the producer will survive
		this.entities = [];
		// Consumers
		//this.entities.push(new this.Consumer().fillData({resources:{energy:100}}));
		//this.entities.push(new this.Consumer().fillData({resources:{energy:60}, position:{x:15,y:5}}));
		//this.entities.push(new this.Consumer().fillData({resources:{energy:10}, position:{x:5,y:15}}));
		// Producer
		this.addEntities([ new this.EnergyProducer().fillData({resources:{energy:100}, position:{x:10,y:10}}) ]);
		// And some more consumers in a row
		for (var a = 0; a < 5; a++) {
			this.addEntities([
				new this.MiddleStation().fillData(
					{resources:{energy:60}, 
					position:{x:10,y:(15+(a*5))}}
				)
			]);
		}
		// And another row
		for (var a = 0; a < 5; a++) {
			this.addEntities([
				new this.MiddleStation().fillData(
					{resources:{energy:60}, 
					position:{x:(25+a*10),y:25}}
				)
			]);
		}
	},

	// Set timer to do the pulsing
	timer : function() {
		// Set timer for the next pulse
		// Note: this points to global scope when executed from within window.setTimeout and thus .timer() cannot be found
		// Consequently, we need to bind our 'this' as the execution environment
		this.timerID = setTimeout(this.timer.bind(this), this.timerDelay);
		// Increase turn number
		this.turnCount++;
		// Calculate timeDelta since previous turn, and store the current time
		this.storeTimeForCurrentTurn();
		var timeDelta = this.getTimeDelta(); // in milliseconds
		var secondsThatHavePassed = (timeDelta / 1000);
		// Start the new turn of every entity
		for (entityid in this.entities) {
			var entity = this.entities[entityid];
			entity.onStartOfTurn();
		}
		// Loop over every entity, and perform their actions
		for (entityid in this.entities) {
			var entity = this.entities[entityid];
			// Do consumption and production
			entity.resources.energy += entity.getProduction("energy") * secondsThatHavePassed;
			entity.resources.energy -= entity.getConsumption("energy") * secondsThatHavePassed;
			// Move the entity to the correct space
			this.moveEntities([entityid]);
			// Determine which elements fall within the pulse radius, and pulse energy to them if they want that
			// First, determine how many entities want resources, and how much resources they want in total
			var wantedResources = {};
			for (entity2id in this.entities) {
				if (entityid == entity2id) {
					// Don't compare any entity with itself
					continue;
				}
				var entity2 = this.entities[entity2id];
				// Check if position of entity2 is within pulse radius of entity
				// I.e. the distance from entity2 to entity should be less than pulse-radius
				// We square the pulse-radius to prevent an expensive square-root calculation for the pythagoras
				var radiussquared = entity.pulseRadius * entity.pulseRadius;
				var distancesquared = Math.abs(entity.position.x - entity2.position.x)*Math.abs(entity.position.x - entity2.position.x) +
										Math.abs(entity.position.y - entity2.position.y)*Math.abs(entity.position.y - entity2.position.y);
				if (distancesquared <= radiussquared) {
					// Entity can pulse to entity2
					// Determine what quantity of every resource entity2 wants to receive
					for (resourcename in entity.resources) {
						var amount = entity2.getPreferableAmountOfResourcesToReceive(resourcename);
						if (amount > 0) {
							if (wantedResources[resourcename] == null) {
								wantedResources[resourcename] = {amountOfNodes:1, amountOfResources:amount};
							} else {
								wantedResources[resourcename].amountOfNodes+=1;
								wantedResources[resourcename].amountOfResources+=amount;
							}
						}
					}
				}
			}
			// Now that we know the amount of Resources that how many entities want to have, 
			// we can decide on the amount of resources that we want to send to everyone
			for (entity2id in this.entities) {
				if (entityid == entity2id) {
					// Don't compare any enitty with itself
					continue;
				}
				var entity2 = this.entities[entity2id];
				// Check if position of entity2 is within pulse radius of entity
				// I.e. the distance from entity2 to entity should be less than pulse-radius
				// We square the pulse-radius to prevent an expensive square-root calculation for the pythagoras
				var radiussquared = entity.pulseRadius * entity.pulseRadius;
				var distancesquared = Math.abs(entity.position.x - entity2.position.x)*Math.abs(entity.position.x - entity2.position.x) +
										Math.abs(entity.position.y - entity2.position.y)*Math.abs(entity.position.y - entity2.position.y);
				if (distancesquared <= radiussquared) {
					// Entity can pulse to entity2
					// Determine what quantity of every resource entity2 wants to receive
					for (resourcename in entity.resources) {
						var amount = entity2.getPreferableAmountOfResourcesToReceive(resourcename);
						if (amount > 0) {
							// Entity2 wants to have 'amount', but do we want to give it?
							var amountToGive = entity.getPreferableAmountOfResourcesToPulse(resourcename, amount, entity2, wantedResources);
							// Adjust amount for the time that has passed since previous turn
							amountToGive = amountToGive * secondsThatHavePassed;
							// Pulse resources over
							entity.resources[resourcename] -= amountToGive;
							entity.resourcesPulsedDuringTurn[resourcename] += amountToGive;
							entity2.resources[resourcename] += amountToGive;
							entity2.resourcesReceivedDuringTurn[resourcename] += amountToGive;
						}
					}
				}
			}
		}
		// Check which entities will cease to exist
		for(entityid in this.entities) {
			if (this.entities[entityid].resources.energy < 0) {
				var toBeRemoved = {};
				toBeRemoved[entityid] = this.entities[entityid];
				delete this.entities[entityid];
			} else {
				// Formally end its turn
				entity.onEndOfTurn();
			}
		}
	},
	
	// Start the simulation
	start : function() {
		// Set current time as start-time
		this.storeTimeForCurrentTurn(); // move current turn's time (==null) to prev turn and set current turn's time
		this.storeTimeForCurrentTurn(); // move current turn's time (==now) to prev turn and set current turn's time
		// Start the timer
		this.timer();
	},
	
	stop : function() {
		clearTimeout(this.timerID);
	},
	
	// Set the renderer
	setRenderer : function(renderer) {
		this.renderer = renderer;
		this.renderer.energia = this;
	},
	
	// Set the input
	setInput : function(input) {
		this.input = input;
		this.input.energia = this;
	},
	
	// API for Input
	setSelectedEntities : function(entityIDs) {
		this.selectedEntities = entityIDs;
	},
	
	getSelectedEntities : function() {
		return this.selectedEntities;
	},
	
	addEntities : function(entities) {
		for (entityID in entities) {
			this.entities.push(entities[entityID]);
		}
	},
	
	removeEntities : function(entities) {
		for(entityID in entities) {
			this.renderer.onEntitiesRemoved([entities[entityID]]);
			delete this.entities[entities[entityID]];
		}
	},
	
	getEntity : function(entityID) {
		// Get entity from array, based in its index
		return this.entities[entityID];
	},
	
	setWayPointForEntities : function(entities, x, y) {
		// Add waypoints to the entities
		for(i in entities) {
			var entityID = entities[i];
			var entity = this.getEntity(entityID);
			entity.waypoints = [{x:x,y:y}];
		}
	},
	
	moveEntities : function(entities) {
		// Get timedelta and calculate entity-speed and move entity accordingly
		var timeDelta = this.getTimeDelta();
		var secondsThatHavePassed = timeDelta / 1000;
		// Move entities towareds their waypoints
		for(i in entities) {
			var entityID = entities[i];
			var entity = this.getEntity(entityID);
			if (entity.waypoints != undefined && entity.waypoints.length > 0) {
				// Calculate max distance that entities can move this turn
				var maxDistance = entity.maxSpeed * secondsThatHavePassed;
				// Calculate direction in which entity should go
				var dx = entity.waypoints[0].x - entity.position.x;
				var dy = entity.waypoints[0].y - entity.position.y;
				// Move entity
				entity.position.x += (dx < 0 ? maxDistance * -1 : maxDistance);
				entity.position.y += (dy < 0 ? maxDistance * -1 : maxDistance);
			}
		}
	},
	
	// Time functions
	getTimeDelta : function() {
		// Calculate  difference between current time and the stored time
		return (this.currentTurnTime - this.previousTurnTime); // in milliseconds
	},
	
	storeTimeForCurrentTurn : function() {
		this.previousTurnTime = this.currentTurnTime;
		this.currentTurnTime = new Date().getTime();
	},
	
	// Handy functions
	distance : function(pos1,pos2) {
		return Math.sqrt(Math.pow(Math.abs(pos1.x-pos2.x),2) + Math.pow(Math.abs(pos1.y-pos2.y),2));
	}
	
});

// Renderer
Energia.renderer = Class.$extend({
	__init__ : function(canvasElement) {
		// Set canvas
		this.canvasContainer = $(canvasElement);
		// Create canvas element
		var canvasElement = $("<canvas>");
		// Add it to the canvasContainer
		this.canvasContainer.append(canvasElement);
		// Set correct size
		canvasElement.get(0).width = this.canvasContainer.width();
		canvasElement.get(0).height = this.canvasContainer.height();
		// Get 2D context
		this.canvas = canvasElement.get(0).getContext("2d");
		// Fake the requestAnimationFrame
		window.requestAnimFrame = (function(){
			return  window.requestAnimationFrame       || 
			window.webkitRequestAnimationFrame || 
			window.mozRequestAnimationFrame    || 
			window.oRequestAnimationFrame      || 
			window.msRequestAnimationFrame     || 
			function(/* function */ callback, /* DOMElement */ element){
				window.setTimeout(callback, 1000 / 60);
			};
		})();
	},
	info : "Default renderer",
	canvasContainer : null,
	canvas : null,
	energia : null,
	doRender : false,
	startRender : function() {
		// Set doRender to true. If doRender is false, the render cycle will not initiate a new cycle
		this.doRender = true;
		// Initiate the render-cyclus
		// Request requestAnimationFrame on the DOM canvas element, to make the browser call this.render when this.canvas will be redrawn
		requestAnimFrame(this.loopRender.bind(this), this.canvas);
	},
	stopRender : function() {
		this.doRender = false;
	},
	loopRender : function() {
		this.render.bind(this)();
		requestAnimFrame(this.loopRender.bind(this), this.canvas);
	},
	render : function() {
		// Clear the canvas
		this.canvas.clearRect(0,0,this.canvas.canvas.width,this.canvas.canvas.height);
		// render all entities
		for(entityID in this.energia.entities) {
			// Render it on the screen with its amount of energy
			var entity = this.energia.entities[entityID];
			// Select color for entity
			if (entity instanceof this.energia.Producer) {
				var color = "#ff0000";
			} else {
				var color = "#000";
			}
			// Make selected entities white
			if (this.energia.selectedEntities.indexOf(entityID) != -1)
			{
				color = "#00ff00";
			}
			// Draw the entity
			this.canvas.fillStyle = color; 
			this.canvas.fillRect(entity.position.x * 15 - 5, entity.position.y * 15 - 5, 10, 10);
			var text = (Math.round(entity.resources.energy*10)/10 + " (uit " + Math.round(entity.resourcesPulsedDuringTurn.energy) + ", in " + Math.round(entity.resourcesReceivedDuringTurn.energy) + ")");
			this.canvas.font = '10px sans-serif';
			this.canvas.fillText(text, entity.position.x * 15 + 10, entity.position.y * 15 + 3);
			
			// Draw the pulseRadius around element
			this.canvas.beginPath();
			this.canvas.arc(entity.position.x * 15, entity.position.y * 15, entity.pulseRadius * 15,entity.position.y, entity.pulseRadius * 15,Math.PI*2,true);
			this.canvas.closePath();
			this.canvas.fillStyle = "rgba(0,0,0,0.1)";  
			this.canvas.fill();
		}
		// Render the selection Bounding Box
		if (this.energia.input.mouseDownPosition.x != -1) {
			this.canvas.fillStyle = "#000000";
			this.canvas.strokeRect(
				this.energia.input.mouseDownPosition.x, 
				this.energia.input.mouseDownPosition.y,
				(this.energia.input.mouseCurrentPosition.x - this.energia.input.mouseDownPosition.x), 
				(this.energia.input.mouseCurrentPosition.y - this.energia.input.mouseDownPosition.y)
			);
		}
		// Render context menu, if useful
		var contextMenu = $("#energia_renderer_contextmenu");
		if (!contextMenu.length) {
			var contextMenuHTML = "<button>Selfdestruct</button>";
			contextMenu = $("<div>", { id: "energia_renderer_contextmenu" });
			contextMenu.html(contextMenuHTML);
			contextMenu.find("button").on("click", function() { this.energia.removeEntities(this.energia.getSelectedEntities()); }.bind(this));
			contextMenu.on("click", function(event) { event.preventDefault(); event.stopPropagation(); });
			this.canvasContainer.append(contextMenu);
		}
		if (this.energia.selectedEntities.length) {
			contextMenu.fadeIn();
		} else {
			contextMenu.fadeOut();
		}
	},
	onEntitiesRemoved : function(entities) {
		for(entityNo in entities) {
			$("#energia_entity_"+entities[entityNo]).remove();
		}
	}
});

// Input
Energia.input = Class.$extend({
	__init__ : function(canvasContainer) {
		this.canvasContainer = $(canvasContainer);
		// Set listener on document
		$(this.canvasContainer).on("click", this.processInput.bind(this));
		$(this.canvasContainer).on("mousedown", this.setMouseDownPosition.bind(this));
		$(this.canvasContainer).on("mousemove", this.setMouseCurrentPosition.bind(this));
		$(this.canvasContainer).on("contextmenu", this.onContextMenu.bind(this));
	},
	info : "Default input",
	canvasContainer : null,
	energia : null,
	mouseDownPosition : {x:-1,y:-1},
	setMouseDownPosition : function(event) {
		// If left click, then remember the mouseDown
		// left button == 1
		// center button = 2
		// right button == 3
		if (event.which == 1) {
			this.mouseDownPosition.x = event.offsetX;
			this.mouseDownPosition.y = event.offsetY;
		}
	},
	mouseCurrentPosition : {x:-1,y:-1},
	setMouseCurrentPosition : function(event) {
		// Set the current mouse position
		this.mouseCurrentPosition.x = event.offsetX;
		this.mouseCurrentPosition.y = event.offsetY;
		// If we need to draw a bounding box, do it right now. Somehow, this is faster than waiting for the requestAnimFrame()
		if (this.mouseDownPosition.x != -1) {
			this.energia.renderer.render.bind(this.energia.renderer)();
		}
	},
	onContextMenu : function(event) {
		// Pass right-click event to processInput function
		this.processInput(event);
		// Do not show any browser-contextmenu
		return false;
	},
	processInput : function(event) {
		// If left click, then select or deslect
		// left button == 1
		// center button = 2
		// right button == 3
		if (event.which == 1) {
			// If the user did not draw a 'substantial' bounding box, just select one entity
			if (energia.distance(this.mouseDownPosition, this.mouseCurrentPosition) < 5) {
				// Find the element at this position
				var x = event.offsetX;
				var y = event.offsetY;
				var closestDistance, closestEntityID = null;
				for (entityID in this.energia.entities) {
					var entity = energia.entities[entityID];
					var x2 = entity.position.x * 15; // 15px per in-game meter
					var y2 = entity.position.y * 15; // 15px per in-game meter
					var distanceToEvent = energia.distance({x:x2,y:y2}, {x:x,y:y});
					if (closestDistance == null || distanceToEvent < closestDistance) {
						closestDistance = distanceToEvent;
						closestEntityID = entityID;
					}
				}
				if (closestDistance > 30) {
					// Deselect any selected entities
					this.energia.setSelectedEntities([]);
				} else {
					// Select the closest entity
					this.energia.setSelectedEntities([closestEntityID]);
				}
			} else {
				// User did draw a bounding box, so select all entities within the box
				var x1 = this.mouseDownPosition.x;
				var x2 = event.offsetX;
				var y1 = this.mouseDownPosition.y;
				var y2 = event.offsetY;
				selectedEntities = [];
				for (entityID in this.energia.entities) {
					var entity = energia.entities[entityID];
					var ex = entity.position.x * 15; // 15px per in-game meter
					var ey = entity.position.y * 15; // 15px per in-game meter
					if ( ((ex > x1 && ex < x2) || (ex < x1 && ex > x2)) &&
					((ey > y1 && ey < y2) || (ey < y1 && ey > y2)) ){
						selectedEntities.push(entityID);
					}					
				}
				if (selectedEntities.size == 0) {
					// Deselect any selected entities
					this.energia.setSelectedEntities([]);
				} else {
					// Select the closest entity
					this.energia.setSelectedEntities(selectedEntities);
				}
			}
		} else if (event.which == 3) {
			// Make the selected entities move to the specified event.position
			if (this.energia.getSelectedEntities() != null) {
				this.energia.setWayPointForEntities(this.energia.getSelectedEntities(), event.offsetX / 15, event.offsetY / 15);
			}
		}
		// Prevent default action
		event.preventDefault();
		event.stopPropagation();
		// Reset the mouseDownPosition
		this.mouseDownPosition = { x:-1, y:-1 };
		return false;
	}
});