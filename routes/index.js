var express = require('express');
var router  = express.Router();
var PF = require('pathfinding');
var floodFill = require('n-dimensional-flood-fill');
var dist = require('manhattan');

// handle POST request to '/start'
router.post('/start', function (req, res) {  
    // response data
    var data = {
        color: '#FF69B4',
        name: 'Shiffany',
        secondary_color: '#CD5C5C',
        head_url: 'https://sdevalapurkar.github.io/personal-website/img/Shiffany.png',
        tail_type: 'curled',
        head_type: 'bendr',
        taunt: 'I am cuter than you',
    };

    return res.json(data);
});


// handle POST request to '/move'
router.post('/move', function (req, res) {
    // generate a move
    var generatedMove = generateMove(req);

    // response data
    var taunts = ['Hey there gorgeoussssss', 'Get Shift done!', 'Shiffannnnnyyyyyyy'];
    var data = {
        move: generatedMove,
        taunt: taunts[Math.floor(Math.random()*taunts.length)]
    };

    return res.json(data);
});


// generate a move
function generateMove(req) {
    var generatedMove = undefined;
    var possibleMoves = ['up', 'down', 'left', 'right'];
    var grid = new PF.Grid(req.body.width, req.body.height);
    var cornerMove = checkCorners(req.body);

    var otherSnakeHeads = [];
    var updatedOtherSnakeHeads = [];
    otherSnakeHeads = storeHeadsOfOtherSnakes(req.body.snakes.data, otherSnakeHeads, req.body.you.id);
    updatedOtherSnakeHeads = appendFakeHeadsToSnakes(otherSnakeHeads, updatedOtherSnakeHeads, req.body);

    var markedGrid = setUnwalkableGridAreas(req.body.you.body.data, grid.clone(), req.body.snakes.data, updatedOtherSnakeHeads);
    markedGrid = setWalkableGridAreas(markedGrid.clone(), req.body.you.body.data, req.body.snakes.data, req.body.you.id);

    var floodFillGrid = createEmptyFFGrid(req.body, []);
    floodFillGrid = initializeFFGrid(markedGrid.clone(), floodFillGrid);

    possibleMoves = checkWalls(req.body, possibleMoves);
    possibleMoves = removeSnakeCollisionMoves(possibleMoves, floodFillGrid, req.body.you.body.data);
    if (req.body.you.health > 15) {
        possibleMoves = removeDangerousWalls(possibleMoves, req.body.you.body.data, req.body);
    }

    var floodFillResults = [];
    var seed, result;
    var getter = function (x, y) { return floodFillGrid[y][x]; };
    floodFillResults = performFloodFill(possibleMoves, req.body.you.body.data, seed, result, getter, floodFillResults, req.body);

    var bestFloodFillMove = getBestFloodFillMove(floodFillResults, floodFillResults[0].floodLengthLimited, floodFillResults[0].floodLength);
    var closestFood = foodSearch(req.body);
    var foodMove = pathToFood(closestFood, req.body, markedGrid.clone(), floodFillResults, bestFloodFillMove);
    var tailMove = pathToTail(req.body, markedGrid.clone(), possibleMoves, bestFloodFillMove);
    
    if (cornerMove !== false) {
        generatedMove = cornerMove;
    } else if (req.body.you.health < 25 && pathToFood(closestFood, req.body, markedGrid.clone(), floodFillResults, []) !== false && pathToFood(closestFood, req.body, markedGrid.clone(), floodFillResults, []) !== undefined) {
        generatedMove = pathToFood(closestFood, req.body, markedGrid.clone(), floodFillResults, []);
    } else if (closestFood[0] < 5 && foodMove !== false && foodMove !== undefined) {
        generatedMove = foodMove;
    } else if (tailMove !== false && tailMove !== undefined) {
        generatedMove = tailMove;
    } else {
        generatedMove = lastMinuteMoveChoice(bestFloodFillMove);
    }

    return generatedMove;
}


