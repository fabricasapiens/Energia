// Renderer
Energia.renderer3D = Class.$extend({
	__init__ : function(canvasElement) {
		// Set canvas
		this.canvasContainer = $(canvasElement);
		// Create canvas element
		this.renderer = new THREE.WebGLRenderer({
                    antialias : true,	// to get smoother output
                    preserveDrawingBuffer : true	// to allow screenshot
                });
                this.renderer.setClearColorHex( 0xFFFFFF, 1 );
                this.renderer.shadowMapEnabled = true;
                this.renderer.shadowMapSoft = true;
                // Set size and attach to container
                this.renderer.setSize( this.canvasContainer.width(), this.canvasContainer.height() );
                this.canvasContainer.append(this.renderer.domElement);
                
                // create a scene
                this.scene = new THREE.Scene();
                
                // Ambient light
                var ambientLight = new THREE.AmbientLight( 0xffffff );
                this.scene.add ( ambientLight );
                
                // Shadow light
                var spotLight = new THREE.SpotLight( 0xffffcc );
                spotLight.position.set( -100, 100, 100 );
                spotLight.target.position.set( 0, 0, 0 );
                spotLight.castShadow = true;
                spotLight.shadowMapHeight = 2048;
                spotLight.shadowMapWidth = 1024;
                this.scene.add( spotLight );

                // put a camera in the scene
                this.camera = new THREE.PerspectiveCamera(50, this.canvasContainer.width() / this.canvasContainer.height(), 1, 1000000 );
                this.camera.rotation.x = 0.5;
                this.camera.position.set(0, 0, 20);
                this.scene.add(this.camera);
                
                // Set up Three.js DOM Events with the proper camera
                THREE.Object3D._threexDomEvent.camera(this.camera);
                
                this.cameraTarget = { x : this.camera.position.x, y : this.camera.position.y };
                
                /*
                // transparently support window resize
                THREEx.WindowResize.bind(renderer, camera);
                // allow 'p' to make screenshot
                THREEx.Screenshot.bindKey(renderer);
                // allow 'f' to go fullscreen where this feature is supported
                if( THREEx.FullScreen.available() ){
                        THREEx.FullScreen.bindKey();				
                }else{
                        document.getElementById('fullscreenDoc').style.display	= "none";				
                }*/
            
                // add Stats.js - https://github.com/mrdoob/stats.js
                this.stats = new Stats();
                this.stats.domElement.style.position	= 'absolute';
                this.stats.domElement.style.bottom	= '0px';
                document.body.appendChild( this.stats.domElement )
            
                // Add ground plane
                var geometry = new THREE.PlaneGeometry( 1000, 1000 );
                var material = new THREE.MeshBasicMaterial( { color: 0xeeeeee } );
                var ground = new THREE.Mesh( geometry, material );
                ground.receiveShadow = true;
                this.scene.add( ground );
                
		// Fake the requestAnimationFrame
		window.requestAnimFrame = (function(){
			return  window.requestAnimationFrame       || 
			window.webkitRequestAnimationFrame || 
			window.mozRequestAnimationFrame    || 
			window.oRequestAnimationFrame      || 
			window.msRequestAnimationFrame     || 
			function(callback){
				window.setTimeout(callback, 1000 / 60);
			};
		})();
	},
	info : "Default 3D Three.js renderer",
	canvasContainer : null,
        scene : null,
        renderer : null,
        stats : null,
        camera : null,
        cameraTarget : null,
	energia : null,
	doRender : false,
	startRender : function() {
		// Set doRender to true. If doRender is false, the render cycle will not initiate a new cycle
		this.doRender = true;
		// Initiate the render-cyclus
		// Request requestAnimationFrame on the DOM canvas element, to make the browser call this.render when this.canvas will be redrawn
		requestAnimFrame(this.loopRender.bind(this));
	},
	stopRender : function() {
		this.doRender = false;
	},
	loopRender : function() {
		this.render.bind(this)();
                this.stats.update();
		requestAnimFrame(this.loopRender.bind(this));
	},
	render : function() {
            this.renderer.render(this.scene, this.camera);
            if (this.cameraTarget.x != this.camera.position.x) {
                this.camera.position.x = this.camera.position.x + (this.cameraTarget.x - this.camera.position.x)/5;
            }
            if (this.cameraTarget.y != this.camera.position.y) {
                this.camera.position.y = this.camera.position.y + (this.cameraTarget.y - this.camera.position.y)/5;
            }
            // Render entities
            for(var entityID in this.energia.entities) {
                // Render it on the screen with its amount of energy
                var entity = this.energia.entities[entityID];
                // Add cube to entity if it was not already there
                if (entity.renderer3Dmesh == undefined) {
                    var cube = new THREE.Mesh( 
                        new THREE.CubeGeometry( 2, 2, 2 ),
                        new THREE.MeshLambertMaterial({color:0xffffff})
                    );
                    cube.castShadow = true;
                    cube.receiveShadow = true;
                    cube.normalMaterial = new THREE.MeshLambertMaterial({color:0xffffff});
                    cube.selectedMaterial = new THREE.MeshLambertMaterial( { color: 0xaaaaff } );
                    cube.position.x = entity.position.x;
                    cube.position.y = entity.position.y;
                    cube.position.z = 1;
                    cube.hovered = false;
                    // Events on the mesh
                    cube.on('mouseover', function(event){
                        event.target.hovered = true;
                    });
                    cube.on('mouseout', function(event){
                        event.target.hovered = false;
                    });
                    entity.renderer3Dmesh = cube;
                    this.scene.add( cube );
                }
                // Select color for entity
                if (entity instanceof this.energia.Producer) {
                        entity.renderer3Dmesh.material.color.setHex( 0xff0000 );
                } else {
                        entity.renderer3Dmesh.material.color.setHex( 0x000000 );
                }
                // Make selected entities white
                if (entity.renderer3Dmesh.hovered == true || this.energia.selectedEntities.indexOf(entityID) != -1)
                {
                        entity.renderer3Dmesh.material.color.setHex( 0xffffff );
                }
                
            }
            /*
            // Render the selection Bounding Box
            if (this.energia.input.mouseDownPosition.x != -1) {
                    this.canvas.fillStyle = "#000000";
                    this.canvas.strokeRect(
                            this.energia.input.mouseDownPosition.x, 
                            this.energia.input.mouseDownPosition.y,
                            (this.energia.input.mouseCurrentPosition.x - this.energia.input.mouseDownPosition.x), 
                            (this.energia.input.mouseCurrentPosition.y - this.energia.input.mouseDownPosition.y)
                    );
            }*/
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
Energia.input3D = Class.$extend({
	__init__ : function(canvasContainer) {
		this.canvasContainer = $(canvasContainer);
		// Set listener on document
		$(this.canvasContainer).on("click", this.processMouseInput.bind(this));
		$(this.canvasContainer).on("mousedown", this.setMouseDownPosition.bind(this));
		$(this.canvasContainer).on("mousemove", this.setMouseCurrentPosition.bind(this));
		$(this.canvasContainer).on("contextmenu", this.onContextMenu.bind(this));
                // Key listeners to move the camera
                $(document).on("keyup", this.processKeyInput.bind(this));
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
		this.processMouseInput(event);
		// Do not show any browser-contextmenu
		return false;
	},
	processMouseInput : function(event) {
		// If left click, then select or deslect
		// left button == 1
		// center button = 2
		// right button == 3
		if (event.which == 1) {
			// If the user did not draw a 'substantial' bounding box, just select one entity
			if (this.energia.distance(this.mouseDownPosition, this.mouseCurrentPosition) < 5) {
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
	},
        processKeyInput : function(event) {
            if (event.keyCode == 37) {
                this.energia.renderer.cameraTarget.x -= 10;
            } else if (event.keyCode == 38) {
                this.energia.renderer.cameraTarget.y += 10;
            } else if (event.keyCode == 39) {
                this.energia.renderer.cameraTarget.x += 10;
            } else if (event.keyCode == 40) {
                this.energia.renderer.cameraTarget.y -= 10;
            }            
        }
});