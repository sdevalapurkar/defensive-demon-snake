var express = require('express')
var router  = express.Router()
var PF = require('pathfinding')
var floodFill = require("n-dimensional-flood-fill")

// Handle POST request to '/start'
router.post('/start', function (req, res) {
  // NOTE: Do something here to start the game

  // Response data
  var data = {
    color: "#FF69B4", // old color: #FFA07A, nice also #c2bff9, and nice green #007f7f, #6d0000
    name: "Shiffany",
    secondary_color: "#CD5C5C",
    head_url: "https://rdbrck.com/wp-content/uploads/2016/09/shift_icon@2x.png", // optional, but encouraged!
    tail_type: 'curled',
    head_type: 'bendr' // bendr is nice
  }

  return res.json(data)
})

// Handle POST request to '/move'
router.post('/move', function (req, res) {
  // define some global variables
  var taunts = ["Can't beat Redbrickers at ping pong", "Meet the spinmaaaaassstaaaaa", "Let's go for a spinnnn"]
  var generatedMove = undefined
  var cornerMove = checkCorners(req.body)
  var possibleMoves = ['up', 'down', 'left', 'right']
  var bodyParam = req.body
  var body = req.body.you.body.data
  var snakes = req.body.snakes.data
  var grid = new PF.Grid(req.body.width, req.body.height)
  var backupGrid = grid.clone()
  var newBackupGrid = grid.clone()
  var closestFood = []
  var foodMove = ''
  var tailMove = ''
  var gridData = []
  var largest = 0
  var largestFloodFillMove
  var seed
  var result
  var floodFillResults = []
  var possibleWallMoves = checkWalls(req.body)
  var myID = req.body.you.id
  var otherSnakeHeads = []
  var updatedOtherSnakeHeads = []
  var hungerValue = 0

  // calculate hunger value dynamically based on # of snakes and # of food
  console.log('# snakes: ', req.body.snakes.data.length)
  console.log('# food: ', req.body.food.data.length)
  if (req.body.snakes.data.length > 4 && req.body.food.data.length < 3) {
    hungerValue = 80
  } else if (req.body.snakes.data.length > 4 && req.body.food.data.length < 7) {
    hungerValue = 60
  } else if (req.body.snakes.data.length < 4) {
    hungerValue = 41
  } else {
    hungerValue = 85
  }

  // helper function to remove a specified element from an array
  function removeElement(array, element) {
    var index = array.indexOf(element)

    if (index !== -1) {
      array.splice(index, 1)
    }
  }

  // store all the head locations of other snakes
  snakes.forEach(function (snake) {
    if (snake.id !== myID) {
      otherSnakeHeads.push({ x: snake.body.data[0].x, y: snake.body.data[0].y, length: snake.length, id: snake.id })
    }
  })
  console.log('other snake heads: ', otherSnakeHeads)

  // append fake heads to each of the heads of the other snakes for pessimistic flood fill
  otherSnakeHeads.forEach(function (object) {
    if (object.x - 1 >= 0) {
      updatedOtherSnakeHeads.push({ x: object.x - 1, y: object.y })
    }
    if (object.x + 1 < req.body.width) {
      updatedOtherSnakeHeads.push({ x: object.x + 1, y: object.y })
    }
    if (object.y - 1 >= 0) {
      updatedOtherSnakeHeads.push({ x: object.x, y: object.y - 1 })
    }
    if (object.y + 1 < req.body.height) {
      updatedOtherSnakeHeads.push({ x: object.x, y: object.y + 1 })
    }
  })

  // also push all values in othersnakeshead into updatedothersnakeshead
  otherSnakeHeads.forEach(function (object) {
    updatedOtherSnakeHeads.push(object)
  })

  console.log('updated other snakes headsss: ', updatedOtherSnakeHeads)

  // create the empty new grid 2d array
  for (var j = 0; j < req.body.height; j++) {
    var row = []
    for (var k = 0; k < req.body.width; k++) {
      row.push(1)
    }
    gridData.push(row)
  }

  // set all body points as unwalkable in the backup grid
  body.forEach(function (object) {
    backupGrid.setWalkableAt(object.x, object.y, false)
  })

  // set all snake points as unwalkable in the backup grid
  snakes.forEach(function (snake) {
    snake.body.data.forEach(function (object) {
      backupGrid.setWalkableAt(object.x, object.y, false)
    })
  })

  // set all body points as unwalkable in the new backup grid
  body.forEach(function (object) {
    newBackupGrid.setWalkableAt(object.x, object.y, false)
  })

  // set all snake points as unwalkable in the new backup grid
  snakes.forEach(function (snake) {
    snake.body.data.forEach(function (object) {
      newBackupGrid.setWalkableAt(object.x, object.y, false)
    })
  })

  // set all the 'fake' snake heads as unwalkable for the new backup grid
  updatedOtherSnakeHeads.forEach(function (object) {
    newBackupGrid.setWalkableAt(object.x, object.y, false)
  })

  // set my own tail as walkable for flood fill purposes if im longer than 5 units and didn't just eat
  if (req.body.you.length > 5 && req.body.you.health < 100) {
    newBackupGrid.setWalkableAt(body[body.length - 1].x, body[body.length - 1].y, true)
  }
  
  // create the new grid for the flood fill function
  newBackupGrid.nodes.forEach(function (node) {
    node.forEach(function (object) {
      gridData[object.x] = gridData[object.x] || []
      if (!object.walkable) {
        gridData[object.y][object.x] = 0
      }
    })
  })

  console.log('test1')
  if (possibleWallMoves !== false) {
    if (!possibleWallMoves.includes('up')) { // at top wall
      removeElement(possibleMoves, 'up')
    } else if (!possibleWallMoves.includes('down')) { // at down wall
      removeElement(possibleMoves, 'down')
    } else if (!possibleWallMoves.includes('left')) { // at left wall
      removeElement(possibleMoves, 'left')
    } else if (!possibleWallMoves.includes('right')) { // at right wall
      removeElement(possibleMoves, 'right')
    }
  }

  console.log('possible moves: ', possibleMoves)
  console.log('test2')
  console.log(gridData)

  console.log(gridData[body[0].y][body[0].x - 1])
  console.log(gridData[body[0].y][body[0].x + 1])
  console.log(gridData[body[0].y - 1])
  console.log(gridData[body[0].y + 1])

  // update possible moves based on where we are and where other snakes are
  if (possibleMoves.includes('left') && gridData[body[0].y][body[0].x - 1] !== 1) {
    console.log('remove left')
    removeElement(possibleMoves, 'left')
  } 
  if (possibleMoves.includes('right') && gridData[body[0].y][body[0].x + 1] !== 1) {
    console.log('remove right')
    removeElement(possibleMoves, 'right')
  } 
  if (possibleMoves.includes('up') && (gridData[body[0].y - 1]) !== undefined && gridData[body[0].y - 1][body[0].x] !== 1) {
    console.log('remove up')
    removeElement(possibleMoves, 'up')
  } 
  if (possibleMoves.includes('down') && (gridData[body[0].y + 1]) !== undefined && gridData[body[0].y + 1][body[0].x] !== 1) {
    console.log('remove down')
    removeElement(possibleMoves, 'down')
  }

  console.log('updated possible moves: ', possibleMoves)
  console.log('test 3')

  //finally, update possible moves if a snake can move into the same spot as us for head on head collison
  if (possibleMoves.includes('up') && possibleMoves.length > 1) {
    otherSnakeHeads.forEach(function (location) {
      if (gridData[body[0].y - 2] !== undefined && location.y === body[0].y - 2 && location.x === body[0].x && location.length >= req.body.you.length) {
        console.log('remove up snake above')
        removeElement(possibleMoves, 'up')
      } else if (gridData[body[0].x + 1] !== undefined && location.y === body[0].y - 1 && location.x === body[0].x + 1 && location.length >= req.body.you.length) {
        console.log('remove up snake to right')
        removeElement(possibleMoves, 'up')
      } else if (gridData[body[0].x - 1] !== undefined && location.y === body[0].y - 1 && location.x === body[0].x - 1 && location.length >= req.body.you.length) {
        console.log('remove up snake to left')
        removeElement(possibleMoves, 'up')
      }
    })
  }
  if (possibleMoves.includes('down') && possibleMoves.length > 1) {
    otherSnakeHeads.forEach(function (location) {
      if (gridData[body[0].y + 2] !== undefined && location.y === body[0].y + 2 && location.x === body[0].x && location.length >= req.body.you.length) {
        console.log('remove down snake below')
        removeElement(possibleMoves, 'down')
      } else if (gridData[body[0].x + 1] !== undefined && location.y === body[0].y + 1 && location.x === body[0].x + 1 && location.length >= req.body.you.length) {
        console.log('remove down snake to right')
        removeElement(possibleMoves, 'down')
      } else if (gridData[body[0].x - 1] !== undefined && location.y === body[0].y + 1 && location.x === body[0].x - 1 && location.length >= req.body.you.length) {
        console.log('remove down snake to left')
        removeElement(possibleMoves, 'down')
      }
    })
  }
  if (possibleMoves.includes('left') && possibleMoves.length > 1) {
    otherSnakeHeads.forEach(function (location) {
      if (gridData[body[0].x - 2] !== undefined && location.y === body[0].y && location.x === body[0].x - 2 && location.length >= req.body.you.length) {
        console.log('remove left snake to left')
        removeElement(possibleMoves, 'left')
      } else if (gridData[body[0].y - 1] !== undefined && location.y === body[0].y - 1 && location.x === body[0].x - 1 && location.length >= req.body.you.length) {
        console.log('remove left snake above')
        removeElement(possibleMoves, 'left')
      } else if (gridData[body[0].y + 1] !== undefined && location.y === body[0].y + 1 && location.x === body[0].x - 1 && location.length >= req.body.you.length) {
        console.log('remove left snake below')
        removeElement(possibleMoves, 'left')
      }
    })
  }
  if (possibleMoves.includes('right') && possibleMoves.length > 1) {
    otherSnakeHeads.forEach(function (location) {
      if (gridData[body[0].x + 2] !== undefined && location.y === body[0].y && location.x === body[0].x + 2 && location.length >= req.body.you.length) {
        console.log('remove right snake to right')
        removeElement(possibleMoves, 'right')
      } else if (gridData[body[0].y - 1] !== undefined && location.y === body[0].y - 1 && location.x === body[0].x + 1 && location.length >= req.body.you.length) {
        console.log('remove right snake above')
        removeElement(possibleMoves, 'right')
      } else if (gridData[body[0].y + 1] !== undefined && location.y === body[0].y + 1 && location.x === body[0].x + 1 && location.length >= req.body.you.length) {
        console.log('remove right snake below')
        removeElement(possibleMoves, 'right')
      }
    })
  }

  console.log('possible moves after the head on head avoidance: ', possibleMoves)
  
  // Define our getter for accessing the data structure
  var getter = function (x, y) {
    return gridData[y][x];
  };

  console.log(body[0].y - 1)
  console.log(body[0].y + 1)
  console.log(body[0].x - 1)
  console.log(body[0].x + 1)

  // go through the possible moves and store the flood fill lengths for those moves
  possibleMoves.forEach(function (move) {
    if (move === 'up' && body[0].y - 1 > -1) {
      seed = [body[0].x, body[0].y - 1]
      result = floodFill({
        getter: getter,
        seed: seed
      })
      floodFillResults.push({ move, floodLength: result.flooded.length })
    } else if (move === 'down' && body[0].y + 1 < req.body.height) {
      seed = [body[0].x, body[0].y + 1]
      result = floodFill({
        getter: getter,
        seed: seed
      })
      floodFillResults.push({ move, floodLength: result.flooded.length })
    } else if (move === 'left' && body[0].x - 1 > -1) {
      seed = [body[0].x - 1, body[0].y]
      result = floodFill({
        getter: getter,
        seed: seed
      })
      floodFillResults.push({ move, floodLength: result.flooded.length })
    } else if (move === 'right' && body[0].x + 1 < req.body.width) {
      seed = [body[0].x + 1, body[0].y]
      result = floodFill({
        getter: getter,
        seed: seed
      })
      floodFillResults.push({ move, floodLength: result.flooded.length })
    }
  })

  console.log(floodFillResults)

  // get the move with the largest flood fill value
  floodFillResults.forEach(function (object) {
    if (object.floodLength < req.body.you.length) {
      removeElement(possibleMoves, object.move) // need to remove from floodfilledresults
    }
    if (largest < object.floodLength) {
      largest = object.floodLength
      largestFloodFillMove = object.move
    }
  })

  console.log('corner: ', cornerMove)

  // generate a move
  if (cornerMove !== false) { // we are at a corner
    console.log('at a corner')
    generatedMove = cornerMove
  } else {
    if (req.body.you.health < hungerValue) { // we are hungry
      console.log('not at corner, we are hungry')
      closestFood = foodSearch(req.body)
      console.log(closestFood)
      foodMove = pathToFood(closestFood, req.body, backupGrid, possibleMoves, floodFillResults)
      if (foodMove !== false) {
        generatedMove = foodMove
      } else {
        generatedMove = pathToTail(bodyParam, backupGrid, possibleMoves, floodFillResults)
      }
    } else { // find path to tail
      console.log('to tail we go')
      tailMove = pathToTail(bodyParam, backupGrid, possibleMoves, floodFillResults)
      console.log('tail move:', tailMove)
      if (tailMove !== false && tailMove !== undefined) {
        generatedMove = tailMove
      } else {
        console.log('largest flood fill move: ', largestFloodFillMove)
        console.log('no path to tail, going to place with largest flood fill')
        generatedMove = largestFloodFillMove
      }
    }
  }

  if (generatedMove === false || generatedMove === undefined) {
    generatedMove = largestFloodFillMove
  }

  // Response data
  var data = {
    move: generatedMove, // one of: ['up','down','left','right']
    taunt: taunts[Math.floor(Math.random()*taunts.length)]
  }

  return res.json(data)
})