// function to check if we are at a corner of the game board
function checkCorners(data) {
    var bodyData = data.you.body.data;
    if (bodyData[0].x === 0 && bodyData[0].y === 0) {
        if (bodyData[1].y === 1) {
            return 'right';
        } else if (bodyData[1].x === 1) {
            return 'down';
        }
    } else if (bodyData[0].x === data.width - 1 && bodyData[0].y === 0) {
        if (bodyData[1].x === data.width - 2) {
            return 'down';
        } else if (bodyData[1].y === 1) {
            return 'left';
        }
    } else if (bodyData[0].x === 0 && bodyData[0].y === data.height - 1) {
        if (bodyData[1].y === data.height - 2) {
            return 'right';
        } else if (bodyData[1].x === 1) {
            return 'up';
        }
    } else if (bodyData[0].x === data.width - 1 && bodyData[0].y === data.height - 1) {
        if (bodyData[1].y === data.height - 2) {
            return 'left';
        } else if (bodyData[1].x === data.width - 2) {
            return 'up';
        }
    } else {
        return false;
    }
}


// function to store all the head and tail locations of other snakes
function storeHeadsOfOtherSnakes(snakes, otherSnakeHeads, myID) {
    snakes.forEach(function (snake) {
        if (snake.id !== myID) {
            otherSnakeHeads.push({ 
                x: snake.body.data[0].x,
                y: snake.body.data[0].y,
                length: snake.length, id: snake.id
            });
        }
    });
    return otherSnakeHeads;
}


// append fake heads to each of the heads of the other snakes
function appendFakeHeadsToSnakes(otherSnakeHeads, updatedOtherSnakeHeads, bodyParam) {
    otherSnakeHeads.forEach(function (object) {
        if (object.x - 1 >= 0) {
            updatedOtherSnakeHeads.push({
                x: object.x - 1,
                y: object.y 
            });
        }
        if (object.x + 1 < bodyParam.width) {
            updatedOtherSnakeHeads.push({
                x: object.x + 1,
                y: object.y
            }); 
        } 
        if (object.y - 1 >= 0) {
            updatedOtherSnakeHeads.push({
                x: object.x,
                y: object.y - 1
            }); 
        } 
        if (object.y + 1 < bodyParam.height) {
            updatedOtherSnakeHeads.push({
                x: object.x,
                y: object.y + 1
            }); 
        } 
    });

    // also push all values in othersnakeshead into updatedothersnakeshead 
    otherSnakeHeads.forEach(function (object) { 
        updatedOtherSnakeHeads.push(object);
    });
    return updatedOtherSnakeHeads;
}


// mark all the unwalkable parts of the grid
function setUnwalkableGridAreas(body, backupGrid, snakes, updatedOtherSnakeHeads) {
    body.forEach(function (object) {
        backupGrid.setWalkableAt(object.x, object.y, false);
    });

    snakes.forEach(function (snake) {
        snake.body.data.forEach(function (object) {
            backupGrid.setWalkableAt(object.x, object.y, false);
        });
    });
  
    updatedOtherSnakeHeads.forEach(function (head) {
        backupGrid.setWalkableAt(head.x, head.y, false);
    });
    return backupGrid;
}


// mark all the walkable parts of the grid
function setWalkableGridAreas(backupGrid, body, snakes, myID) {
    // set all locations where my body or other snakes' bodies will disappear as walkable
    snakes.forEach(function (snake) {
        if (snake.id !== myID && snake.health !== 100) {
            snake.body.data.reverse().forEach(function (object, index) {
                if (dist([body[0].x, body[0].y], [object.x, object.y]) > index) {
                    backupGrid.setWalkableAt(object.x, object.y, true);
                }
            });
        } else {
            if (snake.health < 100) {
                snake.body.data.reverse().forEach(function (object, index) {
                    if (dist([body[0].x, body[0].y], [object.x, object.y]) > index) {
                        backupGrid.setWalkableAt(object.x, object.y, true);
                    }
                });
            }
        }
    });
    return backupGrid;
}


