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
        head_type: 'bendr'
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
    var possibleMoves = ['up', 'down', 'left', 'right'];
    var grid = new PF.Grid(req.body.width, req.body.height);
    var floodFillGrid = [];
    var otherSnakeHeads = [];
    var updatedOtherSnakeHeads = [];
    var cornerMove = checkCorners(req.body);
    otherSnakeHeads = storeHeadsOfOtherSnakes(req.body.snakes.data, otherSnakeHeads, req.body.you.id);
    updatedOtherSnakeHeads = appendFakeHeadsToSnakes(otherSnakeHeads, updatedOtherSnakeHeads, req.body);
    var markedGrid = setUnwalkableGridAreas(req.body.you.body.data, grid.clone(), req.body.snakes.data, updatedOtherSnakeHeads);
    markedGrid = setWalkableGridAreas(markedGrid.clone(), req.body.you.body.data, req.body.snakes.data, req.body.you.id);
    floodFillGrid = createEmptyFFGrid(req.body, floodFillGrid);
    possibleMoves = checkWalls(req.body);
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
            if (snake.length > 3 && snake.health < 100) {
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


// check if we are at a wall
function checkWalls(data) {
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
