var express = require('express');
var router  = express.Router();
var PF = require('pathfinding');
var floodFill = require('n-dimensional-flood-fill');
var dist = require('manhattan');

// handle POST request to '/start'
router.post('/start', (req, res) => {  
    // response data
    const data = {
        color: '#652DC1',
    };

    return res.json(data);
});


// handle POST request to '/move'
router.post('/move', (req, res) => {
    // generate a move
    var generatedMove = generateMove(req);

    var data = {
        move: generatedMove,
    };

    return res.json(data);
});


// generate a move
function generateMove(req) {
    // some basic variables to be used later
    var generatedMove = undefined;
    var possibleMoves = ['up', 'down', 'left', 'right'];
    var grid = new PF.Grid(req.body.board.width, req.body.board.height);
    var cornerMove = checkCorners(req.body);
    var dangerousFlag = false;


    // store head locations of other snakes and also append extra heads
    var otherSnakeHeads = [];
    var updatedOtherSnakeHeads = [];

    otherSnakeHeads = storeHeadsOfOtherSnakes(req.body.board.snakes, otherSnakeHeads, req.body.you.id);
    updatedOtherSnakeHeads = appendFakeHeadsToSnakes(otherSnakeHeads, updatedOtherSnakeHeads, req.body, true);

    // create the grid and mark walkable/unwalkable areas (with and without fake heads)
    var markedGrid = setUnwalkableGridAreas(req.body.you.body, grid.clone(), req.body.board.snakes, updatedOtherSnakeHeads);
    markedGrid = setWalkableGridAreas(markedGrid.clone(), req.body.you.body, req.body.board.snakes, req.body.you.id);
    var noFakeHeadsMarkedGrid = setUnwalkableGridAreas(req.body.you.body, grid.clone(), req.body.board.snakes, otherSnakeHeads);
    noFakeHeadsMarkedGrid = setWalkableGridAreas(noFakeHeadsMarkedGrid.clone(), req.body.you.body, req.body.board.snakes, req.body.you.id);

    // create the flood fill grids based on the marked grids (with and without fake heads)
    var floodFillGrid = createEmptyFFGrid(req.body, []);
    console.log('hehehehehehe111111');
    floodFillGrid = initializeFFGrid(markedGrid.clone(), floodFillGrid);
    var noFakeHeadsFloodFillGrid = createEmptyFFGrid(req.body, []);
    noFakeHeadsFloodFillGrid = initializeFFGrid(noFakeHeadsMarkedGrid.clone(), noFakeHeadsFloodFillGrid);

    // update the possible moves based on our location
    possibleMoves = checkWalls(req.body, possibleMoves);
    console.log('sauce');
    possibleMoves = removeSnakeCollisionMoves(possibleMoves, noFakeHeadsFloodFillGrid, req.body.you.body);
    possibleMoves = checkForHeadCollisions(req.body, otherSnakeHeads, possibleMoves, noFakeHeadsFloodFillGrid, req.body.board);

    if (req.body.you.health > 15) {
        possibleMoves = removeDangerousWalls(possibleMoves, req.body.you.body, req.body.board);
    }

    if (possibleMoves.length === 0) {
        dangerousFlag = true;
        possibleMoves = ['up', 'down', 'left', 'right'];
    }

    // perform the flood fill using the grid without fake heads
    var floodFillResults = [];
    var seed, result;
    var getter = function (x, y) { return floodFillGrid[y][x]; };
    floodFillResults = performFloodFill(possibleMoves, req.body.you.body, seed, result, getter, floodFillResults, req.body);

    // generate the best flood fill move, the best move to get to my tail, and to food
    var bestFloodFillMove = getBestFloodFillMove(floodFillResults, floodFillResults[0].floodLengthLimited, floodFillResults[0].floodLength);
    
    
    
    var closestFood = foodSearch(req.body);
    console.log('sauce2', closestFood);
    var tailMove = pathToTail(req.body, markedGrid.clone(), possibleMoves);
    var foodMove = pathToFood(closestFood, req.body, markedGrid.clone(), floodFillResults, []);
    console.log(foodMove);

    console.log('sauce2');

    // use the moves calculated to figure out what the generated move shall be
    if (dangerousFlag) {
        console.log('might die, need dangerous move');
        generatedMove = lastMinuteMoveChoice(bestFloodFillMove);
    } else if (cornerMove !== false) {
        generatedMove = cornerMove;
    } else if (req.body.you.health < 55 && foodMove !== false && foodMove !== undefined) {
        console.log('hungry');
        generatedMove = pathToFood(closestFood, req.body, markedGrid.clone(), floodFillResults, []);
    } else if (tailMove !== false && tailMove !== undefined) {
        console.log('tail');
        generatedMove = tailMove;
    } else {
        console.log('last minute');
        generatedMove = lastMinuteMoveChoice(bestFloodFillMove);
    }

    return generatedMove;
}