// create the empty flood fill grid
function createEmptyFFGrid(bodyParam, gridData) {
    for (var j = 0; j < bodyParam.height; j++) {
        var row = [];
        for (var k = 0; k < bodyParam.width; k++) {
            row.push(1);
        }
        gridData.push(row);
    }
    return gridData;
}


// initialize the grid for flood fill
function initializeFFGrid(backupGrid, gridData) {
    backupGrid.nodes.forEach(function (node) {
        node.forEach(function (object) {
            gridData[object.x] = gridData[object.x] || [];
            if (!object.walkable) {
                gridData[object.y][object.x] = 0; // 0 in the grid marks an unwalkable location
            }
        });
    });
    return gridData;
}


// update possible moves based on where we are and where other snakes are
function removeSnakeCollisionMoves(possibleMoves, gridData, body) {
    if (possibleMoves.includes('left') && gridData[body[0].y][body[0].x - 1] !== 1) {
        possibleMoves = removeElement(possibleMoves, 'left');
    }
    if (possibleMoves.includes('right') && gridData[body[0].y][body[0].x + 1] !== 1) {
        possibleMoves = removeElement(possibleMoves, 'right');
    } 
    if (possibleMoves.includes('up') && (gridData[body[0].y - 1]) !== undefined && gridData[body[0].y - 1][body[0].x] !== 1) {
        possibleMoves = removeElement(possibleMoves, 'up');
    } 
    if (possibleMoves.includes('down') && (gridData[body[0].y + 1]) !== undefined && gridData[body[0].y + 1][body[0].x] !== 1) {
        possibleMoves = removeElement(possibleMoves, 'down');
    }
    return possibleMoves;
}

// update possible moves based on if going near a wall is dangerous
function removeDangerousWalls(possibleMoves, body, board) {
    if (possibleMoves.includes('left') && body[0].x - 1 === 0) {
        if (possibleMoves.length !== 1) {
            removeElement(possibleMoves, 'left');
        }
    }
    if (possibleMoves.includes('right') && body[0].x + 1 === board.width - 1) {
        if (possibleMoves.length !== 1) {
            removeElement(possibleMoves, 'right');
        }
    }
    if (possibleMoves.includes('up') && body[0].y - 1 === 0) {
        if (possibleMoves.length !== 1) {
            removeElement(possibleMoves, 'up');
        }
    }
    if (possibleMoves.includes('down') && body[0].y + 1 === board.height - 1) {
        if (possibleMoves.length !== 1) {
            removeElement(possibleMoves, 'down');
        }
    }
    return possibleMoves;
}


// check if we are at a wall
function checkWalls(data, possibleMoves) {
    var bodyData = data.you.body.data;
    if (bodyData[0].x === 0) {
        if (bodyData[1].x === 1) {
            return ['up', 'down'];
        } else if (bodyData[1].y === bodyData[0].y - 1) {
            return ['right', 'down'];
        } else if (bodyData[1].y === bodyData[0].y + 1) {
            return ['right', 'up'];
        } else {
            return ['right', 'up', 'down'];
        }
    } else if (bodyData[0].x === data.width - 1) {
        if (bodyData[1].x === bodyData[0].x - 1) {
            return ['up', 'down'];
        } else if (bodyData[1].y === bodyData[0].y - 1) {
            return ['left', 'down'];
        } else if (bodyData[1].y === bodyData[0].y + 1) {
            return ['left', 'up'];
        } else {
            return ['up', 'down', 'left'];
        }
    } else if (bodyData[0].y === 0) {
        if (bodyData[1].y === bodyData[0].y + 1) {
            return ['left', 'right'];
        } else if (bodyData[1].x === bodyData[0].x - 1) {
            return ['down', 'right'];
        } else if (bodyData[1].x === bodyData[0].x + 1) {
            return ['down', 'left'];
        } else {
            return ['left', 'right', 'down'];
        }
    } else if (bodyData[0].y === data.height - 1) {
        if (bodyData[1].y === bodyData[0].y - 1) {
            return ['left', 'right'];
        } else if (bodyData[1].x === bodyData[0].x - 1) {
            return ['up', 'right'];
        } else if (bodyData[1].x === bodyData[0].x + 1) {
            return ['up', 'left'];
        } else {
            return ['up', 'left', 'right'];
        }
    } else {
        return possibleMoves;
    }
}


