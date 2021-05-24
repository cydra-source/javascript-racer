function racer(gamemode) {
    var fps = 60;                      // how many 'update' frames per second
    var step = 1 / fps;                   // how long is each frame (in seconds)
    var width = 1024;                    // logical canvas width
    var height = 768;                     // logical canvas height
    var segments = [];                      // array of road segments

    var canvas = Dom.get('canvas');       // our canvas...
    var ctx = canvas.getContext('2d'); // ...and its drawing context
 
    var roadWidth = 2000;                    // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
    var segmentLength = 200;                     // length of a single segment
    var rumbleLength = 3;                       // number of segments per red/white rumble strip
    var trackLength = null;                    // z length of entire track (computed)
    var lanes = 3;                       // number of lanes
    var fieldOfView = 100;                     // angle (degrees) for field of view
    var cameraHeight = 1000;                    // z height of camera
    var cameraDepth = null;                    // z distance camera is from screen (computed)
    var drawDistance = 300;                     // number of segments to draw
    var playerX = 0;                       // player x offset from center of road (-1 to 1 to stay independent of roadWidth)
    var playerZ = null;                    // player relative z distance from camera (computed)
    var fogDensity = 5;                       // exponential fog density
    var position = 0;                       // current camera Z position (add playerZ to get player's absolute Z position)
    var speed = 0;                       // current speed
    var maxSpeed = segmentLength / step;      // top speed (ensure we can't move more than 1 segment in a single frame to make collision detection easier)
    var accel = maxSpeed / 5;             // acceleration rate - tuned until it 'felt' right
    var breaking = -maxSpeed;               // deceleration rate when braking
    var decel = -maxSpeed / 5;             // 'natural' deceleration rate when neither accelerating, nor braking
 
    var currentLapTime = 0;                       // current lap time
  
    var randomTrack = true;                     // enable random procedural generation of the track
    var randomTrackLength = 5;                  // if random track is enable, how many track segments/constructs to build?
    //var gamemode = 1;                               // Gamemode: 0: fastest lap, 1: out of time DEPRECATED: defined as argument now

    // Gamemode 1: out of time
    var remainingTime = 0;                         // internal variable - remaining time left to pass the next finish line or it's game over, will be calculated automatically
  
    var remainingTimeIncrease = 0.00009;                      // Multiplier of the trackLength to get seconds that will be added to the remainingTime, in other words this defines the time left to the player to finish the track proportionally to the track length (a higher value makes the game easier)
    var remainingTimeStartBonus = 2.0;                      // Multiplier of the remaining time given for the first level (to make game easier for newscomers), also because the player has no momentum at the beginning
    var remainingTimeThreshold = 20;      // When only this amount of time is left, the remaining time HUD will be highlighted (set to 0 to disable)
    var currentLevel = 0;                           // Internal variable, just a value to display the current level
    var gameOverFlag = false;                       // this flag will be set if game over was triggered

    var keyLeft = false;
    var keyRight = false;
    var keyFaster = false;
    var keySlower = false;

    // Add variables to update HUD
    var hud = {
        speed: { value: null, dom: Dom.get('speed_value') },
        current_lap_time: { value: null, dom: Dom.get('current_lap_time_value') },
        current_level: { value: null, dom: Dom.get('current_level_value') },
        remaining_time: { value: null, dom: Dom.get('remaining_time_value') },
        last_lap_time: { value: null, dom: Dom.get('last_lap_time_value') },
        fast_lap_time: { value: null, dom: Dom.get('fast_lap_time_value') },
    }

    if (gamemode == 1) {
        // Out of time gamemode-only HUD elements
        hud["turbo_left"] = { value: null, dom: Dom.get('turbo_left_value') }
    }


    //=========================================================================
    // UPDATE THE GAME HUD AND ADD GAME OVER IF PLAYER RUNS OUT OF TIME
    //=========================================================================


        if (!gameOverFlag) { //add game over screen
            if (keyLeft)
                playerX = playerX - dx;
            else if (keyRight)
                playerX = playerX + dx;
        }


        if (!gameOverFlag) {
            if (keyFaster)
                speed = Util.accelerate(speed, accel, dt);
            else if (keySlower)
                speed = Util.accelerate(speed, breaking, dt);
            else
                speed = Util.accelerate(speed, decel, dt);
        } else { // game over flag, just decelerate the car until full stop
            speed = Util.accelerate(speed, decel, dt);
        }



        for (n = 0; n < playerSegment.cars.length; n++) {
            car = playerSegment.cars[n];
            carW = car.sprite.w * SPRITES.SCALE;
            if (speed > car.speed) {
                if (Util.overlap(playerX, playerW, car.offset, carW, 0.8)) {
                    speed = car.speed * (car.speed / speed);
                    position = Util.increase(car.z, -playerZ, trackLength);
                    break;
                }
            }
        }


        if (position > playerZ) {
            if (currentLapTime && (startPosition < playerZ)) { // arrived at finish line, update last lap time + generate new track if enabled
                if (gamemode == 1) { // Out of time gamemode

                    // Give the player some more time
                    var remainingTimePast = remainingTime;
                    remainingTime += trackLength * remainingTimeIncrease;
                    if ((remainingTimePast < remainingTimeThreshold) & (remainingTime > remainingTimeThreshold)) {
                        Dom.removeClassName('remaining_time_value', 'warninglow'); // remove any warning if there was one
                        Dom.addClassName('remaining_time_value', 'value');
                    }

            } else {
                // Else we are not yet at the finish line, we increase the time/decrease remaining time
                currentLapTime += dt;
                if (remainingTime > 0) {
                    remainingTime -= dt;
                } else {
                    remainingTime = 0;
                    if (currentLevel == 0) { // first level, we give some time to the player
                        remainingTime += trackLength * remainingTimeIncrease * remainingTimeStartBonus;
                    }
                }

                // Highlight remaining time if quite low
                if ((gamemode == 1) & (remainingTime < remainingTimeThreshold)) {
                    Dom.removeClassName('remaining_time_value', 'value');
                    Dom.addClassName('remaining_time_value', 'warninglow');
                }


        // Update HUD
        updateHud('speed', 5 * Math.round(speed / 500));
        if (gamemode == 1) {
            updateHud('remaining_time', formatTime(remainingTime));
            updateHud('current_level', currentLevel);
            updateHud('turbo_left', turboLeft);
        } else {
            updateHud('current_lap_time', formatTime(currentLapTime));
        }
    }


    //-------------------------------------------------------------------------

    function updateHud(key, value) { // Only changing the hud if values have changed
        if (hud[key].value !== value) {
            hud[key].value = value;
            Dom.set(hud[key].dom, value);
        }
    }

    function formatTime(dt) {
        var minutes = Math.floor(dt / 60);
        var seconds = Math.floor(dt - (minutes * 60));
        var tenths = Math.floor(10 * (dt - Math.floor(dt)));
        if (minutes > 0)
            return minutes + "." + (seconds < 10 ? "0" : "") + seconds + "." + tenths;
        else
            return seconds + "." + tenths;
    }


   

        // Draw "Game Over" screen
        if (gameOverFlag) {
            ctx.font = "3em Arial";
            ctx.fillStyle = "magenta";
            ctx.textAlign = "center";
            ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
            ctx.fillText("(Refresh to restart, try to get to the finish faster!)", canvas.width / 2, canvas.height / 1.5);
        }
    }

    function findSegment(z) {
        return segments[Math.floor(z / segmentLength) % segments.length];
    }


   
    function reset(options) {
        options = options || {};
        canvas.width = width = Util.toInt(options.width, width);
        canvas.height = height = Util.toInt(options.height, height);
        lanes = Util.toInt(options.lanes, lanes);
        roadWidth = Util.toInt(options.roadWidth, roadWidth);
        cameraHeight = Util.toInt(options.cameraHeight, cameraHeight);
        drawDistance = Util.toInt(options.drawDistance, drawDistance);
        fogDensity = Util.toInt(options.fogDensity, fogDensity);
        fieldOfView = Util.toInt(options.fieldOfView, fieldOfView);
        segmentLength = Util.toInt(options.segmentLength, segmentLength);
        rumbleLength = Util.toInt(options.rumbleLength, rumbleLength);
        cameraDepth = 1 / Math.tan((fieldOfView / 2) * Math.PI / 180);
        playerZ = (cameraHeight * cameraDepth);
        resolution = height / 480;
        refreshTweakUI();

        if ((segments.length == 0) || (options.segmentLength) || (options.rumbleLength)) {
            resetRoad(randomTrack, randomTrackLength); // only rebuild road when necessary
            resetCars();
        }
    }

    function updateFOV(fov) {
        cameraDepth = 1 / Math.tan((fov / 2) * Math.PI / 180);
        playerZ = (cameraHeight * cameraDepth);
    }

    //=========================================================================
    // Add FullScreen Mode
    //=========================================================================

    Dom.on('resolution', 'change', function (ev) {
        var w, h, ratio;
        switch (ev.target.options[ev.target.selectedIndex].value) {
            case 'fine': w = 1280; h = 960; ratio = w / width; break;
            case 'high': w = 1024; h = 768; ratio = w / width; break;
            case 'medium': w = 640; h = 480; ratio = w / width; break;
            case 'low': w = 480; h = 360; ratio = w / width; break;
        }
        reset({ width: w, height: h })
        Dom.blur(ev);
    });

    Dom.on('lanes', 'change', function (ev) { Dom.blur(ev); reset({ lanes: ev.target.options[ev.target.selectedIndex].value }); });
    Dom.on('roadWidth', 'change', function (ev) { Dom.blur(ev); reset({ roadWidth: Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max'))) }); });
    Dom.on('cameraHeight', 'change', function (ev) { Dom.blur(ev); reset({ cameraHeight: Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max'))) }); });
    Dom.on('drawDistance', 'change', function (ev) { Dom.blur(ev); reset({ drawDistance: Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max'))) }); });
    Dom.on('fieldOfView', 'change', function (ev) { Dom.blur(ev); reset({ fieldOfView: Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max'))) }); });
    Dom.on('fogDensity', 'change', function (ev) { Dom.blur(ev); reset({ fogDensity: Util.limit(Util.toInt(ev.target.value), Util.toInt(ev.target.getAttribute('min')), Util.toInt(ev.target.getAttribute('max'))) }); });

    function refreshTweakUI() {
        Dom.get('lanes').selectedIndex = lanes - 1;
        Dom.get('currentRoadWidth').innerHTML = Dom.get('roadWidth').value = roadWidth;
        Dom.get('currentCameraHeight').innerHTML = Dom.get('cameraHeight').value = cameraHeight;
        Dom.get('currentDrawDistance').innerHTML = Dom.get('drawDistance').value = drawDistance;
        Dom.get('currentFieldOfView').innerHTML = Dom.get('fieldOfView').value = fieldOfView;
        Dom.get('currentFogDensity').innerHTML = Dom.get('fogDensity').value = fogDensity;
    }

    function fullscreenOnClick() {
        // Manage full screen mode on double click
        // from: https://www.sitepoint.com/use-html5-full-screen-api/
        if (document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.mozFullScreenElement ||
            document.msFullscreenElement
        ) {
            // exit full-screen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        } else {
            // go full-screen
            var e = document.getElementById('canvas');
            if (e.requestFullscreen) {
                e.requestFullscreen();
            } else if (e.webkitRequestFullscreen) {
                e.webkitRequestFullscreen();
            } else if (e.mozRequestFullScreen) {
                e.mozRequestFullScreen();
            } else if (e.msRequestFullscreen) {
                e.msRequestFullscreen();
            }
        }
    }

