'use strict';

//
// Motion blur can blur vertically or horizontally
//
function motionBlur(startIndex, increment, size, radius, buffer) {
  var sumValue = 0;
  var valueOut = buffer[startIndex];
  var i = 0;
  var diameter = radius + radius + 1;
  var windowStep = diameter * increment;
  var maxOffset = startIndex + (size - 1) * increment;
  var offset;

  sumValue = buffer[startIndex] * diameter;

  for (i=startIndex - windowStep; i<startIndex + size * increment; i += increment) {
    if (i >= startIndex) {
      offset = Math.max(startIndex, i);
      valueOut = buffer[i];
      buffer[i] = sumValue / diameter;
    }

    offset = Math.min(maxOffset, i + windowStep);
    sumValue += buffer[offset]
    sumValue -= valueOut;
  }
}

// 
// Filter the buffer horizontally
// 
function blurHorizontally(width, height, radius, buffer) {
  var y;

  for (y = 0; y < height; y++ ) {
    motionBlur(y * width, 1, width, radius, buffer);
  }
}

// 
// Filter the buffer vertically
// 
function blurVertically(width, height, radius, buffer) {
  var x;

  for (x = 0; x < width; x++) {
    motionBlur(x, width, height, radius, buffer);
  }
}

//
// It returns a blurred buffer without modifying the
// buffer which passed by parameter.
// 
function fastblur(src, width, height, radius, steps) {
  steps = steps || 1;
  var buffer = new Uint8Array(src);
  var i;
  var radiusPlus1 = radius + 1;
  var diameter = radius + radiusPlus1;

  // The filter state object
  var radius = radius;
  var width = width;
  var height = height;

  if (radius < 1) {
    // If radius is 0 then copy the buffer and return it
    return buffer;
  }

  // blur more steps time with the same radius
  for (i = 0; i < steps; i++) {
    blurHorizontally(width, height, radius, buffer);
    blurVertically(width, height, radius, buffer);
  }

  return buffer;
}

module.exports = fastblur;