// perform a flood fill with fake heads
function performFloodFill(possibleMoves, body, seed, result, getter, floodFillResults, bodyParam) {
    possibleMoves.forEach(function (move) {
        var onFlood = [];
        if (move === 'up' && body[0].y - 1 > -1) {
            seed = [body[0].x, body[0].y - 1];
            result = floodFill({
                getter: getter,
                seed: seed,
                onFlood: function (x, y) {
                    onFlood.push(dist([x, y], [body[0].x, body[0].y - 1]));
                }
            });
            floodFillResults.push({
                move,
                floodLengthLimited: onFlood.filter(distance => distance < 3).length,
                floodLength: result.flooded.length
            });
        } else if (move === 'down' && body[0].y + 1 < bodyParam.height) {
            seed = [body[0].x, body[0].y + 1];
            result = floodFill({
                getter: getter,
                seed: seed,
                onFlood: function (x, y) {
                    onFlood.push(dist([x, y], [body[0].x, body[0].y + 1]));
                }
            });
            floodFillResults.push({
                move,
                floodLengthLimited: onFlood.filter(distance => distance < 3).length,
                floodLength: result.flooded.length
            });
        } else if (move === 'left' && body[0].x - 1 > -1) {
            seed = [body[0].x - 1, body[0].y];
            result = floodFill({
                getter: getter,
                seed: seed,
                onFlood: function (x, y) {
                    onFlood.push(dist([x, y], [body[0].x - 1, body[0].y]));
                }
            });
            floodFillResults.push({
                move,
                floodLengthLimited: onFlood.filter(distance => distance < 3).length,
                floodLength: result.flooded.length
            });
        } else if (move === 'right' && body[0].x + 1 < bodyParam.width) {
            seed = [body[0].x + 1, body[0].y];
            result = floodFill({
                getter: getter,
                seed: seed,
                onFlood: function (x, y) {
                    onFlood.push(dist([x, y], [body[0].x + 1, body[0].y]));
                }
            });
            floodFillResults.push({
                move,
                floodLengthLimited: onFlood.filter(distance => distance < 3).length,
                floodLength: result.flooded.length
            });
        }
    });
    return floodFillResults;
}


// get the move and length of the best direction for limited and full flood fill result
function getBestFloodFillMove(floodFillResults, largestLimited, largestFull) {
    var bestFloodFillMove = {};
    floodFillResults.forEach(function (object) {
        if (object.floodLength >= largestFull) {
            largestFull = object.floodLength;
            bestFloodFillMove.fullLength = object.floodLength;
            bestFloodFillMove.fullMove = object.move;
        }
        if (object.floodLengthLimited >= largestLimited) {
            largestLimited = object.floodLengthLimited;
            bestFloodFillMove.limitedLength = object.floodLengthLimited;
            bestFloodFillMove.limitedMove = object.move;
        }
    });
    return bestFloodFillMove;
}


// find the closest piece of food to our head
function foodSearch(data) {
    var foodData = data.food.data;
    var distancesToFood = [];
    var closestFood = [];
  
    foodData.forEach(function (object) {
        distancesToFood.push(object);
        distancesToFood.push(distance(object, (data.you.body.data)[0]));
    });
  
    var min = distancesToFood[1];
    var index = 0;
    var object = {};
    for (var i = 0; i < distancesToFood.length; i++) {
        if (i % 2 !== 0) {
            if (distancesToFood[i] < min) {
                min = distancesToFood[i];
                index = i - 1;
            }
        }
    }
    object = distancesToFood[index];
    closestFood.push(min, object);
    return closestFood; // [distance to closest food, { coordinates of closest food }]
}


