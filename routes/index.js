var express = require('express')
var router  = express.Router()
var PF = require('pathfinding')
var floodFill = require("n-dimensional-flood-fill")

// Handle POST request to '/start'
router.post('/start', function (req, res) {
  // NOTE: Do something here to start the game

  // Response data
  var data = {
    color: "#FFA07A",
    name: "Spinmaaaasstaaaaa",
    secondary_color: "#CD5C5C",
    head_url: "https://pbs.twimg.com/profile_images/914920708248969216/bLKIEQkS_400x400.jpg", // optional, but encouraged!
    // taunt: ["Can't beat Redbrickers at ping pong", "Meet the spinmaaaaassstaaaaa", "Let's go for a spinnnn"], // optional, but encouraged!
    tail_type: 'curled',
    head_type: 'shades'
  }

  return res.json(data)
})

// Handle POST request to '/move'
router.post('/move', function (req, res) {
  // NOTE: Do something here to generate your move
  var taunts = ["Can't beat Redbrickers at ping pong", "Meet the spinmaaaaassstaaaaa", "Let's go for a spinnnn"]
  var generatedMove = 'left'
  var cornerMove = checkCorners(req.body)
  var possibleMoves = checkWalls(req.body)
  var bodyParam = req.body
  var body = req.body.you.body.data
  var snakes = req.body.snakes.data
  var grid = new PF.Grid(req.body.width, req.body.height)
  var backupGrid = grid.clone()
  var closestFood = []
  var foodMove = ''
  var tailMove = ''
  var gridData = []

  // set all snake points as unwalkable in the backup grid
  body.forEach(function (object) {
    backupGrid.setWalkableAt(object.x, object.y, false)
  })

  snakes.forEach(function (snake) {
    snake.body.data.forEach(function (object) {
      console.log(object)
      backupGrid.setWalkableAt(object.x, object.y, false)
    })
  })
  
  backupGrid.nodes.forEach(function (node) {
    node.forEach(function (object) {
      gridData[object.x] = gridData[object.x] || []
      if (object.walkable) {
        gridData[object.x][object.y] = 1
      } else {
        gridData[object.x][object.y] = 0
      }
    })
  })

  // Define our getter for accessing the data structure
  var getter = function (x, y) {
    return gridData[y][x];
  };

  // Choose a start node. 
  var seed = [body[0].x, body[0].y];
  
  // Flood fill over the data structure. 
  var result = floodFill({
    getter: getter,
    seed: seed
  });
  
  // Get the flooded nodes from the result. 
  console.log('result: ', result.flooded)



  // generate a move logic
  if (cornerMove !== false) { // we are at a corner
    generatedMove = cornerMove
  } else if (possibleMoves !== false) { // we are at a wall
    if (req.body.you.health < 60) { // we are hungry
      closestFood = foodSearch(req.body)
      foodMove = pathToFood(closestFood, req.body, backupGrid, possibleMoves)
      if (foodMove !== false) {
        generatedMove = foodMove
      } else {
        generatedMove = pathToTail(bodyParam, backupGrid, possibleMoves)
      }
    } else { // find path to tail
      tailMove = pathToTail(bodyParam, backupGrid, possibleMoves)
      if (tailMove !== false) {
        generatedMove = tailMove
      } else {
        console.log('no path to tail, going to find food instead')
        generatedMove = pathToFood(closestFood, req.body, backupGrid, possibleMoves)
      }
    }
  } else {
    if (body[1].x === body[0].x - 1) { // left of my head
      possibleMoves = ['up', 'down', 'right']
    } else if (body[1].x === body[0].x + 1) { // right of my head
      possibleMoves = ['left', 'up', 'down']
    } else if (body[1].y === body[0].y - 1) { // up of my head
      possibleMoves = ['left', 'down', 'right']
    } else if (body[1].y === body[0].y + 1) { // down of my head
      possibleMoves = ['left', 'right', 'up']
    } else {
      possibleMoves = ['up', 'down', 'left', 'right']
    }

    if (req.body.you.health < 60) { // we are hungry
      console.log('not at a wall and hungry')
      closestFood = foodSearch(req.body)
      foodMove = pathToFood(closestFood, req.body, backupGrid, possibleMoves)
      if (foodMove !== false) {
        generatedMove = foodMove
      } else {
        generatedMove = pathToTail(bodyParam, backupGrid, possibleMoves)
      }
    } else { // find path to tail
      tailMove = pathToTail(bodyParam, backupGrid, possibleMoves)
      if (tailMove !== false) {
        generatedMove = tailMove
      } else {
        console.log('no path to tail, going to find food instead')
        generatedMove = pathToFood(closestFood, req.body, backupGrid, possibleMoves)
      }
    }
  }

  if (body[1].x === body[0].x - 1) { // left of my head
    possibleMoves = ['up', 'down', 'right']
  } else if (body[1].x === body[0].x + 1) { // right of my head
    possibleMoves = ['left', 'up', 'down']
  } else if (body[1].y === body[0].y - 1) { // up of my head
    possibleMoves = ['left', 'down', 'right']
  } else if (body[1].y === body[0].y + 1) { // down of my head
    possibleMoves = ['left', 'right', 'up']
  } else {
    possibleMoves = ['up', 'down', 'left', 'right']
  }

  console.log(possibleMoves)

  if (!possibleMoves.includes(generatedMove)) {
    generatedMove = possibleMoves[0]
  }

  // Response data
  var data = {
    move: generatedMove, // one of: ['up','down','left','right']
    taunt: taunts[Math.floor(Math.random()*taunts.length)]
  }

  return res.json(data)
})