// function to check if we are at a corner of the game board
function checkCorners(data) {
    let bodyData = data.you.body;

    if (bodyData[0].x === 0 && bodyData[0].y === 0) {
        if (bodyData[1].y === 1) {
            return 'right';
        } else if (bodyData[1].x === 1) {
            return 'down';
        }
    } else if (bodyData[0].x === data.board.width - 1 && bodyData[0].y === 0) {
        if (bodyData[1].x === data.board.width - 2) {
            return 'down';
        } else if (bodyData[1].y === 1) {
            return 'left';
        }
    } else if (bodyData[0].x === 0 && bodyData[0].y === data.board.height - 1) {
        if (bodyData[1].y === data.board.height - 2) {
            return 'right';
        } else if (bodyData[1].x === 1) {
            return 'up';
        }
    } else if (bodyData[0].x === data.board.width - 1 && bodyData[0].y === data.board.height - 1) {
        if (bodyData[1].y === data.board.height - 2) {
            return 'left';
        } else if (bodyData[1].x === data.board.width - 2) {
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
                x: snake.body[0].x,
                y: snake.body[0].y,
                length: snake.body.length,
                id: snake.id
            });
        }
    });
    return otherSnakeHeads;
}


// append fake heads to each of the heads of the other snakes
function appendFakeHeadsToSnakes(otherSnakeHeads, updatedOtherSnakeHeads, bodyParam, flag) {
    otherSnakeHeads.forEach(function (object) {
        if (!flag) {
            if (object.length >= bodyParam.you.body.length) {
                if (object.x - 1 >= 0) {
                    updatedOtherSnakeHeads.push({
                        x: object.x - 1,
                        y: object.y,
                        length: object.length,
                        id: object.id
                    });
                }
                if (object.x + 1 < bodyParam.board.width) {
                    updatedOtherSnakeHeads.push({
                        x: object.x + 1,
                        y: object.y,
                        length: object.length,
                        id: object.id
                    }); 
                }
                if (object.y - 1 >= 0) {
                    updatedOtherSnakeHeads.push({
                        x: object.x,
                        y: object.y - 1,
                        length: object.length,
                        id: object.id
                    }); 
                }
                if (object.y + 1 < bodyParam.board.height) {
                    updatedOtherSnakeHeads.push({
                        x: object.x,
                        y: object.y + 1,
                        length: object.length,
                        id: object.id
                    }); 
                }
            }
        } else {
            if (object.x - 1 >= 0) {
                updatedOtherSnakeHeads.push({
                    x: object.x - 1,
                    y: object.y,
                    length: object.length,
                    id: object.id
                });
            }
            if (object.x + 1 < bodyParam.board.width) {
                updatedOtherSnakeHeads.push({
                    x: object.x + 1,
                    y: object.y,
                    length: object.length,
                    id: object.id
                }); 
            }
            if (object.y - 1 >= 0) {
                updatedOtherSnakeHeads.push({
                    x: object.x,
                    y: object.y - 1,
                    length: object.length,
                    id: object.id
                }); 
            }
            if (object.y + 1 < bodyParam.board.height) {
                updatedOtherSnakeHeads.push({
                    x: object.x,
                    y: object.y + 1,
                    length: object.length,
                    id: object.id
                }); 
            }
        }
    });
    
    // also push all values in othersnakeshead into updatedothersnakeshead 
    otherSnakeHeads.forEach(function (object) { 
        updatedOtherSnakeHeads.push(object);
    });

    return updatedOtherSnakeHeads;
}


// remove duplicate tuples from an array of objects
function removeDuplicates(array) {
    var existingItems = [];
    return array.filter(function (item) {
        if (!existingItems.find(function (i) {
            return i.x === item.x && i.y === item.y;
        })) {
            existingItems.push(item);
            return true;
        } else {
            return false;
        }
    });
}