// find a move that gets you closest to the nearest piece of food if a path exists to the food
function pathToFood(closestFood, data, gridBackup, floodFillResults, bestFloodFillMove) {
    var bodyData = data.you.body.data;
    var finder = new PF.AStarFinder();
    var path = finder.findPath(bodyData[0].x, bodyData[0].y, closestFood[1].x, closestFood[1].y, gridBackup);
    var checkPossibleMoves = [];
    floodFillResults.forEach(function (object) {
        checkPossibleMoves.push(object.move);
    });
    var flag = false;
    if (bestFloodFillMove.length === 0) {
        flag = true;
    }

    console.log(path);
    console.log(checkPossibleMoves);

    if (path.length === 0) {
        return false;
    } else {
        if (path[1][0] === bodyData[0].x) {
            if (!flag) {
                if (path[1][1] === bodyData[0].y - 1 && checkPossibleMoves.includes('up') && bestFloodFillMove.limitedMove === 'up') {
                    return 'up';
                } else if (path[1][1] === (bodyData[0].y + 1) && checkPossibleMoves.includes('down') && bestFloodFillMove.limitedMove === 'down') {
                    return 'down';
                }
            } else {
                if (path[1][1] === bodyData[0].y - 1 && checkPossibleMoves.includes('up')) {
                    return 'up';
                } else if (path[1][1] === (bodyData[0].y + 1) && checkPossibleMoves.includes('down')) {
                    return 'down';
                }
            }
        } else if (path[1][1] === bodyData[0].y) {
            if (!flag) {
                if (path[1][0] === (bodyData[0].x - 1) && checkPossibleMoves.includes('left') && bestFloodFillMove.limitedMove === 'left') {
                    return 'left';
                } else if (path[1][0] === bodyData[0].x + 1 && checkPossibleMoves.includes('right') && bestFloodFillMove.limitedMove === 'right') {
                    return 'right';
                }
            } else {
                if (path[1][0] === (bodyData[0].x - 1) && checkPossibleMoves.includes('left')) {
                    return 'left';
                } else if (path[1][0] === bodyData[0].x + 1 && checkPossibleMoves.includes('right')) {
                    return 'right';
                }
            }
        }
    }
}


// find and return the first move that leads to our tail
function pathToTail(data, gridBackup, possibleMoves, bestFloodFillMove) {
    var bodyData = data.you.body.data;
    var finder = new PF.AStarFinder();
    var path = finder.findPath(bodyData[0].x, bodyData[0].y, bodyData[bodyData.length - 1].x, bodyData[bodyData.length - 1].y, gridBackup);
  
    if (path.length === 0 || path.length === 1) {
        return false;
    } else {
        if (path[1][0] === path[0][0]) {
            if (path[1][1] !== path[0][1]) {
                if (path[1][1] < path[0][1] && possibleMoves.includes('up') && bestFloodFillMove.limitedMove === 'up') {
                    return 'up';
                } else if (path[1][1] > path[0][1] && possibleMoves.includes('down') && bestFloodFillMove.limitedMove === 'down') {
                    return 'down';
                }
            }
        } else if (path[1][1] === path[0][1]) {
            if (path[1][0] !== path[0][0]) {
                if (path[1][0] > path[0][0] && possibleMoves.includes('right') && bestFloodFillMove.limitedMove === 'right') {
                    return 'right';
                } else if (path[1][0] < path[0][0] && possibleMoves.includes('left') && bestFloodFillMove.limitedMove === 'left') {
                    return 'left';
                }
            }
        }
    }
}

// make a choice about the best move based on the flood fill
function lastMinuteMoveChoice(bestFloodFillMove) {
    if (bestFloodFillMove.fullMove === bestFloodFillMove.limitedMove) {
        return bestFloodFillMove.fullMove;
    } else {
        return bestFloodFillMove.limitedMove;
    }
}


// calculate the distance between two coordinate points
function distance(point1, point2) {
    return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
}


// remove a specified element from an array
function removeElement(array, element) {
    var index = array.indexOf(element);
    if (index !== -1) {
        array.splice(index, 1);
    }
    return array;
}

module.exports = router;