// find and return the first move that leads to our tail
function pathToTail(data, grid, possibleMoves, floodFillResults) {
  var bodyData = data.you.body.data
  var finder = new PF.AStarFinder()
  var gridBackup = grid.clone()

  // set parts of the grid that are unwalkable
  bodyData.forEach(function (object) {
    gridBackup.setWalkableAt(object.x, object.y, false)
  })
  data.snakes.data.forEach(function (snake) {
    snake.body.data.forEach(function (object) {
      gridBackup.setWalkableAt(object.x, object.y, false)
    })
  })

  // set our own head and tail as walkable points
  gridBackup.setWalkableAt(bodyData[0].x, bodyData[0].y, true)
  gridBackup.setWalkableAt(bodyData[bodyData.length - 1].x, bodyData[bodyData.length - 1].y, true)

  var path = finder.findPath(bodyData[0].x, bodyData[0].y, bodyData[bodyData.length - 1].x, bodyData[bodyData.length - 1].y, gridBackup) 
  if (path.length === 0 || path.length === 1) {
    return false
  }

  console.log('path to tail: ', path)

  var checkPossibleMoves = []
  floodFillResults.forEach(function (object) {
    checkPossibleMoves.push(object.move)
  })

  if (path[1][0] === path[0][0]) { // same x coordinates
    if (path[1][1] !== path[0][1]) { // different y coordinates
      if (path[1][1] < path[0][1] && checkPossibleMoves.includes('up') && possibleMoves.includes('up')) {
        return 'up'
      } else if (path[1][1] > path[0][1] && checkPossibleMoves.includes('down') && possibleMoves.includes('down')) {
        return 'down'
      }
    }
  } else if (path[1][1] === path[0][1]) { // same y coordinates
    if (path[1][0] !== path[0][0]) { // different x coordinates
      if (path[1][0] > path[0][0] && checkPossibleMoves.includes('right') && possibleMoves.includes('right')) {
        return 'right'
      } else if (path[1][0] < path[0][0] && checkPossibleMoves.includes('left') && possibleMoves.includes('left')) {
        return 'left'
      }
    }
  }
}

