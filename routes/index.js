var express = require('express')
var router  = express.Router()
var PF = require('pathfinding')
var floodFill = require("n-dimensional-flood-fill")
var dist = require('manhattan')

// Handle POST request to '/start'
router.post('/start', function (req, res) {  
  // Response data
  var data = {
    color: "#FF69B4", // old color: #FFA07A, nice also #c2bff9, and nice green #007f7f, #6d0000
    name: "Shiffany",
    secondary_color: "#CD5C5C",
    head_url: "https://rdbrck.com/wp-content/uploads/2016/09/shift_icon@2x.png",
    tail_type: 'curled',
    head_type: 'bendr'
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
  var noFakeHeadGridData = []
  var largest = 0
  var largestFloodFillMove
  var seed
  var newSeed
  var headCollisionSeed
  var result
  var floodFillResults = []
  var headCollisionFloodFillResults = []
  var possibleWallMoves = checkWalls(req.body)
  var myID = req.body.you.id
  var otherSnakeHeads = []
  var otherSnakeTails = []
  var updatedOtherSnakeHeads = []
  var hungerValue = 0
  var headCollisionMoves = []
  var floodFillDepth = 5

  // helper function to remove a specified element from an array
  function removeElement(array, element) {
    var index = array.indexOf(element)

    if (index !== -1) {
      array.splice(index, 1)
    }
  }

  // store all the head and tail locations of other snakes
  snakes.forEach(function (snake) {
    if (snake.id !== myID) {
      otherSnakeHeads.push({ x: snake.body.data[0].x, y: snake.body.data[0].y, length: snake.length, id: snake.id })
      otherSnakeTails.push({ x: snake.body.data[snake.body.data.length - 1].x, y: snake.body.data[snake.body.data.length - 1].y, health: snake.health })
    }
  })
  
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

  // set all snake points as unwalkable in the backup grid including their fake heads
  snakes.forEach(function (snake) {
    snake.body.data.forEach(function (object) {
      backupGrid.setWalkableAt(object.x, object.y, false)
    })
  })

  updatedOtherSnakeHeads.forEach(function (head) {
    backupGrid.setWalkableAt(head.x, head.y, false)
  })

  console.log('-----------------------------------------------')

  // set all snake tails as walkable if their health is not 100 (that is, they haven't just ate)
  otherSnakeTails.forEach(function (object) {
    if (object.health !== 100) {
      backupGrid.setWalkableAt(object.x, object.y, true)
    }
  })

  // set my own tail as walkable for flood fill purposes if im longer than 3 units and didn't just eat
  if (req.body.you.length > 3 && req.body.you.health < 100) {
    backupGrid.setWalkableAt(body[body.length - 1].x, body[body.length - 1].y, true)
  }

  // create the grid for the flood fill
  backupGrid.nodes.forEach(function (node) {
    node.forEach(function (object) {
      gridData[object.x] = gridData[object.x] || []
      if (!object.walkable) {
        gridData[object.y][object.x] = 0
      }
    })
  })

  console.log(gridData)

  console.log('possible moves 1: ', possibleMoves)

  // check if at a wall and remove moves from possible moves accordingly
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

  console.log('possible moves 2: ', possibleMoves)

  //TO DO: check if im longer than the other snake if im bumping into head

  // update possible moves based on where we are and where other snakes are
  if (possibleMoves.includes('left') && gridData[body[0].y][body[0].x - 1] !== 1) {
    removeElement(possibleMoves, 'left')
  } 
  if (possibleMoves.includes('right') && gridData[body[0].y][body[0].x + 1] !== 1) {
    removeElement(possibleMoves, 'right')
  } 
  if (possibleMoves.includes('up') && (gridData[body[0].y - 1]) !== undefined && gridData[body[0].y - 1][body[0].x] !== 1) {
    removeElement(possibleMoves, 'up')
  } 
  if (possibleMoves.includes('down') && (gridData[body[0].y + 1]) !== undefined && gridData[body[0].y + 1][body[0].x] !== 1) {
    removeElement(possibleMoves, 'down')
  }
  
  console.log('possible moves 3: ', possibleMoves)

  // Define our getter for accessing the data structure
  var getter = function (x, y) {
    return gridData[y][x]
  }

  // go through the possible moves and store the flood fill lengths for those moves
  possibleMoves.forEach(function (move) {
    var testOnFlood = []

    if (move === 'up' && body[0].y - 1 > -1) {
      seed = [body[0].x, body[0].y - 1]
      result = floodFill({
        getter: getter,
        seed: seed,
        // might need to dip this later
        onFlood: function (x, y) { // returns manhattan distance from head to (x,y)
          testOnFlood.push(dist([x, y], [body[0].x, body[0].y]))
        }
      })
      floodFillResults.push({ move, floodLengthLimited: testOnFlood.filter(distance => distance < floodFillDepth).length, floodLength: result.flooded.length })
    } else if (move === 'down' && body[0].y + 1 < req.body.height) {
      seed = [body[0].x, body[0].y + 1]
      result = floodFill({
        getter: getter,
        seed: seed,
        onFlood: function (x, y) { // returns manhattan distance from head to (x,y)
          testOnFlood.push(dist([x, y], [body[0].x, body[0].y]))
        }
      })
      floodFillResults.push({ move, floodLengthLimited: testOnFlood.filter(distance => distance < floodFillDepth).length, floodLength: result.flooded.length })
    } else if (move === 'left' && body[0].x - 1 > -1) {
      seed = [body[0].x - 1, body[0].y]
      result = floodFill({
        getter: getter,
        seed: seed,
        onFlood: function (x, y) { // returns manhattan distance from head to (x,y)
          testOnFlood.push(dist([x, y], [body[0].x, body[0].y]))
        }
      })
      floodFillResults.push({ move, floodLengthLimited: testOnFlood.filter(distance => distance < floodFillDepth).length, floodLength: result.flooded.length })
    } else if (move === 'right' && body[0].x + 1 < req.body.width) {
      seed = [body[0].x + 1, body[0].y]
      result = floodFill({
        getter: getter,
        seed: seed,
        onFlood: function (x, y) { // returns manhattan distance from head to (x,y)
          testOnFlood.push(dist([x, y], [body[0].x, body[0].y]))
        }
      })
      floodFillResults.push({ move, floodLengthLimited: testOnFlood.filter(distance => distance < floodFillDepth).length, floodLength: result.flooded.length })
    }
  })

  // console.log('flood fill results', result.flooded)
  console.log('flood fill results: ', floodFillResults)

  // get the move with the largest flood fill value
  var flagLimited = false
  var flag = false

  console.log('flag before', flag)
  console.log('flag limited before', flagLimited)

  var allLimitedLengths = []
  var allLengths = []
  floodFillResults.forEach(function (object) {
    allLimitedLengths.push(object.floodLengthLimited)
    allLengths.push(object.floodLength)
  })

  for (var i = 0; i < allLengths.length - 1; i++) {
    if (allLengths[i] !== allLengths[i + 1]) {
      flag = true
    }
  }
  for (var j = 0; j < allLimitedLengths.length - 1; j++) {
    if (allLimitedLengths[j] !== allLimitedLengths[j + 1]) {
      flagLimited = true
    }
  }

  var largestValueLimited = floodFillResults[0].floodLengthLimited
  var largestValue = floodFillResults[0].floodLength
  var largestMove = floodFillResults[0].move
  var largestMoveLimited = floodFillResults[0].move
  floodFillResults.forEach(function (object) {
    if (object.floodLengthLimited > largestValueLimited) {
      largestValueLimited = object.floodLengthLimited
      largestMoveLimited = object.move
    }
    if (object.floodLength > largestValue) {
      largestValue = object.floodLength
      largestMove = object.move
    }
  })

  console.log('flag after', flag)
  console.log('flag limited after', flagLimited)

  // generate a move
  if (cornerMove !== false) { // we are at a corner
    generatedMove = cornerMove
  } else {
    if (req.body.you.health < 85) { // we are hungry
      closestFood = foodSearch(req.body)
      console.log(closestFood)
      foodMove = pathToFood(closestFood, req.body, backupGrid, floodFillResults, flag, flagLimited, largestMove, largestMoveLimited)
      if (foodMove !== false) {
        generatedMove = foodMove
      } else {
        generatedMove = pathToTail(bodyParam, backupGrid, possibleMoves, floodFillResults)
      }
    } else { // find path to tail if not hungry
      tailMove = pathToTail(bodyParam, backupGrid, possibleMoves, flag, flagLimited, largestMove, largestMoveLimited)
      console.log('tail move:', tailMove)
      if (tailMove !== false && tailMove !== undefined) {
        generatedMove = tailMove
      }
    }
  }

  // last minute check
  if (generatedMove === false || generatedMove === undefined) {
    console.log('inside last min check')
    generatedMove = largestMoveLimited
  }

  // Response data
  var data = {
    move: generatedMove, // one of: ['up','down','left','right']
    taunt: taunts[Math.floor(Math.random()*taunts.length)]
  }

  return res.json(data)
})

// find and return the first move that leads to our tail
function pathToTail(data, grid, possibleMoves, flag, flagLimited, largestMove, largestMoveLimited) {
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

  console.log(gridBackup.nodes)

  var path = finder.findPath(bodyData[0].x, bodyData[0].y, bodyData[bodyData.length - 1].x, bodyData[bodyData.length - 1].y, gridBackup) 
  console.log('path', path)
  if (path.length === 0 || path.length === 1) {
    return false
  }

  if (path[1][0] === path[0][0]) { // same x coordinates
    if (path[1][1] !== path[0][1]) { // different y coordinates
      if (path[1][1] < path[0][1] && possibleMoves.includes('up')) {
        if (!flag && !flagLimited) {
          return 'up'
        } else if (largestMoveLimited === 'up') {
          return 'up'
        }
      } else if (path[1][1] > path[0][1] && possibleMoves.includes('down')) {
        if (!flag && !flagLimited) {
          return 'down'
        } else if (largestMoveLimited === 'down') {
          return 'down'
        }
      }
    }
  } else if (path[1][1] === path[0][1]) { // same y coordinates
    if (path[1][0] !== path[0][0]) { // different x coordinates
      if (path[1][0] > path[0][0] && possibleMoves.includes('right')) {
        if (!flag && !flagLimited) {
          return 'right'
        } else if (largestMoveLimited === 'right') {
          return 'right'
        }
      } else if (path[1][0] < path[0][0] && possibleMoves.includes('left')) {
        if (!flag && !flagLimited) {
          return 'left'
        } else if (largestMoveLimited === 'left') {
          return 'left'
        }
      }
    }
  }
}

function pathToFood(closestFood, data, grid, floodFillResults, flag, flagLimited, largestMove, largestMoveLimited) {
  var bodyData = data.you.body.data // body coordinates
  var snakes = data.snakes.data // snakes data
  var finder = new PF.AStarFinder()
  var gridBackup = grid.clone()

  console.log('flag', flag)
  console.log('flag limited', flagLimited)
  console.log('firstvalue:', largestMove)
  console.log('firstvalue limited:', largestMoveLimited)

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

  console.log('path', path)

  var checkPossibleMoves = []
  floodFillResults.forEach(function (object) {
    checkPossibleMoves.push(object.move)
  })

  console.log('checkpossiblemoves: ', checkPossibleMoves)
  
  if (path[1][0] === bodyData[0].x) { // don't turn left or right
    if (path[1][1] === bodyData[0].y - 1 && checkPossibleMoves.includes('up')) { // go up
      if (!flag && !flagLimited) {
        return 'up'
      } else if (largestMoveLimited === 'up') {
        return 'up'
      }
    } else if (path[1][1] === (bodyData[0].y + 1) && checkPossibleMoves.includes('down')) { // go down
      if (!flag && !flagLimited) {
        return 'down'
      } else if (largestMoveLimited === 'down') {
        return 'down'
      }
    }
  } else if (path[1][1] === bodyData[0].y) { // don't turn up or down
    if (path[1][0] === (bodyData[0].x - 1) && checkPossibleMoves.includes('left')) { // go left
      if (!flag && !flagLimited) {
        return 'left'
      } else if (largestMoveLimited === 'left') {
        return 'left'
      }
    } else if (path[1][0] === bodyData[0].x + 1 && checkPossibleMoves.includes('right')) { // go right
      if (!flag && !flagLimited) {
        return 'right'
      } else if (largestMoveLimited === 'right') {
        return 'right'
      }
    }
  }
}

// helper function to calculate the distance between two coordinate points
function distance(point1, point2) { // calculate distance between two points
  return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2))
}

function foodSearch(data) {
  var foodData = data.food.data // food
  var bodyData = data.you.body.data // body coordinates
  var distancesToFood = []
  var closestFood = []

  foodData.forEach(function (object) {
    distancesToFood.push(object)
    distancesToFood.push(distance(object, bodyData[0]))
  })

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
