var express = require('express')
var router  = express.Router()

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
  if (cornerMove !== false) {
    generatedMove = cornerMove;
  }

  // Response data
  var data = {
    move: generatedMove, // one of: ['up','down','left','right']
    taunt: 'Outta my way, snake!', // optional, but encouraged!
  }

  return res.json(data)
})

function checkCorners(data) {
  var bodyData = data.you.body.data
  console.log(bodyData);
  if (bodyData[0].x === 0 && bodyData[0].y === 0) { // top left corner
    console.log('top left')
    if (bodyData[1].y === 1) { // approaching from bottom
      return 'right'
    } else if (bodyData[1].x === 1) { // approaching from right
      return 'down'
    }
  } else if (bodyData[0].x === data.width - 1 && bodyData[0].y === 0) { // top right corner
    console.log('top right')
    if (bodyData[1].x === data.width - 2) { // approaching from left
      return 'down'
    } else if (bodyData[1].y === 1) { // approaching from botttom
      return 'left'
    }
  } else if (bodyData[0].x === 0 && bodyData[0].y === data.height - 1) { // bottom left corner
    console.log('bottom left')
    if (bodyData[1].y === data.height - 2) { // approaching from top
      return 'right'
    } else if (bodyData[1].x === 1) { // approaching from right
      return 'up'
    }
  } else if (bodyData[0].x === data.width - 1 && bodyData[0].y === data.height - 1) { // bottom right corner
    console.log('bottom right')
    if (bodyData[1].y === data.height - 2) { // approaching from top
      return 'left'
    } else if (bodyData[1].x === data.width - 2) { // approaching from left
      return 'up'
    }
  } else {
    return false;
  }
}

module.exports = router