function pathToFood(closestFood, data, grid, possibleMoves, floodFillResults) {
  console.log('closestFood: ', closestFood)
  console.log('floodfillresults in pathtofood: ', floodFillResults)
  var bodyData = data.you.body.data // body coordinates
  var snakes = data.snakes.data // snakes data
  var finder = new PF.AStarFinder()
  var gridBackup = grid.clone()

  bodyData.forEach(function (object) {
    gridBackup.setWalkableAt(object.x, object.y, false)
  })
  gridBackup.setWalkableAt(bodyData[bodyData.length - 1].x, bodyData[bodyData.length - 1].y, true)

  data.snakes.data.forEach(function (snake) {
    snake.body.data.forEach(function (object) {
      gridBackup.setWalkableAt(object.x, object.y, false)
    })
  })

  var path = finder.findPath(bodyData[0].x, bodyData[0].y, closestFood[1].x, closestFood[1].y, gridBackup)
  if (path.length === 0) {
    return false
  }

  var checkPossibleMoves = []
  floodFillResults.forEach(function (object) {
    checkPossibleMoves.push(object.move)
  })
  console.log(checkPossibleMoves)
  
  if (path[1][0] === bodyData[0].x) { // don't turn left or right
    if (path[1][1] === bodyData[0].y - 1 && checkPossibleMoves.includes('up') && possibleMoves.includes('up')) { // go up
      return 'up'
    } else if (path[1][1] === (bodyData[0].y + 1) && checkPossibleMoves.includes('down') && possibleMoves.includes('down')) { // go down
      return 'down'
    }
  } else if (path[1][1] === bodyData[0].y) { // don't turn up or down
    if (path[1][0] === (bodyData[0].x - 1) && checkPossibleMoves.includes('left') && possibleMoves.includes('left')) { // go left
      return 'left'
    } else if (path[1][0] === bodyData[0].x + 1 && checkPossibleMoves.includes('right') && possibleMoves.includes('right')) { // go right
      return 'right'
    }
  }
}

