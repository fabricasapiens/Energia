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
				this.moveable = false;
				this.wayPoints = [];
				this.maxSpeed = 0; // in-game meters per second
				this.resources = { energy: 0, yellow: 0 };
				this.pulseRadius = 0; // in-game meters
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
			
			canMove : function() {
				return this.moveable;
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
		
		this.Car = this.Consumer.$extend({
			__init__ : function() {
				this.$super();
				this.moveable = true;
				this.pulseRadius = 5;
				this.maxSpeed = 20;
			},
			
			getConsumption : function(resource) {
				if (resource == "energy") {
					// Uses very few energy when standing still, but uses more energy when moving
					if (this.wayPoints != undefined  && this.wayPoints.length > 0) {
						return 5;
					} else {
						return 1;
					}
				} else {
					return 0;
				}
			},
		});
		
		this.MiddleStation = this.Consumer.$extend({
			__init__ : function() {
				this.$super();
				this.moveable = false;
				this.pulseRadius = 15;
			},
			
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
		
			__init__ : function() {
				this.$super();
				this.moveable = false;
				this.pulseRadius = 30;
			},
			
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
		// And another row, but this time of Cars
		for (var a = 0; a < 5; a++) {
			this.addEntities([
				new this.Car().fillData(
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
				// TODO: remove it from all places where a pointer to this entity exists (e.g. selected entities)
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
	
	addWayPointForEntities : function(entities, x, y) {
		// Add waypoints to the entities
		for(i in entities) {
			var entityID = entities[i];
			var entity = this.getEntity(entityID);
			// Only set waypoints for entities that move
			if (entity.canMove()) {
				entity.wayPoints.push({x:x,y:y});
			}
		}
	},
	
	setWayPointForEntities : function(entities, x, y) {
		// Add waypoints to the entities
		for(i in entities) {
			var entityID = entities[i];
			var entity = this.getEntity(entityID);
			// Only set waypoints for entities that move
			if (entity.canMove()) {
				entity.wayPoints = [{x:x,y:y}];
			}
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
			if (entity.wayPoints != undefined && entity.wayPoints.length > 0) {
				// Calculate max distance that entities can move this turn
				var maxDistance = entity.maxSpeed * secondsThatHavePassed;
				// Calculate direction in which entity should go
				var dx = entity.wayPoints[0].x - entity.position.x;
				var dy = entity.wayPoints[0].y - entity.position.y;
				// Calculate in which ratio the entity should move to x or y (1 is max in that direction)
				// TODO: make this fair. Right now, the 'distance-box' around the starting point is square-shaped, while it should be round
				if (dx == 0) {
					var ratioX = 1;
					var ratioY = 1;
				} else {
					var ratioX = Math.abs(dx / (Math.abs(dx) + Math.abs(dy)));
					var ratioY = 1 - ratioX;
				}
				// Calculate how much entity will move in both directions
				var moveX = (dx < 0 ? maxDistance * ratioX * -1 : maxDistance * ratioX);
				var moveY = (dy < 0 ? maxDistance * ratioY * -1 : maxDistance * ratioY);
				// Check if the entity won't surpass it's destination
				if (Math.abs(moveX) > Math.abs(dx)) { 
					moveX = dx;
				}
				if (Math.abs(moveY) > Math.abs(dy)) { 
					moveY = dy;
				}
				if(moveX === dx && moveY === dy) {
					// Entity will arrive at its location, thus we can remove the waypoint for that location
					entity.wayPoints.shift(); // Remove first element
				}
				// Move entity
				entity.position.x += moveX;
				entity.position.y += moveY;
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