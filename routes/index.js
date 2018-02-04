var express = require('express')
var router  = express.Router()
var PF = require('pathfinding')

// Handle POST request to '/start'
router.post('/start', function (req, res) {
  // NOTE: Do something here to start the game

  // Response data
  var data = {
    color: "#DFFF00",
    name: "Spinmaaaasstaaaaa",
    head_url: "http://www.placecage.com/c/200/200", // optional, but encouraged!
    taunt: "Let's go for a spin", // optional, but encouraged!
  }

  return res.json(data)
})

// Handle POST request to '/move'
router.post('/move', function (req, res) {
  // NOTE: Do something here to generate your move
  var generatedMove = undefined
  var cornerMove = checkCorners(req.body)
  var possibleMoves = checkWalls(req.body)
  var body = req.body.you.body.data
  var grid = new PF.Grid(req.body.width, req.body.height)
  var closestFood = []
  var foodMove = ''
  var tailMove = ''

  if (cornerMove !== false) { // we are at a corner
    generatedMove = cornerMove
  } else if (possibleMoves !== false) { // we are at a wall
    if (req.body.you.health < 75) { // we are hungry
      closestFood = foodSearch(req.body)
      foodMove = pathToFood(closestFood, req.body, grid, possibleMoves)
      generatedMove = foodMove
    } else { // find path to tail
      tailMove = pathToTail(body, grid, possibleMoves)
      generatedMove = tailMove
    }
  } else { // at start move randomly (for now)
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

    if (req.body.you.health < 75) { // we are hungry
      closestFood = foodSearch(req.body)
      foodMove = pathToFood(closestFood, req.body, grid, possibleMoves)
      generatedMove = foodMove
    } else { // find path to tail
      tailMove = pathToTail(body, grid, possibleMoves)
      generatedMove = tailMove
    }
  }

  if (!possibleMoves.includes(generatedMove)) {
    generatedMove = possibleMoves[0]
  }

  // Response data
  var data = {
    move: generatedMove, // one of: ['up','down','left','right']
    taunt: 'Meet the spinmaaaaassstaaaaa',
  }

  return res.json(data)
})

function pathToTail(bodyData, grid, possibleMoves) {
  var finder = new PF.AStarFinder()
  var gridBackup = grid.clone()

  bodyData.forEach(function (object) {
    gridBackup.setWalkableAt(object.x, object.y, false)
  })
  gridBackup.setWalkableAt(bodyData[0].x, bodyData[0].y, true)
  gridBackup.setWalkableAt(bodyData[bodyData.length - 1].x, bodyData[bodyData.length - 1].y, true)
  var path = finder.findPath(bodyData[0].x, bodyData[0].y, bodyData[bodyData.length - 1].x, bodyData[bodyData.length - 1].y, gridBackup)
  
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
  var bodyData = data.you.body.data // body coordinates
  var finder = new PF.AStarFinder()
  var gridBackup = grid.clone()
  var path = finder.findPath(bodyData[0].x, bodyData[0].y, closestFood[1].x, closestFood[1].y, gridBackup)
  
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