// helper function to calculate the distance between two coordinate points
function distance(point1, point2) { // calculate distance between two points
  return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2))
}

function foodSearch(data) {
  console.log('in food search')
  var foodData = data.food.data // food
  var bodyData = data.you.body.data // body coordinates
  var distancesToFood = []
  var closestFood = []

  console.log('test1')

  foodData.forEach(function (object) {
    distancesToFood.push(object)
    distancesToFood.push(distance(object, bodyData[0]))
    console.log(distancesToFood)
  })

  console.log('test2')

  var min = distancesToFood[1]
  var index = 0
  var object = {}
  for (var i = 0; i < distancesToFood.length; i++) {
    if (i % 2 !== 0) {
      if (distancesToFood[i] < min) {
        min = distancesToFood[i]
        index = i - 1
      }
    }
  }
  object = distancesToFood[index]
  closestFood.push(min, object)
  console.log(closestFood)
  return closestFood // [distance to closest food, { coordinates of closest food }]
}

function checkWalls(data) {
  var bodyData = data.you.body.data
  var health = data.you.health
  if (bodyData[0].x === 0) { // left wall
    if (bodyData[1].x === 1) { // approaching from right
      return ['up', 'down']
    } else if (bodyData[1].y === bodyData[0].y - 1) { // approaching from up
      return ['right', 'down']
    } else if (bodyData[1].y === bodyData[0].y + 1) { // approaching from down
      return ['right', 'up']
    } else {
      return ['right', 'up', 'down']
    }
  } else if (bodyData[0].x === data.width - 1) { // right wall
    if (bodyData[1].x === bodyData[0].x - 1) { // approaching from left
      return ['up', 'down']
    } else if (bodyData[1].y === bodyData[0].y - 1) { // approaching from up
      return ['left', 'down']
    } else if (bodyData[1].y === bodyData[0].y + 1) { // approaching from down
      return ['left', 'up']
    } else {
      return ['up', 'down', 'left']
    }
  } else if (bodyData[0].y === 0) { // up wall
    if (bodyData[1].y === bodyData[0].y + 1) { // approaching from down
      return ['left', 'right']
    } else if (bodyData[1].x === bodyData[0].x - 1) { // approaching from left
      return ['down', 'right']
    } else if (bodyData[1].x === bodyData[0].x + 1) { // approaching from right
      return ['down', 'left']
    } else {
      return ['left', 'right', 'down']
    }
  } else if (bodyData[0].y === data.height - 1) { // down wall
    if (bodyData[1].y === bodyData[0].y - 1) { // approaching from up
      return ['left', 'right']
    } else if (bodyData[1].x === bodyData[0].x - 1) { // approaching from left
      return ['up', 'right']
    } else if (bodyData[1].x === bodyData[0].x + 1) { // approaching from right
      return ['up', 'left']
    } else {
      return ['up', 'left', 'right']
    }
  } else {
    return false
  }
}

function checkCorners(data) {
  var bodyData = data.you.body.data
  if (bodyData[0].x === 0 && bodyData[0].y === 0) { // up left corner
    if (bodyData[1].y === 1) { // approaching from down
      return 'right'
    } else if (bodyData[1].x === 1) { // approaching from right
      return 'down'
    }
  } else if (bodyData[0].x === data.width - 1 && bodyData[0].y === 0) { // up right corner
    if (bodyData[1].x === data.width - 2) { // approaching from left
      return 'down'
    } else if (bodyData[1].y === 1) { // approaching from down
      return 'left'
    }
  } else if (bodyData[0].x === 0 && bodyData[0].y === data.height - 1) { // down left corner
    if (bodyData[1].y === data.height - 2) { // approaching from up
      return 'right'
    } else if (bodyData[1].x === 1) { // approaching from right
      return 'up'
    }
  } else if (bodyData[0].x === data.width - 1 && bodyData[0].y === data.height - 1) { // down right corner
    if (bodyData[1].y === data.height - 2) { // approaching from up
      return 'left'
    } else if (bodyData[1].x === data.width - 2) { // approaching from left
      return 'up'
    }
  } else {
    return false
  }
}

module.exports = router