function pathToTail(data, grid, possibleMoves) {
  var bodyData = data.you.body.data
  var finder = new PF.AStarFinder()
  var gridBackup = grid.clone()

  bodyData.forEach(function (object) {
    gridBackup.setWalkableAt(object.x, object.y, false)
  })

  data.snakes.data.forEach(function (snake) {
    snake.body.data.forEach(function (object) {
      console.log(object)
      gridBackup.setWalkableAt(object.x, object.y, false)
    })
  })

  gridBackup.setWalkableAt(bodyData[0].x, bodyData[0].y, true)
  gridBackup.setWalkableAt(bodyData[bodyData.length - 1].x, bodyData[bodyData.length - 1].y, true)

  var path = finder.findPath(bodyData[0].x, bodyData[0].y, bodyData[bodyData.length - 1].x, bodyData[bodyData.length - 1].y, gridBackup)
  if (path.length === 0) {
    return false
  }
  console.log(path)

  if (path[1][0] === path[0][0]) { // same x coordinates
    if (path[1][1] !== path[0][1]) { // different y coordinates
      if (path[1][1] < path[0][1] && possibleMoves.includes('up')) {
        return 'up'
      } else if (path[1][1] > path[0][1] && possibleMoves.includes('down')) {
        return 'down'
      }
    }
  } else if (path[1][1] === path[0][1]) { // same y coordinates
    if (path[1][0] !== path[0][0]) { // different x coordinates
      if (path[1][0] > path[0][0] && possibleMoves.includes('right')) {
        return 'right'
      } else if (path[1][0] < path[0][0] && possibleMoves.includes('left')) {
        return 'left'
      }
    }
  }
}

function pathToFood(closestFood, data, grid, possibleMoves) {
  console.log('closestFood: ', closestFood)
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
  
  if (path[1][0] === bodyData[0].x) { // don't turn left or right
    if (path[1][1] === bodyData[0].y - 1 && possibleMoves.includes('up')) { // go up
      return 'up'
    } else if (path[1][1] === (bodyData[0].y + 1) && possibleMoves.includes('down')) { // go down
      return 'down'
    }
  } else if (path[1][1] === bodyData[0].y) { // don't turn up or down
    if (path[1][0] === (bodyData[0].x - 1) && possibleMoves.includes('left')) { // go left
      return 'left'
    } else if (path[1][0] === bodyData[0].x + 1 && possibleMoves.includes('right')) { // go right
      return 'right'
    }
  }
}

function foodSearch(data) {
  var foodData = data.food.data // food
  var bodyData = data.you.body.data // body coordinates
  var distancesToFood = []
  var closestFood = []

  foodData.forEach(function (object) {
    distancesToFood.push(object, distance(object, bodyData[0]))
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

function distance(point1, point2) { // calculate distance between two points
  return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2))
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