// mark all the unwalkable parts of the grid
function setUnwalkableGridAreas(body, backupGrid, snakes, updatedOtherSnakeHeads) {
    body.forEach(function (object) {
        backupGrid.setWalkableAt(object.x, object.y, false);
    });

    snakes.forEach(function (snake) {
        snake.body.forEach(function (object) {
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
    var reversedSnakes = [];
    var meReversed = [];

    // set all locations where my body or other snakes' bodies will disappear as walkable
    snakes.forEach(function (snake) {
        if (snake.id !== myID && snake.health !== 100) {
            var snakeHeadX = snake.body[0].x;
            var snakeHeadY = snake.body[0].y;

            snake.body.forEach(function (object) {
                reversedSnakes.push(object);
            });
            reversedSnakes = reversedSnakes.reverse();
            reversedSnakes.forEach(function (object, index) {
                if (dist([body[0].x, body[0].y], [object.x, object.y]) > index) {
                    if (dist([body[0].x, body[0].y], [object.x, object.y]) < dist([snakeHeadX, snakeHeadY], [object.x, object.y])) {
                        backupGrid.setWalkableAt(object.x, object.y, true);
                    }
                }
            });
        } else {
            if (snake.length > 4) {
                snake.body.forEach(function (object) {
                    meReversed.push(object);
                });
                meReversed = meReversed.reverse();
                meReversed.forEach(function (object, index) {
                    if (dist([body[0].x, body[0].y], [object.x, object.y]) > index) {
                        if (!(index === 0 && snake.health === 100)) {
                            backupGrid.setWalkableAt(object.x, object.y, true);
                        }
                    }
                });
            }
        }
    });
    return backupGrid;
}


// create the empty flood fill grid
function createEmptyFFGrid(bodyParam, gridData) {
    for (var j = 0; j < bodyParam.board.height; j++) {
        var row = [];
        for (var k = 0; k < bodyParam.board.width; k++) {
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
        if (possibleMoves.length > 2) {
            removeElement(possibleMoves, 'left');
        }
    }
    if (possibleMoves.includes('right') && body[0].x + 1 === board.width - 1) {
        if (possibleMoves.length > 2) {
            removeElement(possibleMoves, 'right');
        }
    }
    if (possibleMoves.includes('up') && body[0].y - 1 === 0) {
        if (possibleMoves.length > 2) {
            removeElement(possibleMoves, 'up');
        }
    }
    if (possibleMoves.includes('down') && body[0].y + 1 === board.height - 1) {
        if (possibleMoves.length > 2) {
            removeElement(possibleMoves, 'down');
        }
    }
    return possibleMoves;
}

// look ahead for spaces where we can get stuck in head on head, and try to avoid those spaces
function removePotentialHeadCollisions(possibleMoves, body, moreFakeHeads, grid, board) {
    var len = possibleMoves.length;
    console.log(possibleMoves);
    console.log(grid);
    possibleMoves.forEach(function (move) {
        if (move === 'left' && len >= 2) {
            if (body[0].x - 2 >= 0 &&
                grid[body[0].y][body[0].x - 2] === 0 &&
                body[0].y - 1 >= 0 &&
                grid[body[0].y - 1][body[0].x - 1] === 0 &&
                body[0].y + 1 < board.height &&
                grid[body[0].y + 1][body[0].x - 1] === 0
            ) {
                possibleMoves = removeElement(possibleMoves, 'left');
                len = possibleMoves.length;
            }
        }
        if (move === 'right' && len >= 2) {
            if (body[0].x + 2 < board.width &&
                grid[body[0].y][body[0].x + 2] === 0 &&
                body[0].y - 1 >= 0 &&
                grid[body[0].y - 1][body[0].x + 1] === 0 &&
                body[0].y + 1 < board.height &&
                grid[body[0].y + 1][body[0].x + 1] === 0
            ) {
                possibleMoves = removeElement(possibleMoves, 'right');
                len = possibleMoves.length;
            }
        }
        if (move === 'up' && len >= 2) {
            if (body[0].y - 2 >= 0 &&
                grid[body[0].y - 2][body[0].x] === 0 &&
                body[0].x - 1 >= 0 &&
                grid[body[0].y - 1][body[0].x - 1] === 0 &&
                body[0].x + 1 < board.width &&
                grid[body[0].y - 1][body[0].x + 1] === 0
            ) {
                possibleMoves = removeElement(possibleMoves, 'up');
                len = possibleMoves.length;
            }
        }
        if (move === 'down' && len >= 2) {
            if (body[0].y + 2 < board.height &&
                grid[body[0].y + 2][body[0].x] === 0 &&
                body[0].x - 1 >= 0 &&
                grid[body[0].y + 1][body[0].x - 1] === 0 &&
                body[0].x + 1 < board.width &&
                grid[body[0].y + 1][body[0].x + 1] === 0
            ) {
                possibleMoves = removeElement(possibleMoves, 'down');
                len = possibleMoves.length;
            }
        }
    });
    return possibleMoves;
}


// be aggressive when there is a chance for head on head collision with a shorter snake
function checkForHeadCollisions(bodyParam, otherSnakeHeads, possibleMoves, gridData, board) {
    otherSnakeHeads.forEach(function (object) {
        if (bodyParam.you.length > object.length) {
            // if snake head two spaces to right of my head
            if (bodyParam.you.body[0].x + 2 < board.width && object.x === bodyParam.you.body[0].x + 2 && object.y === bodyParam.you.body[0].y) {
                if (gridData[object.y][bodyParam.you.body[0].x + 1] !== 0) {
                    possibleMoves.push('right');
                }
            // if snake head two spaces to left of my head
            } else if (bodyParam.you.body[0].x - 2 >= 0 && object.x === bodyParam.you.body[0].x - 2 && object.y === bodyParam.you.body[0].y) {
                if (gridData[object.y][bodyParam.you.body[0].x - 1] !== 0) {
                    possibleMoves.push('left');
                }
            // if snake head two spaces above my head
            } else if (bodyParam.you.body[0].y - 2 >= 0 && object.y === bodyParam.you.body[0].y - 2 && object.x === bodyParam.you.body[0].x) {
                if (gridData[bodyParam.you.body[0].y - 1][object.x] !== 0) {
                    possibleMoves.push('up');
                }
            // if snake head two spaces below my head
            } else if (bodyParam.you.body[0].y + 2 < board.height && object.y === bodyParam.you.body[0].y + 2 && object.x === bodyParam.you.body[0].x) {
                if (gridData[bodyParam.you.body[0].y + 1][object.x] !== 0) {
                    possibleMoves.push('down');
                }
            // if snake head one down
            } else if (bodyParam.you.body[0].y + 1 < board.height && object.y === bodyParam.you.body[0].y + 1) {
                // and one to right of my head
                if (bodyParam.you.body[0].x + 1 < board.width && object.x === bodyParam.you.body[0].x + 1) {
                    if (gridData[bodyParam.you.body[0].y + 1][bodyParam.you.body[0].x] !== 0) {
                        possibleMoves.push('down');
                    }
                    if (gridData[bodyParam.you.body[0].y][bodyParam.you.body[0].x + 1] !== 0) {
                        possibleMoves.push('right');
                    }
                // and one to left of my head
                } else if (bodyParam.you.body[0].x - 1 >= 0 && object.x === bodyParam.you.body[0].x - 1) {
                    if (gridData[bodyParam.you.body[0].y + 1][bodyParam.you.body[0].x] !== 0) {
                        possibleMoves.push('down');
                    }
                    if (gridData[bodyParam.you.body[0].y][bodyParam.you.body[0].x - 1] !== 0) {
                        possibleMoves.push('left');
                    }
                }
            // if snake head one above
            } else if (bodyParam.you.body[0].y - 1 >= 0 && object.y === bodyParam.you.body[0].y - 1) {
                // and one to right of my head
                if (bodyParam.you.body[0].x + 1 < board.width && object.x === bodyParam.you.body[0].x + 1) {
                    if (gridData[bodyParam.you.body[0].y - 1][bodyParam.you.body[0].x] !== 0) {
                        possibleMoves.push('up');
                    }
                    if (gridData[bodyParam.you.body[0].y][bodyParam.you.body[0].x + 1] !== 0) {
                        possibleMoves.push('right');
                    }
                // and one to left of my head
                } else if (bodyParam.you.body[0].x - 1 >= 0 && object.x === bodyParam.you.body[0].x - 1) {
                    if (gridData[bodyParam.you.body[0].y - 1][bodyParam.you.body[0].x] !== 0) {
                        possibleMoves.push('up');
                    }
                    if (gridData[bodyParam.you.body[0].y][bodyParam.you.body[0].x - 1] !== 0) {
                        possibleMoves.push('left');
                    }
                }
            }
        }
    });

    return possibleMoves;
}


// check if we are at a wall
function checkWalls(data, possibleMoves) {
    var bodyData = data.you.body;

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
    } else if (bodyData[0].x === data.board.width - 1) {
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
    } else if (bodyData[0].y === data.board.height - 1) {
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
                floodLengthLimited: onFlood.filter(distance => distance < 6).length,
                floodLength: result.flooded.length
            });
        } else if (move === 'down' && body[0].y + 1 < bodyParam.board.height) {
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
                floodLengthLimited: onFlood.filter(distance => distance < 6).length,
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
                floodLengthLimited: onFlood.filter(distance => distance < 6).length,
                floodLength: result.flooded.length
            });
        } else if (move === 'right' && body[0].x + 1 < bodyParam.board.width) {
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
                floodLengthLimited: onFlood.filter(distance => distance < 6).length,
                floodLength: result.flooded.length
            });
        }
    });
    return floodFillResults;
}


