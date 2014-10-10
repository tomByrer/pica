'use strict';

/*
* Transfer values from buffer to values and
* from values to buffer
* horizontalFilter sends buffer values to values
* verticalFilter dens values to buffer values
* the values from outSum are subtracted from valueSum
* and value from inSum are added to valueSum
*
* inSum is the sum of values located to the right of the
* half of the box
* outSum is the sum of values located to the left of the
* half of the box
*
* By removing and adding the other, it's as we were moving from
* the left to the right mainting the right average.
*
* the valueSum is then taken from the cache to get a concrete pixel
*/
function convolveFilter(
  size,
  increment,
  bufferTo,
  bufferFrom,
  stack,
  index,
  radius,
  diameter,
  locationIndex,
  sums,
  mapping
) {
  var i, stackstart, offset, targetOffset, stackValue;
  var stackPointer = radius;
  var inSum    = sums[0];
  var outSum   = sums[1];
  var valueSum = sums[2];
  var divsum = (radius + 1) * (radius + 1);

  for (i = 0; i < size; i++ ) {
    // Store a computed value in a buffer
    // Either values or final buffer
    bufferTo[locationIndex] = valueSum / divsum |0;

    // remove old sum
    valueSum -= outSum;

    // use value from the stack
    // the stack is simply an accumulator that stores
    // rows or columns of the diameter of the box
    stackstart = stackPointer - radius + diameter;
    offset = (stackstart % diameter);
    stackValue = stack[offset];
    outSum -= stackValue;

    // transfer a concrete value to the stack
    targetOffset = index + mapping[i];
    stack[offset] = stackValue = bufferFrom[targetOffset];
    inSum += stackValue;
    valueSum += inSum;

    // calculate the pointer offset relative to the current
    // stackPointer
    stackPointer = (stackPointer + 1) % diameter;
    stackValue = stack[stackPointer];

    outSum += stackValue;
    inSum -= stackValue;

    locationIndex += increment;
  }
}

/*
 * Compute the sums for the box used for the blur effect
 *
 * inSum and outSum are the right and left halfs of the box.
 * valueSum is the sumValue modified by the coefficient rbs
 *
 * RBS is the value which should be contained in a box like this
 *
 *   [1 2 3 2 1]
 *
 * Vertically and horizontally as we are convolving twice
 */
function computeWindowSums(radius, index, bufferFrom, bufferTo, size, increment, secondIndex) {
  var i, locationIndex, offset, stackValue, rbs;
  var outSum = 0;
  var inSum  = 0;
  var valueSum = 0;
  var radiusPlus1 = radius + 1;

  for (i = -radius; i <= radius; i++) {
    // get first right x column for the window generation
    // yPointer is the height and x is the offset in x
    if (secondIndex >= 0) {
      locationIndex = index + Math.max(0, secondIndex);
    } else {
      locationIndex = index + Math.min(size , Math.max(i , 0));
    }

    offset = (i + radius);
    bufferTo[offset] = stackValue = bufferFrom[locationIndex];

    // get window coefficient
    rbs = radiusPlus1 - Math.abs(i);
    // Calculate the sums
    valueSum += stackValue * rbs;

    if (i > 0) {
      inSum += stackValue;
    } else {
      outSum += stackValue;
    }

    if (secondIndex >= 0 && i < size) {
      // increase the y pointer with the width offset
      secondIndex += increment;
    }
  }

  return [ inSum, outSum, valueSum ];
}

/*
* Map an index to neighbour pixel within the size
* radiusPlus1 is the radius of the box plus 1
* step is used to get rows or columns
*/
function generateMapping(size, radiusPlus1, step) {
  var maps = new Uint32Array(size);
  var i,
      sizeMinus1 = size - 1;

  for (i=0; i<size; i++) {
    maps[i] = Math.min(i + radiusPlus1, sizeMinus1) * step;
  }

  return maps;
}

/*
 * Filter the buffer horizontally
 */
function filterHorizontally(filter) {
  var y, locationIndex = 0, sums;

  var radiusPlus1 = filter.radius + 1;
  var diameter = filter.radius + radiusPlus1;
  var widthMinus1 = filter.width - 1;
  var mapping = generateMapping(filter.width, radiusPlus1, 1);

  for (y = 0; y < filter.height; y++ ) {
    // Compute the sums
    sums = computeWindowSums(filter.radius, locationIndex, filter.buffer, filter.stack, widthMinus1, -1, -1, -1);
    // Compute the concrete values for the current row
    // move values from the filter.buffer to filter.values
    convolveFilter(filter.width,
                   1,
                   filter.buffer,
                   filter.buffer,
                   filter.stack,
                   locationIndex,
                   filter.radius,
                   diameter,
                   locationIndex,
                   sums,
                   mapping);

    locationIndex += filter.width;
  }
}

/*
 * Filter the buffer vertically
 */
function filterVertically(filter) {
  var x, locationIndex, sums;

  var radiusPlus1 = filter.radius + 1;
  var diameter = filter.radius + radiusPlus1;
  var heightMinus1 = filter.height - 1;
  var mapping = generateMapping(filter.height, radiusPlus1, filter.width);

  for (x = 0; x < filter.width; x++) {
    locationIndex = x;
    // Compute the sums for the current row
    sums = computeWindowSums(
            filter.radius, locationIndex, filter.buffer, filter.stack,
            heightMinus1, filter.width, -filter.radius*filter.width);

    // Compute the concrete values for the current row
    // move values from the filter.values to filter.buffer
    convolveFilter(
      filter.height, filter.width, filter.buffer, filter.buffer,
      filter.stack, x, filter.radius, diameter, locationIndex, sums, mapping);
  }
}

/* main fastblur function which compute a blur effect on a src
 * buffer. It takes the width, height of the image.
 * The radius is the radius of the box which should be used
 * steps is the amount of times we should apply the filter
 * on the same buffer.
 *
 * It returns a filtered buffer without modifying the
 * buffer which passed by parameter.
 */
function fastblur(src, width, height, radius, steps) {
  steps = steps || 1;

  if (radius < 1) {
    // If radius is 0 then copy the buffer and return it
    return new Uint8Array(src);
  }

  var i;
  var radiusPlus1 = radius + 1;
  var diameter = radius + radiusPlus1;
  var divsum = radiusPlus1 * radiusPlus1 | 0;

  // The filter state object
  var filter = {
    buffer: new Uint8Array(src),
    stack: new Uint8Array(diameter),
    //values: new Uint8Array(width * height),
    radius: radius,
    width: width,
    height: height
  };

  // Compute division sums for each possible sums
  // Sums are precomputed and obtained by index
  // radius = 4
  // maxDivision = 256 * 10 = 2560
  // filter.divisionCache[10] = 10 / 10 = 1
  // filter.divisionCache[40] = 40 / 10 = 4
  // ...
  // filter.divisionCache[2550] = 2550 / 10 = 255
  // filter.divisionCache[2550] = 2559 / 10 = 255
  /*
  for (i = 0; i < maxDivision; i++){
    filter.divisionCache[i] = i / divsum | 0;
  }
  */

  // blur more steps time with the same radius
  for (i = 0; i < steps; i++) {
    filterHorizontally(filter);
    filterVertically(filter);
  }

  return filter.buffer;
}

module.exports = fastblur;
