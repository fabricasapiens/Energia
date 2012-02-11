// Renderer
Energia.renderer2D = Class.$extend({
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
Energia.input2D = Class.$extend({
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
			// If Control is down, *add* the waypoint. Otherwise, *replace* the waypoints
			if (event.ctrlKey) {
				// Make the selected entities move to the specified event.position
				if (this.energia.getSelectedEntities() != null) {
					this.energia.addWayPointForEntities(this.energia.getSelectedEntities(), event.offsetX / 15, event.offsetY / 15);
				}
			} else {
				// Make the selected entities move to the specified event.position
				if (this.energia.getSelectedEntities() != null) {
					this.energia.setWayPointForEntities(this.energia.getSelectedEntities(), event.offsetX / 15, event.offsetY / 15);
				}
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