// get the move and length of the best direction for limited and full flood fill result
function getBestFloodFillMove(floodFillResults, largestLimited, largestFull) {
    var bestFloodFillMove = {};
    bestFloodFillMove.fullLength = floodFillResults[0].floodLength;
    bestFloodFillMove.fullMove = floodFillResults[0].move;
    bestFloodFillMove.limitedLength = floodFillResults[0].floodLengthLimited;
    bestFloodFillMove.limitedMove = floodFillResults[0].move;
    floodFillResults.forEach(function (object) {
        if (object.floodLength > largestFull) {
            largestFull = object.floodLength;
            bestFloodFillMove.fullLength = object.floodLength;
            bestFloodFillMove.fullMove = object.move;
            if (object.floodLengthLimited === largestLimited) {
                bestFloodFillMove.limitedLength = object.floodLengthLimited;
                bestFloodFillMove.limitedMove = object.move;
            }
        }
        if (object.floodLengthLimited > largestLimited) {
            largestLimited = object.floodLengthLimited;
            bestFloodFillMove.limitedLength = object.floodLengthLimited;
            bestFloodFillMove.limitedMove = object.move;
            if (object.floodLength === largestFull) {
                bestFloodFillMove.fullLength = object.floodLength;
                bestFloodFillMove.fullMove = object.move;
            }
        }
    });
    return bestFloodFillMove;
}


// find the closest piece of food to our head
function foodSearch(data) {
    console.log('data', data);
    var foodData = data.board.food;
    var distancesToFood = [];
    var closestFood = [];

    console.log('fooddata', foodData);
  
    foodData.forEach(function (object) {
        distancesToFood.push(object);
        distancesToFood.push(distance(object, (data.you.body)[0]));
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
    var bodyData = data.you.body;
    var finder = new PF.AStarFinder();

    if (closestFood[0] === undefined) {
        return undefined;
    }

    console.log('bodydata MANNNNNNN', bodyData);

    var path = finder.findPath(bodyData[0].x, bodyData[0].y, closestFood[1].x, closestFood[1].y, gridBackup);
    var checkPossibleMoves = [];
    floodFillResults.forEach(function (object) {
        if (object.floodLength > data.you.length || object.floodLengthLimited > 14) {
            checkPossibleMoves.push(object.move);
        }
    });
    var flag = false;
    if (bestFloodFillMove.length === 0) {
        flag = true;
    }

    if (path.length === 0) {
        return false;
    } else if (dist([closestFood[1].x, closestFood[1].y], [bodyData[bodyData.length-1].x, bodyData[bodyData.length-1].y]) === 2 && dist([closestFood[1].x, closestFood[1].y], [bodyData[bodyData.length-2].x, bodyData[bodyData.length-2].y]) === 1) {
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
function pathToTail(data, gridBackup, possibleMoves) {
    var bodyData = data.you.body;
    var finder = new PF.AStarFinder();
    var path = finder.findPath(bodyData[0].x, bodyData[0].y, bodyData[bodyData.length - 1].x, bodyData[bodyData.length - 1].y, gridBackup);

    if (path.length === 0 || path.length === 1) {
        return false;
    } else {
        if (path[1][0] === path[0][0]) {
            if (path[1][1] !== path[0][1]) {
                if (path[1][1] < path[0][1] && possibleMoves.includes('up')) {
                    return 'up';
                } else if (path[1][1] > path[0][1] && possibleMoves.includes('down')) {
                    return 'down';
                }
            }
        } else if (path[1][1] === path[0][1]) {
            if (path[1][0] !== path[0][0]) {
                if (path[1][0] > path[0][0] && possibleMoves.includes('right')) {
                    return 'right';
                } else if (path[1][0] < path[0][0] && possibleMoves.includes('left')) {
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
        if (bestFloodFillMove.limitedLength > 14) {
            return bestFloodFillMove.limitedMove;
        } else {
            return bestFloodFillMove.fullMove;
        }
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
